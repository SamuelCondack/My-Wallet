const {
  verifyBearerToken,
  getFirestore,
} = require("./_shared/firebaseAdmin.cjs");
const { getStripe, jsonResponse, handleOptions } = require("./_shared/stripe.cjs");
const {
  buildSubscriptionPatch,
  writeSubscription,
} = require("./_shared/subscriptionSync.cjs");

function customerIdOf(subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id || null;
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const decoded = await verifyBearerToken(event);
    const stripe = getStripe();
    const db = getFirestore();

    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const existing = userData.subscription || {};

    let subscription = null;

    // Only sync accounts already linked in Firestore — never claim by email.
    if (existing.stripeSubscriptionId) {
      subscription = await stripe.subscriptions.retrieve(
        existing.stripeSubscriptionId
      );
    } else if (existing.stripeCustomerId) {
      const list = await stripe.subscriptions.list({
        customer: existing.stripeCustomerId,
        status: "all",
        limit: 10,
      });
      subscription =
        list.data.find(
          (item) => item.status === "trialing" || item.status === "active"
        ) ||
        list.data[0] ||
        null;
    } else {
      return jsonResponse(404, {
        error: "No Stripe subscription linked to this account.",
        code: "NO_SUBSCRIPTION",
      });
    }

    if (!subscription) {
      return jsonResponse(404, {
        error: "No Stripe subscription found for this account.",
        code: "NO_SUBSCRIPTION",
      });
    }

    const linkedUid = subscription.metadata?.firebaseUid || null;
    if (linkedUid && linkedUid !== decoded.uid) {
      return jsonResponse(403, {
        error: "This Stripe subscription is linked to another account.",
        code: "SUBSCRIPTION_OWNED_ELSEWHERE",
      });
    }

    if (
      existing.stripeCustomerId &&
      customerIdOf(subscription) &&
      customerIdOf(subscription) !== existing.stripeCustomerId
    ) {
      return jsonResponse(403, {
        error: "Stripe customer mismatch for this account.",
        code: "CUSTOMER_MISMATCH",
      });
    }

    // Attach metadata only when missing — never reassign from another owner.
    if (!linkedUid) {
      await stripe.subscriptions.update(subscription.id, {
        metadata: {
          ...(subscription.metadata || {}),
          firebaseUid: decoded.uid,
        },
      });
    }

    const patch = buildSubscriptionPatch(subscription);
    await writeSubscription(db, decoded.uid, patch);

    return jsonResponse(200, {
      ok: true,
      subscription: {
        status: patch.status,
        planId: patch.planId,
        trialEndsAt: patch.trialEndsAt?.toMillis?.() || null,
        currentPeriodEnd: patch.currentPeriodEnd?.toMillis?.() || null,
        cancelAtPeriodEnd: Boolean(patch.cancelAtPeriodEnd),
      },
    });
  } catch (err) {
    console.error("sync-subscription failed:", err);
    return jsonResponse(err.statusCode || 500, {
      error: err.message || "Failed to sync subscription.",
      code: err.code || "SYNC_FAILED",
    });
  }
};

const {
  verifyBearerToken,
  getFirestore,
} = require("./_shared/firebaseAdmin.cjs");
const { getStripe, jsonResponse, handleOptions } = require("./_shared/stripe.cjs");
const {
  buildSubscriptionPatch,
  writeSubscription,
} = require("./_shared/subscriptionSync.cjs");

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

    if (existing.stripeSubscriptionId) {
      subscription = await stripe.subscriptions.retrieve(
        existing.stripeSubscriptionId
      );
    } else {
      let customerId = existing.stripeCustomerId || null;

      if (!customerId && decoded.email) {
        const customers = await stripe.customers.list({
          email: decoded.email,
          limit: 5,
        });
        customerId = customers.data[0]?.id || null;
      }

      if (customerId) {
        const list = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 10,
        });
        subscription =
          list.data.find(
            (item) => item.status === "trialing" || item.status === "active"
          ) || list.data[0] || null;
      }
    }

    if (!subscription) {
      return jsonResponse(404, {
        error: "No Stripe subscription found for this account.",
        code: "NO_SUBSCRIPTION",
      });
    }

    // Ensure metadata links back to this Firebase user
    if (subscription.metadata?.firebaseUid !== decoded.uid) {
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

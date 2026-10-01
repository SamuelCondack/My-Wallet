const { FieldValue, Timestamp } = require("firebase-admin/firestore");

function toTimestamp(seconds) {
  if (!seconds) return null;
  return Timestamp.fromMillis(seconds * 1000);
}

function mapSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "past_due";
    default:
      return "none";
  }
}

function buildSubscriptionPatch(subscription) {
  const status = mapSubscriptionStatus(subscription.status);
  const isProLike = status === "active" || status === "trialing";
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  const periodEnd =
    subscription.current_period_end ||
    subscription.items?.data?.[0]?.current_period_end ||
    subscription.billing_cycle_anchor ||
    null;

  return {
    status,
    planId: isProLike ? "pro_monthly" : "free",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id || null,
    priceId: subscription.items?.data?.[0]?.price?.id || null,
    trialEndsAt: toTimestamp(subscription.trial_end),
    currentPeriodEnd: toTimestamp(periodEnd),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
}

async function writeSubscription(db, uid, patch) {
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        subscription: {
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

async function findUid(db, { subscription, customerId, clientReferenceId }) {
  if (subscription?.metadata?.firebaseUid) {
    return subscription.metadata.firebaseUid;
  }
  if (clientReferenceId) return clientReferenceId;

  if (customerId) {
    const snap = await db
      .collection("users")
      .where("subscription.stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  return null;
}

async function syncSubscriptionFromStripe(db, subscription, extra = {}) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;

  const uid = await findUid(db, {
    subscription,
    customerId,
    clientReferenceId: extra.clientReferenceId,
  });

  if (!uid) {
    return null;
  }

  const patch = buildSubscriptionPatch(subscription);
  await writeSubscription(db, uid, patch);
  return { uid, patch };
}

module.exports = {
  toTimestamp,
  mapSubscriptionStatus,
  buildSubscriptionPatch,
  writeSubscription,
  findUid,
  syncSubscriptionFromStripe,
};

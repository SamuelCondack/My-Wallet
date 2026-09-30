const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getFirestore } = require("./_shared/firebaseAdmin.cjs");
const { getStripe, jsonResponse } = require("./_shared/stripe.cjs");

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

async function findUid({ subscription, customerId, clientReferenceId }) {
  if (subscription?.metadata?.firebaseUid) {
    return subscription.metadata.firebaseUid;
  }
  if (clientReferenceId) return clientReferenceId;

  if (customerId) {
    const db = getFirestore();
    const snap = await db
      .collection("users")
      .where("subscription.stripeCustomerId", "==", customerId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  return null;
}

async function writeSubscription(uid, patch) {
  const db = getFirestore();
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

async function syncSubscriptionFromStripe(subscription, extra = {}) {
  const uid = await findUid({
    subscription,
    customerId: subscription.customer,
    clientReferenceId: extra.clientReferenceId,
  });

  if (!uid) {
    console.warn(
      "stripe-webhook: could not resolve firebase uid for subscription",
      subscription.id
    );
    return;
  }

  const status = mapSubscriptionStatus(subscription.status);
  const isProLike = status === "active" || status === "trialing";

  await writeSubscription(uid, {
    status,
    planId: isProLike ? "pro_monthly" : "free",
    stripeCustomerId: subscription.customer || null,
    stripeSubscriptionId: subscription.id || null,
    priceId: subscription.items?.data?.[0]?.price?.id || null,
    trialEndsAt: toTimestamp(subscription.trial_end),
    currentPeriodEnd: toTimestamp(subscription.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return jsonResponse(503, {
      error: "STRIPE_WEBHOOK_SECRET is not configured.",
      code: "WEBHOOK_SECRET_MISSING",
    });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    return jsonResponse(503, { error: err.message, code: err.code });
  }

  const signature =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return jsonResponse(400, { error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );
          await syncSubscriptionFromStripe(subscription, {
            clientReferenceId: session.client_reference_id,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionFromStripe(stripeEvent.data.object);
        break;
      }
      default:
        break;
    }

    return jsonResponse(200, { received: true });
  } catch (err) {
    console.error("stripe-webhook handler failed:", err);
    return jsonResponse(500, {
      error: err.message || "Webhook handler failed.",
    });
  }
};

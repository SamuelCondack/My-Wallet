const { getFirestore } = require("./_shared/firebaseAdmin.cjs");
const {
  syncSubscriptionFromStripe,
} = require("./_shared/subscriptionSync.cjs");
const { getStripe, jsonResponse } = require("./_shared/stripe.cjs");

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
    const db = getFirestore();

    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription
          );
          await syncSubscriptionFromStripe(db, subscription, {
            clientReferenceId: session.client_reference_id,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscriptionFromStripe(db, stripeEvent.data.object);
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

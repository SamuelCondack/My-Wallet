const { FieldValue } = require("firebase-admin/firestore");
const { verifyBearerToken, getFirestore } = require("./_shared/firebaseAdmin.cjs");
const {
  getStripe,
  getPriceId,
  getTrialDays,
  jsonResponse,
  handleOptions,
  parseJsonBody,
  resolveAppRedirectUrl,
} = require("./_shared/stripe.cjs");

async function getOrCreateStripeCustomer({ stripe, uid, email, name, existingCustomerId }) {
  if (existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(existingCustomerId);
      if (!existing.deleted) return existing;
    } catch {
      // fall through and create a new customer
    }
  }

  return stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { firebaseUid: uid },
  });
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  try {
    const decoded = await verifyBearerToken(event);
    const body = parseJsonBody(event);
    const stripe = getStripe();
    const priceId = getPriceId();
    const trialDays = getTrialDays();
    const db = getFirestore();

    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const subscription = userData.subscription || {};

    const customer = await getOrCreateStripeCustomer({
      stripe,
      uid: decoded.uid,
      email: decoded.email || userData.email,
      name: userData.displayName || decoded.name,
      existingCustomerId: subscription.stripeCustomerId,
    });

    if (subscription.stripeCustomerId !== customer.id) {
      await userRef.set(
        {
          email: decoded.email || userData.email || null,
          updatedAt: FieldValue.serverTimestamp(),
          subscription: {
            ...(subscription || {}),
            status: subscription.status || "none",
            planId: subscription.planId || "free",
            stripeCustomerId: customer.id,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    }

    const successUrl = resolveAppRedirectUrl(
      body.successUrl,
      "/home/profile?checkout=success"
    );
    const cancelUrl = resolveAppRedirectUrl(
      body.cancelUrl,
      "/home/profile?checkout=cancel"
    );

    // One trial per account: skip trial if they already started/had a subscription.
    const alreadyUsedTrial = Boolean(
      subscription.stripeSubscriptionId ||
        ["trialing", "active", "past_due", "canceled"].includes(
          subscription.status || ""
        )
    );

    const subscriptionData = {
      metadata: { firebaseUid: decoded.uid },
    };
    if (!alreadyUsedTrial && trialDays > 0) {
      subscriptionData.trial_period_days = trialDays;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: decoded.uid,
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: subscriptionData,
      metadata: { firebaseUid: decoded.uid },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return jsonResponse(200, { url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("create-checkout failed:", err);
    return jsonResponse(err.statusCode || 500, {
      error: err.message || "Failed to create checkout session.",
      code: err.code || "CHECKOUT_FAILED",
    });
  }
};

const { verifyBearerToken, getFirestore } = require("./_shared/firebaseAdmin.cjs");
const {
  getStripe,
  jsonResponse,
  handleOptions,
  parseJsonBody,
} = require("./_shared/stripe.cjs");

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
    const db = getFirestore();

    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const subscription = userSnap.exists
      ? userSnap.data().subscription || {}
      : {};

    if (!subscription.stripeCustomerId) {
      return jsonResponse(400, {
        error: "No Stripe customer found. Start a trial first.",
        code: "NO_CUSTOMER",
      });
    }

    const origin = process.env.APP_URL || "http://localhost:8888";
    const returnUrl = body.returnUrl || `${origin}/home/profile`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return jsonResponse(200, { url: portal.url });
  } catch (err) {
    console.error("create-portal failed:", err);
    return jsonResponse(err.statusCode || 500, {
      error: err.message || "Failed to create billing portal session.",
      code: err.code || "PORTAL_FAILED",
    });
  }
};

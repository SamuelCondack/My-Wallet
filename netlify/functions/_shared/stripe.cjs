const Stripe = require("stripe");

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const error = new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY on the server."
    );
    error.code = "STRIPE_MISSING";
    error.statusCode = 503;
    throw error;
  }
  return new Stripe(key);
}

function getPriceId() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    const error = new Error(
      "Stripe price is not configured. Set STRIPE_PRICE_ID."
    );
    error.code = "STRIPE_PRICE_MISSING";
    error.statusCode = 503;
    throw error;
  }
  return priceId;
}

function getTrialDays() {
  const raw = process.env.STRIPE_TRIAL_DAYS || "7";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function handleOptions(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, {});
  }
  return null;
}

function parseJsonBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  getStripe,
  getPriceId,
  getTrialDays,
  jsonResponse,
  handleOptions,
  parseJsonBody,
};

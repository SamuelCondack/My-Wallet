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

function getAppOrigin() {
  return String(process.env.APP_URL || "http://localhost:8888").replace(
    /\/$/,
    ""
  );
}

/**
 * Only allow redirects back to APP_URL (same origin). Rejects open redirects.
 */
function resolveAppRedirectUrl(candidate, fallbackPath) {
  const origin = getAppOrigin();
  const fallback = `${origin}${fallbackPath.startsWith("/") ? "" : "/"}${fallbackPath}`;

  if (!candidate) return fallback;

  let parsed;
  try {
    parsed = new URL(String(candidate));
  } catch {
    const error = new Error("Invalid redirect URL.");
    error.statusCode = 400;
    error.code = "INVALID_REDIRECT";
    throw error;
  }

  let allowed;
  try {
    allowed = new URL(origin);
  } catch {
    const error = new Error("APP_URL is misconfigured.");
    error.statusCode = 503;
    error.code = "APP_URL_INVALID";
    throw error;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const error = new Error("Redirect URL must use http or https.");
    error.statusCode = 400;
    error.code = "INVALID_REDIRECT";
    throw error;
  }

  if (parsed.origin !== allowed.origin) {
    const error = new Error("Redirect URL must stay on the app origin.");
    error.statusCode = 400;
    error.code = "INVALID_REDIRECT";
    throw error;
  }

  return parsed.toString();
}

module.exports = {
  getStripe,
  getPriceId,
  getTrialDays,
  jsonResponse,
  handleOptions,
  parseJsonBody,
  getAppOrigin,
  resolveAppRedirectUrl,
};

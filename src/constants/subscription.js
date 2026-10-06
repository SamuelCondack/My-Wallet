import { FREE_FAVORITE_LIMIT } from "./quickAdd";

export const PLAN_ID = {
  FREE: "free",
  PRO_MONTHLY: "pro_monthly",
};

export const SUBSCRIPTION_STATUS = {
  NONE: "none",
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  INCOMPLETE: "incomplete",
};

export const TRIAL_DAYS = 7;
export const PRO_PRICE_LABEL = "$4.99/month";
export const PRO_PRICE_CENTS = 499;

export const DEFAULT_SUBSCRIPTION = {
  status: SUBSCRIPTION_STATUS.NONE,
  planId: PLAN_ID.FREE,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  priceId: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  updatedAt: null,
};

/**
 * Canonical Pro feature list — Profile, paywall, banners, and ProGate copy
 * should read from here. `shipped: false` = Soon (never "Included").
 */
export const PRO_FEATURES = [
  {
    id: "budgets",
    title: "Category budgets & alerts",
    shortLabel: "budgets",
    description: "Set monthly limits and get warned before you overspend.",
    shipped: true,
  },
  {
    id: "export",
    title: "CSV & PDF export",
    shortLabel: "CSV & PDF export",
    description:
      "Download expense CSV/PDF reports or a pending income PDF for collections.",
    shipped: true,
  },
  {
    id: "favorites",
    title: "Unlimited favorites",
    shortLabel: "unlimited favorites",
    description: `Save more than ${FREE_FAVORITE_LIMIT} quick-add favorites. Pro has no limit.`,
    shipped: true,
  },
  {
    id: "ocr",
    title: "Receipt photo capture",
    shortLabel: "receipt capture",
    description: "Snap a receipt and auto-fill amount, date, and merchant.",
    shipped: false,
  },
  {
    id: "ai_review",
    title: "AI month review",
    shortLabel: "AI review",
    description: "Get a clear critique of the month with practical tips.",
    shipped: false,
  },
];

export const PRO_FEATURE_IDS = PRO_FEATURES.map((feature) => feature.id);
export const PRO_FEATURES_SHIPPED = PRO_FEATURES.filter((feature) => feature.shipped);
export const PRO_FEATURES_SOON = PRO_FEATURES.filter((feature) => !feature.shipped);

export function getProFeature(id) {
  return PRO_FEATURES.find((feature) => feature.id === id) ?? null;
}

export function getProFeatureBadge(feature, { isPro = false } = {}) {
  if (!feature?.shipped) return "Soon";
  return isPro ? "Included" : "Pro";
}

function joinEnglish(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalizeSentence(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** e.g. "budgets, CSV & PDF export, and unlimited favorites" */
export function getProShippedSummary() {
  return joinEnglish(PRO_FEATURES_SHIPPED.map((feature) => feature.shortLabel));
}

/** e.g. "receipt capture and AI review" */
export function getProSoonSummary() {
  return joinEnglish(PRO_FEATURES_SOON.map((feature) => feature.shortLabel));
}

export const PRO_COPY = {
  trialLead: `${capitalizeSentence(getProShippedSummary())} — no charge today.`,
  subscribeLead: `${capitalizeSentence(getProShippedSummary())}. ${capitalizeSentence(getProSoonSummary())} coming soon.`,
  trialBanner: `${TRIAL_DAYS}-day trial · ${getProShippedSummary()} on Pro.`,
  favoritesPaywallTitle: "Unlimited favorites",
  favoritesPaywallMessage: `Free plan allows ${FREE_FAVORITE_LIMIT} favorites. Upgrade for ${getProShippedSummary()}.`,
};

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

/** i18n key for the localized price label (see pro.priceLabel in the catalogs). */
export const PRO_PRICE_LABEL_KEY = "pro.priceLabel";

/**
 * Canonical Pro feature list — Profile, paywall, banners, and ProGate copy
 * should read from here. `shipped: false` = Soon (never "Included").
 *
 * Text lives in the i18n catalogs: render with `t(feature.titleKey)`,
 * `t(feature.shortLabelKey)` and `t(feature.descriptionKey, { limit })`.
 */
export const PRO_FEATURES = [
  {
    id: "budgets",
    titleKey: "pro.feature.budgets.title",
    shortLabelKey: "pro.feature.budgets.short",
    descriptionKey: "pro.feature.budgets.description",
    shipped: true,
  },
  {
    id: "export",
    titleKey: "pro.feature.export.title",
    shortLabelKey: "pro.feature.export.short",
    descriptionKey: "pro.feature.export.description",
    shipped: true,
  },
  {
    id: "favorites",
    titleKey: "pro.feature.favorites.title",
    shortLabelKey: "pro.feature.favorites.short",
    descriptionKey: "pro.feature.favorites.description",
    /** Interpolation values for the translation keys above. */
    vars: { limit: FREE_FAVORITE_LIMIT },
    shipped: true,
  },
  {
    id: "ocr",
    titleKey: "pro.feature.ocr.title",
    shortLabelKey: "pro.feature.ocr.short",
    descriptionKey: "pro.feature.ocr.description",
    shipped: false,
  },
  {
    id: "ai_review",
    titleKey: "pro.feature.ai_review.title",
    shortLabelKey: "pro.feature.ai_review.short",
    descriptionKey: "pro.feature.ai_review.description",
    shipped: false,
  },
];

export const PRO_FEATURE_IDS = PRO_FEATURES.map((feature) => feature.id);
export const PRO_FEATURES_SHIPPED = PRO_FEATURES.filter((feature) => feature.shipped);
export const PRO_FEATURES_SOON = PRO_FEATURES.filter((feature) => !feature.shipped);

export function getProFeature(id) {
  return PRO_FEATURES.find((feature) => feature.id === id) ?? null;
}

/** Returns the i18n key for the badge: pro.badge.soon | included | pro */
export function getProFeatureBadgeKey(feature, { isPro = false } = {}) {
  if (!feature?.shipped) return "pro.badge.soon";
  return isPro ? "pro.badge.included" : "pro.badge.pro";
}

/**
 * Translation keys for shared Pro marketing copy. Resolve in the UI with
 * `t(PRO_COPY_KEYS.trialLead)`. `trialBanner` needs { days }, and
 * `favoritesPaywallMessage` needs { limit } (use FREE_FAVORITE_LIMIT).
 */
export const PRO_COPY_KEYS = {
  trialLead: "pro.copy.trialLead",
  subscribeLead: "pro.copy.subscribeLead",
  trialBanner: "pro.copy.trialBanner",
  favoritesPaywallTitle: "pro.copy.favoritesPaywallTitle",
  favoritesPaywallMessage: "pro.copy.favoritesPaywallMessage",
};

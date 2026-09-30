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
export const PRO_PRICE_LABEL = "$5/month";
export const PRO_PRICE_CENTS = 500;

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

/** Features reserved for Pro — used by paywall copy in Phase 0+. */
export const PRO_FEATURES = [
  {
    id: "budgets",
    title: "Category budgets & alerts",
    description: "Set monthly limits and get warned before you overspend.",
  },
  {
    id: "ocr",
    title: "Receipt photo capture",
    description: "Snap a receipt and auto-fill amount, date, and merchant.",
  },
  {
    id: "ai_review",
    title: "AI month review",
    description: "Get a clear critique of the month with practical tips.",
  },
  {
    id: "export",
    title: "PDF / CSV export",
    description: "Download a clean monthly report whenever you need it.",
  },
];

export const PRO_FEATURE_IDS = PRO_FEATURES.map((feature) => feature.id);

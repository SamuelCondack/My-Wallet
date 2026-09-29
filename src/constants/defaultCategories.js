export const CATEGORY_TYPE = {
  EXPENSE: "expense",
  INCOME: "income",
};

export const DEFAULT_CATEGORIES = [
  { id: "food", name: "Food", color: "#FF6B6B", icon: "🍔", type: CATEGORY_TYPE.EXPENSE },
  { id: "transport", name: "Transport", color: "#4ECDC4", icon: "🚗", type: CATEGORY_TYPE.EXPENSE },
  { id: "housing", name: "Housing", color: "#45B7D1", icon: "🏠", type: CATEGORY_TYPE.EXPENSE },
  { id: "health", name: "Health", color: "#96CEB4", icon: "💊", type: CATEGORY_TYPE.EXPENSE },
  { id: "leisure", name: "Leisure", color: "#FFEAA7", icon: "🎮", type: CATEGORY_TYPE.EXPENSE },
  { id: "subscriptions", name: "Subscriptions", color: "#DDA0DD", icon: "📱", type: CATEGORY_TYPE.EXPENSE },
  { id: "education", name: "Education", color: "#87CEEB", icon: "📚", type: CATEGORY_TYPE.EXPENSE },
  { id: "other", name: "Other", color: "#B0B0B0", icon: "📦", type: CATEGORY_TYPE.EXPENSE },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { id: "income-salary", name: "Salary", color: "#3e92eb", icon: "💼", type: CATEGORY_TYPE.INCOME },
  { id: "income-youtube", name: "YouTube", color: "#FF0000", icon: "▶️", type: CATEGORY_TYPE.INCOME },
  { id: "income-freelance", name: "Freelance", color: "#20c997", icon: "💻", type: CATEGORY_TYPE.INCOME },
  { id: "income-investment", name: "Investment", color: "#fd7e14", icon: "📈", type: CATEGORY_TYPE.INCOME },
  { id: "income-refund", name: "Refund", color: "#6f42c1", icon: "↩️", type: CATEGORY_TYPE.INCOME },
  { id: "income-other", name: "Other", color: "#B0B0B0", icon: "💰", type: CATEGORY_TYPE.INCOME },
];

export const DEFAULT_CATEGORY_ID = "other";
export const DEFAULT_INCOME_CATEGORY_ID = "income-other";

export const ALL_DEFAULT_CATEGORIES = [
  ...DEFAULT_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
];

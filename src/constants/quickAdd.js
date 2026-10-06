export const PAYMENT_METHODS = [
  "Credit Card",
  "Debit Card",
  "Money",
  "Pix",
];

/** Maps the English value stored in Firestore to its i18n key. */
export const PAYMENT_METHOD_LABEL_KEYS = {
  "Credit Card": "payment.creditCard",
  "Debit Card": "payment.debitCard",
  Money: "payment.money",
  Pix: "payment.pix",
};

/** Matches expense card colors in Expenses.module.scss */
export const PAYMENT_METHOD_COLORS = {
  "Credit Card": "#3e92eb",
  "Debit Card": "#c385d4",
  Money: "#347bc7",
  Pix: "#ebab3d",
};

/** Free users can keep this many expense favorites. Pro is unlimited. */
export const FREE_FAVORITE_LIMIT = 5;

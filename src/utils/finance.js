export function formatCurrency(value, locale = "pt-BR", currency = "BRL") {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

export function getLastNMonthKeys(count = 6, fromDate = new Date()) {
  const keys = [];
  const date = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }

  return keys;
}

export function getMonthLabel(monthKey) {
  const date = parseMonthKey(monthKey);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function getBudgetDocId(monthKey, categoryId) {
  return `${monthKey}_${categoryId}`;
}

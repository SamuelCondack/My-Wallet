export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

export function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Numeric expense search:
 * - "20"     → values whose string form starts with 20 (20, 20.01, 20.20…)
 * - "20.21"  → exact amount (with cents)
 * Returns false when the query is not a numeric pattern.
 */
export function matchesExpenseValueQuery(value, rawQuery) {
  const query = String(rawQuery || "")
    .trim()
    .replace(",", ".");

  if (!/^\d+(\.\d*)?$/.test(query)) {
    return false;
  }

  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return false;
  }

  // Full amount with cents → exact match only
  if (/^\d+\.\d+$/.test(query)) {
    const target = Number(query);
    if (Number.isNaN(target)) {
      return false;
    }
    return Math.round(amount * 100) === Math.round(target * 100);
  }

  // Prefix match on common string forms (raw + 2-decimal)
  const prefix = query.endsWith(".") ? query : query;
  return (
    String(amount).startsWith(prefix) || amount.toFixed(2).startsWith(prefix)
  );
}

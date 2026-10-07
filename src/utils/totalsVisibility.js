/** Whether an income/expense row should count toward on-screen totals. */
export function countsInTotals(item) {
  return !item?.excludedFromTotals;
}

export function normalizeExcludedMonths(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item || "").slice(0, 7))
        .filter((month) => /^\d{4}-\d{2}$/.test(month))
    ),
  ].sort();
}

/** Monthly / multi-installment expenses are one doc shown in many months. */
export function expenseUsesMonthScopedExclusion(expense) {
  return (
    Boolean(expense?.isMonthly) || Number(expense?.installments) > 1
  );
}

export function isExpenseExcludedInMonth(expense, monthKey) {
  if (!expense) return false;
  if (!expenseUsesMonthScopedExclusion(expense)) {
    return Boolean(expense.excludedFromTotals);
  }
  const months = normalizeExcludedMonths(expense.excludedMonths);
  if (monthKey && months.includes(monthKey)) return true;
  // Legacy: global flag before per-month exclusions existed.
  if (expense.excludedFromTotals && months.length === 0) return true;
  return false;
}

export function withExpenseExclusionForMonth(expense, monthKey) {
  return {
    ...expense,
    excludedFromTotals: isExpenseExcludedInMonth(expense, monthKey),
  };
}

export function nextExcludedMonths(expense, monthKey, excluded) {
  const months = new Set(normalizeExcludedMonths(expense?.excludedMonths));
  if (excluded) months.add(monthKey);
  else months.delete(monthKey);
  return [...months].sort();
}

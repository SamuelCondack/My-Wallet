/**
 * Financial-period vs cash-flow helpers.
 *
 * Income page / Earnings / Net Earnings filter by incomePeriod (YYYY-MM).
 * Cash flow filters by receivedDate (actual money movement).
 * Do not mix these.
 */

export const INCOME_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
};

/** Sum of all income belonging to a financial period (pending + confirmed). */
export function getEarnedIncome(incomes, period) {
  return sumBy(incomes, (item) => item.incomePeriod === period);
}

/** Confirmed income for a financial period (by incomePeriod, not receivedDate). */
export function getReceivedIncomeForFinancialPeriod(incomes, period) {
  return sumBy(
    incomes,
    (item) =>
      item.incomePeriod === period && item.status === INCOME_STATUS.CONFIRMED
  );
}

/** Pending income for a financial period. */
export function getPendingIncome(incomes, period) {
  return sumBy(
    incomes,
    (item) =>
      item.incomePeriod === period && item.status === INCOME_STATUS.PENDING
  );
}

/**
 * Net Earnings = Earned (includes pending) − expenses for the period.
 * Pending must NOT be added again on top of Earned.
 */
export function getNetEarnings(incomes, period, expensesTotal) {
  return getEarnedIncome(incomes, period) - (Number(expensesTotal) || 0);
}

/**
 * Cash received during a calendar period (YYYY-MM), based on receivedDate.
 * Intentionally independent from incomePeriod / Earnings.
 */
export function getCashReceived(incomes, cashPeriod) {
  return sumBy(
    incomes,
    (item) =>
      item.status === INCOME_STATUS.CONFIRMED &&
      Boolean(item.receivedDate) &&
      monthKeyFromDate(item.receivedDate) === cashPeriod
  );
}

/**
 * Cash out for a period. Prefer paidDate when present; fall back to inclusionDate
 * so existing expenses still contribute until a paidDate field is widely used.
 * Credit-card bill payments should NOT be recorded as a second expense.
 */
export function getCashOut(expenses, cashPeriod) {
  return (expenses || []).reduce((sum, item) => {
    const cashDate = item.paidDate || item.inclusionDate;
    if (!cashDate || monthKeyFromDate(cashDate) !== cashPeriod) {
      return sum;
    }
    // Expenses use `value`; keep amount as a fallback for future-shaped records.
    return sum + (Number(item.value ?? item.amount) || 0);
  }, 0);
}

export function getNetCashFlow(incomes, expenses, cashPeriod) {
  return getCashReceived(incomes, cashPeriod) - getCashOut(expenses, cashPeriod);
}

export function getIncomeSummaryForPeriod(incomes, period) {
  const earned = getEarnedIncome(incomes, period);
  const received = getReceivedIncomeForFinancialPeriod(incomes, period);
  const pending = getPendingIncome(incomes, period);
  return { earned, received, pending };
}

export function filterIncomes(incomes, { year, month, categoryId, status } = {}) {
  return incomes.filter((item) => {
    const [itemYear, itemMonth] = (item.incomePeriod || "").split("-");

    if (year && year !== "All" && itemYear !== year) {
      return false;
    }
    if (month && month !== "All" && itemMonth !== month) {
      return false;
    }
    if (categoryId && categoryId !== "All" && item.categoryId !== categoryId) {
      return false;
    }
    if (status && status !== "All" && item.status !== status) {
      return false;
    }
    return true;
  });
}

export function monthKeyFromDate(dateValue) {
  if (!dateValue || typeof dateValue !== "string") {
    return "";
  }
  // Date-only YYYY-MM-DD — take year-month without Date parsing (avoids TZ shifts).
  if (/^\d{4}-\d{2}/.test(dateValue)) {
    return dateValue.slice(0, 7);
  }
  return "";
}

export function formatPeriodLabel(period) {
  if (!period || !period.includes("-")) {
    return period || "";
  }
  const [year, month] = period.split("-");
  const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString(
    "default",
    { month: "long" }
  );
  return `${label} ${year}`;
}

export function formatDisplayDate(dateValue) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue || "";
  }
  const [year, month, day] = dateValue.split("-");
  return `${month}/${day}/${year}`;
}

/** Calendar input value for an incomePeriod (YYYY-MM → YYYY-MM-01). */
export function periodToDateInput(periodOrDate) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodOrDate || "")) {
    return periodOrDate;
  }
  if (/^\d{4}-\d{2}$/.test(periodOrDate || "")) {
    return `${periodOrDate}-01`;
  }
  return new Date().toLocaleDateString("en-CA");
}

/** Derive financial period YYYY-MM from a calendar date. */
export function dateInputToPeriod(dateValue) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) {
    return dateValue.slice(0, 7);
  }
  if (/^\d{4}-\d{2}$/.test(dateValue || "")) {
    return dateValue;
  }
  return "";
}

function sumBy(items, predicate) {
  return (items || []).reduce((sum, item) => {
    if (!predicate(item)) {
      return sum;
    }
    return sum + (Number(item.amount) || 0);
  }, 0);
}

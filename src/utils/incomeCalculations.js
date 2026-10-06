/**
 * Financial-period vs cash-flow helpers.
 *
 * Income page / Earnings / Net Earnings filter by incomePeriod (YYYY-MM).
 * Cash flow filters by receivedDate (actual money movement).
 * Do not mix these.
 */

import { countsInTotals } from "./totalsVisibility.js";

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
    if (!countsInTotals(item)) {
      return sum;
    }
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

/** Shift a YYYY-MM period by N calendar months. */
export function shiftPeriod(period, monthsToAdd) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || "";
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + Number(monthsToAdd || 0), 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of YYYY-MM periods from start to end. */
export function periodsFromTo(startPeriod, endPeriod) {
  if (!startPeriod || !/^\d{4}-\d{2}$/.test(startPeriod)) return [];
  if (!endPeriod || !/^\d{4}-\d{2}$/.test(endPeriod) || endPeriod < startPeriod) {
    return [startPeriod];
  }
  const out = [];
  let current = startPeriod;
  for (let i = 0; i < 120 && current <= endPeriod; i += 1) {
    out.push(current);
    current = shiftPeriod(current, 1);
  }
  return out;
}

/** Months between two YYYY-MM periods (can be negative). */
export function monthDiff(fromPeriod, toPeriod) {
  if (
    !fromPeriod ||
    !toPeriod ||
    !/^\d{4}-\d{2}$/.test(fromPeriod) ||
    !/^\d{4}-\d{2}$/.test(toPeriod)
  ) {
    return 0;
  }
  const [y1, m1] = fromPeriod.split("-").map(Number);
  const [y2, m2] = toPeriod.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Current calendar period + N months (default +2, same horizon as expenses). */
export function horizonEndPeriod(referenceDate = new Date(), monthsAhead = 2) {
  const period = `${referenceDate.getFullYear()}-${String(
    referenceDate.getMonth() + 1
  ).padStart(2, "0")}`;
  return shiftPeriod(period, monthsAhead);
}

/** Shift a YYYY-MM-DD date by N calendar months (clamps day). */
export function shiftDateOnly(dateValue, monthsToAdd) {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue || "";
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const targetMonthIndex = month - 1 + Number(monthsToAdd || 0);
  const lastDay = new Date(
    year + Math.floor(targetMonthIndex / 12),
    ((targetMonthIndex % 12) + 12) % 12 + 1,
    0
  ).getDate();
  const safeDay = Math.min(day, lastDay);
  const date = new Date(
    year,
    month - 1 + Number(monthsToAdd || 0),
    safeDay
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return "";
  }
  const raw = String(dateValue).trim();
  // YYYY-MM-DD (with optional time)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${month}/${day}/${year}`;
  }
  // Already MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  }
  return raw;
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
    if (!countsInTotals(item) || !predicate(item)) {
      return sum;
    }
    return sum + (Number(item.amount) || 0);
  }, 0);
}

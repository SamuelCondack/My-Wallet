const PERIOD_KEY = "mw_period_filters";
const PAGE_KEYS = {
  expenses: "mw_filters_expenses",
  income: "mw_filters_income",
};

const periodListeners = new Set();

function currentPeriodDefaults() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
  };
}

function readJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota — ignore; in-memory listeners still update.
  }
}

/** Shared year/month across Dashboard, Expenses, and Income for this tab session. */
export function getPeriodFilter() {
  const defaults = currentPeriodDefaults();
  const stored = readJson(PERIOD_KEY, defaults);
  return {
    year: stored.year || defaults.year,
    month: stored.month || defaults.month,
  };
}

export function setPeriodFilter(partial) {
  const next = {
    ...getPeriodFilter(),
    ...partial,
  };
  writeJson(PERIOD_KEY, next);
  periodListeners.forEach((listener) => listener(next));
  return next;
}

export function subscribePeriodFilter(listener) {
  periodListeners.add(listener);
  return () => periodListeners.delete(listener);
}

/** Page-only filters (category / status) that survive in-app navigation. */
export function getPageFilter(page, defaults) {
  return readJson(PAGE_KEYS[page], defaults);
}

export function setPageFilter(page, partial, defaults = {}) {
  const next = {
    ...getPageFilter(page, defaults),
    ...partial,
  };
  writeJson(PAGE_KEYS[page], next);
  return next;
}

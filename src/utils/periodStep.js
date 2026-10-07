/**
 * Step calendar month by `delta` (−1 / +1), wrapping years.
 * When year/month are "All" or missing, falls back to the provided defaults.
 */
export function shiftPeriodMonth(
  year,
  month,
  delta,
  fallbackYear,
  fallbackMonth
) {
  const baseYear = Number(
    year && year !== "All" ? year : fallbackYear
  );
  const baseMonth = Number(
    month && month !== "All" ? month : fallbackMonth
  );
  const safeYear = Number.isFinite(baseYear)
    ? baseYear
    : new Date().getFullYear();
  const safeMonth = Number.isFinite(baseMonth) ? baseMonth : 1;
  const next = new Date(safeYear, safeMonth - 1 + delta, 1);
  return {
    year: String(next.getFullYear()),
    month: String(next.getMonth() + 1).padStart(2, "0"),
  };
}

import { useCallback, useEffect, useState } from "react";
import {
  getPeriodFilter,
  setPeriodFilter,
  subscribePeriodFilter,
} from "../utils/sessionFilters";

/**
 * Year/month filters shared across Dashboard, Expenses, and Income.
 * Defaults to the current period on a fresh tab; afterwards persists in
 * sessionStorage until the app/tab is closed.
 *
 * URL overrides (deep links) win on first mount and are written back to session.
 */
export function useSessionPeriodFilter(urlOverrides = {}) {
  const [period, setPeriod] = useState(() => {
    const stored = getPeriodFilter();
    const year = urlOverrides.year || stored.year;
    const month = urlOverrides.month || stored.month;
    return { year, month };
  });

  useEffect(() => {
    if (urlOverrides.year || urlOverrides.month) {
      setPeriodFilter({
        year: urlOverrides.year || getPeriodFilter().year,
        month: urlOverrides.month || getPeriodFilter().month,
      });
    }
    // Seed once from deep-link URL if present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribePeriodFilter(setPeriod), []);

  const setSelectedYear = useCallback((year) => {
    setPeriodFilter({ year });
  }, []);

  const setSelectedMonth = useCallback((month) => {
    setPeriodFilter({ month });
  }, []);

  const setPeriodBoth = useCallback((year, month) => {
    setPeriodFilter({ year, month });
  }, []);

  return {
    selectedYear: period.year,
    selectedMonth: period.month,
    setSelectedYear,
    setSelectedMonth,
    setPeriodBoth,
  };
}

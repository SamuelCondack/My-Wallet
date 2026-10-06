import { useCallback, useRef, useState } from "react";

const SPLASH_MS = 520;

/**
 * Drives liquid-glass splash then persists excludedFromTotals.
 */
export function useExcludeFromTotalsToggle() {
  const [splashKey, setSplashKey] = useState(null);
  const timerRef = useRef(null);
  const pendingRef = useRef(new Set());

  const isInteractiveTarget = useCallback((target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "button, a, input, select, textarea, label, [data-no-exclude-toggle]"
      )
    );
  }, []);

  const runToggle = useCallback(async ({ key, currentlyExcluded, persist }) => {
    if (!key || pendingRef.current.has(key)) return;
    pendingRef.current.add(key);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const nextExcluded = !currentlyExcluded;
    if (nextExcluded) {
      setSplashKey(key);
      timerRef.current = setTimeout(() => {
        setSplashKey((prev) => (prev === key ? null : prev));
        timerRef.current = null;
      }, SPLASH_MS);
    } else {
      setSplashKey(null);
    }

    try {
      await persist(nextExcluded);
    } finally {
      pendingRef.current.delete(key);
    }
  }, []);

  return { splashKey, runToggle, isInteractiveTarget };
}

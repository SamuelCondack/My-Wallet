import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const EXPENSES_PATH = "/home/expenses";
const INCOME_PATH = "/home/income";

/** In-memory scroll Y per pathname (session-lived). */
const scrollMemory = new Map();

export function clearRouteScroll(pathname) {
  if (!pathname) return;
  scrollMemory.delete(pathname);
}

function readScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function writeScrollY(y) {
  const top = Math.max(0, Number(y) || 0);
  window.scrollTo(0, top);
}

function isExpensesIncomeSwap(fromPath, toPath) {
  return (
    (fromPath === EXPENSES_PATH && toPath === INCOME_PATH) ||
    (fromPath === INCOME_PATH && toPath === EXPENSES_PATH)
  );
}

/**
 * Remembers scroll per /home/* page and restores it on return.
 * Expenses ↔ Income always resets to the top (does not restore).
 */
export function useRouteScrollMemory() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    const nextPath = location.pathname;

    if (prevPath === nextPath) {
      return undefined;
    }

    scrollMemory.set(prevPath, readScrollY());

    const swap = isExpensesIncomeSwap(prevPath, nextPath);
    let targetY = 0;

    if (swap) {
      scrollMemory.delete(nextPath);
      targetY = 0;
    } else if (scrollMemory.has(nextPath)) {
      targetY = scrollMemory.get(nextPath) || 0;
    }

    prevPathRef.current = nextPath;

    // Wait a frame so the new page has painted before restoring.
    const id = window.requestAnimationFrame(() => {
      writeScrollY(targetY);
      // Second pass after layout (images / lists) settles a bit.
      window.requestAnimationFrame(() => writeScrollY(targetY));
    });

    return () => window.cancelAnimationFrame(id);
  }, [location.pathname]);
}

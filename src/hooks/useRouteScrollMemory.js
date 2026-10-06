import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** In-memory scroll Y per pathname (session-lived). */
const scrollMemory = new Map();

function readScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function writeScrollY(y) {
  const top = Math.max(0, Number(y) || 0);
  window.scrollTo(0, top);
}

/**
 * Remembers scroll per /home/* page and restores it on return.
 * First visit to a page scrolls to the top.
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

    const targetY = scrollMemory.has(nextPath)
      ? scrollMemory.get(nextPath) || 0
      : 0;

    prevPathRef.current = nextPath;

    const id = window.requestAnimationFrame(() => {
      writeScrollY(targetY);
      window.requestAnimationFrame(() => writeScrollY(targetY));
    });

    return () => window.cancelAnimationFrame(id);
  }, [location.pathname]);
}

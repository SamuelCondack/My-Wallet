import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import styles from "./FloatingMetricsDock.module.scss";

const MOBILE_MQ = "(max-width: 768px)";
const TOP_INSET_PX = 64;
const MENU_OPEN_ATTR = "data-mw-menu-open";
const DOCK_OPEN_ATTR = "data-mw-dock-open";
/** Ignore tiny scroll jitter when deciding hide/show direction. */
const DIRECTION_THRESHOLD_PX = 8;

function resolveFocusTarget(targetRefOrSelector) {
  if (!targetRefOrSelector || typeof document === "undefined") return null;
  const target =
    typeof targetRefOrSelector === "string"
      ? document.querySelector(targetRefOrSelector)
      : targetRefOrSelector.current;
  return target instanceof HTMLElement ? target : null;
}

/** Move focus + caret from the active field to `targetRefOrSelector`. */
function handoffFocusTo(targetRefOrSelector) {
  const target = resolveFocusTarget(targetRefOrSelector);
  if (!target) return false;

  const active = document.activeElement;
  let start = null;
  let end = null;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    try {
      start = active.selectionStart;
      end = active.selectionEnd;
    } catch {
      /* ignore */
    }
  }

  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }

  if (
    (target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement) &&
    typeof start === "number" &&
    typeof end === "number"
  ) {
    try {
      target.setSelectionRange(start, end);
    } catch {
      /* ignore */
    }
  }

  return document.activeElement === target;
}

function getScrollY() {
  return (
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0
  );
}

/**
 * True after Net Earnings (anchor) has scrolled past the top inset.
 * At the real top of the page this is always false.
 */
function isAnchorPastTop(anchor) {
  if (!(anchor instanceof HTMLElement)) return false;
  const rect = anchor.getBoundingClientRect();
  const scrolled = getScrollY() > 1 || rect.top < 0;
  return scrolled && rect.top < TOP_INSET_PX;
}

/**
 * Frosted floating dock — mobile only.
 *
 * Feature (embracing iOS keyboard/fixed limits):
 * - Scroll down → hide the dock
 * - Scroll up → show the dock (only while still past Net Earnings)
 * - Scroll back above Net Earnings → hide and, if the dock search had focus,
 *   hand focus to the in-page search at the top
 *
 * Page scroll stays unlocked; no visualViewport pinning / scroll-lock.
 */
export default function FloatingMetricsDock({
  anchorRef,
  metrics,
  filters,
  search,
  handoffSearchFocusTo,
  dockSearchFocusTo,
  enabled = true,
  ariaLabel,
  observeKey,
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_MQ).matches
      : false
  );
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchFocusedRef = useRef(false);
  const visibleRef = useRef(false);
  const pastAnchorRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const pageSearchRef = useRef(handoffSearchFocusTo);
  const dockSearchRef = useRef(dockSearchFocusTo);
  pageSearchRef.current = handoffSearchFocusTo;
  dockSearchRef.current = dockSearchFocusTo;

  const [menuOpen, setMenuOpen] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute(MENU_OPEN_ATTR) === "1"
      : false
  );

  const setDockVisible = (next) => {
    visibleRef.current = next;
    setVisible((prev) => (prev === next ? prev : next));
  };

  const handoffDockToPage = () => {
    if (!searchFocusedRef.current) return;
    handoffFocusTo(pageSearchRef.current);
    searchFocusedRef.current = false;
  };

  const handoffPageToDock = () => {
    const page = resolveFocusTarget(pageSearchRef.current);
    if (!(page instanceof HTMLElement)) return;
    if (document.activeElement !== page) return;
    const tryFocus = (attemptsLeft) => {
      if (handoffFocusTo(dockSearchRef.current)) {
        searchFocusedRef.current = true;
        return;
      }
      if (attemptsLeft > 0) {
        window.requestAnimationFrame(() => tryFocus(attemptsLeft - 1));
      }
    };
    window.requestAnimationFrame(() => tryFocus(8));
  };

  const dismissAboveNetEarnings = () => {
    const hadDockSearchFocus = searchFocusedRef.current;
    if (hadDockSearchFocus) {
      handoffDockToPage();
    }
    searchFocusedRef.current = false;
    setDockVisible(false);
  };

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const syncMenu = () => {
      setMenuOpen(
        document.documentElement.getAttribute(MENU_OPEN_ATTR) === "1"
      );
    };
    syncMenu();
    const observer = new MutationObserver(syncMenu);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [MENU_OPEN_ATTR],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled || !isMobile || menuOpen) {
      dismissAboveNetEarnings();
      pastAnchorRef.current = false;
      return undefined;
    }

    let io;
    let cancelled = false;
    let pollId = 0;
    let rafId = 0;

    lastScrollYRef.current = getScrollY();

    const apply = () => {
      if (cancelled) return;
      const anchor = anchorRef?.current;
      const pastTop = isAnchorPastTop(anchor);
      const y = getScrollY();
      const delta = y - lastScrollYRef.current;
      const wasPast = pastAnchorRef.current;
      pastAnchorRef.current = pastTop;

      if (Math.abs(delta) >= DIRECTION_THRESHOLD_PX) {
        lastScrollYRef.current = y;
      }

      // Back above Net Earnings → always dismiss; hand focus to page search
      // if the user was typing in the dock search.
      if (!pastTop) {
        if (visibleRef.current || searchFocusedRef.current) {
          dismissAboveNetEarnings();
        }
        return;
      }

      // Just crossed past Net Earnings → show once, handoff page → dock search.
      if (pastTop && !wasPast) {
        setDockVisible(true);
        handoffPageToDock();
        lastScrollYRef.current = y;
        return;
      }

      // Direction chrome while still past Net Earnings:
      // scroll down → hide, scroll up → show.
      if (delta > DIRECTION_THRESHOLD_PX) {
        if (visibleRef.current) {
          searchFocusedRef.current = false;
          setDockVisible(false);
        }
      } else if (delta < -DIRECTION_THRESHOLD_PX) {
        if (!visibleRef.current) {
          setDockVisible(true);
        }
      }
    };

    const applySoon = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(apply);
    };

    const connect = () => {
      const anchor = anchorRef?.current;
      if (!anchor || cancelled) return false;

      io = new IntersectionObserver(applySoon, {
        root: null,
        threshold: [0, 1],
        rootMargin: `-${TOP_INSET_PX}px 0px 0px 0px`,
      });
      io.observe(anchor);

      window.addEventListener("scroll", apply, { passive: true, capture: true });
      window.addEventListener("touchmove", applySoon, { passive: true });
      window.visualViewport?.addEventListener("resize", applySoon);
      window.visualViewport?.addEventListener("scroll", apply);

      apply();
      return true;
    };

    if (!connect()) {
      pollId = window.setInterval(() => {
        if (connect()) window.clearInterval(pollId);
      }, 80);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
      if (rafId) cancelAnimationFrame(rafId);
      io?.disconnect();
      window.removeEventListener("scroll", apply, { capture: true });
      window.removeEventListener("touchmove", applySoon);
      window.visualViewport?.removeEventListener("resize", applySoon);
      window.visualViewport?.removeEventListener("scroll", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handoff uses refs
  }, [anchorRef, enabled, isMobile, menuOpen, observeKey]);

  const show = enabled && isMobile && !menuOpen && visible;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (show) {
      document.documentElement.setAttribute(DOCK_OPEN_ATTR, "1");
      setMounted(true);
    } else {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
      const timeoutId = window.setTimeout(() => setMounted(false), 420);
      return () => window.clearTimeout(timeoutId);
    }
    return () => {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    };
  }, [show]);

  const handleSearchFocusCapture = () => {
    searchFocusedRef.current = true;
  };

  const handleSearchBlurCapture = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    searchFocusedRef.current = false;
  };

  if (typeof document === "undefined") return null;
  if (!mounted && !show) return null;

  return createPortal(
    <div
      className={`${styles.dock} ${show ? styles.dockVisible : ""}`}
      data-no-pull-refresh="true"
      role="region"
      aria-label={ariaLabel || "Summary"}
    >
      <div className={styles.dockVeil} aria-hidden="true" />
      <div className={styles.dockInner}>
        {filters ? <div className={styles.filters}>{filters}</div> : null}
        {metrics || search ? (
          <div className={styles.metrics}>
            {metrics}
            {search ? (
              <div
                className={styles.metricSearch}
                onFocusCapture={handleSearchFocusCapture}
                onBlurCapture={handleSearchBlurCapture}
              >
                {search}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

FloatingMetricsDock.propTypes = {
  anchorRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  metrics: PropTypes.node,
  filters: PropTypes.node,
  search: PropTypes.node,
  handoffSearchFocusTo: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  dockSearchFocusTo: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  enabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  observeKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export { styles as floatingMetricsDockStyles };

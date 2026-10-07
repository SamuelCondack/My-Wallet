import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import styles from "./FloatingMetricsDock.module.scss";

const MOBILE_MQ = "(max-width: 768px)";
const TOP_INSET_PX = 64;
const MENU_OPEN_ATTR = "data-mw-menu-open";
const DOCK_OPEN_ATTR = "data-mw-dock-open";

function resolveHandoffTarget(handoffSearchFocusTo) {
  if (!handoffSearchFocusTo || typeof document === "undefined") return null;
  const target =
    typeof handoffSearchFocusTo === "string"
      ? document.querySelector(handoffSearchFocusTo)
      : handoffSearchFocusTo.current;
  return target instanceof HTMLElement ? target : null;
}

/**
 * Move focus (and caret) to the in-page search before the dock unmounts so the
 * mobile keyboard can stay open across the handoff.
 */
function handoffFocusToPageSearch(handoffSearchFocusTo) {
  const target = resolveHandoffTarget(handoffSearchFocusTo);
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
 * Show only after Net Earnings (anchor) has scrolled past the top inset.
 * At the real top of the page (scrollY ≈ 0) always hide — even if a short
 * filtered layout leaves the anchor inside the inset band.
 */
function isAnchorPastTop(anchor) {
  if (!(anchor instanceof HTMLElement)) return false;
  const rect = anchor.getBoundingClientRect();
  const scrolled = getScrollY() > 1 || rect.top < 0;
  return scrolled && rect.top < TOP_INSET_PX;
}

/**
 * Frosted floating dock that fades in after `anchorRef` scrolls past the top.
 * Mobile-only. Keeps summary metrics + compact filters visible while editing cards.
 */
export default function FloatingMetricsDock({
  anchorRef,
  metrics,
  filters,
  search,
  handoffSearchFocusTo,
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchFocusedRef = useRef(false);
  const dockRef = useRef(null);
  const handoffToRef = useRef(handoffSearchFocusTo);
  handoffToRef.current = handoffSearchFocusTo;

  const [menuOpen, setMenuOpen] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute(MENU_OPEN_ATTR) === "1"
      : false
  );

  const clearFixedCaretHack = () => {
    const el = dockRef.current;
    if (!el) return;
    el.style.position = "";
    el.style.top = "";
  };

  /**
   * iOS Safari misplaces the caret in inputs inside position:fixed layers.
   * While the dock search is focused, pin the dock with position:absolute at
   * the current scroll offset so caret and glyphs stay aligned.
   */
  const applyFixedCaretHack = () => {
    const el = dockRef.current;
    if (!el) return;
    el.style.position = "absolute";
    el.style.top = `${getScrollY()}px`;
  };

  const handoffIfDockSearchFocused = () => {
    if (!searchFocusedRef.current) return;
    handoffFocusToPageSearch(handoffToRef.current);
    searchFocusedRef.current = false;
    setSearchFocused(false);
    clearFixedCaretHack();
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
      handoffIfDockSearchFocused();
      setVisible(false);
      return undefined;
    }

    let io;
    let ro;
    let cancelled = false;
    let pollId = 0;
    let rafId = 0;

    const applyVisibility = (pastTop) => {
      if (cancelled) return;
      if (!pastTop) {
        handoffIfDockSearchFocused();
      }
      setVisible((prev) => (prev === pastTop ? prev : pastTop));
    };

    const measure = () => {
      if (cancelled) return;
      applyVisibility(isAnchorPastTop(anchorRef?.current));
    };

    const measureSoon = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(measure);
      });
    };

    const connect = () => {
      const anchor = anchorRef?.current;
      if (!anchor || cancelled) return false;

      io = new IntersectionObserver(measure, {
        root: null,
        threshold: [0, 1],
        rootMargin: `-${TOP_INSET_PX}px 0px 0px 0px`,
      });
      io.observe(anchor);

      ro = new ResizeObserver(measureSoon);
      ro.observe(anchor);
      if (document.body) ro.observe(document.body);
      ro.observe(document.documentElement);

      window.addEventListener("scroll", measure, { passive: true });
      window.visualViewport?.addEventListener("resize", measureSoon);
      window.visualViewport?.addEventListener("scroll", measure);

      measure();
      measureSoon();
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
      ro?.disconnect();
      window.removeEventListener("scroll", measure);
      window.visualViewport?.removeEventListener("resize", measureSoon);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handoff uses refs
  }, [anchorRef, enabled, isMobile, menuOpen, observeKey]);

  // Hide for real when back above Net Earnings — never keep open just for focus.
  const show = enabled && isMobile && !menuOpen && visible;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (show) {
      document.documentElement.setAttribute(DOCK_OPEN_ATTR, "1");
      setMounted(true);
    } else {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
      clearFixedCaretHack();
      setSearchFocused(false);
      const timeoutId = window.setTimeout(() => setMounted(false), 420);
      return () => window.clearTimeout(timeoutId);
    }
    return () => {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    };
  }, [show]);

  const handleSearchFocusCapture = () => {
    searchFocusedRef.current = true;
    setSearchFocused(true);
    applyFixedCaretHack();
  };

  const handleSearchBlurCapture = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    searchFocusedRef.current = false;
    setSearchFocused(false);
    clearFixedCaretHack();
  };

  if (typeof document === "undefined") return null;
  if (!mounted && !show) return null;

  return createPortal(
    <div
      ref={dockRef}
      className={`${styles.dock} ${show ? styles.dockVisible : ""} ${
        searchFocused ? styles.dockSearchFocused : ""
      }`}
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
  enabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  observeKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export { styles as floatingMetricsDockStyles };

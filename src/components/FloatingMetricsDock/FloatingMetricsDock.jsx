import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import styles from "./FloatingMetricsDock.module.scss";

const MOBILE_MQ = "(max-width: 768px)";
const TOP_INSET_PX = 64;
const MENU_OPEN_ATTR = "data-mw-menu-open";
const DOCK_OPEN_ATTR = "data-mw-dock-open";

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
  const layout =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;
  const visualOffset = window.visualViewport?.offsetTop || 0;
  return layout + visualOffset;
}

/**
 * Show only after Net Earnings (anchor) has scrolled past the top inset.
 * At the real top of the page always hide — even if a short filtered layout
 * leaves the anchor inside the inset band.
 */
function isAnchorPastTop(anchor) {
  if (!(anchor instanceof HTMLElement)) return false;
  const rect = anchor.getBoundingClientRect();
  const vv = window.visualViewport;
  const topInVisual = vv ? rect.top - vv.offsetTop : rect.top;
  const scrolled = getScrollY() > 1 || rect.top < 0;
  return scrolled && topInVisual < TOP_INSET_PX;
}

function clearDockViewportPin(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.top = "";
  el.style.left = "";
  el.style.width = "";
  el.style.right = "";
}

/**
 * Pin a position:fixed element to the *visual* viewport top.
 * Needed only while the in-page search (outside the dock) keeps the keyboard
 * open — iOS then offsets the visual viewport so plain top:0 is wrong.
 */
function pinDockToVisualViewport(el) {
  if (!(el instanceof HTMLElement)) return;
  const vv = window.visualViewport;
  if (!vv) {
    clearDockViewportPin(el);
    return;
  }
  el.style.top = `${vv.offsetTop}px`;
  el.style.left = `${vv.offsetLeft}px`;
  el.style.width = `${vv.width}px`;
  el.style.right = "auto";
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
  const dockElRef = useRef(null);
  const pageSearchRef = useRef(handoffSearchFocusTo);
  const dockSearchRef = useRef(dockSearchFocusTo);
  pageSearchRef.current = handoffSearchFocusTo;
  dockSearchRef.current = dockSearchFocusTo;

  const [menuOpen, setMenuOpen] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute(MENU_OPEN_ATTR) === "1"
      : false
  );

  /**
   * JS visualViewport pinning lags one frame while scrolling and looks "loose".
   * Use it only while the *page* search is focused. Once the dock search owns
   * focus, native position:fixed is stable — clear the inline pin.
   */
  const syncDockPosition = () => {
    const el = dockElRef.current;
    if (!el || !visibleRef.current) return;

    const page = resolveFocusTarget(pageSearchRef.current);
    const dockSearch = resolveFocusTarget(dockSearchRef.current);
    const active = document.activeElement;

    if (
      dockSearch &&
      (active === dockSearch ||
        (active instanceof Node && dockSearch.contains(active)))
    ) {
      clearDockViewportPin(el);
      return;
    }

    if (page && active === page) {
      pinDockToVisualViewport(el);
      return;
    }

    clearDockViewportPin(el);
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
        // Drop the visualViewport pin — dock search focus uses native fixed.
        clearDockViewportPin(dockElRef.current);
        return;
      }
      if (attemptsLeft > 0) {
        window.requestAnimationFrame(() => tryFocus(attemptsLeft - 1));
      }
    };
    window.requestAnimationFrame(() => tryFocus(8));
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
      handoffDockToPage();
      visibleRef.current = false;
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
      const wasVisible = visibleRef.current;
      if (!pastTop && wasVisible) {
        handoffDockToPage();
      }
      visibleRef.current = pastTop;
      setVisible((prev) => (prev === pastTop ? prev : pastTop));
      if (pastTop && !wasVisible) {
        handoffPageToDock();
      }
      syncDockPosition();
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

      window.addEventListener("scroll", measure, { passive: true, capture: true });
      window.addEventListener("touchmove", measureSoon, { passive: true });
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
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("touchmove", measureSoon);
      window.visualViewport?.removeEventListener("resize", measureSoon);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handoff uses refs
  }, [anchorRef, enabled, isMobile, menuOpen, observeKey]);

  const show = enabled && isMobile && !menuOpen && visible;

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (show) {
      document.documentElement.setAttribute(DOCK_OPEN_ATTR, "1");
      setMounted(true);
      handoffPageToDock();
      syncDockPosition();
      const t1 = window.setTimeout(() => {
        handoffPageToDock();
        syncDockPosition();
      }, 50);
      return () => {
        window.clearTimeout(t1);
        document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
      };
    }
    clearDockViewportPin(dockElRef.current);
    document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    const timeoutId = window.setTimeout(() => setMounted(false), 420);
    return () => {
      window.clearTimeout(timeoutId);
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handoff uses refs
  }, [show]);

  const handleSearchFocusCapture = () => {
    searchFocusedRef.current = true;
    // Native fixed while typing in the dock — no JS viewport chasing.
    clearDockViewportPin(dockElRef.current);
  };

  const handleSearchBlurCapture = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    searchFocusedRef.current = false;
    syncDockPosition();
  };

  if (typeof document === "undefined") return null;
  if (!mounted && !show) return null;

  return createPortal(
    <div
      ref={(node) => {
        dockElRef.current = node;
        if (node && show) syncDockPosition();
      }}
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

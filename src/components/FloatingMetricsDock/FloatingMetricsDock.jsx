import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import styles from "./FloatingMetricsDock.module.scss";

const MOBILE_MQ = "(max-width: 768px)";
const TOP_INSET_PX = 64;
const MENU_OPEN_ATTR = "data-mw-menu-open";
const DOCK_OPEN_ATTR = "data-mw-dock-open";

const fadeTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
};

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
  const searchFocusedRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute(MENU_OPEN_ATTR) === "1"
      : false
  );

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
      setVisible(false);
      return undefined;
    }

    let observer;
    let cancelled = false;
    let pollId = 0;

    const connect = () => {
      const anchor = anchorRef?.current;
      if (!anchor || cancelled) return false;

      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          const pastTop =
            !entry.isIntersecting && entry.boundingClientRect.top < TOP_INSET_PX;
          setVisible(pastTop);
        },
        {
          root: null,
          threshold: 0,
          rootMargin: `-${TOP_INSET_PX}px 0px 0px 0px`,
        }
      );
      observer.observe(anchor);
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
      observer?.disconnect();
    };
  }, [anchorRef, enabled, isMobile, menuOpen, observeKey]);

  // Stay open while the dock search is focused so filtering/scroll jumps
  // do not unmount the input and dismiss the mobile keyboard.
  const show =
    enabled && isMobile && !menuOpen && (visible || searchFocused);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (show) {
      document.documentElement.setAttribute(DOCK_OPEN_ATTR, "1");
    } else {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    }
    return () => {
      document.documentElement.removeAttribute(DOCK_OPEN_ATTR);
    };
  }, [show]);

  const handoffFocusToPageSearch = () => {
    if (!handoffSearchFocusTo || typeof document === "undefined") return;
    const target =
      typeof handoffSearchFocusTo === "string"
        ? document.querySelector(handoffSearchFocusTo)
        : handoffSearchFocusTo.current;
    if (!(target instanceof HTMLElement)) return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  };

  const handleSearchFocusCapture = () => {
    searchFocusedRef.current = true;
    setSearchFocused(true);
  };

  const handleSearchBlurCapture = (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    searchFocusedRef.current = false;
    setSearchFocused(false);
    // If scroll already returned above the anchor, move focus to page search
    // so the keyboard can stay up on the top bar.
    if (!visible && handoffSearchFocusTo) {
      window.requestAnimationFrame(() => handoffFocusToPageSearch());
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (searchFocusedRef.current) {
          handoffFocusToPageSearch();
          searchFocusedRef.current = false;
        }
      }}
    >
      {show ? (
        <motion.div
          key="floating-metrics-dock"
          className={styles.dock}
          data-no-pull-refresh="true"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={fadeTransition}
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
        </motion.div>
      ) : null}
    </AnimatePresence>,
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

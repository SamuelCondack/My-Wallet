import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import styles from "./FloatingMetricsDock.module.scss";

const MOBILE_MQ = "(max-width: 768px)";
const TOP_INSET_PX = 64;
const MENU_OPEN_ATTR = "data-mw-menu-open";

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

  if (typeof document === "undefined") return null;

  const show = enabled && isMobile && visible && !menuOpen;

  return createPortal(
    <AnimatePresence>
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
          <div className={styles.dockInner}>
            {filters ? <div className={styles.filters}>{filters}</div> : null}
            {metrics ? <div className={styles.metrics}>{metrics}</div> : null}
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
  enabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  observeKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export { styles as floatingMetricsDockStyles };

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import styles from "./PullToRefresh.module.scss";

const THRESHOLD_PX = 92;
const MAX_PULL_PX = 128;
const RESISTANCE = 0.42;

function isInteractiveLock(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        '[role="dialog"]',
        ".ReactModal__Overlay",
        ".ReactModal__Content",
        "[data-no-pull-refresh]",
      ].join(", ")
    )
  );
}

function findScrollParent(start) {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 1;
    if (canScroll) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function resistancePull(dy) {
  const raw = Math.max(0, dy) * RESISTANCE;
  return Math.min(MAX_PULL_PX, raw * (1 - raw / (MAX_PULL_PX * 3.2)));
}

/**
 * Mobile Instagram/X-style pull-to-refresh: ball fills while pulling at top,
 * full fill reloads the page.
 */
function PullToRefresh({ enabled }) {
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!enabled || refreshing) return undefined;

    const setPull = (value) => {
      pullRef.current = value;
      setPullPx(value);
    };

    const onStart = (event) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch || isInteractiveLock(event.target)) {
        stateRef.current = null;
        return;
      }

      const scrollEl = findScrollParent(event.target);
      if ((scrollEl?.scrollTop || 0) > 1) {
        stateRef.current = null;
        return;
      }

      stateRef.current = {
        startY: touch.clientY,
        startX: touch.clientX,
        scrollEl,
        pulling: false,
        armed: true,
      };
    };

    const onMove = (event) => {
      const state = stateRef.current;
      if (!state?.armed || event.touches.length !== 1) return;

      const touch = event.touches[0];
      if (!touch) return;

      const dy = touch.clientY - state.startY;
      const dx = Math.abs(touch.clientX - state.startX);

      // Let horizontal edge gestures (menu) win.
      if (!state.pulling && dx > 18 && dx > dy) {
        state.armed = false;
        setPull(0);
        return;
      }

      const atTop = (state.scrollEl?.scrollTop || 0) <= 1;
      if (!atTop || dy <= 0) {
        if (state.pulling) {
          state.pulling = false;
          setPull(0);
        }
        return;
      }

      state.pulling = true;
      const pull = resistancePull(dy);
      setPull(pull);

      if (pull > 8) {
        event.preventDefault();
      }
    };

    const finish = () => {
      const state = stateRef.current;
      stateRef.current = null;
      if (!state?.pulling) {
        setPull(0);
        return;
      }

      if (pullRef.current >= THRESHOLD_PX) {
        setPull(THRESHOLD_PX);
        setRefreshing(true);
        window.setTimeout(() => {
          window.location.reload();
        }, 220);
        return;
      }

      setPull(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", finish, { passive: true });
    document.addEventListener("touchcancel", finish, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", finish);
    };
  }, [enabled, refreshing]);

  if (!enabled && !refreshing) return null;

  const progress = Math.min(1, pullPx / THRESHOLD_PX);
  const visible = refreshing || pullPx > 2;
  const circumference = 2 * Math.PI * 14;
  const dashOffset = circumference * (1 - (refreshing ? 1 : progress));

  return (
    <div
      className={`${styles.host} ${visible ? styles.visible : ""} ${
        refreshing ? styles.refreshing : ""
      }`}
      style={{
        transform: `translate3d(-50%, ${Math.max(
          pullPx * 0.55,
          refreshing ? 28 : 0
        )}px, 0)`,
      }}
      aria-hidden="true"
    >
      <div className={styles.ball}>
        <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true">
          <circle className={styles.track} cx="18" cy="18" r="14" />
          <circle
            className={styles.fill}
            cx="18"
            cy="18"
            r="14"
            style={{
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset: dashOffset,
            }}
          />
        </svg>
        <span
          className={`${styles.spinner} ${refreshing ? styles.spinnerOn : ""}`}
        />
      </div>
    </div>
  );
}

PullToRefresh.propTypes = {
  enabled: PropTypes.bool,
};

export default PullToRefresh;

import { useEffect } from "react";

/**
 * Nested-safe body scroll lock. Uses position:fixed (iOS) plus a non-passive
 * touchmove guard so the page behind a sheet cannot scroll when the keyboard
 * is open and an inner list has little/no overflow.
 */
let lockCount = 0;
let savedScrollY = 0;
let savedBody = null;
let touchStartY = 0;

function isScrollableY(el) {
  if (!(el instanceof HTMLElement)) return false;
  const { overflowY } = window.getComputedStyle(el);
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }
  return el.scrollHeight > el.clientHeight + 1;
}

function findScrollableParent(start) {
  let node = start instanceof Element ? start : start?.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollableY(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function onTouchStart(event) {
  if (event.touches.length === 1) {
    touchStartY = event.touches[0].clientY;
  }
}

function onTouchMove(event) {
  if (event.touches.length !== 1) return;

  const scrollable = findScrollableParent(event.target);
  if (!scrollable) {
    event.preventDefault();
    return;
  }

  const dy = event.touches[0].clientY - touchStartY;
  const atTop = scrollable.scrollTop <= 0;
  const atBottom =
    scrollable.scrollTop + scrollable.clientHeight >=
    scrollable.scrollHeight - 1;

  // Finger down → trying to pull content down (reveal above) → blocked at top.
  if (dy > 0 && atTop) {
    event.preventDefault();
    return;
  }
  // Finger up → trying to push content up → blocked at bottom.
  if (dy < 0 && atBottom) {
    event.preventDefault();
  }
}

function applyLock() {
  savedScrollY = window.scrollY || window.pageYOffset || 0;
  const { style } = document.body;
  savedBody = {
    overflow: style.overflow,
    position: style.position,
    top: style.top,
    left: style.left,
    right: style.right,
    width: style.width,
    paddingRight: style.paddingRight,
  };

  const scrollbarGap =
    window.innerWidth - document.documentElement.clientWidth;

  style.overflow = "hidden";
  style.position = "fixed";
  style.top = `-${savedScrollY}px`;
  style.left = "0";
  style.right = "0";
  style.width = "100%";
  if (scrollbarGap > 0) {
    style.paddingRight = `${scrollbarGap}px`;
  }

  document.documentElement.style.overflow = "hidden";

  document.addEventListener("touchstart", onTouchStart, {
    passive: true,
    capture: true,
  });
  document.addEventListener("touchmove", onTouchMove, {
    passive: false,
    capture: true,
  });
}

function releaseLock() {
  document.removeEventListener("touchstart", onTouchStart, { capture: true });
  document.removeEventListener("touchmove", onTouchMove, { capture: true });

  if (!savedBody) return;

  const { style } = document.body;
  style.overflow = savedBody.overflow;
  style.position = savedBody.position;
  style.top = savedBody.top;
  style.left = savedBody.left;
  style.right = savedBody.right;
  style.width = savedBody.width;
  style.paddingRight = savedBody.paddingRight;
  document.documentElement.style.overflow = "";
  window.scrollTo(0, savedScrollY);
  savedBody = null;
}

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return undefined;

    if (lockCount === 0) {
      applyLock();
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        releaseLock();
      }
    };
  }, [isLocked]);
}

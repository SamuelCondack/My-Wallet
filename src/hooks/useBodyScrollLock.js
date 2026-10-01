import { useEffect } from "react";

/**
 * Nested-safe body scroll lock.
 * Avoids position:fixed (it creates a tall blank gap under iOS bottom sheets).
 * Uses overflow:hidden + a non-passive touchmove guard so background pages
 * cannot scroll while a sheet/modal is open (including with the keyboard up).
 */
let lockCount = 0;
let savedBody = null;
let savedHtmlOverflow = "";
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

  if (dy > 0 && atTop) {
    event.preventDefault();
    return;
  }
  if (dy < 0 && atBottom) {
    event.preventDefault();
  }
}

function applyLock() {
  const { style } = document.body;
  savedBody = {
    overflow: style.overflow,
    overscrollBehavior: style.overscrollBehavior,
    touchAction: style.touchAction,
    paddingRight: style.paddingRight,
  };
  savedHtmlOverflow = document.documentElement.style.overflow;

  const scrollbarGap =
    window.innerWidth - document.documentElement.clientWidth;

  style.overflow = "hidden";
  style.overscrollBehavior = "none";
  style.touchAction = "none";
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
  style.overscrollBehavior = savedBody.overscrollBehavior;
  style.touchAction = savedBody.touchAction;
  style.paddingRight = savedBody.paddingRight;
  document.documentElement.style.overflow = savedHtmlOverflow;
  savedBody = null;
  savedHtmlOverflow = "";
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

import { useEffect } from "react";

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    const { style } = document.documentElement;
    const previousOverflow = style.overflow;

    style.overflow = "hidden";

    return () => {
      style.overflow = previousOverflow;
    };
  }, [isLocked]);
}

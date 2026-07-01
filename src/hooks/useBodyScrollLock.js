import { useEffect } from "react";

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }

    const scrollY = window.scrollY;
    const { style } = document.body;

    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.left = "0";
    style.right = "0";
    style.overflow = "hidden";
    style.width = "100%";

    return () => {
      style.position = "";
      style.top = "";
      style.left = "";
      style.right = "";
      style.overflow = "";
      style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
}

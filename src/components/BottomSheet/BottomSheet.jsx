import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import styles from "./BottomSheet.module.scss";

/* Close only when dragged well down — mid release springs back smoothly. */
const CLOSE_DISTANCE = 160;
const CLOSE_VELOCITY = 1100;

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  labelledBy,
  className = "",
  lockScroll = true,
  zIndex,
}) {
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [entered, setEntered] = useState(false);
  /* Settled = no CSS transform on the sheet. Inputs inside a transformed
     ancestor jank hard in Chromium. */
  const [settled, setSettled] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [returning, setReturning] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const sheetRef = useRef(null);
  const dragYRef = useRef(0);
  const closingFromDragRef = useRef(false);
  const dragRef = useRef({
    pointerId: null,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
  });

  useBodyScrollLock(Boolean(isOpen && lockScroll && rendered));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      closingFromDragRef.current = false;
      setDismissing(false);
      setRendered(true);
      setSettled(false);
      setDragging(false);
      setReturning(false);
      setDragY(0);
      dragYRef.current = 0;
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(id);
    }

    setSettled(false);
    setDragging(false);
    setReturning(false);

    if (closingFromDragRef.current) {
      /* Drag dismiss already animating off-screen via dragY. */
      return undefined;
    }

    setDismissing(false);
    setDragY(0);
    dragYRef.current = 0;
    const id = window.requestAnimationFrame(() => setEntered(false));
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  const finishUnmount = () => {
    closingFromDragRef.current = false;
    setDismissing(false);
    setEntered(false);
    setRendered(false);
    setDragY(0);
    dragYRef.current = 0;
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== sheetRef.current) return;
    if (event.propertyName !== "transform") return;

    if (dismissing) {
      finishUnmount();
      return;
    }

    if (returning) {
      setReturning(false);
      setDragY(0);
      dragYRef.current = 0;
      if (isOpen && entered) {
        setSettled(true);
      }
      return;
    }

    if (isOpen && entered && !dragging) {
      setSettled(true);
      setDragY(0);
      dragYRef.current = 0;
      return;
    }

    if (!isOpen && !entered) {
      setRendered(false);
      setDragY(0);
      dragYRef.current = 0;
    }
  };

  const onHandlePointerDown = (event) => {
    if (dismissing) return;
    event.preventDefault();
    const y = event.clientY;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: y,
      lastY: y,
      lastT: performance.now(),
      velocity: 0,
    };
    setSettled(false);
    setReturning(false);
    setDragging(true);
    setDragY(0);
    dragYRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const y = event.clientY;
    const now = performance.now();
    const dt = Math.max(now - drag.lastT, 1);
    const dy = y - drag.startY;
    drag.velocity = ((y - drag.lastY) / dt) * 1000;
    drag.lastY = y;
    drag.lastT = now;
    const next = Math.max(0, dy);
    dragYRef.current = next;
    setDragY(next);
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    drag.pointerId = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }

    const currentY = dragYRef.current;
    const shouldClose =
      currentY > CLOSE_DISTANCE || drag.velocity > CLOSE_VELOCITY;

    setDragging(false);

    if (shouldClose) {
      const sheetHeight = sheetRef.current?.offsetHeight || window.innerHeight;
      closingFromDragRef.current = true;
      setDismissing(true);
      window.requestAnimationFrame(() => {
        const off = Math.max(currentY, sheetHeight + 48);
        dragYRef.current = off;
        setDragY(off);
      });
      onClose();
      return;
    }

    if (currentY <= 1) {
      setDragY(0);
      dragYRef.current = 0;
      setSettled(true);
      return;
    }

    setReturning(true);
    window.requestAnimationFrame(() => {
      setDragY(0);
      dragYRef.current = 0;
    });
  };

  if (!mounted || !rendered) return null;

  const sheetClass = [
    styles.sheet,
    entered && !dismissing ? styles.sheetEntered : "",
    settled && !dragging && !returning && !dismissing
      ? styles.sheetSettled
      : "",
    dragging ? styles.sheetDragging : "",
    returning || dismissing ? styles.sheetReturning : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const sheetStyle =
    dragging || returning || dismissing || dragY > 0
      ? { transform: `translateY(${dragY}px)` }
      : undefined;

  return createPortal(
    <div
      className={styles.root}
      style={zIndex != null ? { zIndex } : undefined}
      role="presentation"
    >
      <button
        type="button"
        className={`${styles.backdrop} ${
          entered && !dismissing ? styles.backdropVisible : ""
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div className={styles.sheetRail}>
        <div
          ref={sheetRef}
          className={sheetClass}
          style={sheetStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          onTransitionEnd={handleTransitionEnd}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={styles.handleHit}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-hidden="true"
          >
            <div className={styles.handle} />
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

BottomSheet.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  labelledBy: PropTypes.string,
  className: PropTypes.string,
  lockScroll: PropTypes.bool,
  zIndex: PropTypes.number,
};

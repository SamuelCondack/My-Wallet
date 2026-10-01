import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import styles from "./BottomSheet.module.scss";

const CLOSE_OFFSET = 110;

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
     ancestor jank hard in Chromium — Framer's translateY(0) was enough. */
  const [settled, setSettled] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const sheetRef = useRef(null);
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
      setRendered(true);
      setSettled(false);
      setDragging(false);
      setDragY(0);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(id);
    }

    setSettled(false);
    setDragging(false);
    setDragY(0);
    const id = window.requestAnimationFrame(() => setEntered(false));
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  const handleTransitionEnd = (event) => {
    if (event.target !== sheetRef.current) return;
    if (event.propertyName !== "transform") return;

    if (isOpen && entered && !dragging) {
      setSettled(true);
      setDragY(0);
      return;
    }

    if (!isOpen && !entered) {
      setRendered(false);
    }
  };

  const onHandlePointerDown = (event) => {
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
    setDragging(true);
    setDragY(0);
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
    setDragY(Math.max(0, dy));
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

    const shouldClose =
      dragY > CLOSE_OFFSET || drag.velocity > 700;

    setDragging(false);

    if (shouldClose) {
      onClose();
      return;
    }

    if (dragY <= 1) {
      setDragY(0);
      setSettled(true);
      return;
    }

    setDragY(0);
  };

  if (!mounted || !rendered) return null;

  const sheetClass = [
    styles.sheet,
    entered ? styles.sheetEntered : "",
    settled && !dragging ? styles.sheetSettled : "",
    dragging ? styles.sheetDragging : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const sheetStyle =
    dragging || dragY > 0
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
        className={`${styles.backdrop} ${entered ? styles.backdropVisible : ""}`}
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

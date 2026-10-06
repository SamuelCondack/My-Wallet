import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useT } from "../../i18n/useT";
import styles from "./ProWelcomeCelebration.module.scss";

const BLOBS = [styles.blobA, styles.blobB, styles.blobC];

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const letters = parts.map((part) => part[0]?.toUpperCase()).join("");
  return letters || "MW";
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ProWelcomeCelebration({
  open,
  onDone,
  userName = "",
  photoURL = null,
  isTrial = true,
}) {
  const t = useT();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("idle");

  const firstName = String(userName || "")
    .trim()
    .split(/\s+/)[0];
  const initials = getInitials(userName);
  const showPhoto = Boolean(photoURL) && !photoFailed;

  const closeNow = useCallback(() => {
    setVisible(false);
    setMounted(false);
    setPhase("idle");
    onDone?.();
  }, [onDone]);

  const finish = useCallback(() => {
    if (phase !== "idle") return;
    if (prefersReducedMotion()) {
      closeNow();
      return;
    }
    setPhase("leaving");
  }, [phase, closeNow]);

  useEffect(() => {
    if (!open) {
      setMounted(false);
      setVisible(false);
      setPhase("idle");
      return undefined;
    }

    setPhotoFailed(false);
    setPhase("idle");
    setMounted(true);

    const raf = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [open, photoURL]);

  useEffect(() => {
    if (phase !== "leaving") return undefined;
    const timer = window.setTimeout(() => {
      closeNow();
    }, 780);
    return () => window.clearTimeout(timer);
  }, [phase, closeNow]);

  useEffect(() => {
    if (!mounted || phase !== "idle") return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, phase, finish]);

  if (typeof document === "undefined" || !mounted) return null;

  const rootClass = [
    styles.root,
    visible ? styles.rootVisible : "",
    phase === "leaving" ? styles.rootLeaving : "",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className={rootClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-title"
    >
      <div className={styles.liquid} aria-hidden="true">
        {BLOBS.map((blobClass) => (
          <span key={blobClass} className={`${styles.blob} ${blobClass}`} />
        ))}
        <div className={styles.sheen} />
      </div>

      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.stage}>
        <div className={styles.card}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarFrame}>
              <div className={styles.avatarFallback} aria-hidden="true">
                {initials}
              </div>
              {showPhoto && (
                <img
                  key={photoURL}
                  src={photoURL}
                  alt=""
                  className={styles.avatarImage}
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoFailed(true)}
                />
              )}
            </div>
            <span className={styles.proChip} aria-hidden="true">
              {t("common.pro")}
            </span>
          </div>

          <p className={styles.kicker}>{t("proWelcome.kicker")}</p>
          <h2 id="pro-welcome-title" className={styles.title}>
            {firstName
              ? t("proWelcome.titleNamed", { name: firstName })
              : t("proWelcome.title")}
          </h2>
          <p className={styles.subtitle}>
            {isTrial
              ? t("proWelcome.subtitleTrial")
              : t("proWelcome.subtitleActive")}
          </p>

          <button
            type="button"
            className={styles.cta}
            onClick={finish}
            disabled={phase !== "idle"}
          >
            {t("proWelcome.cta")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

ProWelcomeCelebration.propTypes = {
  open: PropTypes.bool.isRequired,
  onDone: PropTypes.func,
  userName: PropTypes.string,
  photoURL: PropTypes.string,
  isTrial: PropTypes.bool,
};

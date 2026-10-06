import { useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import {
  PRO_FEATURES_SHIPPED,
  PRO_PRICE_LABEL_KEY,
  TRIAL_DAYS,
} from "../../constants/subscription";
import { startCheckout, openStripeSession } from "../../services/subscriptionService";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useT } from "../../i18n/useT";
import styles from "./PaywallModal.module.scss";

export default function PaywallModal({
  isOpen,
  onClose,
  title,
  message,
  canStartTrial = true,
}) {
  const t = useT();
  const [isStarting, setIsStarting] = useState(false);
  useBodyScrollLock(Boolean(isOpen));

  if (!isOpen) return null;

  const priceLabel = t(PRO_PRICE_LABEL_KEY);
  const resolvedTitle = title || t("paywall.title");
  const resolvedMessage =
    message ||
    (canStartTrial ? t("paywall.messageTrial") : t("paywall.message"));

  const trustLine = canStartTrial
    ? t("paywall.thenPrice", { price: priceLabel })
    : t("paywall.secureCheckout");

  const ctaLabel = canStartTrial
    ? t("paywall.startTrial", { days: TRIAL_DAYS })
    : t("paywall.getPro", { price: priceLabel });

  const handleCheckout = async () => {
    setIsStarting(true);
    try {
      await openStripeSession(() => startCheckout());
      onClose();
    } catch (err) {
      console.error(err);
      let message = err?.message;
      if (err?.code === "auth_required") message = t("toast.needSignIn");
      else if (err?.code === "url_missing") message = t("profile.billingUrlMissing");
      toast.error(message || t("paywall.billingNotConfigured"));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ×
        </button>

        <p className={styles.eyebrow}>{t("paywall.eyebrow")}</p>
        <h2 id="paywall-title">{resolvedTitle}</h2>
        <p className={styles.message}>{resolvedMessage}</p>

        <ul className={styles.featureList}>
          {PRO_FEATURES_SHIPPED.map((feature) => (
            <li key={feature.id}>
              <strong>{t(feature.titleKey)}</strong>
              <span>{t(feature.descriptionKey, feature.vars)}</span>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleCheckout}
            disabled={isStarting}
          >
            {isStarting ? t("common.opening") : ctaLabel}
          </button>
          <p className={styles.price}>{trustLine}</p>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={isStarting}
          >
            {t("paywall.notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}

PaywallModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
  canStartTrial: PropTypes.bool,
};

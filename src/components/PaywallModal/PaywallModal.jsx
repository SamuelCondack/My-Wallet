import { useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { PRO_FEATURES_SHIPPED, PRO_PRICE_LABEL, TRIAL_DAYS } from "../../constants/subscription";
import { startCheckout, openStripeSession } from "../../services/subscriptionService";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import styles from "./PaywallModal.module.scss";

export default function PaywallModal({
  isOpen,
  onClose,
  title = "Unlock MyWallet Pro",
  message,
  canStartTrial = true,
}) {
  const [isStarting, setIsStarting] = useState(false);
  useBodyScrollLock(Boolean(isOpen));

  if (!isOpen) return null;

  const resolvedMessage =
    message ||
    (canStartTrial
      ? "Get the tools that make tracking effortless — no charge today."
      : "Get the tools that make tracking effortless.");

  const trustLine = canStartTrial
    ? `Then ${PRO_PRICE_LABEL}. Cancel anytime.`
    : "Secure checkout · Cancel anytime";

  const ctaLabel = canStartTrial
    ? `Start ${TRIAL_DAYS}-day free trial`
    : `Get Pro — ${PRO_PRICE_LABEL}`;

  const handleCheckout = async () => {
    setIsStarting(true);
    try {
      await openStripeSession(() => startCheckout());
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(
        err.message ||
          "Billing is not configured yet. Add Stripe keys to enable checkout."
      );
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
          aria-label="Close"
        >
          ×
        </button>

        <p className={styles.eyebrow}>MyWallet Pro</p>
        <h2 id="paywall-title">{title}</h2>
        <p className={styles.message}>{resolvedMessage}</p>

        <ul className={styles.featureList}>
          {PRO_FEATURES_SHIPPED.map((feature) => (
            <li key={feature.id}>
              <strong>{feature.title}</strong>
              <span>{feature.description}</span>
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
            {isStarting ? "Opening…" : ctaLabel}
          </button>
          <p className={styles.price}>{trustLine}</p>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={isStarting}
          >
            Not now
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

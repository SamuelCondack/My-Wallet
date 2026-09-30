import { useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import { PRO_FEATURES, PRO_PRICE_LABEL, TRIAL_DAYS } from "../../constants/subscription";
import { startCheckout } from "../../services/subscriptionService";
import styles from "./PaywallModal.module.scss";

export default function PaywallModal({
  isOpen,
  onClose,
  title = "Unlock MyWallet Pro",
  message = "Start a free trial and get the tools that make tracking effortless.",
}) {
  const [isStarting, setIsStarting] = useState(false);

  if (!isOpen) return null;

  const handleStartTrial = async () => {
    setIsStarting(true);
    try {
      const { url } = await startCheckout();
      if (!url) {
        throw new Error("Checkout URL missing.");
      }
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      toast.error(
        err.message ||
          "Billing is not configured yet. Add Stripe keys to enable checkout."
      );
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
        <p className={styles.message}>{message}</p>

        <ul className={styles.featureList}>
          {PRO_FEATURES.map((feature) => (
            <li key={feature.id}>
              <strong>{feature.title}</strong>
              <span>{feature.description}</span>
            </li>
          ))}
        </ul>

        <p className={styles.price}>
          {TRIAL_DAYS}-day free trial, then {PRO_PRICE_LABEL}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleStartTrial}
            disabled={isStarting}
          >
            {isStarting ? "Redirecting…" : `Start ${TRIAL_DAYS}-day free trial`}
          </button>
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
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
};

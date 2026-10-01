import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import { SUBSCRIPTION_STATUS, TRIAL_DAYS } from "../../constants/subscription";
import PaywallModal from "../PaywallModal/PaywallModal";
import styles from "./TrialBanner.module.scss";

export default function TrialBanner() {
  const {
    loading,
    isPro,
    isTrialing,
    isPastDue,
    trialDaysLeft,
    subscription,
    canStartTrial,
  } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;

  if (isPastDue) {
    return (
      <div className={`${styles.banner} ${styles.warning}`}>
        <div className={styles.copy}>
          <strong>Payment issue</strong>
          <span>Update your billing details to keep Pro access.</span>
        </div>
        <div className={styles.actions}>
          <Link to="/home/profile" className={styles.primaryLink}>
            Manage billing
          </Link>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (isTrialing && trialDaysLeft !== null) {
    const urgent = trialDaysLeft <= 2;
    return (
      <>
        <div
          className={`${styles.banner} ${urgent ? styles.warning : styles.info}`}
        >
          <div className={styles.copy}>
            <strong>
              {trialDaysLeft === 0
                ? "Trial ends today"
                : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in trial`}
            </strong>
            <span>
              {urgent
                ? "Subscribe to keep Pro features after the trial."
                : "Explore Pro features before your trial ends."}
            </span>
          </div>
          <div className={styles.actions}>
            <Link to="/home/profile" className={styles.primaryLink}>
              Manage plan
            </Link>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      </>
    );
  }

  if (
    isPro ||
    subscription.status === SUBSCRIPTION_STATUS.CANCELED ||
    subscription.status === SUBSCRIPTION_STATUS.INCOMPLETE
  ) {
    return null;
  }

  // Free users eligible for trial
  if (!canStartTrial) {
    return null;
  }

  return (
    <>
      <div className={`${styles.banner} ${styles.promo}`}>
        <div className={styles.copy}>
          <strong>Try MyWallet Pro free</strong>
          <span>
            {TRIAL_DAYS}-day trial · budgets, CSV & PDF export live on Pro.
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setPaywallOpen(true)}
          >
            Start trial
          </button>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        canStartTrial={canStartTrial}
      />
    </>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import {
  PRO_COPY_KEYS,
  TRIAL_DAYS,
  SUBSCRIPTION_STATUS,
} from "../../constants/subscription";
import { useT } from "../../i18n/useT";
import PaywallModal from "../PaywallModal/PaywallModal";
import styles from "./TrialBanner.module.scss";

export default function TrialBanner() {
  const t = useT();
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
          <strong>{t("trialBanner.paymentIssue")}</strong>
          <span>{t("trialBanner.paymentIssueText")}</span>
        </div>
        <div className={styles.actions}>
          <Link to="/home/profile" className={styles.primaryLink}>
            {t("trialBanner.manageBilling")}
          </Link>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label={t("common.dismiss")}
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
                ? t("trialBanner.endsToday")
                : t(
                    trialDaysLeft === 1
                      ? "trialBanner.daysLeftOne"
                      : "trialBanner.daysLeftMany",
                    { n: trialDaysLeft }
                  )}
            </strong>
            <span>
              {urgent
                ? t("trialBanner.urgentText")
                : t("trialBanner.exploreText")}
            </span>
          </div>
          <div className={styles.actions}>
            <Link to="/home/profile" className={styles.primaryLink}>
              {t("trialBanner.managePlan")}
            </Link>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => setDismissed(true)}
              aria-label={t("common.dismiss")}
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
          <strong>{t("trialBanner.promoTitle")}</strong>
          <span>
            {t(PRO_COPY_KEYS.trialBanner, { days: TRIAL_DAYS })}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setPaywallOpen(true)}
          >
            {t("trialBanner.startTrial")}
          </button>
          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setDismissed(true)}
            aria-label={t("common.dismiss")}
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

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import PaywallModal from "../../components/PaywallModal/PaywallModal";
import {
  PRO_FEATURES,
  PRO_PRICE_LABEL,
  SUBSCRIPTION_STATUS,
  TRIAL_DAYS,
} from "../../constants/subscription";
import { useSubscription } from "../../hooks/useSubscription";
import {
  openCustomerPortal,
  startCheckout,
} from "../../services/subscriptionService";
import styles from "./Profile.module.scss";

function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    user,
    profile,
    subscription,
    loading,
    isPro,
    isTrialing,
    isPastDue,
    trialDaysLeft,
    planLabel,
  } = useSubscription();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (!checkout) return;

    if (checkout === "success") {
      toast.success("Welcome to Pro! Your subscription is updating…");
    } else if (checkout === "cancel") {
      toast.info("Checkout canceled. You can start anytime.");
    }

    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleStartCheckout = async () => {
    setBusyAction("checkout");
    try {
      const { url } = await startCheckout();
      if (!url) throw new Error("Checkout URL missing.");
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      toast.error(
        err.message ||
          "Billing is not configured yet. Add Stripe keys on the server."
      );
      setBusyAction(null);
    }
  };

  const handleManageBilling = async () => {
    setBusyAction("portal");
    try {
      const { url } = await openCustomerPortal();
      if (!url) throw new Error("Portal URL missing.");
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      toast.error(
        err.message ||
          "Could not open the billing portal. Check Stripe configuration."
      );
      setBusyAction(null);
    }
  };

  if (loading) {
    return <LoadingComponent variant="dashboard" />;
  }

  const displayName =
    profile?.displayName || user?.displayName || "MyWallet user";
  const email = profile?.email || user?.email || "—";
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const hasStripeCustomer = Boolean(subscription.stripeCustomerId);
  const canStartTrial =
    !isPro &&
    subscription.status !== SUBSCRIPTION_STATUS.PAST_DUE &&
    !hasStripeCustomer;

  let statusDetail = "Core tracking is free forever.";
  if (isTrialing) {
    statusDetail =
      trialDaysLeft === 0
        ? "Your trial ends today."
        : `Trial ends ${formatDate(subscription.trialEndsAtMs)} (${trialDaysLeft} day${
            trialDaysLeft === 1 ? "" : "s"
          } left).`;
  } else if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
    statusDetail = subscription.cancelAtPeriodEnd
      ? `Cancels on ${formatDate(subscription.currentPeriodEndMs)}.`
      : `Renews on ${formatDate(subscription.currentPeriodEndMs)}.`;
  } else if (isPastDue) {
    statusDetail = "Update your payment method to restore Pro access.";
  } else if (subscription.status === SUBSCRIPTION_STATUS.CANCELED) {
    statusDetail = "Your Pro subscription is canceled.";
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Profile</h1>
      </header>

      <section className={styles.card}>
        <div className={styles.identity}>
          {photoURL ? (
            <img src={photoURL} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback} aria-hidden="true">
              {initials || "MW"}
            </div>
          )}
          <div>
            <h2>{displayName}</h2>
            <p>{email}</p>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.planHeader}>
          <div>
            <p className={styles.label}>Current plan</p>
            <h2 className={styles.planName}>{planLabel}</h2>
            <p className={styles.statusDetail}>{statusDetail}</p>
          </div>
          <span
            className={`${styles.badge} ${
              isPro ? styles.badgePro : styles.badgeFree
            }`}
          >
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        <div className={styles.planActions}>
          {canStartTrial && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleStartCheckout}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "checkout"
                ? "Redirecting…"
                : `Start ${TRIAL_DAYS}-day free trial`}
            </button>
          )}

          {!isPro && !canStartTrial && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleStartCheckout}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "checkout" ? "Redirecting…" : "Subscribe to Pro"}
            </button>
          )}

          {!isPro && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPaywallOpen(true)}
            >
              What&apos;s included
            </button>
          )}

          {(hasStripeCustomer || isPro || isPastDue) && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleManageBilling}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "portal" ? "Opening…" : "Manage subscription"}
            </button>
          )}
        </div>

        <p className={styles.priceNote}>
          Pro is {PRO_PRICE_LABEL} after a {TRIAL_DAYS}-day free trial. Cancel
          anytime in the billing portal.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>What&apos;s in Pro</h2>
        <ul className={styles.featureList}>
          {PRO_FEATURES.map((feature) => (
            <li key={feature.id}>
              <div>
                <strong>{feature.title}</strong>
                <span>{feature.description}</span>
              </div>
              <span className={styles.coming}>{isPro ? "Included" : "Soon"}</span>
            </li>
          ))}
        </ul>
      </section>

      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}

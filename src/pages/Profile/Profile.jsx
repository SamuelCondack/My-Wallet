import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { auth } from "../../../config/firebase";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import PaywallModal from "../../components/PaywallModal/PaywallModal";
import ProWelcomeCelebration from "../../components/ProWelcomeCelebration/ProWelcomeCelebration";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import {
  PRO_FEATURES,
  PRO_PRICE_LABEL,
  SUBSCRIPTION_STATUS,
  TRIAL_DAYS,
} from "../../constants/subscription";
import { useSubscription } from "../../hooks/useSubscription";
import {
  openCustomerPortal,
  openStripeSession,
  startCheckout,
  syncSubscription,
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
  const navigate = useNavigate();
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
    canStartTrial,
  } = useSubscription();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [showProWelcome, setShowProWelcome] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const welcomeShownRef = useRef(false);
  const checkoutHandledRef = useRef(false);
  const billingHandledRef = useRef(false);
  const syncInFlightRef = useRef(false);

  const celebratedKey = user?.uid ? `mw_pro_celebrated_${user.uid}` : null;

  const hasCelebrated = useCallback(() => {
    if (!celebratedKey) return false;
    return localStorage.getItem(celebratedKey) === "1";
  }, [celebratedKey]);

  const markCelebrated = useCallback(() => {
    if (celebratedKey) localStorage.setItem(celebratedKey, "1");
    welcomeShownRef.current = true;
  }, [celebratedKey]);

  const openWelcome = useCallback(() => {
    welcomeShownRef.current = true;
    setShowProWelcome(true);
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlightRef.current) return null;
    syncInFlightRef.current = true;
    try {
      return await syncSubscription();
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  // Keep plan in sync whenever Profile opens.
  useEffect(() => {
    if (loading || !user) return;
    runSync().catch((err) => {
      console.error("Silent plan sync failed:", err);
    });
  }, [loading, user, runSync]);

  // After Stripe portal / checkout tab work: resync when this tab is focused again.
  useEffect(() => {
    if (loading || !user) return undefined;

    const resyncIfNeeded = () => {
      if (document.visibilityState !== "visible") return;
      if (sessionStorage.getItem("mw_billing_dirty") !== "1") return;
      sessionStorage.removeItem("mw_billing_dirty");
      runSync().catch((err) => {
        console.error("Billing return sync failed:", err);
      });
    };

    window.addEventListener("focus", resyncIfNeeded);
    document.addEventListener("visibilitychange", resyncIfNeeded);
    resyncIfNeeded();

    return () => {
      window.removeEventListener("focus", resyncIfNeeded);
      document.removeEventListener("visibilitychange", resyncIfNeeded);
    };
  }, [loading, user, runSync]);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const billing = searchParams.get("billing");
    const forceWelcome =
      import.meta.env.DEV && searchParams.get("welcome") === "1";

    if (forceWelcome) {
      const next = new URLSearchParams(searchParams);
      next.delete("welcome");
      setSearchParams(next, { replace: true });
      if (celebratedKey) localStorage.removeItem(celebratedKey);
      welcomeShownRef.current = false;
      openWelcome();
    }

    if (billing === "updated" && !billingHandledRef.current) {
      billingHandledRef.current = true;
      const next = new URLSearchParams(searchParams);
      next.delete("billing");
      setSearchParams(next, { replace: true });
      sessionStorage.removeItem("mw_billing_dirty");
      runSync().catch((err) => {
        console.error("Portal return sync failed:", err);
        toast.error("Could not refresh your plan status. Try again in a moment.");
      });
    }

    if (!checkout || checkoutHandledRef.current) return;
    checkoutHandledRef.current = true;

    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });

    if (checkout === "cancel") {
      toast.info("Checkout canceled. You can start anytime.");
      return;
    }

    if (checkout !== "success") return;

    (async () => {
      try {
        await runSync();
        if (!hasCelebrated()) openWelcome();
      } catch (err) {
        console.error(err);
        window.setTimeout(() => {
          runSync()
            .then(() => {
              if (!hasCelebrated()) openWelcome();
            })
            .catch(() => {
              toast.error(
                "Payment received. Your Pro plan should appear in a moment. Reopen Profile if needed."
              );
            });
        }, 1500);
      }
    })();
  }, [
    searchParams,
    setSearchParams,
    runSync,
    hasCelebrated,
    openWelcome,
    celebratedKey,
  ]);

  // First time we detect Pro on this device: celebrate once.
  useEffect(() => {
    if (loading || !isPro || !user?.uid || welcomeShownRef.current) return;
    if (hasCelebrated()) {
      welcomeShownRef.current = true;
      return;
    }
    openWelcome();
  }, [loading, isPro, user, hasCelebrated, openWelcome]);

  const finishWelcome = useCallback(() => {
    markCelebrated();
    setShowProWelcome(false);
  }, [markCelebrated]);

  const handleStartCheckout = async () => {
    setBusyAction("checkout");
    try {
      sessionStorage.setItem("mw_billing_dirty", "1");
      await openStripeSession(() => startCheckout());
    } catch (err) {
      console.error(err);
      sessionStorage.removeItem("mw_billing_dirty");
      toast.error(
        err.message ||
          "Billing is not configured yet. Add Stripe keys on the server."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleManageBilling = async () => {
    setBusyAction("portal");
    try {
      sessionStorage.setItem("mw_billing_dirty", "1");
      await openStripeSession(() => openCustomerPortal());
    } catch (err) {
      console.error(err);
      sessionStorage.removeItem("mw_billing_dirty");
      toast.error(
        err.message ||
          "Could not open the billing portal. Check Stripe configuration."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const cancelLogout = () => {
    if (isLoggingOut) return;
    setShowLogoutConfirm(false);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      setShowLogoutConfirm(false);
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not log out.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return <LoadingComponent variant="profile" />;
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

  let statusDetail = "Core tracking is free forever.";
  if (isTrialing) {
    if (subscription.cancelAtPeriodEnd) {
      statusDetail = `Ends on ${formatDate(
        subscription.trialEndsAtMs || subscription.currentPeriodEndMs
      )}. Won't convert to paid.`;
    } else {
      statusDetail =
        trialDaysLeft === 0
          ? "Your trial ends today."
          : `Trial ends ${formatDate(subscription.trialEndsAtMs)} (${trialDaysLeft} day${
              trialDaysLeft === 1 ? "" : "s"
            } left).`;
    }
  } else if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
    statusDetail = subscription.cancelAtPeriodEnd
      ? `Ends on ${formatDate(subscription.currentPeriodEndMs)}. You keep Pro until then.`
      : `Renews on ${formatDate(subscription.currentPeriodEndMs)}.`;
  } else if (isPastDue) {
    statusDetail = "Update your payment method to restore Pro access.";
  } else if (subscription.status === SUBSCRIPTION_STATUS.CANCELED) {
    statusDetail =
      "Your previous Pro plan ended. Subscribe anytime to unlock it again.";
  }

  const showManageBilling = isPro || isPastDue;
  const showSubscribe = !isPro && !canStartTrial;
  const showTrial = canStartTrial;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Profile</h1>
      </header>

      <section className={styles.card}>
        <div className={styles.identity}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarSlot}>
              <div className={styles.avatarFallback} aria-hidden="true">
                {initials || "MW"}
              </div>
              {photoURL ? (
                <img
                  src={photoURL}
                  alt=""
                  className={styles.avatar}
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
            </div>
            {isPro ? (
              <span className={styles.proChip} aria-hidden="true">
                Pro
              </span>
            ) : null}
          </div>
          <div className={styles.identityCopy}>
            <h2>{displayName}</h2>
            <p>{email}</p>
          </div>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => setShowLogoutConfirm(true)}
          >
            Log out
          </button>
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
          {showTrial && (
            <div className={styles.subscribeHero}>
              <p className={styles.subscribeEyebrow}>Try Pro free</p>
              <p className={styles.subscribeLead}>
                Budgets, receipt capture, AI review, and exports — no charge
                today.
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleStartCheckout}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "checkout"
                  ? "Opening…"
                  : `Start ${TRIAL_DAYS}-day free trial`}
              </button>
              <p className={styles.subscribeFoot}>
                Then {PRO_PRICE_LABEL}. Cancel anytime.
              </p>
            </div>
          )}

          {showSubscribe && (
            <div className={styles.subscribeHero}>
              <p className={styles.subscribeEyebrow}>Unlock MyWallet Pro</p>
              <p className={styles.subscribeLead}>
                Budgets, receipt capture, AI review, and exports.
              </p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleStartCheckout}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "checkout"
                  ? "Opening…"
                  : `Get Pro — ${PRO_PRICE_LABEL}`}
              </button>
              <p className={styles.subscribeFoot}>
                Secure checkout · Cancel anytime
              </p>
            </div>
          )}

          {!isPro && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPaywallOpen(true)}
            >
              See everything in Pro
            </button>
          )}

          {showManageBilling && (
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

        {!showTrial && !showSubscribe && (
          <p className={styles.priceNote}>
            Pro is {PRO_PRICE_LABEL}. Cancel anytime in the billing portal.
          </p>
        )}
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
        canStartTrial={canStartTrial}
      />

      <ProWelcomeCelebration
        open={showProWelcome}
        onDone={finishWelcome}
        userName={displayName}
        photoURL={photoURL}
        isTrial={isTrialing || subscription.status === SUBSCRIPTION_STATUS.TRIALING}
      />

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onRequestClose={cancelLogout}
        onConfirm={confirmLogout}
        title="Log out"
        message="Are you sure you want to log out?"
        isEditModal
        isSubmitting={isLoggingOut}
      />
    </div>
  );
}

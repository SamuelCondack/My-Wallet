import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { auth } from "../../../config/firebase";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import PaywallModal from "../../components/PaywallModal/PaywallModal";
import ProWelcomeCelebration from "../../components/ProWelcomeCelebration/ProWelcomeCelebration";
import PwaInstallCard from "../../components/PwaInstallCard/PwaInstallCard";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import {
  PRO_COPY_KEYS,
  PRO_FEATURES,
  PRO_PRICE_LABEL_KEY,
  getProFeatureBadgeKey,
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
import {
  applyDocumentTheme,
  getThemeFromProfile,
  updateUserTheme,
} from "../../services/themeService";
import {
  getLanguageFromProfile,
  updateUserLanguage,
} from "../../services/languageService";
import { LANGUAGE, getLocale, resolveLanguage } from "../../i18n/language";
import { useLanguage } from "../../i18n/useLanguage";
import { useT } from "../../i18n/useT";
import { translate } from "../../i18n/translate";
import styles from "./Profile.module.scss";

function formatDate(ms, locale) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useT();
  const { language, setPreference: setLanguagePreference } = useLanguage();
  const locale = getLocale(language);
  const {
    user,
    profile,
    subscription,
    loading,
    isPro,
    isTrialing,
    isPastDue,
    trialDaysLeft,
    planLabelKey,
    canStartTrial,
  } = useSubscription();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [showProWelcome, setShowProWelcome] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);
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
        toast.error(t("profile.refreshFailed"));
      });
    }

    if (!checkout || checkoutHandledRef.current) return;
    checkoutHandledRef.current = true;

    const next = new URLSearchParams(searchParams);
    next.delete("checkout");
    setSearchParams(next, { replace: true });

    if (checkout === "cancel") {
      toast.info(t("profile.checkoutCanceled"));
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
              toast.error(t("profile.paymentReceivedPending"));
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
    t,
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

  const getBillingErrorMessage = (err, fallbackKey) => {
    if (err?.code === "auth_required") return t("toast.needSignIn");
    if (err?.code === "url_missing") return t("profile.billingUrlMissing");
    return err?.message || t(fallbackKey);
  };

  const handleStartCheckout = async () => {
    setBusyAction("checkout");
    try {
      sessionStorage.setItem("mw_billing_dirty", "1");
      await openStripeSession(() => startCheckout());
    } catch (err) {
      console.error(err);
      sessionStorage.removeItem("mw_billing_dirty");
      toast.error(getBillingErrorMessage(err, "profile.billingNotConfigured"));
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
      toast.error(getBillingErrorMessage(err, "profile.billingPortalFailed"));
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
      toast.error(err.message || t("profile.logOutFailed"));
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return <LoadingComponent variant="profile" />;
  }

  const displayName =
    profile?.displayName || user?.displayName || t("profile.defaultName");
  const email = profile?.email || user?.email || "—";
  const photoURL = profile?.photoURL || user?.photoURL || null;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  let statusDetail = t("profile.status.free");
  if (isTrialing) {
    if (subscription.cancelAtPeriodEnd) {
      statusDetail = t("profile.status.trialCancels", {
        date: formatDate(
          subscription.trialEndsAtMs || subscription.currentPeriodEndMs,
          locale
        ),
      });
    } else {
      statusDetail =
        trialDaysLeft === 0
          ? t("profile.status.trialEndsToday")
          : t(
              trialDaysLeft === 1
                ? "profile.status.trialEndsOne"
                : "profile.status.trialEndsMany",
              {
                date: formatDate(subscription.trialEndsAtMs, locale),
                n: trialDaysLeft,
              }
            );
    }
  } else if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
    const date = formatDate(subscription.currentPeriodEndMs, locale);
    statusDetail = subscription.cancelAtPeriodEnd
      ? t("profile.status.activeCancels", { date })
      : t("profile.status.activeRenews", { date });
  } else if (isPastDue) {
    statusDetail = t("profile.status.pastDue");
  } else if (subscription.status === SUBSCRIPTION_STATUS.CANCELED) {
    statusDetail = t("profile.status.canceled");
  }

  const priceLabel = t(PRO_PRICE_LABEL_KEY);

  const showManageBilling = isPro || isPastDue;
  const showSubscribe = !isPro && !canStartTrial;
  const showTrial = canStartTrial;
  const isDarkMode = getThemeFromProfile(profile) === "dark";
  const languagePreference = getLanguageFromProfile(profile);

  const handleToggleTheme = async () => {
    if (!user?.uid || themeBusy) return;
    setThemeBusy(true);
    const next = isDarkMode ? "light" : "dark";
    applyDocumentTheme(next);
    try {
      await updateUserTheme(user.uid, next);
    } catch (err) {
      console.error(err);
      applyDocumentTheme(isDarkMode ? "dark" : "light");
      toast.error(err.message || t("profile.themeSaveFailed"));
    } finally {
      setThemeBusy(false);
    }
  };

  const handleLanguageChange = async (event) => {
    if (!user?.uid || languageBusy) return;
    const next = event.target.value;
    const nextLang = resolveLanguage(next);
    setLanguageBusy(true);
    setLanguagePreference(next);
    try {
      await updateUserLanguage(user.uid, next);
      toast.success(translate(nextLang, "toast.languageSaved"));
    } catch (err) {
      console.error(err);
      toast.error(
        err.message || translate(nextLang, "toast.languageSaveFailed")
      );
    } finally {
      setLanguageBusy(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t("profile.title")}</h1>
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
                {t("common.pro")}
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
            {t("profile.logOut")}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.themeRow}>
          <div>
            <p className={styles.label}>{t("profile.appearance")}</p>
            <h2 className={styles.themeTitle}>{t("profile.darkMode")}</h2>
            <p className={styles.statusDetail}>{t("profile.darkModeHint")}</p>
          </div>
          <button
            type="button"
            className={`${styles.themeSwitch} ${
              isDarkMode ? styles.themeSwitchOn : ""
            }`}
            onClick={handleToggleTheme}
            disabled={themeBusy || !user?.uid}
            aria-pressed={isDarkMode}
            aria-label={t("profile.toggleDarkMode")}
          >
            <span className={styles.themeKnob} />
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.languageBlock}>
          <div>
            <p className={styles.label}>{t("profile.language")}</p>
            <h2 className={styles.themeTitle}>{t("profile.languageTitle")}</h2>
            <p className={styles.statusDetail}>{t("profile.languageHint")}</p>
          </div>
          <select
            className={styles.languageSelect}
            value={languagePreference}
            onChange={handleLanguageChange}
            disabled={languageBusy || !user?.uid}
            aria-label={t("profile.languageTitle")}
          >
            <option value={LANGUAGE.SYSTEM}>
              {t("profile.languageSystem")}
            </option>
            <option value={LANGUAGE.EN}>
              {t("profile.languageEnglish")}
            </option>
            <option value={LANGUAGE.PT}>
              {t("profile.languagePortuguese")}
            </option>
          </select>
        </div>
      </section>

      <PwaInstallCard />

      <section className={styles.card}>
        <div className={styles.planHeader}>
          <div>
            <p className={styles.label}>{t("profile.currentPlan")}</p>
            <h2 className={styles.planName}>{t(planLabelKey)}</h2>
            <p className={styles.statusDetail}>{statusDetail}</p>
          </div>
          <span
            className={`${styles.badge} ${
              isPro ? styles.badgePro : styles.badgeFree
            }`}
          >
            {isPro ? t("common.pro") : t("common.free")}
          </span>
        </div>

        <div className={styles.planActions}>
          {showTrial && (
            <div className={styles.subscribeHero}>
              <p className={styles.subscribeEyebrow}>
                {t("profile.tryProFree")}
              </p>
              <p className={styles.subscribeLead}>{t(PRO_COPY_KEYS.trialLead)}</p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleStartCheckout}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "checkout"
                  ? t("common.opening")
                  : t("profile.startTrial", { days: TRIAL_DAYS })}
              </button>
              <p className={styles.subscribeFoot}>
                {t("profile.thenPrice", { price: priceLabel })}
              </p>
            </div>
          )}

          {showSubscribe && (
            <div className={styles.subscribeHero}>
              <p className={styles.subscribeEyebrow}>
                {t("profile.unlockPro")}
              </p>
              <p className={styles.subscribeLead}>{t(PRO_COPY_KEYS.subscribeLead)}</p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleStartCheckout}
                disabled={Boolean(busyAction)}
              >
                {busyAction === "checkout"
                  ? t("common.opening")
                  : t("profile.getPro", { price: priceLabel })}
              </button>
              <p className={styles.subscribeFoot}>
                {t("profile.secureCheckout")}
              </p>
            </div>
          )}

          {!isPro && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setPaywallOpen(true)}
            >
              {t("profile.seeEverythingInPro")}
            </button>
          )}

          {showManageBilling && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleManageBilling}
              disabled={Boolean(busyAction)}
            >
              {busyAction === "portal"
                ? t("common.opening")
                : t("profile.manageSubscription")}
            </button>
          )}
        </div>

        {!showTrial && !showSubscribe && (
          <p className={styles.priceNote}>
            {t("profile.priceNote", { price: priceLabel })}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>{t("profile.whatsInPro")}</h2>
        <ul className={styles.featureList}>
          {PRO_FEATURES.map((feature) => (
            <li key={feature.id}>
              <div>
                <strong>{t(feature.titleKey)}</strong>
                <span>{t(feature.descriptionKey, feature.vars)}</span>
              </div>
              <span className={styles.coming}>
                {t(getProFeatureBadgeKey(feature, { isPro }))}
              </span>
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
        title={t("profile.logOutTitle")}
        message={t("profile.logOutMessage")}
        isEditModal
        isSubmitting={isLoggingOut}
      />
    </div>
    </div>
  );
}

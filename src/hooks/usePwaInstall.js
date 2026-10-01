import { useCallback, useEffect, useState } from "react";
import {
  PWA_BANNER_MIN_DAYS,
  bindPwaInstallEvents,
  dismissPwaBanner,
  dismissPwaProfile,
  getPwaDaysSinceFirstSeen,
  isAndroidDevice,
  isIosDevice,
  isIosSafari,
  isMobileInstallCandidate,
  isPwaBannerDismissed,
  isPwaProfileDismissed,
  isStandalonePwa,
  promptPwaInstall,
  subscribeDeferredInstallPrompt,
} from "../utils/pwaInstall";

/**
 * PWA install eligibility + shared Android beforeinstallprompt state.
 */
export function usePwaInstall() {
  const [standalone, setStandalone] = useState(() => isStandalonePwa());
  const [ios] = useState(() => isIosDevice());
  const [iosSafari] = useState(() => isIosSafari());
  const [android] = useState(() => isAndroidDevice());
  const [mobile] = useState(() => isMobileInstallCandidate());
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [profileDismissed, setProfileDismissed] = useState(() =>
    isPwaProfileDismissed()
  );
  const [bannerDismissed, setBannerDismissed] = useState(() =>
    isPwaBannerDismissed()
  );
  const [daysSinceFirstSeen, setDaysSinceFirstSeen] = useState(0);

  useEffect(() => {
    bindPwaInstallEvents();
    setDaysSinceFirstSeen(getPwaDaysSinceFirstSeen());
    setStandalone(isStandalonePwa());

    const media = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () => setStandalone(isStandalonePwa());
    media.addEventListener?.("change", syncStandalone);

    const unsubscribePrompt = subscribeDeferredInstallPrompt((prompt) => {
      setCanNativeInstall(Boolean(prompt) && !isStandalonePwa());
    });

    const onInstalled = () => setStandalone(true);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      media.removeEventListener?.("change", syncStandalone);
      unsubscribePrompt();
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismissProfile = useCallback(() => {
    dismissPwaProfile();
    setProfileDismissed(true);
  }, []);

  const dismissBanner = useCallback(() => {
    dismissPwaBanner();
    setBannerDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => promptPwaInstall(), []);

  const showProfileGuide = mobile && !standalone && !profileDismissed;
  const showDashboardBanner =
    mobile &&
    !standalone &&
    !bannerDismissed &&
    daysSinceFirstSeen >= PWA_BANNER_MIN_DAYS;

  return {
    standalone,
    ios,
    iosSafari,
    android,
    canNativeInstall: canNativeInstall && !standalone,
    showProfileGuide,
    showDashboardBanner,
    dismissProfile,
    dismissBanner,
    promptInstall,
  };
}

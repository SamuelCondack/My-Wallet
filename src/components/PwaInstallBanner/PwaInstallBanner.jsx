import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useT } from "../../i18n/useT";
import styles from "./PwaInstallBanner.module.scss";

export default function PwaInstallBanner() {
  const t = useT();
  const {
    showDashboardBanner,
    ios,
    canNativeInstall,
    dismissBanner,
    promptInstall,
  } = usePwaInstall();

  if (!showDashboardBanner) return null;

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === "accepted") {
      toast.success(t("pwa.installed"));
      dismissBanner();
      return;
    }
    if (!result.ok) {
      toast.info(ios ? t("pwa.hintIos") : t("pwa.hintBrowser"));
    }
  };

  return (
    <div className={`${styles.banner} ${styles.promo}`}>
      <div className={styles.copy}>
        <strong>{t("pwa.installTitle")}</strong>
        <span>
          {ios ? t("pwa.bannerIosText") : t("pwa.bannerText")}
        </span>
      </div>
      <div className={styles.actions}>
        {canNativeInstall ? (
          <button type="button" className={styles.primaryBtn} onClick={handleInstall}>
            {t("pwa.install")}
          </button>
        ) : (
          <Link to="/home/profile" className={styles.primaryLink}>
            {t("pwa.howTo")}
          </Link>
        )}
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismissBanner}
          aria-label={t("common.dismiss")}
        >
          ×
        </button>
      </div>
    </div>
  );
}

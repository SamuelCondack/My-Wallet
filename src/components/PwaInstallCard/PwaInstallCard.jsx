import { toast } from "react-toastify";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useT } from "../../i18n/useT";
import styles from "./PwaInstallCard.module.scss";

export default function PwaInstallCard() {
  const t = useT();
  const {
    showProfileGuide,
    ios,
    iosSafari,
    android,
    canNativeInstall,
    dismissProfile,
    promptInstall,
  } = usePwaInstall();

  if (!showProfileGuide) return null;

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.outcome === "accepted") {
      toast.success(t("pwa.installed"));
      return;
    }
    if (!result.ok) {
      toast.info(t("pwa.hintMenu"));
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>{t("pwa.onYourPhone")}</p>
          <h2 className={styles.title}>{t("pwa.installTitle")}</h2>
          <p className={styles.lead}>{t("pwa.cardLead")}</p>
        </div>
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismissProfile}
          aria-label={t("pwa.dismissGuide")}
        >
          ×
        </button>
      </div>

      {canNativeInstall ? (
        <button type="button" className={styles.primaryBtn} onClick={handleInstall}>
          {t("pwa.installApp")}
        </button>
      ) : ios && iosSafari ? (
        <ol className={styles.steps}>
          <li>{t("pwa.iosSafari.step1")}</li>
          <li>{t("pwa.iosSafari.step2")}</li>
          <li>{t("pwa.iosSafari.step3")}</li>
        </ol>
      ) : ios ? (
        <ol className={styles.steps}>
          <li>{t("pwa.iosOther.step1")}</li>
          <li>{t("pwa.iosOther.step2")}</li>
          <li>{t("pwa.iosOther.step3")}</li>
        </ol>
      ) : android ? (
        <ol className={styles.steps}>
          <li>{t("pwa.android.step1")}</li>
          <li>{t("pwa.android.step2")}</li>
        </ol>
      ) : (
        <ol className={styles.steps}>
          <li>{t("pwa.generic.step1")}</li>
        </ol>
      )}

      {!canNativeInstall && (
        <button type="button" className={styles.secondaryBtn} onClick={dismissProfile}>
          {t("pwa.notNow")}
        </button>
      )}
    </section>
  );
}
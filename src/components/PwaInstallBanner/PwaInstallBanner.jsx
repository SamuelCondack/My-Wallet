import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import styles from "./PwaInstallBanner.module.scss";

export default function PwaInstallBanner() {
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
      toast.success("MyWallet installed.");
      dismissBanner();
      return;
    }
    if (!result.ok) {
      toast.info(
        ios
          ? "Safari → Share → Add to Home Screen."
          : "Browser menu → Install app."
      );
    }
  };

  return (
    <div className={`${styles.banner} ${styles.promo}`}>
      <div className={styles.copy}>
        <strong>Install MyWallet</strong>
        <span>
          {ios
            ? "Add to Home Screen for a full app experience."
            : "Install for a home screen icon and faster launch."}
        </span>
      </div>
      <div className={styles.actions}>
        {canNativeInstall ? (
          <button type="button" className={styles.primaryBtn} onClick={handleInstall}>
            Install
          </button>
        ) : (
          <Link to="/home/profile" className={styles.primaryLink}>
            How to
          </Link>
        )}
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismissBanner}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

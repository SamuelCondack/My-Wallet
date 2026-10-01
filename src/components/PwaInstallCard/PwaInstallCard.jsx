import { toast } from "react-toastify";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import styles from "./PwaInstallCard.module.scss";

export default function PwaInstallCard() {
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
      toast.success("MyWallet installed.");
      return;
    }
    if (!result.ok) {
      toast.info("Use your browser menu → Install app.");
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>On your phone</p>
          <h2 className={styles.title}>Install MyWallet</h2>
          <p className={styles.lead}>
            Open it like an app — full screen, home screen icon, faster launch.
          </p>
        </div>
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismissProfile}
          aria-label="Dismiss install guide"
        >
          ×
        </button>
      </div>

      {canNativeInstall ? (
        <button type="button" className={styles.primaryBtn} onClick={handleInstall}>
          Install app
        </button>
      ) : ios && iosSafari ? (
        <ol className={styles.steps}>
          <li>
            Tap <strong>Share</strong> in Safari
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>
          </li>
        </ol>
      ) : ios ? (
        <ol className={styles.steps}>
          <li>
            Open this site in <strong>Safari</strong>
          </li>
          <li>
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
          </li>
          <li>
            Tap <strong>Add</strong>
          </li>
        </ol>
      ) : android ? (
        <ol className={styles.steps}>
          <li>
            Open the browser <strong>menu</strong> (⋮)
          </li>
          <li>
            Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
          </li>
        </ol>
      ) : (
        <ol className={styles.steps}>
          <li>Use your browser menu to install or add to home screen.</li>
        </ol>
      )}

      {!canNativeInstall && (
        <button type="button" className={styles.secondaryBtn} onClick={dismissProfile}>
          Not now
        </button>
      )}
    </section>
  );
}
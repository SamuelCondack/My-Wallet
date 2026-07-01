import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import styles from "./OfflineBanner.module.scss";

export default function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.dot} aria-hidden="true" />
      Você está offline. Seus dados salvos continuam disponíveis.
    </div>
  );
}

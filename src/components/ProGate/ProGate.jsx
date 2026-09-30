import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import PaywallModal from "../PaywallModal/PaywallModal";
import styles from "./ProGate.module.scss";

/**
 * Wraps Pro-only UI. Free users see a locked teaser + paywall.
 * Use requirePro from useSubscription for imperative checks.
 */
export default function ProGate({
  children,
  title = "Pro feature",
  description = "Available on MyWallet Pro.",
  fallback = null,
}) {
  const { requirePro, loading } = useSubscription();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const gate = requirePro();

  if (loading) {
    return fallback;
  }

  if (gate.allowed) {
    return children;
  }

  return (
    <>
      <div className={styles.locked}>
        <div className={styles.lockBadge}>Pro</div>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={() => setPaywallOpen(true)}
          >
            Unlock with Pro
          </button>
          <Link to="/home/profile" className={styles.profileLink}>
            View plans
          </Link>
        </div>
      </div>
      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title={title}
        message={description}
      />
    </>
  );
}

ProGate.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  fallback: PropTypes.node,
};

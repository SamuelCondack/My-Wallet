import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useSubscription } from "../../hooks/useSubscription";
import { useT } from "../../i18n/useT";
import PaywallModal from "../PaywallModal/PaywallModal";
import styles from "./ProGate.module.scss";

/**
 * Wraps Pro-only UI. Free users see a locked teaser + paywall.
 * Use requirePro from useSubscription for imperative checks.
 */
export default function ProGate({
  children,
  title,
  description,
  fallback = null,
  preview = null,
}) {
  const t = useT();
  const { requirePro, loading, canStartTrial } = useSubscription();
  const resolvedTitle = title || t("proGate.defaultTitle");
  const resolvedDescription = description || t("proGate.defaultDescription");
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
        <div className={styles.lockBadge}>{t("common.pro")}</div>
        <h3>{resolvedTitle}</h3>
        <p>{resolvedDescription}</p>
        {preview ? <div className={styles.preview}>{preview}</div> : null}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={() => setPaywallOpen(true)}
          >
            {t("proGate.unlock")}
          </button>
          <Link to="/home/profile" className={styles.profileLink}>
            {t("proGate.viewPlans")}
          </Link>
        </div>
      </div>
      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title={resolvedTitle}
        message={resolvedDescription}
        canStartTrial={canStartTrial}
      />
    </>
  );
}

ProGate.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.string,
  fallback: PropTypes.node,
  preview: PropTypes.node,
};

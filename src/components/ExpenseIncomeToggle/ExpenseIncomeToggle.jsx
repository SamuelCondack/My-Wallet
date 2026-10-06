import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useT } from "../../i18n/useT";
import styles from "./ExpenseIncomeToggle.module.scss";

/**
 * Merged Expense / Income toggle with sliding thumb + shine on change.
 * @param {"expense"|"income"} value
 * @param {(next: "expense"|"income") => void} onChange
 */
export default function ExpenseIncomeToggle({
  value,
  onChange,
  ariaLabel,
}) {
  const t = useT();
  const [shineKey, setShineKey] = useState(0);
  const isIncome = value === "income";

  useEffect(() => {
    if (shineKey === 0) {
      return undefined;
    }
    const timer = setTimeout(() => setShineKey(0), 550);
    return () => clearTimeout(timer);
  }, [shineKey]);

  const select = (next) => {
    if (next === value) {
      return;
    }
    setShineKey((key) => key + 1);
    onChange(next);
  };

  return (
    <div
      className={`${styles.toggle} ${shineKey ? styles.toggleShine : ""}`}
      role="group"
      aria-label={ariaLabel || t("toggle.ariaLabel")}
    >
      <span
        className={`${styles.thumb} ${isIncome ? styles.thumbIncome : ""}`}
        aria-hidden="true"
      />
      {shineKey > 0 && (
        <span key={shineKey} className={styles.shineSweep} aria-hidden="true" />
      )}
      <button
        type="button"
        className={`${styles.option} ${!isIncome ? styles.optionActive : ""}`}
        onClick={() => select("expense")}
        aria-pressed={!isIncome}
      >
        {t("toggle.expense")}
      </button>
      <button
        type="button"
        className={`${styles.option} ${isIncome ? styles.optionActive : ""}`}
        onClick={() => select("income")}
        aria-pressed={isIncome}
      >
        {t("toggle.income")}
      </button>
    </div>
  );
}

ExpenseIncomeToggle.propTypes = {
  value: PropTypes.oneOf(["expense", "income"]).isRequired,
  onChange: PropTypes.func.isRequired,
  ariaLabel: PropTypes.string,
};

import { useEffect, useState } from "react";
import styles from "./ExpenseIncomeToggle.module.scss";

/**
 * Merged Expense / Income toggle with sliding thumb + shine on change.
 * @param {"expense"|"income"} value
 * @param {(next: "expense"|"income") => void} onChange
 */
export default function ExpenseIncomeToggle({
  value,
  onChange,
  ariaLabel = "Switch between Expense and Income",
}) {
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
      aria-label={ariaLabel}
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
        Expense
      </button>
      <button
        type="button"
        className={`${styles.option} ${isIncome ? styles.optionActive : ""}`}
        onClick={() => select("income")}
        aria-pressed={isIncome}
      >
        Income
      </button>
    </div>
  );
}

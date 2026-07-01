import styles from "./BudgetProgress.module.scss";
import { formatCurrency } from "../../utils/finance";

export default function BudgetProgress({ category, spent, limit, onEditLimit }) {
  const progress = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isOver = limit > 0 && spent > limit;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span>
          {category.icon} {category.name}
        </span>
        <button type="button" className={styles.editBtn} onClick={() => onEditLimit(category)}>
          Set budget
        </button>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${isOver ? styles.over : ""}`}
          style={{ width: `${progress}%`, backgroundColor: category.color }}
        />
      </div>
      <p className={styles.meta}>
        {formatCurrency(spent)} / {limit > 0 ? formatCurrency(limit) : "no limit"}
        {isOver && <span className={styles.warning}> Over budget</span>}
      </p>
    </div>
  );
}

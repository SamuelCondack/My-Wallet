import styles from "./SpendingTrendChart.module.scss";
import { formatCurrency, getMonthLabel } from "../../utils/finance";

export default function SpendingTrendChart({ trend }) {
  const max = Math.max(...trend.map((item) => item.total), 1);

  return (
    <div className={styles.chart}>
      {trend.map((item) => (
        <div key={item.monthKey} className={styles.barGroup}>
          <div className={styles.barTrack}>
            <div
              className={styles.bar}
              style={{ height: `${(item.total / max) * 100}%` }}
              title={formatCurrency(item.total)}
            />
          </div>
          <span className={styles.label}>{getMonthLabel(item.monthKey)}</span>
        </div>
      ))}
    </div>
  );
}

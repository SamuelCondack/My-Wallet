import styles from "./CategoryPieChart.module.scss";
import { formatCurrency } from "../../utils/finance";

export default function CategoryPieChart({ data, categoriesMap }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <p className={styles.empty}>No spending data for this month.</p>;
  }

  let rotation = 0;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.pie}
        style={{
          background: `conic-gradient(${data
            .map((item) => {
              const category = categoriesMap[item.categoryId];
              const slice = (item.value / total) * 360;
              const color = category?.color || "#B0B0B0";
              const start = rotation;
              rotation += slice;
              return `${color} ${start}deg ${rotation}deg`;
            })
            .join(", ")})`,
        }}
      />
      <ul className={styles.legend}>
        {data.map((item) => {
          const category = categoriesMap[item.categoryId];
          return (
            <li key={item.categoryId}>
              <span
                className={styles.dot}
                style={{ backgroundColor: category?.color || "#B0B0B0" }}
              />
              <span>
                {category?.icon} {category?.name || "Other"} — {formatCurrency(item.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

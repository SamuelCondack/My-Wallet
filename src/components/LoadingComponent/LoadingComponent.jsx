import styles from "./LoadingComponent.module.scss";

function Shimmer({ className = "" }) {
  return <div className={`${styles.shimmer} ${className}`} aria-hidden="true" />;
}

function ExpensesSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={styles.skeletonSection}>
        <Shimmer className={styles.pageTitle} />

        <div className={styles.filters}>
          <Shimmer className={styles.filterPill} />
          <Shimmer className={styles.filterPill} />
        </div>

        <Shimmer className={styles.monthTitle} />

        <div className={styles.earningsRow}>
          <Shimmer className={styles.earningsLabel} />
          <Shimmer className={styles.earningsInput} />
        </div>

        <Shimmer className={styles.summaryLine} />
        <Shimmer className={`${styles.summaryLine} ${styles.summaryShort}`} />

        <div className={styles.expenseCards}>
          {[1, 2, 3].map((item) => (
            <div key={item} className={styles.expenseCard}>
              <Shimmer className={styles.cardName} />
              <Shimmer className={styles.cardValue} />
              <Shimmer className={styles.cardMethod} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Loading({ variant = "expenses" }) {
  if (variant === "expenses") {
    return <ExpensesSkeleton />;
  }

  return <ExpensesSkeleton />;
}

export default Loading;

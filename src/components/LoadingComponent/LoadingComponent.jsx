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

function DashboardSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={styles.skeletonSection}>
        <div className={styles.dashboardHeader}>
          <div>
            <Shimmer className={styles.pageTitle} />
            <Shimmer className={styles.summaryShort} />
          </div>
          <Shimmer className={styles.actionBtn} />
        </div>

        <Shimmer className={styles.monthInput} />
        <Shimmer className={styles.totalCard} />

        <Shimmer className={styles.sectionTitle} />
        <Shimmer className={styles.pieChart} />

        <Shimmer className={styles.sectionTitle} />
        {[1, 2, 3, 4].map((item) => (
          <Shimmer key={item} className={styles.listRow} />
        ))}
      </div>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={styles.skeletonSection}>
        <Shimmer className={styles.pageTitle} />
        <Shimmer className={styles.summaryShort} />

        <div className={styles.formRow}>
          <Shimmer className={styles.formField} />
          <Shimmer className={styles.formFieldSmall} />
          <Shimmer className={styles.formFieldTiny} />
          <Shimmer className={styles.actionBtn} />
        </div>

        <div className={styles.categoryGrid}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className={styles.categoryCard}>
              <Shimmer className={styles.categoryIcon} />
              <Shimmer className={styles.cardName} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={styles.skeletonSection}>
        <Shimmer className={styles.pageTitle} />

        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className={styles.formFieldGroup}>
            <Shimmer className={styles.earningsLabel} />
            <Shimmer className={styles.formInput} />
          </div>
        ))}

        <Shimmer className={styles.submitBtn} />
      </div>
    </div>
  );
}

function LandingSkeleton() {
  return (
    <div className={styles.skeletonWrapper}>
      <div className={styles.landingSection}>
        <Shimmer className={styles.landingNav} />
        <Shimmer className={styles.landingHero} />
        <Shimmer className={styles.landingSubtitle} />
      </div>
    </div>
  );
}

const VARIANTS = {
  expenses: ExpensesSkeleton,
  dashboard: DashboardSkeleton,
  categories: CategoriesSkeleton,
  form: FormSkeleton,
  landing: LandingSkeleton,
};

function Loading({ variant = "expenses" }) {
  const Skeleton = VARIANTS[variant] || ExpensesSkeleton;
  return <Skeleton />;
}

export default Loading;

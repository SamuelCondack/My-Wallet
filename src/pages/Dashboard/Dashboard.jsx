import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./Dashboard.module.scss";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import CategoryPieChart from "../../components/CategoryPieChart/CategoryPieChart";
import { auth, db } from "../../../config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useCategories } from "../../hooks/useCategories";
import { getCategoryMap } from "../../services/categoriesService";
import {
  buildExpensesByMonth,
  getCategoryTotals,
  getMonthTotal,
} from "../../utils/expenseCalculations";
import { formatCurrency, getMonthKey } from "../../utils/finance";

export default function Dashboard() {
  const [userId, setUserId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(getMonthKey());

  const { categories, loading: categoriesLoading } = useCategories(userId);

  useEffect(() => {
    let active = true;

    auth.authStateReady().then(async () => {
      const user = auth.currentUser;
      if (!user || !active) {
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      const snapshot = await getDocs(collection(db, user.uid));
      const data = snapshot.docs
        .filter((item) => !item.id.startsWith("earnings-"))
        .map((item) => ({ id: item.id, ...item.data() }));

      if (active) {
        setExpenses(data);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const categoriesMap = useMemo(() => getCategoryMap(categories), [categories]);
  const expensesByMonth = useMemo(() => buildExpensesByMonth(expenses), [expenses]);
  const monthTotal = getMonthTotal(expensesByMonth, monthKey);
  const categoryTotals = getCategoryTotals(expensesByMonth, monthKey);

  if (loading || categoriesLoading) {
    return <LoadingComponent />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Spending by category</p>
        </div>
        <Link to="categories" className={styles.linkBtn}>
          Manage categories
        </Link>
      </header>

      <label className={styles.monthFilter}>
        Month
        <input
          type="month"
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
        />
      </label>

      <div className={styles.totalCard}>
        <span>Total spent</span>
        <strong>{formatCurrency(monthTotal)}</strong>
      </div>

      <section className={styles.section}>
        <h2>By category</h2>
        <CategoryPieChart data={categoryTotals} categoriesMap={categoriesMap} />
      </section>

      <section className={styles.section}>
        <h2>Breakdown</h2>
        <ul className={styles.list}>
          {categoryTotals.length === 0 && <li>No expenses this month.</li>}
          {categoryTotals.map((item) => {
            const category = categoriesMap[item.categoryId];
            const percent = monthTotal ? ((item.value / monthTotal) * 100).toFixed(1) : 0;
            return (
              <li key={item.categoryId}>
                <span>
                  {category?.icon} {category?.name || "Other"}
                </span>
                <span>{formatCurrency(item.value)}</span>
                <span>{percent}%</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

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
  getActiveMonthKeys,
  getAggregatedCategoryTotals,
  getAggregatedMonthTotal,
  getUniqueMonthsForYear,
  getUniqueYears,
} from "../../utils/expenseCalculations";
import { formatCurrency } from "../../utils/finance";
import { getCached, setCached } from "../../utils/dataCache";

export default function Dashboard() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");

  const [userId, setUserId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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
      const cachedExpenses = getCached("expenses", user.uid);

      if (cachedExpenses) {
        setExpenses(cachedExpenses);
        setLoading(false);
      }

      const snapshot = await getDocs(collection(db, user.uid));
      const data = snapshot.docs
        .filter((item) => !item.id.startsWith("earnings-"))
        .map((item) => ({ id: item.id, ...item.data() }));

      if (active) {
        setExpenses(data);
        setCached("expenses", user.uid, data);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const categoriesMap = useMemo(() => getCategoryMap(categories), [categories]);
  const expensesByMonth = useMemo(() => buildExpensesByMonth(expenses), [expenses]);
  const sortedUniqueYears = useMemo(
    () => getUniqueYears(expenses, expensesByMonth),
    [expenses, expensesByMonth]
  );
  const sortedUniqueMonths = useMemo(
    () => getUniqueMonthsForYear(expenses, expensesByMonth, selectedYear),
    [expenses, expensesByMonth, selectedYear]
  );
  const activeMonthKeys = useMemo(
    () => getActiveMonthKeys(expensesByMonth, selectedYear, selectedMonth),
    [expensesByMonth, selectedYear, selectedMonth]
  );
  const monthTotal = useMemo(
    () => getAggregatedMonthTotal(expensesByMonth, activeMonthKeys),
    [expensesByMonth, activeMonthKeys]
  );
  const categoryTotals = useMemo(
    () => getAggregatedCategoryTotals(expensesByMonth, activeMonthKeys),
    [expensesByMonth, activeMonthKeys]
  );

  if (loading || categoriesLoading) {
    return <LoadingComponent variant="dashboard" />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Spending by category</p>
        </div>
        <Link to="/home/categories" className={styles.linkBtn}>
          Manage categories
        </Link>
      </header>

      <div className={styles.filterContainer}>
        <div className={styles.filter}>
          <label htmlFor="dashboardYearFilter">Filter by Year: </label>
          <select
            id="dashboardYearFilter"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMonth("All");
            }}
            className={styles.selectFilters}
          >
            <option value="All">All</option>
            {sortedUniqueYears
              .filter((year) => !isNaN(year))
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
        </div>
        <div className={styles.filter}>
          <label htmlFor="dashboardMonthFilter">Filter by Month: </label>
          <select
            id="dashboardMonthFilter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={selectedYear === "All"}
            className={styles.selectFilters}
          >
            <option value="All">All</option>
            {sortedUniqueMonths.map((month) => {
              const isCurrentMonth = selectedYear === currentYear && month === currentMonth;
              return (
                <option key={month} value={month} data-current={isCurrentMonth}>
                  {month} -{" "}
                  {new Date(0, month - 1).toLocaleString("default", {
                    month: "long",
                  })}
                  {isCurrentMonth && " 📅"}
                </option>
              );
            })}
          </select>
        </div>
      </div>

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
          {categoryTotals.length === 0 && <li>No expenses for this period.</li>}
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

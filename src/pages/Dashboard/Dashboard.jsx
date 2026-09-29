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
import { loadIncomesWithMigration } from "../../services/incomeService";
import {
  formatPeriodLabel,
  getCashOut,
  getCashReceived,
  getNetCashFlow,
} from "../../utils/incomeCalculations";

export default function Dashboard() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");

  const [userId, setUserId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
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
      const cachedIncome = getCached("income", user.uid);

      if (cachedExpenses) {
        setExpenses(cachedExpenses);
        setLoading(false);
      }
      if (cachedIncome) {
        setIncomes(cachedIncome);
      }

      const snapshot = await getDocs(collection(db, user.uid));
      const data = snapshot.docs
        .filter((item) => !item.id.startsWith("earnings-"))
        .map((item) => ({ id: item.id, ...item.data() }));

      let incomeData = cachedIncome || [];
      try {
        incomeData = await loadIncomesWithMigration(user.uid);
      } catch (error) {
        console.error("Error loading income for cash flow:", error);
      }

      if (active) {
        setExpenses(data);
        setCached("expenses", user.uid, data);
        setIncomes(incomeData);
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

  // Cash Flow uses receivedDate / paidDate (or inclusionDate fallback), NOT incomePeriod.
  const cashFlowPeriod =
    selectedYear !== "All" && selectedMonth !== "All"
      ? `${selectedYear}-${selectedMonth}`
      : null;
  const cashIn = cashFlowPeriod ? getCashReceived(incomes, cashFlowPeriod) : 0;
  const cashOut = cashFlowPeriod ? getCashOut(expenses, cashFlowPeriod) : 0;
  const netCash = cashFlowPeriod
    ? getNetCashFlow(incomes, expenses, cashFlowPeriod)
    : 0;

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

      {cashFlowPeriod && (
        <section className={styles.cashFlowCard}>
          <h2>Cash Flow</h2>
          <p className={styles.cashFlowPeriod}>{formatPeriodLabel(cashFlowPeriod)}</p>
          <p>
            Money In: <strong>{formatCurrency(cashIn)}</strong>
          </p>
          <p>
            Money Out: <strong>{formatCurrency(cashOut)}</strong>
          </p>
          <p>
            Net Cash Flow:{" "}
            <strong className={netCash < 0 ? styles.negative : undefined}>
              {netCash >= 0 ? "+" : ""}
              {formatCurrency(netCash)}
            </strong>
          </p>
          <p className={styles.cashFlowHint}>
            Based on received dates for income and payment dates for expenses — not the same as Earnings.
          </p>
        </section>
      )}

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

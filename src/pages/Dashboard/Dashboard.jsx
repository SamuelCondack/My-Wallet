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
import { formatCompactCurrency, formatCurrency } from "../../utils/finance";
import { getCached, setCached } from "../../utils/dataCache";
import { loadIncomesWithMigration } from "../../services/incomeService";
import {
  formatPeriodLabel,
  getCashReceived,
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
  const [simulatedMonthly, setSimulatedMonthly] = useState(null);
  const [simulateInput, setSimulateInput] = useState("");

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
  const expensesByMonth = useMemo(
    () => buildExpensesByMonth(expenses),
    [expenses]
  );
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
  const spendings = useMemo(
    () => getAggregatedMonthTotal(expensesByMonth, activeMonthKeys),
    [expensesByMonth, activeMonthKeys]
  );
  const categoryTotals = useMemo(
    () => getAggregatedCategoryTotals(expensesByMonth, activeMonthKeys),
    [expensesByMonth, activeMonthKeys]
  );

  const monthPeriod =
    selectedYear !== "All" && selectedMonth !== "All"
      ? `${selectedYear}-${selectedMonth}`
      : null;

  const moneyReceived = monthPeriod
    ? getCashReceived(incomes, monthPeriod)
    : 0;
  const leftThisMonth = moneyReceived - spendings;

  useEffect(() => {
    setSimulatedMonthly(null);
    setSimulateInput("");
  }, [monthPeriod, leftThisMonth]);

  const realMonthlySurplus = leftThisMonth;
  const usingSimulation = simulatedMonthly !== null;
  const activeMonthlySurplus = usingSimulation
    ? simulatedMonthly
    : realMonthlySurplus;

  const savingsForecast = useMemo(() => {
    if (!monthPeriod) {
      return null;
    }

    const monthNum = Number(selectedMonth);
    const monthsLeft = 12 - monthNum + 1;
    if (monthsLeft <= 0) {
      return null;
    }

    const points = [];
    for (let i = 0; i < monthsLeft; i += 1) {
      const monthIndex = monthNum + i;
      const label = new Date(0, monthIndex - 1).toLocaleString("en-US", {
        month: "short",
      });
      points.push({
        key: `${selectedYear}-${String(monthIndex).padStart(2, "0")}`,
        label,
        cumulative: activeMonthlySurplus * (i + 1),
        isCurrent: i === 0,
        isLast: i === monthsLeft - 1,
      });
    }

    const yearEndTotal = activeMonthlySurplus * monthsLeft;
    const maxAbs = Math.max(
      ...points.map((point) => Math.abs(point.cumulative)),
      1
    );

    return {
      monthsLeft,
      yearEndTotal,
      points,
      maxAbs,
    };
  }, [monthPeriod, selectedMonth, selectedYear, activeMonthlySurplus]);

  const applySimulation = (raw) => {
    const parsed = Number(String(raw).replace(",", "."));
    if (Number.isNaN(parsed)) {
      return;
    }
    setSimulatedMonthly(parsed);
    setSimulateInput(parsed.toFixed(2));
  };

  const resetSimulation = () => {
    setSimulatedMonthly(null);
    setSimulateInput("");
  };

  if (loading || categoriesLoading) {
    return <LoadingComponent variant="dashboard" />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
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
              const isCurrentMonth =
                selectedYear === currentYear && month === currentMonth;
              return (
                <option
                  key={month}
                  value={month}
                  data-current={isCurrentMonth}
                >
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

      {monthPeriod ? (
        <section className={styles.overviewCard}>
          <h2>Month overview</h2>
          <p className={styles.overviewPeriod}>
            {formatPeriodLabel(monthPeriod)}
          </p>

          <div className={styles.overviewGrid}>
            <div className={styles.overviewItem}>
              <span>Spendings</span>
              <strong>{formatCurrency(spendings)}</strong>
            </div>
            <div className={styles.overviewItem}>
              <span>Money received</span>
              <strong className={styles.received}>
                {formatCurrency(moneyReceived)}
              </strong>
            </div>
            <div className={styles.overviewItem}>
              <span>Left this month</span>
              <strong
                className={
                  leftThisMonth >= 0 ? styles.positive : styles.negative
                }
              >
                {leftThisMonth >= 0 ? "+" : ""}
                {formatCurrency(leftThisMonth)}
              </strong>
            </div>
          </div>

          <p className={styles.overviewHint}>
            Spendings matches Expenses for the month. Money received uses
            confirmation dates. Left = received − spendings.
          </p>
        </section>
      ) : (
        <div className={styles.totalCard}>
          <span>Total spendings</span>
          <strong>{formatCurrency(spendings)}</strong>
        </div>
      )}

      {savingsForecast && (
        <section className={styles.forecastCard}>
          <h2>Year-end savings forecast</h2>
          <p className={styles.forecastLead}>
            Simulate how much you&apos;d have by December if you saved this
            amount every month.
          </p>

          <div className={styles.forecastControls}>
            <label htmlFor="forecastMonthlySave" className={styles.forecastInputLabel}>
              Monthly save
            </label>
            <div className={styles.forecastInputRow}>
              <span className={styles.forecastCurrency}>$</span>
              <input
                id="forecastMonthlySave"
                type="text"
                inputMode="decimal"
                className={styles.forecastInput}
                value={
                  simulateInput !== ""
                    ? simulateInput
                    : activeMonthlySurplus.toFixed(2)
                }
                onChange={(e) => {
                  setSimulateInput(e.target.value);
                  const parsed = Number(String(e.target.value).replace(",", "."));
                  if (!Number.isNaN(parsed)) {
                    setSimulatedMonthly(parsed);
                  }
                }}
                onBlur={() => {
                  if (simulateInput === "") {
                    resetSimulation();
                    return;
                  }
                  applySimulation(simulateInput);
                }}
              />
              <button
                type="button"
                className={styles.forecastResetBtn}
                onClick={resetSimulation}
                disabled={!usingSimulation}
                title="Reset to real leftover"
              >
                Use real
              </button>
            </div>
          </div>

          <div
            className={`${styles.forecastChart} ${
              savingsForecast.points.length > 6 ? styles.forecastChartCrowded : ""
            }`}
            role="img"
            aria-label="Savings forecast chart"
          >
            {savingsForecast.points.map((point) => {
              const heightPct = Math.max(
                6,
                (Math.abs(point.cumulative) / savingsForecast.maxAbs) * 100
              );
              const isNegative = point.cumulative < 0;
              const crowded = savingsForecast.points.length > 6;
              const valueLabel = crowded
                ? formatCompactCurrency(point.cumulative)
                : formatCurrency(point.cumulative);

              return (
                <div key={point.key} className={styles.forecastBarCol}>
                  <span className={styles.forecastValue} title={formatCurrency(point.cumulative)}>
                    {valueLabel}
                  </span>
                  <div className={styles.forecastBarTrack}>
                    <div
                      className={`${styles.forecastBar} ${
                        isNegative ? styles.forecastBarNeg : ""
                      } ${point.isCurrent ? styles.forecastBarCurrent : ""}`}
                      style={{ height: `${heightPct}%` }}
                      title={`${point.label}: ${formatCurrency(point.cumulative)}`}
                    />
                  </div>
                  <span className={styles.forecastLabel}>{point.label}</span>
                </div>
              );
            })}
          </div>

          <p className={styles.forecastTotal}>
            Projected by Dec:{" "}
            <strong
              className={
                savingsForecast.yearEndTotal >= 0
                  ? styles.positive
                  : styles.negative
              }
            >
              {savingsForecast.yearEndTotal >= 0 ? "+" : ""}
              {formatCurrency(savingsForecast.yearEndTotal)}
            </strong>
          </p>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>By category</h2>
          <Link to="/home/categories" className={styles.linkBtn}>
            Manage categories
          </Link>
        </div>
        <CategoryPieChart data={categoryTotals} categoriesMap={categoriesMap} />
      </section>

      <section className={styles.section}>
        <h2>Breakdown</h2>
        <ul className={styles.list}>
          {categoryTotals.length === 0 && <li>No expenses for this period.</li>}
          {categoryTotals.map((item) => {
            const category = categoriesMap[item.categoryId];
            const percent = spendings
              ? ((item.value / spendings) * 100).toFixed(1)
              : 0;
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

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

const HORIZON_OPTIONS = [
  { value: "yearEnd", label: "Until Dec" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
];

function buildForecastMonths(startYear, startMonth, horizon) {
  const start = Number(startMonth);
  const year = Number(startYear);
  const count =
    horizon === "yearEnd" ? 12 - start + 1 : Math.max(1, Number(horizon) || 1);

  const months = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(year, start - 1 + i, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    months.push({
      key: `${y}-${m}`,
      label: date.toLocaleString("en-US", { month: "short" }),
      showYear: y !== year,
      yearShort: String(y).slice(2),
    });
  }
  return months;
}

function parseMoneyInput(raw) {
  const trimmed = String(raw).trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "." ||
    trimmed === "-."
  ) {
    return null;
  }
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");

  const [userId, setUserId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [forecastHorizon, setForecastHorizon] = useState("yearEnd");
  const [simulatedMonthly, setSimulatedMonthly] = useState(null);
  const [monthOverrides, setMonthOverrides] = useState({});
  const [simulateInput, setSimulateInput] = useState("");
  const [simulateFocused, setSimulateFocused] = useState(false);
  const [editingMonthKey, setEditingMonthKey] = useState(null);
  const [monthEditInput, setMonthEditInput] = useState("");
  const monthEditRef = useRef(null);

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
    setMonthOverrides({});
    setSimulateInput("");
    setEditingMonthKey(null);
    setMonthEditInput("");
  }, [monthPeriod, leftThisMonth]);

  const realMonthlySurplus = leftThisMonth;
  const baseMonthlySurplus =
    simulatedMonthly !== null ? simulatedMonthly : realMonthlySurplus;
  const usingSimulation =
    simulatedMonthly !== null || Object.keys(monthOverrides).length > 0;

  const getMonthAmount = (key) =>
    monthOverrides[key] !== undefined
      ? monthOverrides[key]
      : baseMonthlySurplus;

  const amountsEqual = (a, b) =>
    Math.abs(Number(a) - Number(b)) < 0.005;

  const savingsForecast = useMemo(() => {
    if (!monthPeriod) {
      return null;
    }

    const months = buildForecastMonths(
      selectedYear,
      selectedMonth,
      forecastHorizon
    );
    if (months.length === 0) {
      return null;
    }

    let cumulative = 0;
    const points = months.map((month, index) => {
      const amount = getMonthAmount(month.key);
      cumulative += amount;
      // Only months with a stored override that differs from the default
      const isCustom = monthOverrides[month.key] !== undefined;
      return {
        ...month,
        amount,
        cumulative,
        isCustom,
        isCurrent: index === 0,
        isLast: index === months.length - 1,
      };
    });

    const maxAbs = Math.max(
      ...points.map((point) => Math.abs(point.cumulative)),
      1
    );

    return {
      monthsCount: points.length,
      yearEndTotal: cumulative,
      points,
      maxAbs,
      isYearEnd: forecastHorizon === "yearEnd",
      showYears: months.some((month) => month.showYear),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    monthPeriod,
    selectedMonth,
    selectedYear,
    forecastHorizon,
    baseMonthlySurplus,
    monthOverrides,
  ]);

  useEffect(() => {
    if (!editingMonthKey || !monthEditRef.current) {
      return;
    }
    monthEditRef.current.focus();
    monthEditRef.current.select();
  }, [editingMonthKey]);

  const applySimulation = (raw) => {
    const parsed = parseMoneyInput(raw);
    if (parsed === null) {
      return false;
    }
    setSimulatedMonthly(parsed);
    setSimulateInput(parsed.toFixed(2));
    return true;
  };

  const resetSimulation = () => {
    setSimulatedMonthly(null);
    setMonthOverrides({});
    setSimulateInput("");
    setEditingMonthKey(null);
    setMonthEditInput("");
  };

  const startEditMonth = (point) => {
    setEditingMonthKey(point.key);
    setMonthEditInput(Number(point.amount).toFixed(2));
  };

  const cancelMonthEdit = () => {
    setEditingMonthKey(null);
    setMonthEditInput("");
  };

  const commitMonthEdit = () => {
    if (!editingMonthKey) {
      return;
    }
    const parsed = parseMoneyInput(monthEditInput);
    if (parsed === null) {
      cancelMonthEdit();
      return;
    }

    setMonthOverrides((current) => {
      const next = { ...current };
      // Only keep an override when it differs from the default monthly amount
      if (amountsEqual(parsed, baseMonthlySurplus)) {
        delete next[editingMonthKey];
      } else {
        next[editingMonthKey] = parsed;
      }
      return next;
    });
    cancelMonthEdit();
  };

  const goToCategoryExpenses = (categoryId) => {
    window.scrollTo(0, 0);
    if (!monthPeriod) {
      navigate("/home/expenses");
      return;
    }
    const params = new URLSearchParams({
      year: selectedYear,
      month: selectedMonth,
      category: categoryId,
    });
    navigate(`/home/expenses?${params.toString()}`);
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
          <h2>Savings forecast</h2>
          <p className={styles.forecastLead}>
            Set a monthly save amount, tap a bar to customize that month, and
            choose how far to project.
          </p>

          <div className={styles.forecastControls}>
            <div className={styles.forecastControlGrid}>
              <div>
                <label
                  htmlFor="forecastHorizon"
                  className={styles.forecastInputLabel}
                >
                  Horizon
                </label>
                <select
                  id="forecastHorizon"
                  className={styles.forecastSelect}
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(e.target.value)}
                >
                  {HORIZON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="forecastMonthlySave"
                  className={styles.forecastInputLabel}
                >
                  Default monthly save
                </label>
                <div className={styles.forecastInputRow}>
                  <span className={styles.forecastCurrency}>$</span>
                  <input
                    id="forecastMonthlySave"
                    type="text"
                    inputMode="decimal"
                    className={styles.forecastInput}
                    value={
                      simulateFocused || simulateInput !== ""
                        ? simulateInput
                        : baseMonthlySurplus.toFixed(2)
                    }
                    onFocus={() => {
                      setSimulateFocused(true);
                      if (simulateInput === "") {
                        setSimulateInput(
                          Number(baseMonthlySurplus).toFixed(2)
                        );
                      }
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setSimulateInput(raw);
                      const parsed = parseMoneyInput(raw);
                      if (parsed !== null) {
                        setSimulatedMonthly(parsed);
                      }
                    }}
                    onBlur={() => {
                      setSimulateFocused(false);
                      if (simulateInput.trim() === "") {
                        setSimulatedMonthly(null);
                        setSimulateInput("");
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
            </div>
            <p className={styles.forecastHint}>
              Tip: tap a month bar to set a custom amount for that month only.
            </p>
          </div>

          <div
            className={`${styles.forecastChart} ${
              savingsForecast.points.length > 6
                ? styles.forecastChartCrowded
                : ""
            }`}
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
              const isEditing = editingMonthKey === point.key;
              const editWidthCh = Math.min(
                12,
                Math.max(4, String(monthEditInput || "0").length + 1)
              );

              return (
                <div
                  key={point.key}
                  className={`${styles.forecastBarCol} ${
                    isEditing ? styles.forecastBarColEditing : ""
                  }`}
                >
                  <div className={styles.forecastValueSlot}>
                    {isEditing ? (
                      <input
                        ref={monthEditRef}
                        type="text"
                        inputMode="decimal"
                        className={styles.forecastMonthInput}
                        style={{ width: `${editWidthCh}ch` }}
                        value={monthEditInput}
                        aria-label={`Edit ${point.label} monthly save`}
                        onChange={(e) => setMonthEditInput(e.target.value)}
                        onBlur={commitMonthEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitMonthEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelMonthEdit();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${styles.forecastValueBtn} ${
                          point.isCustom ? styles.forecastValueCustom : ""
                        }`}
                        title={`Tap to edit ${point.label}: ${formatCurrency(
                          point.amount
                        )}/mo → ${formatCurrency(point.cumulative)} cumulative`}
                        onClick={() => startEditMonth(point)}
                      >
                        {valueLabel}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.forecastBarHit}
                    onClick={() => {
                      if (!isEditing) {
                        startEditMonth(point);
                      }
                    }}
                    aria-label={`Edit ${point.label} save amount`}
                  >
                    <div className={styles.forecastBarTrack}>
                      <div
                        className={`${styles.forecastBar} ${
                          isNegative ? styles.forecastBarNeg : ""
                        } ${point.isCurrent ? styles.forecastBarCurrent : ""} ${
                          point.isCustom ? styles.forecastBarCustom : ""
                        } ${isEditing ? styles.forecastBarEditing : ""}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </button>
                  <span className={styles.forecastLabel}>
                    <span className={styles.forecastLabelMonth}>
                      {point.label}
                    </span>
                    <span
                      className={styles.forecastLabelYear}
                      aria-hidden={!savingsForecast.showYears}
                    >
                      {savingsForecast.showYears
                        ? `'${point.key.slice(2, 4)}`
                        : "\u00A0"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <p className={styles.forecastTotal}>
            {savingsForecast.isYearEnd
              ? "Projected by Dec:"
              : `Projected in ${savingsForecast.monthsCount} mo:`}{" "}
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
        <CategoryPieChart
          data={categoryTotals}
          categoriesMap={categoriesMap}
          onSliceClick={monthPeriod ? goToCategoryExpenses : undefined}
        />
      </section>
    </div>
  );
}

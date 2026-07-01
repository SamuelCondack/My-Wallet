import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.scss";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import CategoryPieChart from "../../components/CategoryPieChart/CategoryPieChart";
import SpendingTrendChart from "../../components/SpendingTrendChart/SpendingTrendChart";
import BudgetProgress from "../../components/BudgetProgress/BudgetProgress";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useCategories } from "../../hooks/useCategories";
import { fetchExpenses, fetchEarnings } from "../../services/expensesService";
import { fetchBudgets, saveBudget } from "../../services/budgetsService";
import { fetchGoals } from "../../services/goalsService";
import { getMonthlyTrend } from "../../services/exportService";
import { getCategoryMap } from "../../services/categoriesService";
import {
  buildExpensesByMonth,
  getCategoryTotals,
  getMonthTotal,
  getUpcomingMonthlyReminders,
} from "../../utils/expenseCalculations";
import { formatCurrency, getMonthKey } from "../../utils/finance";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { userId, loading: authLoading } = useAuthUser();
  const { categories, loading: categoriesLoading } = useCategories(userId);
  const [expenses, setExpenses] = useState([]);
  const [earnings, setEarnings] = useState({});
  const [budgets, setBudgets] = useState({});
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const monthKey = getMonthKey();

  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;

    Promise.all([
      fetchExpenses(userId),
      fetchEarnings(userId),
      fetchBudgets(userId, monthKey),
      fetchGoals(userId),
    ])
      .then(([expensesData, earningsData, budgetsData, goalsData]) => {
        if (!active) {
          return;
        }
        setExpenses(expensesData);
        setEarnings(earningsData);
        setBudgets(budgetsData);
        setGoals(goalsData);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId, monthKey]);

  const categoriesMap = useMemo(() => getCategoryMap(categories), [categories]);
  const expensesByMonth = useMemo(() => buildExpensesByMonth(expenses), [expenses]);
  const monthSpending = getMonthTotal(expensesByMonth, monthKey);
  const monthEarnings = Number(earnings[monthKey] || 0);
  const balance = monthEarnings - monthSpending;

  const previousMonthKey = (() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return getMonthKey(date);
  })();
  const previousSpending = getMonthTotal(expensesByMonth, previousMonthKey);
  const spendingDelta =
    previousSpending > 0
      ? ((monthSpending - previousSpending) / previousSpending) * 100
      : 0;

  const categoryTotals = Object.entries(getCategoryTotals(expensesByMonth, monthKey)).map(
    ([categoryId, value]) => ({ categoryId, value })
  );
  const trend = getMonthlyTrend(expenses, 6);
  const reminders = getUpcomingMonthlyReminders(expenses);

  const handleEditBudget = async (category) => {
    const value = window.prompt(`Monthly budget for ${category.name} (R$):`, budgets[category.id] || "");
    if (value === null) {
      return;
    }
    await saveBudget(userId, monthKey, category.id, value);
    setBudgets((current) => ({ ...current, [category.id]: Number(value) || 0 }));
  };

  if (authLoading || categoriesLoading || loading) {
    return <LoadingComponent />;
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard</h1>
          <p>Your financial overview for this month</p>
        </div>
        <Link to="expenses" className={styles.linkBtn}>
          View expenses
        </Link>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span>Spent</span>
          <strong>{formatCurrency(monthSpending)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Earnings</span>
          <strong>{formatCurrency(monthEarnings)}</strong>
        </article>
        <article className={`${styles.summaryCard} ${balance < 0 ? styles.negative : styles.positive}`}>
          <span>Balance</span>
          <strong>{formatCurrency(balance)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>vs last month</span>
          <strong>{spendingDelta >= 0 ? "+" : ""}{spendingDelta.toFixed(1)}%</strong>
        </article>
      </section>

      {reminders.length > 0 && (
        <section className={styles.section}>
          <h2>Upcoming bills</h2>
          <ul className={styles.reminders}>
            {reminders.map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>{formatCurrency(item.value)}</span>
                <span>{item.dueDate.toLocaleDateString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2>Spending by category</h2>
        <CategoryPieChart data={categoryTotals} categoriesMap={categoriesMap} />
      </section>

      <section className={styles.section}>
        <h2>Last 6 months</h2>
        <SpendingTrendChart trend={trend} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Budgets</h2>
          <Link to="categories">Manage categories</Link>
        </div>
        <div className={styles.budgetGrid}>
          {categories.map((category) => (
            <BudgetProgress
              key={category.id}
              category={category}
              spent={categoryTotals.find((item) => item.categoryId === category.id)?.value || 0}
              limit={budgets[category.id] || 0}
              onEditLimit={handleEditBudget}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Savings goals</h2>
          <Link to="goals">Manage goals</Link>
        </div>
        {goals.length === 0 ? (
          <p className={styles.empty}>No goals yet. Create one to track your savings.</p>
        ) : (
          <div className={styles.goalsGrid}>
            {goals.slice(0, 3).map((goal) => {
              const progress = goal.targetAmount
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
              return (
                <article key={goal.id} className={styles.goalCard}>
                  <h3>{goal.name}</h3>
                  <div className={styles.goalTrack}>
                    <div className={styles.goalFill} style={{ width: `${progress}%` }} />
                  </div>
                  <p>
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

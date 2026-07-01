import { useEffect, useState } from "react";
import styles from "./Goals.module.scss";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { useAuthUser } from "../../hooks/useAuthUser";
import { createGoal, deleteGoal, fetchGoals, updateGoal } from "../../services/goalsService";
import { formatCurrency } from "../../utils/finance";
import { toast } from "react-toastify";

export default function Goals() {
  const { userId, loading: authLoading } = useAuthUser();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    deadline: "",
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    fetchGoals(userId)
      .then(setGoals)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const goalId = await createGoal(userId, form);
    setGoals((current) => [
      ...current,
      {
        id: goalId,
        ...form,
        currentAmount: Number(form.currentAmount) || 0,
        targetAmount: Number(form.targetAmount) || 0,
        status: "active",
      },
    ]);
    setForm({ name: "", targetAmount: "", currentAmount: "", deadline: "" });
    toast.success("Goal created");
  };

  const handleAddAmount = async (goal) => {
    const value = window.prompt(`Add amount to ${goal.name}:`, "0");
    if (value === null) {
      return;
    }

    const currentAmount = Number(goal.currentAmount) + Number(value);
    await updateGoal(userId, goal.id, { currentAmount });
    setGoals((current) =>
      current.map((item) => (item.id === goal.id ? { ...item, currentAmount } : item))
    );
  };

  const handleDelete = async (goalId) => {
    await deleteGoal(userId, goalId);
    setGoals((current) => current.filter((item) => item.id !== goalId));
    toast.success("Goal removed");
  };

  if (authLoading || loading) {
    return <LoadingComponent />;
  }

  return (
    <div className={styles.page}>
      <h1>Savings Goals</h1>
      <p className={styles.subtitle}>Track progress toward your financial targets</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          placeholder="Goal name"
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          required
        />
        <input
          type="number"
          placeholder="Target amount"
          value={form.targetAmount}
          onChange={(e) => setForm((current) => ({ ...current, targetAmount: e.target.value }))}
          required
        />
        <input
          type="number"
          placeholder="Current amount"
          value={form.currentAmount}
          onChange={(e) => setForm((current) => ({ ...current, currentAmount: e.target.value }))}
        />
        <input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm((current) => ({ ...current, deadline: e.target.value }))}
        />
        <button type="submit">Create goal</button>
      </form>

      <div className={styles.list}>
        {goals.map((goal) => {
          const progress = goal.targetAmount
            ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
            : 0;

          return (
            <article key={goal.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h3>{goal.name}</h3>
                <div className={styles.actions}>
                  <button type="button" onClick={() => handleAddAmount(goal)}>
                    Add
                  </button>
                  <button type="button" onClick={() => handleDelete(goal.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${progress}%` }} />
              </div>
              <p>
                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
              </p>
              {goal.deadline && <span>Deadline: {goal.deadline}</span>}
            </article>
          );
        })}
      </div>
    </div>
  );
}

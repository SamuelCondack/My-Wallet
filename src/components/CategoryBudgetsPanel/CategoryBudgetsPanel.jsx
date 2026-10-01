import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import BottomSheet from "../BottomSheet/BottomSheet";
import sheetStyles from "../BottomSheet/BottomSheet.module.scss";
import { formatCurrency } from "../../utils/finance";
import styles from "./CategoryBudgetsPanel.module.scss";

function budgetTone(spent, limit) {
  if (!(limit > 0)) return "ok";
  const ratio = spent / limit;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

function progressPercent(spent, limit) {
  if (!(limit > 0)) return 0;
  return Math.min(100, Math.round((spent / limit) * 100));
}

export function BudgetTeaserPreview() {
  return (
    <div className={styles.teaserList} aria-hidden="true">
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <span className={styles.rowIcon}>🍔</span>
          <div className={styles.rowCopy}>
            <strong>Food</strong>
            <span>$186 / $200</span>
          </div>
        </div>
        <div className={`${styles.track} ${styles.warn}`}>
          <span style={{ width: "93%" }} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <span className={styles.rowIcon}>🚗</span>
          <div className={styles.rowCopy}>
            <strong>Transport</strong>
            <span>$142 / $120</span>
          </div>
        </div>
        <div className={`${styles.track} ${styles.over}`}>
          <span style={{ width: "100%" }} />
        </div>
      </div>
    </div>
  );
}

export default function CategoryBudgetsPanel({
  monthPeriod,
  monthLabel,
  categoryTotals,
  categories,
  budgets,
  onSave,
  onRemove,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const spentByCategory = useMemo(() => {
    const map = {};
    categoryTotals.forEach((item) => {
      map[item.categoryId] = Number(item.value) || 0;
    });
    return map;
  }, [categoryTotals]);

  const categoryById = useMemo(() => {
    const map = {};
    categories.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [categories]);

  const budgetRows = useMemo(() => {
    return [...budgets]
      .map((budget) => {
        const spent = spentByCategory[budget.categoryId] || 0;
        const limit = Number(budget.amount) || 0;
        const category = categoryById[budget.categoryId];
        return {
          ...budget,
          spent,
          limit,
          tone: budgetTone(spent, limit),
          percent: progressPercent(spent, limit),
          name: category?.name || "Category",
          icon: category?.icon || "📦",
        };
      })
      .sort((a, b) => {
        const toneRank = { over: 0, warn: 1, ok: 2 };
        const rankDiff = (toneRank[a.tone] ?? 3) - (toneRank[b.tone] ?? 3);
        if (rankDiff !== 0) return rankDiff;
        return b.spent - a.spent;
      });
  }, [budgets, spentByCategory, categoryById]);

  const availableCategories = useMemo(() => {
    const taken = new Set(budgets.map((item) => item.categoryId));
    if (editingId) {
      return categories.filter(
        (item) => item.id === editingId || !taken.has(item.id)
      );
    }
    return categories.filter((item) => !taken.has(item.id));
  }, [categories, budgets, editingId]);

  const overCount = budgetRows.filter((row) => row.tone === "over").length;
  const warnCount = budgetRows.filter((row) => row.tone === "warn").length;

  const openCreate = () => {
    setEditingId(null);
    setCategoryId(availableCategories[0]?.id || "");
    setAmount("");
    setSheetOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.categoryId);
    setCategoryId(row.categoryId);
    setAmount(String(row.limit));
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (saving) return;
    setSheetOpen(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!categoryId) {
      toast.error("Pick a category.");
      return;
    }
    const value = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid monthly limit.");
      return;
    }

    setSaving(true);
    try {
      // Budgets are keyed by categoryId — moving category means delete + create.
      if (editingId && editingId !== categoryId) {
        await onRemove(editingId);
      }
      await onSave(categoryId, value);
      toast.success(editingId ? "Budget updated." : "Budget saved.");
      setSheetOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not save budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await onRemove(editingId);
      toast.success("Budget removed.");
      setSheetOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not remove budget.");
    } finally {
      setSaving(false);
    }
  };

  if (!monthPeriod) {
    return (
      <p className={styles.hint}>
        Pick a specific month above to track category budgets.
      </p>
    );
  }

  return (
    <>
      <div className={styles.panel}>
        {(overCount > 0 || warnCount > 0) && (
          <p
            className={`${styles.alert} ${
              overCount > 0 ? styles.alertOver : styles.alertWarn
            }`}
          >
            {overCount > 0
              ? `${overCount} categor${overCount === 1 ? "y is" : "ies are"} over budget this month.`
              : `${warnCount} categor${warnCount === 1 ? "y is" : "ies are"} nearing the limit.`}
          </p>
        )}

        <div className={styles.toolbar}>
          <p className={styles.periodNote}>
            Limits for <strong>{monthLabel || monthPeriod}</strong>
          </p>
          <button
            type="button"
            className={styles.addBtn}
            onClick={openCreate}
            disabled={availableCategories.length === 0}
          >
            Add budget
          </button>
        </div>

        {budgetRows.length === 0 ? (
          <p className={styles.empty}>
            Set a monthly limit on a category you care about.
          </p>
        ) : (
          <ul className={styles.list}>
            {budgetRows.map((row) => (
              <li key={row.categoryId}>
                <button
                  type="button"
                  className={styles.rowBtn}
                  onClick={() => openEdit(row)}
                >
                  <div className={styles.rowMain}>
                    <span className={styles.rowIcon} aria-hidden="true">
                      {row.icon}
                    </span>
                    <div className={styles.rowCopy}>
                      <strong>{row.name}</strong>
                      <span>
                        {formatCurrency(row.spent)} / {formatCurrency(row.limit)}
                        {row.tone === "over" ? " · Over" : row.tone === "warn" ? " · Almost" : ""}
                      </span>
                    </div>
                    <span className={styles.pct}>{row.percent}%</span>
                  </div>
                  <div className={`${styles.track} ${styles[row.tone]}`}>
                    <span style={{ width: `${row.percent}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        labelledBy="budget-sheet-title"
        lockScroll
      >
        <form className={styles.sheetForm} onSubmit={handleSave}>
          <div className={styles.sheetBody}>
            <header className={styles.sheetHeader}>
              <h2 id="budget-sheet-title">
                {editingId ? "Edit budget" : "Add budget"}
              </h2>
            </header>

            <label className={styles.fieldLabel} htmlFor="budgetCategory">
              Category
            </label>
            <select
              id="budgetCategory"
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={availableCategories.length === 0}
            >
              {availableCategories.length === 0 ? (
                <option value="">No categories left</option>
              ) : (
                availableCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.icon ? `${item.icon} ` : ""}
                    {item.name}
                  </option>
                ))
              )}
            </select>

            <label className={styles.fieldLabel} htmlFor="budgetAmount">
              Monthly limit
            </label>
            <div className={styles.amountRow}>
              <span aria-hidden="true">$</span>
              <input
                id="budgetAmount"
                className={styles.amountInput}
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </div>

            {editingId && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={handleRemove}
                disabled={saving}
              >
                Remove budget
              </button>
            )}
          </div>

          <div className={sheetStyles.footer}>
            <div className={sheetStyles.actions}>
              <button
                type="submit"
                className={sheetStyles.primaryBtn}
                disabled={saving || !categoryId}
              >
                {saving ? "Saving…" : editingId ? "Edit" : "Add"}
              </button>
              <button
                type="button"
                className={sheetStyles.secondaryBtn}
                onClick={closeSheet}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </BottomSheet>
    </>
  );
}

CategoryBudgetsPanel.propTypes = {
  monthPeriod: PropTypes.string,
  monthLabel: PropTypes.string,
  categoryTotals: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      value: PropTypes.number,
    })
  ),
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      icon: PropTypes.string,
    })
  ),
  budgets: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      amount: PropTypes.number,
    })
  ),
  onSave: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

CategoryBudgetsPanel.defaultProps = {
  monthPeriod: null,
  monthLabel: "",
  categoryTotals: [],
  categories: [],
  budgets: [],
};

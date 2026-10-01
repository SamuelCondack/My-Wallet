import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FaStar, FaRegStar, FaTimes, FaChevronRight, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import BottomSheet from "../../components/BottomSheet/BottomSheet";
import PaywallModal from "../../components/PaywallModal/PaywallModal";
import { DEFAULT_CATEGORY_ID } from "../../constants/defaultCategories";
import {
  FREE_FAVORITE_LIMIT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_COLORS,
} from "../../constants/quickAdd";
import { useSubscription } from "../../hooks/useSubscription";
import styles from "./ExpenseFormModal.module.scss";

function templateQuickValue(template) {
  const value = Number(template?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function monthSpendForCategory(expensesByMonth, monthKey, categoryId, excludeId) {
  if (!monthKey || !categoryId) return 0;
  return (expensesByMonth?.[monthKey] || [])
    .filter(
      (item) =>
        item.categoryId === categoryId &&
        (!excludeId || item.id !== excludeId)
    )
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function budgetImpactAmount({ value, isMonthly, installments }) {
  if (isMonthly) return value;
  const count = Number(installments);
  if (Number.isFinite(count) && count > 1) return value / count;
  return value;
}

const EMPTY_FORM = {
  name: "",
  value: "",
  inclusionDate: "",
  installments: "",
  paymentMethod: "Credit Card",
  pauseDate: "",
  categoryId: DEFAULT_CATEGORY_ID,
  isMonthly: false,
};

function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

function shortLabel(text, max = 18) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function HorizontalChipRow({ className, children }) {
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return undefined;

    const onWheel = (event) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={rowRef} className={className}>
      {children}
    </div>
  );
}

HorizontalChipRow.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

export default function ExpenseFormModal({
  isOpen,
  mode = "create",
  onClose,
  onSave,
  categories = [],
  favorites = [],
  recent = [],
  isPro = false,
  budgets = [],
  expensesByMonth = {},
  onAddFavorite,
  onRemoveFavorite,
  initialValues = null,
  editingExpense = null,
}) {
  const isCreate = mode === "create";
  const { canStartTrial } = useSubscription();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [stepPulse, setStepPulse] = useState(null);
  const valueRef = useRef(null);
  const categorySearchRef = useRef(null);
  const stepPulseTimerRef = useRef(0);

  const pulseStepper = (side) => {
    setStepPulse(side);
    if (stepPulseTimerRef.current) {
      window.clearTimeout(stepPulseTimerRef.current);
    }
    stepPulseTimerRef.current = window.setTimeout(() => {
      setStepPulse(null);
      stepPulseTimerRef.current = 0;
    }, 1100);
  };

  useEffect(() => {
    return () => {
      if (stepPulseTimerRef.current) {
        window.clearTimeout(stepPulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const defaults = {
      ...EMPTY_FORM,
      inclusionDate: todayISO(),
      categoryId: categories[0]?.id || DEFAULT_CATEGORY_ID,
    };

    const next = { ...defaults, ...(initialValues || {}) };
    setForm({
      name: next.name || "",
      value: next.value === 0 || next.value ? String(next.value) : "",
      inclusionDate: next.inclusionDate || todayISO(),
      installments: next.installments ?? "",
      paymentMethod: next.paymentMethod || "Credit Card",
      pauseDate: next.pauseDate || "",
      categoryId: next.categoryId || categories[0]?.id || DEFAULT_CATEGORY_ID,
      isMonthly: Boolean(next.isMonthly),
    });
    setCategoryPickerOpen(false);
    setCategorySearch("");
    setIsSaving(false);
    setIsSavingFavorite(false);

    let timer = 0;
    if (isCreate) {
      timer = window.setTimeout(() => {
        const nameInput = document.getElementById("expenseName");
        nameInput?.focus({ preventScroll: true });
      }, 40);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // Only reset when the modal opens — not when parent re-renders categories/initialValues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!categoryPickerOpen) return;
    const timer = window.setTimeout(() => {
      categorySearchRef.current?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [categoryPickerOpen]);

  const isMonthly = Boolean(form.isMonthly);

  const selectedCategory = useMemo(() => {
    return (
      categories.find((item) => item.id === form.categoryId) ||
      categories[0] || {
        id: DEFAULT_CATEGORY_ID,
        name: "Other",
        icon: "📦",
        color: "#B0B0B0",
      }
    );
  }, [categories, form.categoryId]);

  const budgetHint = useMemo(() => {
    if (!isPro || !budgets.length) return null;
    const budget = budgets.find((item) => item.categoryId === form.categoryId);
    const limit = Number(budget?.amount) || 0;
    if (!(limit > 0)) return null;

    const monthKey = String(form.inclusionDate || todayISO()).slice(0, 7);
    const excludeId = isCreate ? null : editingExpense?.id;
    const spent = monthSpendForCategory(
      expensesByMonth,
      monthKey,
      form.categoryId,
      excludeId
    );
    const draftValue = Number(String(form.value).replace(",", "."));
    const installmentsRaw = String(form.installments || "").trim();
    const impact =
      Number.isFinite(draftValue) && draftValue > 0
        ? budgetImpactAmount({
            value: draftValue,
            isMonthly: Boolean(form.isMonthly),
            installments: installmentsRaw,
          })
        : 0;
    const projected = spent + impact;
    const ratio = projected / limit;
    const tone = ratio >= 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
    return {
      limit,
      spent,
      projected,
      tone,
      percent: Math.min(100, Math.round(ratio * 100)),
    };
  }, [
    isPro,
    budgets,
    form.categoryId,
    form.inclusionDate,
    form.value,
    form.isMonthly,
    form.installments,
    expensesByMonth,
    isCreate,
    editingExpense?.id,
  ]);

  const quickCategories = useMemo(() => {
    const byId = new Map(categories.map((item) => [item.id, item]));
    const picks = [];
    const seen = new Set();

    for (const item of recent) {
      const id = item.categoryId || DEFAULT_CATEGORY_ID;
      if (seen.has(id) || !byId.has(id)) continue;
      seen.add(id);
      picks.push(byId.get(id));
      if (picks.length >= 4) break;
    }

    return picks.filter((item) => item.id !== form.categoryId);
  }, [categories, recent, form.categoryId]);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      return name.includes(query);
    });
  }, [categories, categorySearch]);

  const matchingFavorite = useMemo(() => {
    if (!isCreate) return null;
    const name = form.name.trim().toLowerCase();
    if (!name) return null;
    return (
      favorites.find(
        (item) =>
          item.name?.trim().toLowerCase() === name &&
          (item.categoryId || DEFAULT_CATEGORY_ID) === form.categoryId &&
          (item.paymentMethod || "Credit Card") === form.paymentMethod
      ) || null
    );
  }, [
    isCreate,
    favorites,
    form.name,
    form.categoryId,
    form.paymentMethod,
  ]);

  const applyTemplate = async (template) => {
    if (isSaving) return;

    const name = String(template?.name || "").trim();
    const quickValue = templateQuickValue(template);

    // One-tap save when name + amount are present (create only).
    if (isCreate && name && quickValue != null) {
      setIsSaving(true);
      try {
        const categoryId =
          template.categoryId || form.categoryId || DEFAULT_CATEGORY_ID;
        await onSave({
          name,
          value: quickValue,
          inclusionDate: form.inclusionDate || todayISO(),
          categoryId,
          paymentMethod:
            template.paymentMethod || form.paymentMethod || "Credit Card",
          isMonthly: false,
          installments: "",
          pauseDate: "",
        });
        if (isPro && budgets.length) {
          const budget = budgets.find((item) => item.categoryId === categoryId);
          const limit = Number(budget?.amount) || 0;
          if (limit > 0) {
            const monthKey = String(form.inclusionDate || todayISO()).slice(0, 7);
            const spent = monthSpendForCategory(
              expensesByMonth,
              monthKey,
              categoryId,
              null
            );
            if (spent + quickValue >= limit) {
              toast.info("That category is over its monthly budget.");
            } else if (spent + quickValue >= limit * 0.8) {
              toast.info("That category is nearing its monthly budget.");
            }
          }
        }
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setForm((prev) => ({
      ...prev,
      name: template.name || "",
      value:
        template.value === 0 || template.value
          ? String(template.value)
          : prev.value,
      categoryId: template.categoryId || prev.categoryId,
      paymentMethod: template.paymentMethod || prev.paymentMethod,
      isMonthly: false,
      installments: "",
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const value = Number(String(form.value).replace(",", "."));

    if (!name) {
      toast.error("Enter a name.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!form.inclusionDate) {
      toast.error("Pick an inclusion date.");
      return;
    }

    if (!isMonthly) {
      const installmentsRaw = String(form.installments || "").trim();
      if (installmentsRaw !== "") {
        const installments = Number(installmentsRaw);
        if (
          !Number.isFinite(installments) ||
          installments < 0 ||
          !Number.isInteger(installments)
        ) {
          toast.error("Installments must be 0 or a whole number.");
          return;
        }
      }
    }

    if (
      form.pauseDate &&
      form.inclusionDate &&
      new Date(form.pauseDate) <= new Date(form.inclusionDate)
    ) {
      toast.error("Pause date must be after inclusion date.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name,
        value,
        inclusionDate: form.inclusionDate,
        categoryId: form.categoryId || DEFAULT_CATEGORY_ID,
        paymentMethod: form.paymentMethod,
        isMonthly,
        installments: isMonthly
          ? ""
          : (() => {
              const raw = String(form.installments || "").trim();
              if (raw === "" || Number(raw) === 0) return "";
              return raw;
            })(),
        pauseDate: form.pauseDate || "",
      });
      if (budgetHint?.tone === "over") {
        toast.info(
          `${selectedCategory.name} is over its monthly budget after this expense.`
        );
      } else if (budgetHint?.tone === "warn") {
        toast.info(
          `${selectedCategory.name} is nearing its monthly budget.`
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!isCreate || !onAddFavorite || !onRemoveFavorite) return;

    const name = form.name.trim();
    if (!name) {
      toast.error("Enter a name before saving a favorite.");
      return;
    }

    setIsSavingFavorite(true);
    try {
      if (matchingFavorite) {
        await onRemoveFavorite(matchingFavorite.id);
        toast.success("Favorite removed.");
        return;
      }

      if (!isPro && favorites.length >= FREE_FAVORITE_LIMIT) {
        setPaywallOpen(true);
        return;
      }

      const valueNum = Number(String(form.value).replace(",", "."));
      await onAddFavorite({
        name,
        value: Number.isFinite(valueNum) && valueNum > 0 ? valueNum : null,
        categoryId: form.categoryId || DEFAULT_CATEGORY_ID,
        paymentMethod: form.paymentMethod,
      });
      toast.success("Saved to favorites.");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not update favorites.");
    } finally {
      setIsSavingFavorite(false);
    }
  };

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        labelledBy="expense-form-title"
        lockScroll
      >
        <header className={styles.header}>
          <h2 id="expense-form-title">
            {isCreate ? "Add expense" : "Edit expense"}
          </h2>
          <div className={styles.headerActions}>
            {isCreate && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleToggleFavorite}
                disabled={isSavingFavorite}
                aria-label={
                  matchingFavorite ? "Remove favorite" : "Save as favorite"
                }
                title={matchingFavorite ? "Remove favorite" : "Save favorite"}
              >
                {matchingFavorite ? <FaStar /> : <FaRegStar />}
              </button>
            )}
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.scrollBody}>
            {isCreate && (favorites.length > 0 || recent.length > 0) && (
              <div className={styles.shortcuts}>
                {favorites.length > 0 && (
                    <div className={styles.shortcutBlock}>
                    <p className={styles.shortcutLabel}>Favorites · quick add</p>
                    <HorizontalChipRow className={styles.chipRow}>
                      {favorites.map((item) => {
                        const canQuickAdd = templateQuickValue(item) != null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`${styles.chip} ${styles.favoriteChip}${
                              canQuickAdd ? ` ${styles.chipQuick}` : ""
                            }`}
                            onClick={() => applyTemplate(item)}
                            disabled={isSaving}
                            title={
                              canQuickAdd
                                ? "Tap to save this expense"
                                : "Tap to prefill"
                            }
                          >
                            <FaStar
                              className={styles.chipStar}
                              aria-hidden="true"
                            />
                            <span>{shortLabel(item.name)}</span>
                            {item.value != null && (
                              <em>${Number(item.value).toFixed(0)}</em>
                            )}
                          </button>
                        );
                      })}
                    </HorizontalChipRow>
                  </div>
                )}

                {recent.length > 0 && (
                  <div className={styles.shortcutBlock}>
                    <p className={styles.shortcutLabel}>
                      Repeat recent · quick add
                    </p>
                    <HorizontalChipRow className={styles.chipRow}>
                      {recent.map((item) => {
                        const canQuickAdd = templateQuickValue(item) != null;
                        return (
                          <button
                            key={`recent-${item.id}`}
                            type="button"
                            className={`${styles.chip}${
                              canQuickAdd ? ` ${styles.chipQuick}` : ""
                            }`}
                            onClick={() => applyTemplate(item)}
                            disabled={isSaving}
                            title={
                              canQuickAdd
                                ? "Tap to save this expense"
                                : "Tap to prefill"
                            }
                          >
                            <span>{shortLabel(item.name)}</span>
                            <em>${Number(item.value).toFixed(0)}</em>
                          </button>
                        );
                      })}
                    </HorizontalChipRow>
                  </div>
                )}
              </div>
            )}

            <label className={styles.fieldLabel} htmlFor="expenseName">
              Name
            </label>
            <input
              id="expenseName"
              name="name"
              type="text"
              placeholder="Coffee, Uber, groceries…"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className={styles.textInput}
              autoComplete="off"
            />

            <label className={styles.amountLabel} htmlFor="expenseValue">
              {!isCreate && Number(editingExpense?.installments) > 1
                ? "Total amount"
                : "Amount"}
            </label>
            <div className={styles.amountRow}>
              <span aria-hidden="true">$</span>
              <input
                ref={valueRef}
                id="expenseValue"
                name="value"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.value}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, value: e.target.value }))
                }
                className={styles.amountInput}
                autoComplete="off"
              />
            </div>

            <p className={styles.fieldLabel}>Category</p>
            <button
              type="button"
              className={styles.categoryTrigger}
              onClick={() => setCategoryPickerOpen(true)}
              style={{
                borderColor: selectedCategory.color || "#e4e4e7",
                backgroundColor: `${selectedCategory.color || "#3e92eb"}18`,
              }}
            >
              <span className={styles.categoryTriggerMain}>
                <span className={styles.categoryTriggerIcon}>
                  {selectedCategory.icon}
                </span>
                <span>{selectedCategory.name}</span>
              </span>
              <FaChevronRight className={styles.categoryChevron} aria-hidden="true" />
            </button>

            {budgetHint && (
              <div
                className={`${styles.budgetHint} ${
                  budgetHint.tone === "over"
                    ? styles.budgetHintOver
                    : budgetHint.tone === "warn"
                      ? styles.budgetHintWarn
                      : styles.budgetHintOk
                }`}
              >
                <div className={styles.budgetHintCopy}>
                  <strong>
                    {budgetHint.tone === "over"
                      ? "Over budget"
                      : budgetHint.tone === "warn"
                        ? "Near budget limit"
                        : "Within budget"}
                  </strong>
                  <span>
                    ${budgetHint.projected.toFixed(0)} / $
                    {budgetHint.limit.toFixed(0)} this month
                  </span>
                </div>
                <div className={styles.budgetHintTrack}>
                  <span style={{ width: `${budgetHint.percent}%` }} />
                </div>
              </div>
            )}

            {quickCategories.length > 0 && (
              <div className={styles.quickCategoryRow}>
                {quickCategories.map((category) => (
                  <button
                    key={`quick-${category.id}`}
                    type="button"
                    className={styles.quickCategoryChip}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        categoryId: category.id,
                      }))
                    }
                  >
                    {category.icon} {category.name}
                  </button>
                ))}
              </div>
            )}

            <p className={styles.fieldLabel}>Payment</p>
            <div className={styles.paymentGrid}>
              {PAYMENT_METHODS.map((method) => {
                const active = form.paymentMethod === method;
                const color = PAYMENT_METHOD_COLORS[method] || "#3e92eb";
                return (
                  <button
                    key={method}
                    type="button"
                    className={`${styles.paymentChip} ${
                      active ? styles.paymentChipActive : ""
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            color: "#fff",
                          }
                        : undefined
                    }
                    onClick={() =>
                      setForm((prev) => ({ ...prev, paymentMethod: method }))
                    }
                  >
                    {method}
                  </button>
                );
              })}
            </div>

            <label className={styles.fieldLabel} htmlFor="expenseDate">
              Inclusion date
            </label>
            <input
              id="expenseDate"
              name="inclusionDate"
              type="date"
              value={form.inclusionDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, inclusionDate: e.target.value }))
              }
              className={styles.textInput}
              max={
                form.pauseDate
                  ? new Date(new Date(form.pauseDate).getTime() - 86400000)
                      .toISOString()
                      .split("T")[0]
                  : undefined
              }
              required
            />

            <div className={styles.toggleRow}>
              <span>Monthly expense</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isMonthly}
                className={`${styles.switch} ${
                  form.isMonthly ? styles.switchOn : ""
                }`}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    isMonthly: !prev.isMonthly,
                    installments: !prev.isMonthly ? "" : prev.installments,
                    pauseDate: !prev.isMonthly ? prev.pauseDate : "",
                  }))
                }
              >
                <span className={styles.switchThumb} />
              </button>
            </div>

            {isMonthly && !isCreate && (
              <>
                <div className={styles.pauseDateHeader}>
                  <label className={styles.fieldLabel} htmlFor="expensePause">
                    Pause date
                  </label>
                  {form.pauseDate ? (
                    <button
                      type="button"
                      className={styles.clearPauseBtn}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, pauseDate: "" }))
                      }
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <input
                  id="expensePause"
                  name="pauseDate"
                  type="date"
                  value={form.pauseDate || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      pauseDate: e.target.value || "",
                    }))
                  }
                  className={styles.textInput}
                  min={
                    form.inclusionDate
                      ? new Date(
                          new Date(form.inclusionDate).getTime() + 86400000
                        )
                          .toISOString()
                          .split("T")[0]
                      : undefined
                  }
                />
              </>
            )}

            {!isMonthly && (
              <div className={styles.stepperField}>
                <label
                  className={styles.fieldLabel}
                  htmlFor="expenseInstallments"
                >
                  Installments
                </label>
                <div className={styles.stepperRow}>
                  <button
                    type="button"
                    className={`${styles.stepperBtn} ${
                      stepPulse === "dec" ? styles.stepperBtnPulse : ""
                    }`}
                    aria-label="Decrease installments"
                    disabled={isSaving}
                    onClick={(event) => {
                      event.currentTarget.blur();
                      pulseStepper("dec");
                      setForm((prev) => {
                        const raw = String(prev.installments ?? "").trim();
                        const current = Number(raw);
                        const base =
                          raw === "" || !Number.isFinite(current) ? 1 : current;
                        return {
                          ...prev,
                          installments: String(Math.max(0, base - 1)),
                        };
                      });
                    }}
                  >
                    −
                  </button>
                  <input
                    id="expenseInstallments"
                    name="installments"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.installments}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        installments: e.target.value,
                      }))
                    }
                    className={styles.stepperInput}
                  />
                  <button
                    type="button"
                    className={`${styles.stepperBtn} ${
                      stepPulse === "inc" ? styles.stepperBtnPulse : ""
                    }`}
                    aria-label="Increase installments"
                    disabled={isSaving}
                    onClick={(event) => {
                      event.currentTarget.blur();
                      pulseStepper("inc");
                      setForm((prev) => {
                        const raw = String(prev.installments ?? "").trim();
                        const current = Number(raw);
                        const next =
                          raw === "" || !Number.isFinite(current)
                            ? 1
                            : current + 1;
                        return { ...prev, installments: String(next) };
                      });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <div className={styles.modalButtons}>
              <button
                type="submit"
                className={styles.confirmButton}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving…"
                  : isCreate
                    ? "Add"
                    : "Edit"}
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </BottomSheet>

      <BottomSheet
        isOpen={isOpen && categoryPickerOpen}
        onClose={() => {
          setCategoryPickerOpen(false);
          setCategorySearch("");
        }}
        labelledBy="category-picker-title"
        zIndex={50}
        className={styles.categorySheet}
      >
        <header className={styles.categoryPickerHeader}>
          <h3 id="category-picker-title">Category</h3>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Close"
            onClick={() => {
              setCategoryPickerOpen(false);
              setCategorySearch("");
            }}
          >
            <FaTimes />
          </button>
        </header>

        <div className={styles.categorySearchWrap}>
          <FaSearch className={styles.categorySearchIcon} aria-hidden="true" />
          <input
            ref={categorySearchRef}
            type="search"
            className={styles.categorySearchInput}
            placeholder="Search categories…"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.categoryList}>
          {filteredCategories.length === 0 && (
            <p className={styles.categoryEmpty}>No categories found</p>
          )}
          {filteredCategories.map((category) => {
            const active = form.categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`${styles.categoryOption} ${
                  active ? styles.categoryOptionActive : ""
                }`}
                onClick={() => {
                  setForm((prev) => ({
                    ...prev,
                    categoryId: category.id,
                  }));
                  setCategoryPickerOpen(false);
                  setCategorySearch("");
                }}
              >
                <span
                  className={styles.categoryOptionDot}
                  style={{ backgroundColor: category.color || "#3e92eb" }}
                  aria-hidden="true"
                />
                <span className={styles.categoryOptionLabel}>
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </span>
                {active && <span className={styles.categoryCheck}>✓</span>}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title="Unlimited favorites + Pro tools"
        message={`Free plan allows ${FREE_FAVORITE_LIMIT} favorites. Upgrade for unlimited favorites and Pro tools.`}
        canStartTrial={canStartTrial}
      />
    </>
  );
}

ExpenseFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(["create", "edit"]),
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  categories: PropTypes.array,
  favorites: PropTypes.array,
  recent: PropTypes.array,
  isPro: PropTypes.bool,
  budgets: PropTypes.array,
  expensesByMonth: PropTypes.object,
  onAddFavorite: PropTypes.func,
  onRemoveFavorite: PropTypes.func,
  initialValues: PropTypes.object,
  editingExpense: PropTypes.object,
};

import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FaStar, FaRegStar, FaTimes, FaChevronRight, FaSearch } from "react-icons/fa";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { DEFAULT_CATEGORY_ID } from "../../constants/defaultCategories";
import {
  FREE_FAVORITE_LIMIT,
  PAYMENT_METHODS,
  PAYMENT_METHOD_COLORS,
} from "../../constants/quickAdd";
import styles from "./ExpenseFormModal.module.scss";

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

export default function ExpenseFormModal({
  isOpen,
  mode = "create",
  onClose,
  onSave,
  categories = [],
  favorites = [],
  recent = [],
  isPro = false,
  onAddFavorite,
  onRemoveFavorite,
  initialValues = null,
  editingExpense = null,
}) {
  const isCreate = mode === "create";
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const valueRef = useRef(null);
  const categorySearchRef = useRef(null);

  useBodyScrollLock(isOpen);

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

    const timer = window.setTimeout(() => {
      if (isCreate) {
        const nameInput = document.getElementById("expenseName");
        nameInput?.focus({ preventScroll: true });
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isOpen, initialValues, categories, isCreate]);

  useEffect(() => {
    if (!categoryPickerOpen) return;
    const timer = window.setTimeout(() => {
      categorySearchRef.current?.focus({ preventScroll: true });
    }, 80);
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

  if (!isOpen) return null;

  const applyTemplate = (template) => {
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
    valueRef.current?.focus({ preventScroll: true });
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
      if (!isCreate || installmentsRaw !== "") {
        const installments = Number(installmentsRaw || 1);
        if (!Number.isFinite(installments) || installments < 1) {
          toast.error("Installments must be at least 1.");
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
          : String(form.installments || "").trim() || (isCreate ? "" : "1"),
        pauseDate: form.pauseDate || "",
      });
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
        toast.info(
          `Free plan allows ${FREE_FAVORITE_LIMIT} favorites. Upgrade to Pro for unlimited.`
        );
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
    <div className={styles.root} role="presentation">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close"
        onClick={onClose}
      />

      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-form-title"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />

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
                    <p className={styles.shortcutLabel}>Favorites</p>
                    <div className={styles.chipRow}>
                      {favorites.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`${styles.chip} ${styles.favoriteChip}`}
                          onClick={() => applyTemplate(item)}
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
                      ))}
                    </div>
                  </div>
                )}

                {recent.length > 0 && (
                  <div className={styles.shortcutBlock}>
                    <p className={styles.shortcutLabel}>Repeat recent</p>
                    <div className={styles.chipRow}>
                      {recent.map((item) => (
                        <button
                          key={`recent-${item.id}`}
                          type="button"
                          className={styles.chip}
                          onClick={() => applyTemplate(item)}
                        >
                          <span>{shortLabel(item.name)}</span>
                          <em>${Number(item.value).toFixed(0)}</em>
                        </button>
                      ))}
                    </div>
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
                <label className={styles.fieldLabel} htmlFor="expensePause">
                  Pause date
                </label>
                <input
                  id="expensePause"
                  name="pauseDate"
                  type="date"
                  value={form.pauseDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, pauseDate: e.target.value }))
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
              <>
                <label
                  className={styles.fieldLabel}
                  htmlFor="expenseInstallments"
                >
                  Installments
                </label>
                <input
                  id="expenseInstallments"
                  name="installments"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  placeholder={isCreate ? "1 (optional)" : "1"}
                  value={form.installments}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      installments: e.target.value,
                    }))
                  }
                  className={styles.textInput}
                  required={!isCreate}
                />
              </>
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
      </motion.div>

      {categoryPickerOpen && (
        <div className={styles.categoryPickerRoot}>
          <button
            type="button"
            className={styles.categoryPickerBackdrop}
            aria-label="Close categories"
            onClick={() => {
              setCategoryPickerOpen(false);
              setCategorySearch("");
            }}
          />
          <motion.div
            className={styles.categoryPickerSheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-picker-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className={styles.handle} aria-hidden="true" />
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
          </motion.div>
        </div>
      )}
    </div>
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
  onAddFavorite: PropTypes.func,
  onRemoveFavorite: PropTypes.func,
  initialValues: PropTypes.object,
  editingExpense: PropTypes.object,
};

import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import styles from "./IncomeModal.module.scss";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  dateInputToPeriod,
  formatPeriodLabel,
  INCOME_STATUS,
  periodToDateInput,
} from "../../utils/incomeCalculations";
import { DEFAULT_INCOME_CATEGORY_ID } from "../../constants/defaultCategories";

const EMPTY_FORM = {
  description: "",
  amount: "",
  categoryId: DEFAULT_INCOME_CATEGORY_ID,
  incomePeriodDate: "",
  expectedDate: "",
  receivedDate: "",
  status: INCOME_STATUS.PENDING,
  notes: "",
};

export default function IncomeModal({
  isOpen,
  mode = "create",
  onRequestClose,
  onSubmit,
  initialValues,
  categories = [],
  isSubmitting = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialValues) {
      setForm({
        description: initialValues.description || "",
        amount:
          initialValues.amount === 0 || initialValues.amount
            ? String(initialValues.amount)
            : "",
        categoryId: initialValues.categoryId || categories[0]?.id || DEFAULT_INCOME_CATEGORY_ID,
        incomePeriodDate: periodToDateInput(
          initialValues.incomePeriodDate || initialValues.incomePeriod
        ),
        expectedDate: initialValues.expectedDate || "",
        receivedDate: initialValues.receivedDate || "",
        status: initialValues.status || INCOME_STATUS.PENDING,
        notes: initialValues.notes || "",
      });
    } else {
      const today = new Date().toLocaleDateString("en-CA");
      setForm({
        ...EMPTY_FORM,
        categoryId: categories[0]?.id || DEFAULT_INCOME_CATEGORY_ID,
        incomePeriodDate: today,
        expectedDate: today,
        status: INCOME_STATUS.PENDING,
      });
    }
  }, [isOpen, initialValues, categories]);

  if (!isOpen) {
    return null;
  }

  const isConfirmMode = mode === "confirm";
  const title =
    mode === "edit" ? "Edit Income" : mode === "confirm" ? "Confirm Income" : "Add Income";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "status" && value === INCOME_STATUS.PENDING) {
        next.receivedDate = "";
      }
      if (
        name === "status" &&
        value === INCOME_STATUS.CONFIRMED &&
        !prev.receivedDate
      ) {
        next.receivedDate = new Date().toLocaleDateString("en-CA");
      }
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      description: form.description,
      amount: parseFloat(String(form.amount).replace(/,/g, ".")),
      categoryId: form.categoryId,
      incomePeriod: dateInputToPeriod(form.incomePeriodDate),
      expectedDate: form.expectedDate,
      notes: form.notes,
      receivedDate:
        form.status === INCOME_STATUS.CONFIRMED || isConfirmMode
          ? form.receivedDate
          : null,
      status: isConfirmMode ? INCOME_STATUS.CONFIRMED : form.status,
    });
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onRequestClose} />
      <motion.div
        className={styles.modalContent}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h2>{title}</h2>
        <form onSubmit={handleSubmit} className={styles.editForm}>
          {!isConfirmMode && (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="income-description">Description</label>
                <input
                  id="income-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="income-amount">Amount</label>
                <input
                  id="income-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="income-category">Category</label>
                <select
                  id="income-category"
                  name="categoryId"
                  value={form.categoryId}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="income-period">Income Period</label>
                <input
                  id="income-period"
                  name="incomePeriodDate"
                  type="date"
                  value={form.incomePeriodDate}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
                <span className={styles.fieldHint}>
                  Belongs to {formatPeriodLabel(dateInputToPeriod(form.incomePeriodDate))}
                </span>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="income-expected">Expected Date</label>
                <input
                  id="income-expected"
                  name="expectedDate"
                  type="date"
                  value={form.expectedDate}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="income-status">Status</label>
                <select
                  id="income-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value={INCOME_STATUS.PENDING}>Pending</option>
                  <option value={INCOME_STATUS.CONFIRMED}>Confirmed</option>
                </select>
              </div>
            </>
          )}

          {isConfirmMode && (
            <div className={styles.confirmSummary}>
              <p>
                <strong>{form.description}</strong>
              </p>
              <p>Amount: ${Number(form.amount || 0).toFixed(2)}</p>
              <p>
                Income Period:{" "}
                {formatPeriodLabel(dateInputToPeriod(form.incomePeriodDate))}
              </p>
              <p>Expected: {form.expectedDate}</p>
            </div>
          )}

          {(form.status === INCOME_STATUS.CONFIRMED || isConfirmMode) && (
            <div className={styles.formGroup}>
              <label htmlFor="income-received">Received Date</label>
              <input
                id="income-received"
                name="receivedDate"
                type="date"
                value={form.receivedDate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>
          )}

          {!isConfirmMode && (
            <div className={styles.formGroup}>
              <label htmlFor="income-notes">Notes</label>
              <textarea
                id="income-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          )}

          <div className={styles.modalButtons}>
            <button
              type="submit"
              className={styles.confirmButton}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : isConfirmMode
                ? "Confirm received"
                : mode === "edit"
                ? "Edit"
                : "Add"}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onRequestClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

IncomeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(["create", "edit", "confirm"]),
  onRequestClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialValues: PropTypes.object,
  categories: PropTypes.array,
  isSubmitting: PropTypes.bool,
};

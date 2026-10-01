import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FaTimes } from "react-icons/fa";
import BottomSheet from "../../components/BottomSheet/BottomSheet";
import sheetStyles from "../../components/BottomSheet/BottomSheet.module.scss";
import {
  dateInputToPeriod,
  formatDisplayDate,
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
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialValues) {
      setForm({
        description: initialValues.description || "",
        amount:
          initialValues.amount === 0 || initialValues.amount
            ? String(initialValues.amount)
            : "",
        categoryId:
          initialValues.categoryId ||
          categories[0]?.id ||
          DEFAULT_INCOME_CATEGORY_ID,
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

    let timer = 0;
    if (mode === "create") {
      timer = window.setTimeout(() => {
        nameInputRef.current?.focus({ preventScroll: true });
      }, 40);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isConfirmMode = mode === "confirm";
  const title =
    mode === "edit"
      ? "Edit income"
      : mode === "confirm"
        ? "Confirm income"
        : "Add income";

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
    <BottomSheet
      isOpen={isOpen}
      onClose={onRequestClose}
      labelledBy="income-form-title"
    >
      <header className={sheetStyles.header}>
        <h2 id="income-form-title">{title}</h2>
        <div className={sheetStyles.headerActions}>
          <button
            type="button"
            className={sheetStyles.iconBtn}
            onClick={onRequestClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <FaTimes />
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className={sheetStyles.form}>
        <div className={sheetStyles.scrollBody}>
          {!isConfirmMode && (
            <>
              <label className={sheetStyles.fieldLabel} htmlFor="income-description">
                Name
              </label>
              <input
                ref={nameInputRef}
                id="income-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
                placeholder="Salary, freelance, refund…"
                autoComplete="off"
              />

              <label className={sheetStyles.amountLabel} htmlFor="income-amount">
                Amount
              </label>
              <div className={sheetStyles.amountRow}>
                <span aria-hidden="true">$</span>
                <input
                  id="income-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className={sheetStyles.amountInput}
                  placeholder="0.00"
                  autoComplete="off"
                />
              </div>

              <label className={sheetStyles.fieldLabel} htmlFor="income-category">
                Category
              </label>
              <select
                id="income-category"
                name="categoryId"
                value={form.categoryId}
                onChange={handleChange}
                disabled={isSubmitting}
                className={sheetStyles.selectInput}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>

              <label className={sheetStyles.fieldLabel} htmlFor="income-period">
                Income period
              </label>
              <input
                id="income-period"
                name="incomePeriodDate"
                type="date"
                value={form.incomePeriodDate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
              />
              <span className={sheetStyles.fieldHint}>
                Belongs to {formatPeriodLabel(dateInputToPeriod(form.incomePeriodDate))}
              </span>

              <label className={sheetStyles.fieldLabel} htmlFor="income-expected">
                Expected date
              </label>
              <input
                id="income-expected"
                name="expectedDate"
                type="date"
                value={form.expectedDate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
              />

              <p className={sheetStyles.fieldLabel}>Status</p>
              <div className={sheetStyles.statusRow}>
                {[
                  { id: INCOME_STATUS.PENDING, label: "Pending", color: "#ebab3d" },
                  {
                    id: INCOME_STATUS.CONFIRMED,
                    label: "Confirmed",
                    color: "#3e92eb",
                  },
                ].map((item) => {
                  const active = form.status === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`${sheetStyles.statusChip} ${
                        active ? sheetStyles.statusChipActive : ""
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: item.color,
                              borderColor: item.color,
                              color: "#fff",
                            }
                          : undefined
                      }
                      onClick={() =>
                        handleChange({
                          target: { name: "status", value: item.id },
                        })
                      }
                      disabled={isSubmitting}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isConfirmMode && (
            <div className={sheetStyles.confirmSummary}>
              <p>
                <strong>{form.description}</strong>
              </p>
              <p>Amount: ${Number(form.amount || 0).toFixed(2)}</p>
              <p>
                Income Period:{" "}
                {formatPeriodLabel(dateInputToPeriod(form.incomePeriodDate))}
              </p>
              <p>Expected: {formatDisplayDate(form.expectedDate)}</p>
            </div>
          )}

          {(form.status === INCOME_STATUS.CONFIRMED || isConfirmMode) && (
            <>
              <label className={sheetStyles.fieldLabel} htmlFor="income-received">
                Received date
              </label>
              <input
                id="income-received"
                name="receivedDate"
                type="date"
                value={form.receivedDate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
              />
            </>
          )}

          {!isConfirmMode && (
            <>
              <label className={sheetStyles.fieldLabel} htmlFor="income-notes">
                Notes
              </label>
              <textarea
                id="income-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                disabled={isSubmitting}
                className={sheetStyles.textarea}
                placeholder="Optional"
              />
            </>
          )}
        </div>

        <div className={sheetStyles.footer}>
          <div className={sheetStyles.actions}>
            <button
              type="submit"
              className={sheetStyles.primaryBtn}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving…"
                : isConfirmMode
                  ? "Confirm"
                  : mode === "edit"
                    ? "Edit"
                    : "Add"}
            </button>
            <button
              type="button"
              className={sheetStyles.secondaryBtn}
              onClick={onRequestClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </BottomSheet>
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

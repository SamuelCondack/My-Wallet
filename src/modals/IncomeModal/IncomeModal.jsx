import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FaTimes } from "react-icons/fa";
import BottomSheet from "../../components/BottomSheet/BottomSheet";
import sheetStyles from "../../components/BottomSheet/BottomSheet.module.scss";
import {
  formatDisplayDate,
  formatPeriodLabel,
  INCOME_STATUS,
} from "../../utils/incomeCalculations";
import { DEFAULT_INCOME_CATEGORY_ID } from "../../constants/defaultCategories";
import { useLanguage } from "../../i18n/useLanguage";
import styles from "./IncomeModal.module.scss";

const EMPTY_FORM = {
  description: "",
  amount: "",
  categoryId: DEFAULT_INCOME_CATEGORY_ID,
  incomePeriod: "",
  occurrenceDate: "",
  expectedDate: "",
  receivedDate: "",
  status: INCOME_STATUS.PENDING,
  installments: "",
  isMonthly: false,
  pauseDate: "",
  notes: "",
};

function currentPeriod() {
  return new Date().toLocaleDateString("en-CA").slice(0, 7);
}

export default function IncomeModal({
  isOpen,
  mode = "create",
  onRequestClose,
  onSubmit,
  initialValues,
  categories = [],
  isSubmitting = false,
}) {
  const { t, locale, language } = useLanguage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [stepPulse, setStepPulse] = useState({ side: null, tick: 0 });
  const nameInputRef = useRef(null);
  const stepPulseTimerRef = useRef(0);

  const pulseStepper = (side) => {
    if (stepPulseTimerRef.current) {
      window.clearTimeout(stepPulseTimerRef.current);
      stepPulseTimerRef.current = 0;
    }
    setStepPulse((prev) => ({ side, tick: prev.tick + 1 }));
    stepPulseTimerRef.current = window.setTimeout(() => {
      setStepPulse((prev) => ({ ...prev, side: null }));
      stepPulseTimerRef.current = 0;
    }, 1150);
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

    if (initialValues) {
      const today = new Date().toLocaleDateString("en-CA");
      const period =
        initialValues.incomePeriod ||
        (initialValues.incomePeriodDate || "").slice(0, 7) ||
        currentPeriod();
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
        incomePeriod: period,
        occurrenceDate:
          initialValues.occurrenceDate ||
          initialValues.expectedDate ||
          today,
        expectedDate: initialValues.expectedDate || "",
        receivedDate: initialValues.receivedDate || "",
        status: initialValues.status || INCOME_STATUS.PENDING,
        installments:
          Number(initialValues.installments) > 1
            ? String(Number(initialValues.installments))
            : "",
        isMonthly: Boolean(initialValues.isMonthly),
        pauseDate: initialValues.pauseDate || "",
        notes: initialValues.notes || "",
      });
    } else {
      const today = new Date().toLocaleDateString("en-CA");
      setForm({
        ...EMPTY_FORM,
        categoryId: categories[0]?.id || DEFAULT_INCOME_CATEGORY_ID,
        incomePeriod: currentPeriod(),
        occurrenceDate: today,
        expectedDate: today,
        status: INCOME_STATUS.PENDING,
        installments: "",
        isMonthly: false,
        pauseDate: "",
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
      ? t("incomeForm.editTitle")
      : mode === "confirm"
        ? t("incomeForm.confirmTitle")
        : t("incomeForm.addTitle");

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
    const isMonthly = Boolean(form.isMonthly);
    const installmentsRaw = String(form.installments || "").trim();
    const installments = Number(installmentsRaw);
    const resolvedInstallments =
      !isConfirmMode &&
      !isMonthly &&
      Number.isFinite(installments) &&
      installments > 1
        ? Math.floor(installments)
        : 1;
    onSubmit({
      description: form.description,
      amount: parseFloat(String(form.amount).replace(/,/g, ".")),
      categoryId: form.categoryId,
      incomePeriod: form.incomePeriod,
      occurrenceDate: form.occurrenceDate,
      expectedDate: form.expectedDate,
      notes: form.notes,
      installments: resolvedInstallments,
      isMonthly,
      pauseDate: isMonthly ? form.pauseDate || null : null,
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
            aria-label={t("common.close")}
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
                {t("incomeForm.name")}
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
                placeholder={t("incomeForm.namePlaceholder")}
                autoComplete="off"
              />

              <label className={sheetStyles.amountLabel} htmlFor="income-amount">
                {t("incomeForm.amount")}
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
                {t("incomeForm.category")}
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
                {t("incomeForm.incomePeriod")}
              </label>
              <input
                id="income-period"
                name="incomePeriod"
                type="month"
                value={form.incomePeriod}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
              />
              <span className={sheetStyles.fieldHint}>
                {t("incomeForm.belongsTo", {
                  period: formatPeriodLabel(form.incomePeriod, locale),
                })}
              </span>

              <label
                className={sheetStyles.fieldLabel}
                htmlFor="income-occurrence"
              >
                {t("incomeForm.occurrenceDate")}
              </label>
              <input
                id="income-occurrence"
                name="occurrenceDate"
                type="date"
                value={form.occurrenceDate}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className={sheetStyles.textInput}
              />
              <span className={sheetStyles.fieldHint}>
                {t("incomeForm.occurrenceDateHint")}
              </span>

              <label className={sheetStyles.fieldLabel} htmlFor="income-expected">
                {t("incomeForm.expectedDate")}
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

              <p className={sheetStyles.fieldLabel}>{t("incomeForm.status")}</p>
              <div className={sheetStyles.statusRow}>
                {[
                  {
                    id: INCOME_STATUS.PENDING,
                    label: t("income.pending"),
                    color: "#ebab3d",
                  },
                  {
                    id: INCOME_STATUS.CONFIRMED,
                    label: t("income.confirmed"),
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

              <div className={styles.toggleRow}>
                  <span>{t("incomeForm.monthlyIncome")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.isMonthly}
                    className={`${styles.switch} ${
                      form.isMonthly ? styles.switchOn : ""
                    }`}
                    disabled={isSubmitting}
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

              {form.isMonthly && mode === "edit" && (
                <>
                  <div className={styles.pauseDateHeader}>
                    <label
                      className={sheetStyles.fieldLabel}
                      htmlFor="income-pause"
                    >
                      {t("incomeForm.pauseDate")}
                    </label>
                    {form.pauseDate ? (
                      <button
                        type="button"
                        className={styles.clearPauseBtn}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, pauseDate: "" }))
                        }
                        disabled={isSubmitting}
                      >
                        {t("common.clear")}
                      </button>
                    ) : null}
                  </div>
                  <input
                    id="income-pause"
                    name="pauseDate"
                    type="date"
                    value={form.pauseDate || ""}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className={sheetStyles.textInput}
                    min={
                      form.incomePeriod
                        ? `${form.incomePeriod}-02`
                        : undefined
                    }
                  />
                </>
              )}

              {!form.isMonthly && (
                <div className={styles.stepperField}>
                  <label
                    className={sheetStyles.fieldLabel}
                    htmlFor="income-installments"
                  >
                    {t("incomeForm.installments")}
                  </label>
                  <div className={styles.stepperRow}>
                    <button
                      key={
                        stepPulse.side === "dec"
                          ? `dec-${stepPulse.tick}`
                          : "dec"
                      }
                      type="button"
                      className={`${styles.stepperBtn} ${
                        stepPulse.side === "dec" ? styles.stepperBtnPulse : ""
                      }`}
                      aria-label={t("incomeForm.decreaseInstallments")}
                      disabled={isSubmitting}
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
                      id="income-installments"
                      name="installments"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={form.installments}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      className={styles.stepperInput}
                    />
                    <button
                      key={
                        stepPulse.side === "inc"
                          ? `inc-${stepPulse.tick}`
                          : "inc"
                      }
                      type="button"
                      className={`${styles.stepperBtn} ${
                        stepPulse.side === "inc" ? styles.stepperBtnPulse : ""
                      }`}
                      aria-label={t("incomeForm.increaseInstallments")}
                      disabled={isSubmitting}
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
            </>
          )}

          {isConfirmMode && (
            <div className={sheetStyles.confirmSummary}>
              <p>
                <strong>{form.description}</strong>
              </p>
              {initialValues?.isMonthly && (
                <p className={styles.installmentBadge}>
                  {t("incomeForm.monthlyIncome")}
                </p>
              )}
              {Number(initialValues?.installments) > 1 && (
                <p className={styles.installmentBadge}>
                  {t("incomeForm.installmentBadge", {
                    n: initialValues.installmentNumber,
                    count: initialValues.installments,
                  })}
                </p>
              )}
              <p>
                {t("incomeForm.amountLine", {
                  amount: `$${Number(form.amount || 0).toFixed(2)}`,
                })}
              </p>
              <p>
                {t("income.periodLabel", {
                  period: formatPeriodLabel(form.incomePeriod, locale),
                })}
              </p>
              <p>
                {t("incomeForm.expectedLine", {
                  date: formatDisplayDate(form.expectedDate, language),
                })}
              </p>
            </div>
          )}

          {(form.status === INCOME_STATUS.CONFIRMED || isConfirmMode) && (
            <>
              <label className={sheetStyles.fieldLabel} htmlFor="income-received">
                {t("incomeForm.receivedDate")}
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
                {t("incomeForm.notes")}
              </label>
              <textarea
                id="income-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                disabled={isSubmitting}
                className={sheetStyles.textarea}
                placeholder={t("incomeForm.notesPlaceholder")}
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
                ? t("common.saving")
                : isConfirmMode
                  ? t("common.confirm")
                  : mode === "edit"
                    ? t("common.edit")
                    : t("common.add")}
            </button>
            <button
              type="button"
              className={sheetStyles.secondaryBtn}
              onClick={onRequestClose}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
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

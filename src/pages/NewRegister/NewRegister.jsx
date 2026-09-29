import { useEffect, useMemo, useState } from "react";
import styles from "./NewRegister.module.scss";
import { auth, db } from "../../../config/firebase";
import { addDoc, collection } from "firebase/firestore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useCategories } from "../../hooks/useCategories";
import {
  DEFAULT_CATEGORY_ID,
  DEFAULT_INCOME_CATEGORY_ID,
} from "../../constants/defaultCategories";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { invalidateCached } from "../../utils/dataCache";
import {
  getExpenseCategories,
  getIncomeCategories,
} from "../../services/categoriesService";
import { createIncome } from "../../services/incomeService";
import {
  dateInputToPeriod,
  formatPeriodLabel,
  INCOME_STATUS,
} from "../../utils/incomeCalculations";

export default function NewRegister() {
  const [registerType, setRegisterType] = useState("expense");
  const [name, setName] = useState("");
  const [inclusionDate, setInclusionDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [value, setValue] = useState("");
  const [installments, setInstallments] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Money");
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMonthly, setIsMonthly] = useState(false);

  const [incomePeriodDate, setIncomePeriodDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [expectedDate, setExpectedDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [receivedDate, setReceivedDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [incomeStatus, setIncomeStatus] = useState(INCOME_STATUS.PENDING);
  const [notes, setNotes] = useState("");

  const userId = auth?.currentUser?.uid;
  const { categories, loading: categoriesLoading } = useCategories(userId);
  const expenseCategories = useMemo(
    () => getExpenseCategories(categories),
    [categories]
  );
  const incomeCategories = useMemo(
    () => getIncomeCategories(categories),
    [categories]
  );
  const activeCategories =
    registerType === "income" ? incomeCategories : expenseCategories;
  const expensesCollectionRef = userId ? collection(db, userId) : null;

  useEffect(() => {
    if (activeCategories.length === 0) {
      return;
    }
    if (!activeCategories.some((item) => item.id === categoryId)) {
      setCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, categoryId]);

  useEffect(() => {
    setCategoryId(
      registerType === "income"
        ? incomeCategories[0]?.id || DEFAULT_INCOME_CATEGORY_ID
        : expenseCategories[0]?.id || DEFAULT_CATEGORY_ID
    );
  }, [registerType, incomeCategories, expenseCategories]);

  const resetExpenseForm = () => {
    setName("");
    setInclusionDate(new Date().toLocaleDateString("en-CA"));
    setValue("");
    setInstallments("");
    setPaymentMethod("Money");
    setCategoryId(expenseCategories[0]?.id || DEFAULT_CATEGORY_ID);
    setIsMonthly(false);
  };

  const resetIncomeForm = () => {
    const today = new Date().toLocaleDateString("en-CA");
    setName("");
    setValue("");
    setIncomePeriodDate(today);
    setExpectedDate(today);
    setReceivedDate(today);
    setIncomeStatus(INCOME_STATUS.PENDING);
    setNotes("");
    setCategoryId(incomeCategories[0]?.id || DEFAULT_INCOME_CATEGORY_ID);
  };

  const registerExpense = async () => {
    const expenseBase = {
      name,
      inclusionDate,
      value: parseFloat(value.replace(/,/g, ".")),
      installments: installments > 0 ? installments : "",
      method: paymentMethod,
      isMonthly,
      categoryId,
    };

    const monthlyExpenseFields = isMonthly ? { status: "active" } : {};
    const newExpense = { ...expenseBase, ...monthlyExpenseFields };

    await addDoc(expensesCollectionRef, newExpense);
    invalidateCached("expenses", userId);
    resetExpenseForm();
    toast.success("Expense registered!");
  };

  const registerIncome = async () => {
    await createIncome(userId, {
      description: name,
      amount: parseFloat(value.replace(/,/g, ".")),
      categoryId,
      incomePeriod: dateInputToPeriod(incomePeriodDate),
      expectedDate,
      receivedDate:
        incomeStatus === INCOME_STATUS.CONFIRMED ? receivedDate : null,
      status: incomeStatus,
      notes,
    });
    resetIncomeForm();
    toast.success("Income registered!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (registerType === "income") {
        await registerIncome();
      } else {
        await registerExpense();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error registering item!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (categoriesLoading) {
    return <LoadingComponent variant="form" />;
  }

  return (
    <div className={styles.newRegister}>
      <h1 className={styles.newRegisterTitle}>NEW REGISTER</h1>

      <div className={styles.typeToggle} role="group" aria-label="Register type">
        <button
          type="button"
          className={`${styles.typeButton} ${
            registerType === "expense" ? styles.typeButtonActive : ""
          }`}
          onClick={() => setRegisterType("expense")}
        >
          Expense
        </button>
        <button
          type="button"
          className={`${styles.typeButton} ${
            registerType === "income" ? styles.typeButtonActive : ""
          }`}
          onClick={() => setRegisterType("income")}
        >
          Income
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.inputsContainer}>
        <label htmlFor="nameRegister" className={styles.newRegisterLabels}>
          {registerType === "income" ? "Description" : "Name"}
        </label>
        <input
          id="nameRegister"
          className={styles.newRegisterInputs}
          type="text"
          required
          placeholder={
            registerType === "income"
              ? "e.g. YouTube Sponsorship"
              : "name your registry"
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label htmlFor="categoryRegister" className={styles.newRegisterLabels}>
          Category
        </label>
        <select
          id="categoryRegister"
          className={styles.newRegisterInputs}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {activeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>

        {registerType === "expense" ? (
          <>
            <label htmlFor="inclusionDateRegister" className={styles.newRegisterLabels}>
              Date
            </label>
            <input
              id="inclusionDateRegister"
              className={styles.newRegisterInputs}
              type="date"
              value={inclusionDate}
              required
              onChange={(e) => setInclusionDate(e.target.value)}
            />
          </>
        ) : (
          <>
            <label htmlFor="incomePeriodRegister" className={styles.newRegisterLabels}>
              Income Period
            </label>
            <input
              id="incomePeriodRegister"
              className={styles.newRegisterInputs}
              type="date"
              value={incomePeriodDate}
              required
              onChange={(e) => setIncomePeriodDate(e.target.value)}
            />
            <span className={styles.fieldHint}>
              Belongs to {formatPeriodLabel(dateInputToPeriod(incomePeriodDate))}
            </span>

            <label htmlFor="expectedDateRegister" className={styles.newRegisterLabels}>
              Expected Date
            </label>
            <input
              id="expectedDateRegister"
              className={styles.newRegisterInputs}
              type="date"
              value={expectedDate}
              required
              onChange={(e) => setExpectedDate(e.target.value)}
            />

            <label htmlFor="statusRegister" className={styles.newRegisterLabels}>
              Status
            </label>
            <select
              id="statusRegister"
              className={styles.newRegisterInputs}
              value={incomeStatus}
              onChange={(e) => setIncomeStatus(e.target.value)}
            >
              <option value={INCOME_STATUS.PENDING}>Pending</option>
              <option value={INCOME_STATUS.CONFIRMED}>Confirmed</option>
            </select>

            {incomeStatus === INCOME_STATUS.CONFIRMED && (
              <>
                <label htmlFor="receivedDateRegister" className={styles.newRegisterLabels}>
                  Received Date
                </label>
                <input
                  id="receivedDateRegister"
                  className={styles.newRegisterInputs}
                  type="date"
                  value={receivedDate}
                  required
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </>
            )}
          </>
        )}

        <label htmlFor="valueRegister" className={styles.newRegisterLabels}>
          {registerType === "income" ? "Amount" : "Value"}
        </label>
        <input
          id="valueRegister"
          className={styles.newRegisterInputs}
          type="text"
          inputMode="decimal"
          placeholder={
            registerType === "income" ? "how much did you earn?" : "how much did it cost?"
          }
          value={value}
          required
          onChange={(e) => setValue(e.target.value)}
        />

        {registerType === "expense" ? (
          <>
            <label htmlFor="isMonthlyRegister" className={styles.checkboxRow}>
              <span className={styles.newRegisterLabels}>Monthly Expense</span>
              <input
                id="isMonthlyRegister"
                type="checkbox"
                checked={isMonthly}
                onChange={(e) => setIsMonthly(e.target.checked)}
              />
            </label>

            <label htmlFor="installmentsRegister" className={styles.newRegisterLabels}>
              Installments
            </label>
            <input
              id="installmentsRegister"
              className={styles.newRegisterInputs}
              type="number"
              inputMode="numeric"
              placeholder="how many installments?"
              disabled={isMonthly}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />

            <label htmlFor="paymentMethodRegister" className={styles.newRegisterLabels}>
              Payment Method
            </label>
            <select
              id="paymentMethodRegister"
              className={styles.newRegisterInputs}
              value={paymentMethod}
              required
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Money">Money</option>
              <option value="Pix">Pix</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
            </select>
          </>
        ) : (
          <>
            <label htmlFor="notesRegister" className={styles.newRegisterLabels}>
              Notes
            </label>
            <textarea
              id="notesRegister"
              className={styles.newRegisterInputs}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional notes"
            />
          </>
        )}

        <button className={styles.registerButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? <div className={styles.spinner}></div> : "Register"}
        </button>
      </form>
    </div>
  );
}

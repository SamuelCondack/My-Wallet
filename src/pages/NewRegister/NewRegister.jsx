import { useEffect, useState } from "react";
import styles from "./NewRegister.module.scss";
import { auth, db } from "../../../config/firebase";
import { addDoc, collection } from "firebase/firestore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useCategories } from "../../hooks/useCategories";
import { DEFAULT_CATEGORY_ID } from "../../constants/defaultCategories";

export default function NewRegister() {
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

  const userId = auth?.currentUser?.uid;
  const { categories } = useCategories(userId);
  const expensesCollectionRef = userId ? collection(db, userId) : null;

  useEffect(() => {
    if (categories.length > 0 && !categories.some((item) => item.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const registerExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
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

      await addDoc(expensesCollectionRef, newExpense).then(() => {
        setName("");
        setInclusionDate(new Date().toLocaleDateString("en-CA"));
        setValue("");
        setInstallments("");
        setPaymentMethod("Money");
        setCategoryId(DEFAULT_CATEGORY_ID);
        setIsMonthly(false);
        toast.success("Item registered!");
      });
    } catch (err) {
      console.error(err);
      toast.error("Error registering item!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.newRegister}>
      <h1 className={styles.newRegisterTitle}>NEW REGISTER</h1>
      <form onSubmit={registerExpense} className={styles.inputsContainer}>
        <label htmlFor="nameRegister" className={styles.newRegisterLabels}>
          Name
        </label>
        <input
          id="nameRegister"
          className={styles.newRegisterInputs}
          type="text"
          required
          placeholder="name your registry"
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
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>

        <label htmlFor="inclusionDateRegister" className={styles.newRegisterLabels}>
          Date
        </label>
        <input
          id="inclusionDateRegister"
          className={styles.newRegisterInputs}
          type="date"
          placeholder="mm/dd/yyyy"
          value={inclusionDate}
          required
          onChange={(e) => setInclusionDate(e.target.value)}
        />

        <label htmlFor="valueRegister" className={styles.newRegisterLabels}>
          Value
        </label>
        <input
          id="valueRegister"
          className={styles.newRegisterInputs}
          type="text"
          inputMode="decimal"
          placeholder="how much did it cost?"
          value={value}
          required
          onChange={(e) => setValue(e.target.value)}
        />

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

        <button className={styles.registerButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? <div className={styles.spinner}></div> : "Register"}
        </button>
      </form>
    </div>
  );
}

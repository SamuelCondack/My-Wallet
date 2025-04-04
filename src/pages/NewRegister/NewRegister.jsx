import { useState } from "react";
import styles from "./NewRegister.module.scss";
import { db } from "../../../config/firebase";
import { addDoc, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ToastComponent from "../../components/Toast/ToastComponent";

export default function NewRegister() {
  const [name, setName] = useState("");
  const [inclusionDate, setInclusionDate] = useState("");
  const [value, setValue] = useState("");
  const [installments, setInstallments] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Money");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const auth = getAuth();
  const user = auth?.currentUser;

  const expensesCollectionRef = user ? collection(db, user?.uid) : null;

  const registerExpense = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(expensesCollectionRef, {
        name: name,
        inclusionDate: inclusionDate,
        value: parseFloat(value.replace(/,/g, ".")),
        installments: installments,
        method: paymentMethod,
      }).then(() => {
        setName("");
        setInclusionDate("");
        setValue("");
        setInstallments("");
        setPaymentMethod("Money");
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
      <ToastComponent />
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

        <label
          htmlFor="inclusionDateRegister"
          className={styles.newRegisterLabels}
        >
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
          placeholder="how much did it cost?"
          value={value}
          required
          onChange={(e) => setValue(e.target.value)}
        />

        <label
          htmlFor="installmentsRegister"
          className={styles.newRegisterLabels}
        >
          Installments
        </label>
        <input
          id="installmentsRegister"
          className={styles.newRegisterInputs}
          type="number"
          placeholder="how many installments?"
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
        />

        <label
          htmlFor="paymentMethodRegister"
          className={styles.newRegisterLabels}
        >
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

        <button
          className={styles.registerButton}
          type="submit"
          disabled={isSubmitting} // Desativa o botão enquanto está carregando
        >
          {isSubmitting ? (
            <div className={styles.spinner}></div> // Mostra o spinner enquanto carrega
          ) : (
            "Register"
          )}
        </button>
      </form>
    </div>
  );
}

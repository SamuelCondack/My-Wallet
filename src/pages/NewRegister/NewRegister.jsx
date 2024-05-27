import { useState } from "react";
import styles from "./NewRegister.module.scss";
import { db } from "../../../config/firebase";
import { addDoc, collection } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

export default function NewRegister() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inclusionDate, setInclusionDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [value, setValue] = useState("");
  const [installments, setInstallments] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Money");

  const auth = getAuth();
  const user = auth?.currentUser;

  const expensesCollectionRef = user ? collection(db, user?.uid) : null;

  const registerExpense = async (e) => {
    e.preventDefault();
    try {
      await addDoc(expensesCollectionRef, {
        name: name,
        description: description,
        inclusionDate: inclusionDate,
        // expireDate: expireDate,
        value: parseFloat(value.replace(/,/g, '.')),  // Convertendo para número antes de armazenar
        // installments: installments,
        method: paymentMethod,
      }).then(() => {
        setName("");
        setDescription("");
        setInclusionDate("");
        // setExpireDate("");
        setValue("");
        // setInstallments("");
        setPaymentMethod("Money");
      });
    } catch (err) {
      console.error(err);
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

        <label
          htmlFor="descriptionRegister"
          className={styles.newRegisterLabels}
        >
          Description
        </label>
        <textarea
          id="descriptionRegister"
          className={styles.newRegisterInputs}
          cols="30"
          rows="10"
          placeholder="just put any example that decripts well..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

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

        {/* <label
          htmlFor="expireDateRegister"
          className={styles.newRegisterLabels}
        >
          Expire Date
        </label>
        <input
          id="expireDateRegister"
          className={styles.newRegisterInputs}
          type="date"
          placeholder="mm/dd/yyyy"
          value={expireDate}
          onChange={(e) => setExpireDate(e.target.value)}
        /> */}

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

        {/* <label
          htmlFor="installmentsRegister"
          className={styles.newRegisterLabels}
        >
          Installments
        </label>
        <input
          id="installmentsRegister"
          className={styles.newRegisterInputs}
          type="number"
          placeholder="how many installments?
          "
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
        /> */}

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

        <button className={styles.registerButton} type="submit">
          Register
        </button>
      </form>
    </div>
  );
}

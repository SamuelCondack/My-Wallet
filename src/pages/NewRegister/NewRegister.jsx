import { useEffect, useState } from "react";
import styles from "./NewRegister.module.scss";
import { db } from "../../../config/firebase";
import { addDoc, collection } from "firebase/firestore";
import { getAuth } from 'firebase/auth';


export default function NewRegister() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inclusionDate, setInclusionDate] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [value, setValue] = useState(0);
  const [installments, setInstallments] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("money");

  //trocar o acesso de expensesCollectionRef, ele está passando expenses, mas na verdade deve passar algum identificador do usuário, então cada usuário vai ter um identificador único e o banco de dados terá esse identificador como uma tabela, dentro da tabela tera os expenses. então o expenses deve ser o auth.identificadorUnicoDoUsuário

  const auth = getAuth()

  useEffect(()=>{
    console.log(auth?.currentUser?.uid);
  }, [])
 
  const expensesCollectionRef = collection(db, auth?.currentUser?.uid);

  const registerExpense = async (e) => {
    e.preventDefault();
    try {
      await addDoc(expensesCollectionRef, {
        name: name,
        description: description,
        inclusionDate: inclusionDate,
        expireDate: expireDate,
        value: value,
        installments: installments,
        method: paymentMethod,
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        ></textarea>

        <label
          htmlFor="inclusionDateRegister"
          className={styles.newRegisterLabels}
        >
          Inclusion Date
        </label>
        <input
          id="inclusionDateRegister"
          className={styles.newRegisterInputs}
          type="date"
          value={inclusionDate}
          onChange={(e) => setInclusionDate(e.target.value)}
        />

        <label
          htmlFor="expireDateRegister"
          className={styles.newRegisterLabels}
        >
          Expire Date
        </label>
        <input
          id="expireDateRegister"
          className={styles.newRegisterInputs}
          type="date"
          value={expireDate}
          onChange={(e) => setExpireDate(e.target.value)}
        />

        <label htmlFor="valueRegister" className={styles.newRegisterLabels}>
          Value
        </label>
        <input
          id="valueRegister"
          className={styles.newRegisterInputs}
          type="number"
          step="any"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
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
          value={installments}
          onChange={(e) => setInstallments(Number(e.target.value))}
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
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <option value="money">Money</option>
          <option value="pix">Pix</option>
          <option value="creditCard">Credit Card</option>
          <option value="debitCard">Debit Card</option>
        </select>

        <button className={styles.registerButton} type="submit">
          Register
        </button>
      </form>
    </div>
  );
}

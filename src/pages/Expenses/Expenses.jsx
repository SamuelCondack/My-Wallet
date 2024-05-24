import styles from "./Expenses.module.scss";
import { db } from "../../../config/firebase";
import { useState, useEffect } from 'react';
import { getDocs, collection } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

export default function Expenses({ location }) {
  const [expensesList, setExpensesList] = useState([]);

  const auth = getAuth()

  const expensesCollectionRef = collection(db, auth?.currentUser?.uid);

  useEffect(() => {
    const getExpensesList = async () => {
      try {
        const data = await getDocs(expensesCollectionRef);

        const filteredData = data.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        console.log(filteredData);
        setExpensesList(filteredData);
      } catch (err) {
        console.error(err);
      }
    };
    getExpensesList();
  }, []);

  return (
    <div>
      <h2 style={{ color: "#fff" }}>Expenses</h2>
      {expensesList.map((expense) => (
                <div>
                    <p>{expense.name} R${expense.value}</p>
                </div>
            ))}
    </div>
  );
}

import styles from "./Expenses.module.scss";
import { db } from "../../../config/firebase";
import { useState, useEffect } from 'react';
import { getDocs, collection } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function Expenses() {
  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    
    // Adiciona um ouvinte de estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    // Limpa o ouvinte quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const getExpensesList = async () => {
      if (userId) {
        const expensesCollectionRef = collection(db, userId);
        try {
          const data = await getDocs(expensesCollectionRef);

          const filteredData = data.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          }));
          setExpensesList(filteredData);
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    };

    getExpensesList();
  }, [userId]);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      <h2 style={{ color: "#000" }}>Expenses</h2>
      <div className={styles.expensesContainer}>
        {expensesList.map((expense) => (
          <div key={expense.id} className={styles.expense}>
            <p>Name: {expense.name}</p>
            <p>Value: ${expense.value}</p>
            <p>Method: {expense.method}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

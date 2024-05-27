import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect } from "react";
import { getDocs, collection, doc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bin from "../../assets/bin.png"

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

  const totalValue = expensesList.reduce(
    (acc, expense) => acc + Number(expense.value),
    0
  );
  const formattedTotalValue = totalValue.toFixed(2);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  const deleteExpense = async (id) => {
    const expenseDoc = doc(db, auth?.currentUser?.uid, id)
    await deleteDoc(expenseDoc).then(()=>{
      window.location.reload()
    });
  };

  return (
    <>
      <div className={styles.expensesSection}>
        <h2 style={{ color: "#000" }}>Expenses</h2>
        <p className={styles.totalSpendings}>
          Your Spendings: ${formattedTotalValue}
        </p>
        <div className={styles.expensesContainer}>
          {expensesList.map((expense) => (
            <>
            <div key={expense.id} className={styles.expense}>
              <p>Name: {expense.name}</p>
              <p>Value: ${expense.value}</p>
              <p>Method: {expense.method}</p>
              <p>Date: {expense.inclusionDate}</p>
            <button className={styles.deleteButton} onClick={()=>deleteExpense(expense.id)}>
              <img className={styles.binImg} src={bin} alt="delete button" />
            </button>
            </div>
            </>
          ))}
        </div>
      </div>
    </>
  );
}

import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect } from "react";
import { getDocs, collection, doc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bin from "../../assets/bin.png";

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

  const deleteExpense = async (id) => {
    const expenseDoc = doc(db, auth?.currentUser?.uid, id);
    await deleteDoc(expenseDoc).then(() => {
      window.location.reload();
    });
  };

  function convertDateFormat(dateString) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-");
      return `${month}/${day}/${year}`;
    } else {
      return dateString;
    }
  }

  function formatValue(value) {
    return Number(value).toFixed(2).replace(".", ",");
  }

  // Função de comparação para ordenar as despesas por data
  function compareDates(a, b) {
    return new Date(b.inclusionDate) - new Date(a.inclusionDate);
  }

  // Agrupar despesas por mês
  const expensesByMonth = {};
  expensesList.forEach((expense) => {
    const [year, month] = expense.inclusionDate.split("-");
    if (!expensesByMonth[month]) {
      expensesByMonth[month] = [];
    }
    expensesByMonth[month].push(expense);
  });

  // Ordenar a lista de despesas por mês
  const sortedExpensesByMonth = Object.entries(expensesByMonth).sort(
    (a, b) => parseInt(b[0]) - parseInt(a[0])
  );

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <div className={styles.expensesSection}>
        <h2 style={{ color: "#000" }}>Expenses</h2>
        {sortedExpensesByMonth.map(([month, expenses]) => (
          <div key={month}>
            <h3>{new Date(2022, month - 1, 1).toLocaleString("default", { month: "long" })}</h3>
            <p>Total: ${expenses.reduce((acc, cur) => acc + Number(cur.value), 0)}</p>
            <div className={styles.expensesContainer}>
              {expenses.map((expense) => (
                <div key={expense.id} className={styles.expense}>
                  <p>Name: {expense.name}</p>
                  <p>Value: ${formatValue(expense.value)}</p>
                  <p>Method: {expense.method}</p>
                  <p>Date: {convertDateFormat(expense.inclusionDate)}</p>
                  <button
                    className={styles.deleteButton}
                    onClick={() => deleteExpense(expense.id)}
                  >
                    <img className={styles.binImg} src={bin} alt="delete button" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

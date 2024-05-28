import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect } from "react";
import { getDocs, collection, doc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bin from "../../assets/bin.png";
import Modal from "react-modal";
import ConfirmationModal from "../../modals/Confirmation";

export default function Expenses() {
  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

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

  const handleDeleteButtonClick = (id) => {
    setExpenseToDelete(id);
    setShowModal(true);
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setExpenseToDelete(null);
    console.log(showModal);
  };

  const handleConfirmDelete = async () => {
    if (expenseToDelete) {
      try {
        await deleteExpense(expenseToDelete);
        setShowModal(false);
        setExpenseToDelete(null);
      } catch (error) {
        console.log(error.message);
        console.log("Deletion Returned Error.");
      }
    }
  };

  const deleteExpense = async (id) => {
    try {
      const expenseDoc = doc(db, auth?.currentUser?.uid, id);
      await deleteDoc(expenseDoc).then(() => {
        window.location.reload();
      });
    } catch (error) {
      console.log(error);
    }
  };

  function getBorderStyle(paymentMethod) {
    switch (paymentMethod) {
      case "Money":
        return styles.money;
      case "Pix":
        return styles.pix;
      case "Credit Card":
        return styles.creditCard;
      case "Debit Card":
        return styles.debitCard;
      default:
        return "";
    }
  }

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

  // Agrupar despesas por mês
  const expensesByMonth = {};
  expensesList.forEach((expense) => {
    const [year, month, day] = expense.inclusionDate.split("-");
    const monthKey = `${year}-${month}`;
    if (!expensesByMonth[monthKey]) {
      expensesByMonth[monthKey] = [];
    }
    expensesByMonth[monthKey].push(expense);
  });

  // Ordenar a lista de despesas por mês e dentro de cada mês por dia
  const sortedExpensesByMonth = Object.entries(expensesByMonth).sort(
    ([a], [b]) => new Date(b) - new Date(a)
  );

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <div className={styles.expensesSection}>
        <h2 style={{ color: "#000" }}>Expenses</h2>
        {sortedExpensesByMonth.map(([monthKey, expenses]) => {
          const [year, month] = monthKey.split("-");
          return (
            <div key={monthKey}>
              <h3 className={styles.month}>
                {new Date(year, month - 1, 1).toLocaleString("default", {
                  month: "long",
                })}
              </h3>
              <p className={styles.totalSpendings}>
                Your Spendings:{" "}
                <b>
                  $
                  {expenses
                    .reduce((acc, cur) => acc + Number(cur.value), 0)
                    .toFixed(2)}
                </b>
              </p>
              <div className={styles.expensesContainer}>
                {expenses
                  .sort(
                    (a, b) =>
                      new Date(b.inclusionDate) - new Date(a.inclusionDate)
                  )
                  .map((expense) => (
                    <div
                      key={expense.id}
                      className={`${styles.expense} ${getBorderStyle(
                        expense.method
                      )}`}
                    >
                      <p className={styles.expenseName}>{expense.name}</p>
                      <p className={styles.expenseValue}>
                        ${formatValue(expense.value)}
                      </p>
                      <p className={styles.expenseMethod}>{expense.method}</p>
                      <p>{convertDateFormat(expense.inclusionDate)}</p>
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteButtonClick(expense.id)}
                      >
                        <img
                          className={styles.binImg}
                          src={bin}
                          alt="delete button"
                        />
                      </button>
                    </div>
                  ))}
                <ConfirmationModal
                  isOpen={showModal}
                  onRequestClose={handleCancelDelete}
                  onConfirmDelete={handleConfirmDelete}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

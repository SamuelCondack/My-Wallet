import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect } from "react";
import { getDocs, collection, doc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bin from "../../assets/bin.png";
import Modal from "react-modal";
import ConfirmationModal from "../../modals/Confirmation";

export default function Expenses() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");

  const [expensesList, setExpensesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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

  useEffect(() => {
    if (userId) {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }
  }, [userId, currentYear, currentMonth]);

  const handleDeleteButtonClick = (id) => {
    setExpenseToDelete(id);
    setShowModal(true);
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setExpenseToDelete(null);
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
    
    const installments = expense.installments ? parseInt(expense.installments, 10) : 1;
    const installmentValue = expense.value / installments;

    for (let i = 0; i < installments; i++) {
      const installmentMonth = new Date(year, month - 1 + i, 1);
      const installmentMonthKey = `${installmentMonth.getFullYear()}-${(installmentMonth.getMonth() + 1).toString().padStart(2, "0")}`;

      if (!expensesByMonth[installmentMonthKey]) {
        expensesByMonth[installmentMonthKey] = [];
      }

      expensesByMonth[installmentMonthKey].push({
        ...expense,
        value: installmentValue,
        installmentNumber: i + 1,
        totalValue: expense.value,
        installments: installments
      });
    }
  });

  // Ordenar a lista de despesas por mês e dentro de cada mês por dia
  const sortedExpensesByMonth = Object.entries(expensesByMonth).sort(
    ([a], [b]) => new Date(b) - new Date(a)
  );

  // Gerar lista de anos únicos com base nas despesas
  const uniqueYears = [...new Set(expensesList.flatMap(expense => {
    const [year, month, day] = expense.inclusionDate.split("-");
    const installments = expense.installments ? parseInt(expense.installments, 10) : 1;
    return Array.from({ length: installments }, (_, i) => new Date(year, month - 1 + i, 1).getFullYear());
  }))];

  // Gerar lista de meses únicos com base nas despesas e no ano selecionado
  const uniqueMonths = [...new Set(expensesList.flatMap(expense => {
    const [year, month, day] = expense.inclusionDate.split("-");
    const installments = expense.installments ? parseInt(expense.installments, 10) : 1;
    return Array.from({ length: installments }, (_, i) => {
      const installmentMonth = new Date(year, month - 1 + i, 1);
      return installmentMonth.getFullYear().toString() === selectedYear ? installmentMonth.getMonth() + 1 : null;
    }).filter(month => month !== null);
  }))];

  // Ordem dos meses do ano
  const monthOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Ordenar a lista de meses únicos de acordo com a ordem do calendário
  const sortedUniqueMonths = uniqueMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <>
      <div className={styles.expensesSectionWrapper}>
        <div className={styles.expensesSection}>
          <h2 style={{ color: "#000" }}>Expenses</h2>
          <div className={styles.filterContainer}>
            <div className={styles.filter}>
              <label htmlFor="yearFilter">Filter by Year: </label>
              <select
                id="yearFilter"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedMonth("All");
                }}
                className={styles.selectFilters}
              >
                <option value="All">All</option>
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className={styles.filter}>
              <label htmlFor="monthFilter">Filter by Month: </label>
              <select
                id="monthFilter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={selectedYear === "All"}
                className={styles.selectFilters}
              >
                <option value="All">All</option>
                {sortedUniqueMonths.map(month => (
                  <option key={month} value={month}>
                    {new Date(0, month - 1).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sortedExpensesByMonth
            .filter(([monthKey, _]) => {
              const [year, month] = monthKey.split("-");
              return (selectedYear === "All" || year === selectedYear) &&
                     (selectedMonth === "All" || month === selectedMonth.padStart(2, "0"));
            })
            .map(([monthKey, expenses]) => {
            const [year, month] = monthKey.split("-");
            return (
              <div key={monthKey}>
                <h3 className={styles.month}>
                  {new Date(year, month - 1, 1).toLocaleString("default", {
                    month: "long",
                  })} {year}
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
                        key={expense.id + '-' + expense.installmentNumber}
                        className={`${styles.expense} ${getBorderStyle(
                          expense.method
                        )}`}
                      >
                        <p className={styles.expenseName}>{expense.name}</p>
                        <p className={styles.expenseValue}>
                          {expense.installments > 1 ? (
                            <>
                              ${formatValue(expense.value)} {expense.installmentNumber}/{expense.installments}
                              <br />
                              <span className={styles.expenseTotal}>
                                Total: ${formatValue(expense.totalValue)}
                              </span>
                            </>
                          ) : (
                            `$${formatValue(expense.value)}`
                          )}
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
      </div>
    </>
  );
}

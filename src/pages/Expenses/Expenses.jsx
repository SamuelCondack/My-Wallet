import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect } from "react";
import {
  getDocs,
  collection,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bin from "../../assets/bin.png";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import ToastComponent from "../../components/Toast/ToastComponent";
import { FaPencilAlt, FaPause, FaPlay } from "react-icons/fa";
import { FaRegCalendar } from "react-icons/fa6";
import EditModal from "../../modals/EditModal/EditModal";

export default function Expenses() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const presentMonth = `${currentYear}-${currentMonth}`;

  const [expensesList, setExpensesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [earnings, setEarnings] = useState({});
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [currentMonthKey, setCurrentMonthKey] = useState(null);
  const [isEditingEarnings, setIsEditingEarnings] = useState({});
  const [expenseToDeleteName, setExpenseToDeleteName] = useState("");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [resumeDate, setResumeDate] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    value: "",
    inclusionDate: "",
    installments: "",
    paymentMethod: "Money",
    pauseDate: "",
  });

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const getExpensesList = async () => {
      if (userId) {
        const expensesCollectionRef = collection(db, userId);
        try {
          const data = await getDocs(expensesCollectionRef);

          const filteredData = data.docs
            .filter((doc) => !doc.id.startsWith("earnings-")) // Exclui os documentos de Earnings
            .map((doc) => ({
              ...doc.data(),
              id: doc.id,
            }));

          setExpensesList(filteredData);
          setIsLoading(false);
        } catch (err) {
          console.error(err);
        }
      }
    };

    getExpensesList();
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    }
  }, [userId, currentYear, currentMonth]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true);
      } else {
        setShowScrollToTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const loadEarningsFromFirestore = async () => {
      if (userId) {
        try {
          const earningsCollectionRef = collection(
            db,
            `users/${userId}/earnings`
          );
          const earningsSnapshot = await getDocs(earningsCollectionRef);
          const earningsData = {};
          earningsSnapshot.forEach((doc) => {
            earningsData[doc.id] = doc.data().value.toFixed(2);
          });
          setEarnings(earningsData);
        } catch (error) {
          console.error("Error loading earnings:", error);
        }
      }
    };

    loadEarningsFromFirestore();
  }, [userId]);

  if (isLoading) {
    return <LoadingComponent />;
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDeleteButtonClick = (id, name) => {
    setExpenseToDelete(id);
    setExpenseToDeleteName(name);
    setShowModal(true);
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setExpenseToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (expenseToDelete) {
      try {
        setShowModal(false);
        await deleteExpense(expenseToDelete);
        setExpenseToDelete(null);
      } catch (error) {
        error.message;
        console.log("Deletion Returned Error.");
      }
    }
  };

  const deleteExpense = async (id) => {
    try {
      const expenseDoc = doc(db, auth?.currentUser?.uid, id);
      await deleteDoc(expenseDoc);
      setExpensesList((prevExpenses) =>
        prevExpenses.filter((expense) => expense.id !== id)
      );
      toast.success("Expense deleted!");
    } catch (error) {
      console.log(error);
    }
  };

  const saveEarningsToFirestore = async (monthKey, value) => {
    try {
      const numericValue = isNaN(parseFloat(value)) ? 0 : parseFloat(value);

      const earningsDoc = doc(db, `users/${userId}/earnings`, monthKey);
      await setDoc(earningsDoc, { value: numericValue });
    } catch (error) {
      console.error("Error saving earnings:", error);
      toast.error("Failed to save earnings.");
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

  const handlePauseExpense = (expense) => {
    setSelectedExpense(expense);
    setExpenseToDeleteName(expense.name);
    setShowPauseModal(true);
  };

  const handleConfirmPause = async () => {
    if (!selectedExpense) return;

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const day = currentDate.getDate().toString().padStart(2, "0");
    const pauseDate = `${year}-${month}-${day}`;

    try {
      const expenseDoc = doc(db, auth.currentUser.uid, selectedExpense.id);
      await updateDoc(expenseDoc, {
        isPaused: true,
        pauseDate: pauseDate,
      });

      setExpensesList((prev) =>
        prev.map((item) =>
          item.id === selectedExpense.id ? { ...item, isPaused: true, pauseDate } : item
        )
      );

      setShowPauseModal(false);
      setSelectedExpense(null);
      setExpenseToDeleteName("");
      toast.success("Despesa pausada com sucesso!");
    } catch (error) {
      console.error("Erro ao pausar:", error);
      toast.error("Falha ao pausar despesa");
    }
  };

  const handleResumeExpense = (expense) => {
    setSelectedExpense(expense);
    setExpenseToDeleteName(expense.name);
    setShowResumeModal(true);
  };

  const handleConfirmResume = async () => {
    if (!selectedExpense) return;

    try {
      const expenseDoc = doc(db, auth.currentUser.uid, selectedExpense.id);
      await updateDoc(expenseDoc, {
        isPaused: false,
        pauseDate: null,
      });

      setExpensesList((prev) =>
        prev.map((item) =>
          item.id === selectedExpense.id
            ? { ...item, isPaused: false, pauseDate: null }
            : item
        )
      );

      setShowResumeModal(false);
      setSelectedExpense(null);
      setExpenseToDeleteName("");
      toast.success("Despesa despausada com sucesso!");
    } catch (error) {
      console.error("Erro ao despausar:", error);
      toast.error("Falha ao despausar despesa");
    }
  };

  // Agrupar despesas por mês
  const expensesByMonth = {};

  // Adicionar despesas normais (não mensais)
  expensesList.forEach((expense) => {
    if (!expense.inclusionDate) return;

    const [year, month] = expense.inclusionDate.split("-");
    if (!year || !month || isNaN(year) || isNaN(month)) {
      console.warn("Skipping invalid inclusionDate:", expense.inclusionDate);
      return;
    }

    const installments = expense.installments
      ? parseInt(expense.installments, 10)
      : 1;

    if (!expense.isMonthly) {
      for (let i = 0; i < installments; i++) {
        const installmentMonth = new Date(year, month - 1 + i, 1);
        if (isNaN(installmentMonth)) {
          console.warn("Skipping invalid installmentMonth:", installmentMonth);
          continue;
        }

        const monthKey = `${installmentMonth.getFullYear()}-${(
          installmentMonth.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}`;

        if (!expensesByMonth[monthKey]) {
          expensesByMonth[monthKey] = [];
        }

        expensesByMonth[monthKey].push({
          ...expense,
          value: expense.value / installments,
          installmentNumber: i + 1,
          totalValue: expense.value,
          installments,
        });
      }
    }
  });

  // Garantir que o mês atual e o próximo mês sejam adicionados
  const nextMonthDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    1
  );
  const nextMonthKey = `${nextMonthDate.getFullYear()}-${(
    nextMonthDate.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}`;

  if (currentMonthKey) {
    if (!expensesByMonth[currentMonthKey]) {
      expensesByMonth[currentMonthKey] = [];
    }
  }
  if (nextMonthKey) {
    if (!expensesByMonth[nextMonthKey]) {
      expensesByMonth[nextMonthKey] = [];
    }
  }

  // Processar despesas mensais
  expensesList.forEach((expense) => {
    if (expense.isMonthly && expense.inclusionDate) {
      const [year, month] = expense.inclusionDate.split("-");
      const inclusionDate = new Date(year, month - 1, 1);
      let currentMonth = new Date(inclusionDate);

      // Sempre adiciona a despesa no mês de inclusão
      addExpenseToMonth(expense, inclusionDate);

      // Se a despesa está pausada, verifica se deve mostrar em outros meses
      if (expense.isPaused && expense.pauseDate) {
        const [pauseYear, pauseMonth] = expense.pauseDate.split("-");
        const pauseDate = new Date(pauseYear, pauseMonth - 1, 1);
        
        // Se a data de pausa é posterior ao mês de inclusão, mostra até a data de pausa
        if (pauseDate > inclusionDate) {
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          while (currentMonth <= pauseDate) {
            addExpenseToMonth(expense, currentMonth);
            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
        }
      } else {
        // Se não está pausada, verifica se está no futuro
        const currentDate = new Date();
        const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        if (inclusionDate <= currentMonthStart) {
          // Se não está no futuro, mostra até 2 meses após a data atual
          const propagationLimit = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 2,
            1
          );
          
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          while (currentMonth <= propagationLimit) {
            addExpenseToMonth(expense, currentMonth);
            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
        }
      }
    }
  });

  // Helper function to add expense to the month map
  function addExpenseToMonth(expense, date) {
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;

    if (!expensesByMonth[monthKey]) {
      expensesByMonth[monthKey] = [];
    }

    // Verifica se a despesa já existe no mês
    const existingExpenseIndex = expensesByMonth[monthKey].findIndex(
      (e) => e.id === expense.id
    );

    if (existingExpenseIndex === -1) {
      // Se não existe, adiciona
      expensesByMonth[monthKey].push({
        ...expense,
        installmentNumber: null,
        totalValue: expense.value,
        installments: 1,
      });
    } else {
      // Se existe, atualiza
      expensesByMonth[monthKey][existingExpenseIndex] = {
        ...expense,
        installmentNumber: null,
        totalValue: expense.value,
        installments: 1,
      };
    }
  }

  // Ordenar a lista de despesas por mês e dentro de cada mês por dia
  const sortedExpensesByMonth = Object.entries(expensesByMonth).sort(
    ([a], [b]) => new Date(a) - new Date(b)
  );

  // Gerar lista de anos únicos com base em expensesList e expensesByMonth
  const uniqueYears = [
    ...new Set([
      // Anos calculados a partir de expensesList
      ...expensesList.flatMap((expense) => {
        const [year, month] = expense.inclusionDate.split("-");
        const installments = expense.installments
          ? parseInt(expense.installments, 10)
          : 1; // Assume 1 se installments não estiver definido

        return Array.from({ length: installments }, (_, i) => {
          const installmentYear = new Date(
            year,
            month - 1 + i,
            1
          ).getFullYear();
          return installmentYear;
        });
      }),
      // Anos presentes no objeto expensesByMonth
      ...Object.keys(expensesByMonth)
        .filter((monthKey) => monthKey && monthKey.includes("-")) // Filtra monthKeys inválidos
        .map((monthKey) => {
          const [year] = monthKey.split("-");
          const parsedYear =
            year && /^\d{4}$/.test(year) ? parseInt(year, 10) : null;
          return parsedYear;
        })
        .filter((year) => year !== null), // Filtra valores null
    ]),
  ];

  // Ordenar os anos em ordem crescente
  const sortedUniqueYears = uniqueYears.sort((a, b) => a - b);

  // Gerar lista de meses únicos com base em expensesList e expensesByMonth
  const uniqueMonths = [
    ...new Set([
      // Meses calculados a partir de expensesList
      ...expensesList.flatMap((expense) => {
        const [year, month] = expense.inclusionDate.split("-");
        if (!year || !month || isNaN(year) || isNaN(month)) {
          console.warn("Skipping invalid inclusionDate:", expense.inclusionDate);
          return [];
        }

        const installments = expense.installments
          ? parseInt(expense.installments, 10)
          : 1;

        // Para despesas mensais, incluir o mês de inclusão mesmo se for futuro
        if (expense.isMonthly) {
          const inclusionDate = new Date(year, month - 1, 1);
          return inclusionDate.getFullYear().toString() === selectedYear
            ? [inclusionDate.getMonth() + 1]
            : [];
        }

        // Para despesas não mensais, calcular os meses das parcelas
        return Array.from({ length: installments }, (_, i) => {
          const installmentMonth = new Date(year, month - 1 + i, 1);
          if (isNaN(installmentMonth)) {
            console.warn("Skipping invalid installmentMonth:", installmentMonth);
            return null;
          }
          return installmentMonth.getFullYear().toString() === selectedYear
            ? installmentMonth.getMonth() + 1
            : null;
        }).filter((month) => month !== null);
      }),
      // Meses presentes no objeto expensesByMonth
      ...Object.keys(expensesByMonth)
        .filter((monthKey) => {
          if (!monthKey || !monthKey.includes("-")) {
            console.warn("Skipping invalid monthKey:", monthKey);
            return false;
          }

          const [year, month] = monthKey.split("-");
          if (!year || !month || isNaN(year) || isNaN(month)) {
            console.warn("Skipping invalid year or month in monthKey:", monthKey);
            return false;
          }

          return true;
        })
        .flatMap((monthKey) => {
          const [year, month] = monthKey.split("-");
          return year === selectedYear ? parseInt(month, 10) : null;
        })
        .filter((month) => month !== null),
    ]),
  ];

  // Ordenar os meses em ordem cronológica
  const monthOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const sortedUniqueMonths = uniqueMonths
    .map((month) => month.toString().padStart(2, "0"))
    .sort(
      (a, b) =>
        monthOrder.indexOf(parseInt(a)) - monthOrder.indexOf(parseInt(b))
    );

  const renderMonthlyExpenseControls = (expense, monthKey) => {
    const isCurrentMonth = monthKey === presentMonth;
    const [year, month] = monthKey.split("-");
    const viewedMonthDate = new Date(year, month - 1, 1);
    const inclusionDate = new Date(expense.inclusionDate);
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // O calendário deve estar ativo se:
    // 1. O mês visualizado é anterior ao mês atual (ex: janeiro quando estamos em abril)
    // 2. O mês visualizado é posterior à data de inclusão (ex: maio quando a data de inclusão é abril)
    const shouldEnableCalendar = viewedMonthDate < currentMonthStart || viewedMonthDate >= inclusionDate;

    if (expense.isPaused) {
      const [pauseYear, pauseMonth] = expense.pauseDate.split("-");
      const pauseDate = new Date(pauseYear, pauseMonth - 1, 1);
      const isPauseMonth = viewedMonthDate.getTime() === pauseDate.getTime();

      if (isPauseMonth) {
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaPlay
              onClick={() => handleResumeExpense(expense)}
              className={styles.playPauseIcon}
              title="Resume expense"
            />
          </div>
        );
      } else {
        return (
          <FaRegCalendar
            onClick={() => {
              setSelectedYear(pauseYear);
              setSelectedMonth(pauseMonth);
            }}
            className={styles.calendarIcon}
            title="Go to pause month"
          />
        );
      }
    }

    return isCurrentMonth ? (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <FaPause
          onClick={() => handlePauseExpense(expense)}
          className={styles.playPauseIcon}
          title="Pause expense"
        />
      </div>
    ) : (
      <FaRegCalendar
        onClick={shouldEnableCalendar ? () => {
          setSelectedYear(currentYear);
          setSelectedMonth(currentMonth);
        } : undefined}
        className={`${styles.calendarIcon} ${!shouldEnableCalendar ? styles.disabledCalendar : ''}`}
        title={!shouldEnableCalendar ? "This expense is in the future" : "Go to current month"}
      />
    );
  };

  const handleEditClick = (expense) => {
    setEditingExpense(expense);
    setEditFormData({
      name: expense.name,
      value: expense.value.toString(),
      inclusionDate: expense.inclusionDate,
      installments: expense.installments || "",
      paymentMethod: expense.method,
      pauseDate: expense.pauseDate || "",
    });
    setShowEditModal(true);
  };

  const refetchExpenses = async () => {
    try {
      const expensesCollectionRef = collection(db, userId);
      const data = await getDocs(expensesCollectionRef);
      const filteredData = data.docs
        .filter((doc) => !doc.id.startsWith("earnings-"))
        .map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

      // Força uma atualização do estado
      setExpensesList([]); // Limpa o estado primeiro
      setExpensesList(filteredData); // Atualiza com os novos dados
    } catch (error) {
      console.error("Erro ao recarregar despesas:", error);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingExpense) return;

    try {
      const expenseDoc = doc(db, auth.currentUser.uid, editingExpense.id);
      const updateData = {
        name: editFormData.name,
        value: parseFloat(editFormData.value.replace(/,/g, ".")),
        inclusionDate: editFormData.inclusionDate,
        method: editFormData.paymentMethod,
      };

      let shouldRefetch = false;

      if (editingExpense.isMonthly) {
        if (!editingExpense.isPaused && editFormData.pauseDate) {
          updateData.isPaused = true;
          updateData.pauseDate = editFormData.pauseDate;
          shouldRefetch = true;
        } else if (editingExpense.isPaused && !editFormData.pauseDate) {
          updateData.isPaused = false;
          updateData.pauseDate = null;
          shouldRefetch = true;
        } else if (editingExpense.isPaused && editFormData.pauseDate) {
          // Verifica se a data de pausa foi alterada
          if (editingExpense.pauseDate !== editFormData.pauseDate) {
            updateData.pauseDate = editFormData.pauseDate;
            shouldRefetch = true;
          }
        }
      } else {
        updateData.installments = editFormData.installments;
      }

      await updateDoc(expenseDoc, updateData);

      if (shouldRefetch) {
        // Mostra o loading
        setIsLoading(true);

        // Força uma atualização completa do estado
        setExpensesList([]); // Limpa completamente o estado
        
        // Pequeno delay para garantir que o estado foi limpo
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Recarrega todas as despesas
        const expensesCollectionRef = collection(db, userId);
        const data = await getDocs(expensesCollectionRef);
        const filteredData = data.docs
          .filter((doc) => !doc.id.startsWith("earnings-"))
          .map((doc) => ({
            ...doc.data(),
            id: doc.id,
          }));

        // Atualiza o estado com os novos dados
        setExpensesList(filteredData);

        // Força uma atualização dos filtros
        setSelectedYear(selectedYear);
        setSelectedMonth(selectedMonth);

        // Esconde o loading
        setIsLoading(false);
      } else {
        // Atualiza apenas a despesa específica no estado
        setExpensesList((prev) =>
          prev.map((item) =>
            item.id === editingExpense.id
              ? { ...item, ...updateData }
              : item
          )
        );
      }

      setShowEditModal(false);
      setEditingExpense(null);
      toast.success("Despesa atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Falha ao atualizar despesa");
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={styles.expensesSectionWrapper}>
        <ToastComponent />
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
                {sortedUniqueYears
                  .filter((year) => !isNaN(year)) // Filtra valores NaN
                  .map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
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
                {sortedUniqueMonths.map((month) => {
                  const isCurrentMonth = selectedYear === currentYear && month === currentMonth;
                  return (
                    <option 
                      key={month} 
                      value={month}
                      data-current={isCurrentMonth}
                    >
                      {month} - {new Date(0, month - 1).toLocaleString("default", {
                        month: "long",
                      })}
                      {isCurrentMonth && " 📅"}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          {sortedExpensesByMonth
            .filter(([monthKey]) => {
              const [year, month] = monthKey.split("-");
              return (
                (selectedYear === "All" || year === selectedYear) &&
                (selectedMonth === "All" || month === selectedMonth.padStart(2, "0"))
              );
            })
            .map(([monthKey, expenses]) => {
              const [year, month] = monthKey.split("-");
              const totalSpendings = expenses
                .reduce((acc, cur) => acc + Number(cur.value), 0)
                .toFixed(2);

              // Garantir que o mês seja exibido mesmo sem despesas
              if (expenses.length === 0) {
                return (
                  <div key={monthKey}>
                    <h3 className={styles.month}>
                      {new Date(year, month - 1, 1).toLocaleString("default", {
                        month: "long",
                      })}{" "}
                      {year}
                    </h3>
                    <div className={styles.earningContainer}>
                      <label
                        htmlFor={`earning-${monthKey}`}
                        className={styles.earningLabel}
                      >
                        Earnings:
                      </label>
                      <div className={styles.earningInputWrapper}>
                        <input
                          id={`earning-${monthKey}`}
                          type="text"
                          className={
                            isEditingEarnings[monthKey]
                              ? `${styles.earningInput} ${styles.editing}`
                              : `${styles.earningInput} ${styles.readOnly}`
                          }
                          placeholder="Enter your earnings"
                          value={
                            isEditingEarnings[monthKey]
                              ? earnings[monthKey] || ""
                              : earnings[monthKey]
                              ? `$${earnings[monthKey]}`
                              : "$0.00"
                          }
                          readOnly={!isEditingEarnings[monthKey]}
                          disabled={!isEditingEarnings[monthKey]}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, "");
                            setEarnings((prev) => ({
                              ...prev,
                              [monthKey]: value,
                            }));
                          }}
                          onBlur={() => {
                            setIsEditingEarnings((prev) => ({
                              ...prev,
                              [monthKey]: false,
                            }));
                            saveEarningsToFirestore(
                              currentMonthKey,
                              earnings[currentMonthKey]
                            );
                          }}
                        />
                        <button
                          className={styles.editButton}
                          onClick={() => {
                            setCurrentMonthKey(monthKey);
                            setShowEarningsModal(true);
                          }}
                        >
                          <FaPencilAlt className={styles.pencilIcon} />{" "}
                        </button>
                      </div>
                    </div>
                    <p className={styles.totalSpendings}>
                      Your Spendings: <b>$0.00</b>
                    </p>
                    <p
                      className={`${styles.netEarnings} ${
                        (earnings[monthKey] || 0) < 0
                          ? styles.netEarningsNegative
                          : ""
                      }`}
                    >
                      Net Earnings:{" "}
                      <b>
                        ${((earnings[monthKey] || 0)).toFixed(2)}
                      </b>
                    </p>
                  </div>
                );
              }

              return (
                <div key={monthKey}>
                  <h3 className={styles.month}>
                    {new Date(year, month - 1, 1).toLocaleString("default", {
                      month: "long",
                    })}{" "}
                    {year}
                  </h3>

                  <div className={styles.earningContainer}>
                    <label
                      htmlFor={`earning-${monthKey}`}
                      className={styles.earningLabel}
                    >
                      Earnings:
                    </label>
                    <div className={styles.earningInputWrapper}>
                      <input
                        id={`earning-${monthKey}`}
                        type="text"
                        className={
                          isEditingEarnings[monthKey]
                            ? `${styles.earningInput} ${styles.editing}`
                            : `${styles.earningInput} ${styles.readOnly}`
                        }
                        placeholder="Enter your earnings"
                        value={
                          isEditingEarnings[monthKey]
                            ? earnings[monthKey] || ""
                            : earnings[monthKey]
                            ? `$${earnings[monthKey]}`
                            : "$0.00"
                        }
                        readOnly={!isEditingEarnings[monthKey]} // Torna o campo somente leitura se não estiver editando
                        disabled={!isEditingEarnings[monthKey]} // Desabilita o campo se não estiver editando
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, "");
                          setEarnings((prev) => ({
                            ...prev,
                            [monthKey]: value,
                          }));
                        }}
                        onBlur={() => {
                          setIsEditingEarnings((prev) => ({
                            ...prev,
                            [monthKey]: false,
                          }));
                          saveEarningsToFirestore(
                            currentMonthKey,
                            earnings[currentMonthKey]
                          );
                        }}
                      />
                      <button
                        className={styles.editButton}
                        onClick={() => {
                          setCurrentMonthKey(monthKey);
                          setShowEarningsModal(true);
                        }}
                      >
                        <FaPencilAlt className={styles.pencilIcon} />{" "}
                      </button>
                    </div>
                    {showEarningsModal && (
                      <ConfirmationModal
                        isOpen={showEarningsModal}
                        onRequestClose={() => setShowEarningsModal(false)}
                        onConfirm={() => {
                          setEarnings((prev) => ({
                            ...prev,
                            [currentMonthKey]: "", // Apaga o valor do mês atual
                          }));
                          setIsEditingEarnings((prev) => ({
                            ...prev,
                            [currentMonthKey]: true, // Libera o campo para edição
                          }));
                          setShowEarningsModal(false); // Fecha o modal
                        }}
                        title="Edit Earnings"
                        message="Are you sure you want to edit the earnings for this month"
                        identifier={currentMonthKey}
                        afterMessage={"?"}
                      />
                    )}
                  </div>

                  <p className={styles.totalSpendings}>
                    Your Spendings: <b>${totalSpendings}</b>
                  </p>

                  <p
                    className={`${styles.netEarnings} ${
                      (earnings[monthKey] || 0) - totalSpendings < 0
                        ? styles.netEarningsNegative
                        : ""
                    }`}
                  >
                    Net Earnings:{" "}
                    <b>
                      ${((earnings[monthKey] || 0) - totalSpendings).toFixed(2)}
                    </b>
                  </p>

                  <div className={styles.expensesContainer}>
                    <AnimatePresence>
                      {expenses
                        .sort(
                          (a, b) =>
                            new Date(b.inclusionDate) -
                            new Date(a.inclusionDate)
                        )
                        .map((expense) => (
                          <motion.div
                            key={expense.id + "-" + expense.installmentNumber}
                            className={`${styles.expense} ${getBorderStyle(
                              expense.method
                            )}`}
                            exit={{ opacity: 0, scale: -1 }}
                            transition={{ duration: 0.4, ease: "linear" }}
                            onAnimationComplete={() => {
                              setExpensesList((prevExpenses) =>
                                prevExpenses.filter((e) => e.id !== expense.id)
                              );
                            }}
                          >
                            <button
                              className={styles.expenseEditButton}
                              onClick={() => handleEditClick(expense)}
                              title="Edit expense"
                            >
                              <FaPencilAlt className={styles.expensePencilIcon} />
                            </button>
                            <p className={styles.expenseName}>{expense.name}</p>
                            <p className={styles.expenseValue}>
                              {expense.installments > 1 ? (
                                <>
                                  ${formatValue(expense.value)}{" "}
                                  {expense.installmentNumber}/
                                  {expense.installments}
                                  <br />
                                  <span className={styles.expenseTotal}>
                                    Total: ${formatValue(expense.totalValue)}
                                  </span>
                                </>
                              ) : (
                                `$${formatValue(expense.value)}`
                              )}
                            </p>
                            <p className={styles.expenseMethod}>
                              {expense.method}
                            </p>
                            <p>{convertDateFormat(expense.inclusionDate)}</p>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                justifyContent: expense.isMonthly
                                  ? "space-between"
                                  : "flex-end",
                              }}
                            >
                              {expense.isMonthly && (
                                <div>
                                  {renderMonthlyExpenseControls(
                                    expense,
                                    monthKey
                                  )}
                                </div>
                              )}

                              <button
                                className={styles.deleteButton}
                                onClick={() =>
                                  handleDeleteButtonClick(
                                    expense.id,
                                    expense.name
                                  )
                                }
                              >
                                <img
                                  className={styles.binImg}
                                  src={bin}
                                  alt="delete button"
                                />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                    <AnimatePresence>
                      <ConfirmationModal
                        isOpen={showModal}
                        onRequestClose={handleCancelDelete}
                        onConfirm={handleConfirmDelete}
                        expenseName={expenseToDeleteName}
                        title="Delete Expense"
                        message="Are you sure you want to delete this expense?"
                        identifier={expenseToDeleteName}
                      />
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
        </div>
        <AnimatePresence>
          {showScrollToTop && (
            <motion.button
              className={styles.scrollToTopButton}
              onClick={scrollToTop}
              initial={{ y: 50 }} // Começa invisível e deslocado para baixo
              animate={{ y: 0, scale: 1 }} // Anima para visível e na posição original
              exit={{ y: 50, scale: -1 }} // Desaparece com escala e rotação
              transition={{ duration: 0.4, ease: "easeInOut" }} // Duração e suavidade da animação
            >
              ↑
            </motion.button>
          )}
        </AnimatePresence>
        {showPauseModal && (
          <ConfirmationModal
            isOpen={showPauseModal}
            onRequestClose={() => setShowPauseModal(false)}
            onConfirm={handleConfirmPause}
            title="Pause Expense"
            message="Are you sure you want to pause this expense?"
            identifier={expenseToDeleteName}
            expenseName={expenseToDeleteName}
          />
        )}
        {showResumeModal && (
          <ConfirmationModal
            isOpen={showResumeModal}
            onRequestClose={() => setShowResumeModal(false)}
            onConfirm={handleConfirmResume}
            title="Resume Expense"
            message="Are you sure you want to resume this expense?"
            identifier={expenseToDeleteName}
            expenseName={expenseToDeleteName}
          />
        )}
        {showEditModal && (
          <EditModal
            isOpen={showEditModal}
            onRequestClose={() => {
              setShowEditModal(false);
              setEditingExpense(null);
            }}
            onConfirm={handleEditSubmit}
            editingExpense={editingExpense}
            editFormData={editFormData}
            setEditFormData={setEditFormData}
          />
        )}
      </div>
    </>
  );
}

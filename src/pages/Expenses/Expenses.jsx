import styles from "./Expenses.module.scss";
import { auth, db } from "../../../config/firebase";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getDocs,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import bin from "../../assets/bin.png";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { FaCheck, FaCopy, FaPencilAlt, FaPause, FaPlay } from "react-icons/fa";
import { FaRegCalendar } from "react-icons/fa6";
import ExpenseFormModal from "../../modals/ExpenseFormModal/ExpenseFormModal";
import {
  getCategoryMap,
  getExpenseCategories,
} from "../../services/categoriesService";
import { useCategories } from "../../hooks/useCategories";
import { useExpenseFavorites } from "../../hooks/useExpenseFavorites";
import { useSubscription } from "../../hooks/useSubscription";
import { buildRecentTemplates } from "../../services/expenseFavoritesService";
import { DEFAULT_CATEGORY_ID } from "../../constants/defaultCategories";
import { getCached, setCached } from "../../utils/dataCache";
import { matchesExpenseValueQuery } from "../../utils/finance";
import { loadIncomesWithMigration } from "../../services/incomeService";
import {
  getEarnedIncome,
  getNetEarnings,
  getPendingIncome,
  getReceivedIncomeForFinancialPeriod,
} from "../../utils/incomeCalculations";

export default function Expenses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const presentMonth = `${currentYear}-${currentMonth}`;

  const [expensesList, setExpensesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get("year") || currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    searchParams.get("month") || currentMonth
  );
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [incomes, setIncomes] = useState([]);
  const [isIncomeLoading, setIsIncomeLoading] = useState(true);
  const [expenseToDeleteName, setExpenseToDeleteName] = useState("");
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseModalMode, setExpenseModalMode] = useState("create");
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseFormInitial, setExpenseFormInitial] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "All"
  );
  const { categories } = useCategories(userId);
  const expenseCategories = useMemo(
    () => getExpenseCategories(categories),
    [categories]
  );
  const categoriesMap = getCategoryMap(categories);
  const { favorites, addFavorite, removeFavorite } = useExpenseFavorites(userId);
  const { isPro } = useSubscription();
  const recentTemplates = useMemo(
    () => buildRecentTemplates(expensesList, 6),
    [expensesList]
  );
  const [pressedExpenseKey, setPressedExpenseKey] = useState(null);
  const activeTouchIdRef = useRef(null);
  const pressReleaseTimerRef = useRef(0);
  const categoryHintValueRef = useRef(0);
  const [copiedMetric, setCopiedMetric] = useState(null);
  const copyTimeoutsRef = useRef([]);
  const earnedCopyPhaseRef = useRef("copy");

  useEffect(() => {
    return () => {
      copyTimeoutsRef.current.forEach((id) => clearTimeout(id));
      if (pressReleaseTimerRef.current) {
        window.clearTimeout(pressReleaseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadExpenses = async () => {
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user || cancelled) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      setUserId(user.uid);
      const expensesCollectionRef = collection(db, user.uid);
      const cachedExpenses = getCached("expenses", user.uid);

      if (cachedExpenses) {
        setExpensesList(cachedExpenses);
        setIsLoading(false);
      }

      try {
        const data = await getDocs(expensesCollectionRef);
        if (cancelled) {
          return;
        }

        const filteredData = data.docs
          .filter((doc) => !doc.id.startsWith("earnings-"))
          .map((doc) => ({
            ...doc.data(),
            id: doc.id,
          }));

        setExpensesList(filteredData);
        setCached("expenses", user.uid, filteredData);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadExpenses();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setUserId(null);
        setExpensesList([]);
        setIncomes([]);
        setIsIncomeLoading(true);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const params = {};
    if (selectedYear !== "All") params.year = selectedYear;
    if (selectedMonth !== "All") params.month = selectedMonth;
    if (selectedCategory !== "All") params.category = selectedCategory;
    setSearchParams(params, { replace: true });
  }, [selectedYear, selectedMonth, selectedCategory, setSearchParams]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true);
      } else {
        setShowScrollToTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    const loadIncomeFromFirestore = async () => {
      if (!userId) {
        setIsIncomeLoading(true);
        return;
      }

      const cachedIncome = getCached("income", userId);

      if (cachedIncome) {
        setIncomes(cachedIncome);
        setIsIncomeLoading(false);
        return;
      }

      setIsIncomeLoading(true);

      try {
        const data = await loadIncomesWithMigration(userId);
        setIncomes(data);
      } catch (error) {
        console.error("Error loading income:", error);
        toast.error("Failed to load income summary.");
      } finally {
        setIsIncomeLoading(false);
      }
    };

    loadIncomeFromFirestore();
  }, [userId]);

  useEffect(() => {
    if (userId && !isLoading) {
      setCached("expenses", userId, expensesList);
    }
  }, [userId, expensesList, isLoading]);

  useEffect(() => {
    const handleTouchEnd = (event) => {
      if (activeTouchIdRef.current === null) {
        return;
      }

      const touchEnded = Array.from(event.changedTouches).some(
        (touch) => touch.identifier === activeTouchIdRef.current
      );

      if (touchEnded) {
        activeTouchIdRef.current = null;
        if (pressReleaseTimerRef.current) {
          window.clearTimeout(pressReleaseTimerRef.current);
        }
        // Hold pressed briefly so the scale-up can finish before easing down.
        pressReleaseTimerRef.current = window.setTimeout(() => {
          setPressedExpenseKey(null);
          pressReleaseTimerRef.current = 0;
        }, 220);
      }
    };

    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    setExpenseModalMode("create");
    setEditingExpense(null);
    setExpenseFormInitial(null);
    setShowExpenseModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (isLoading) {
    return <LoadingComponent variant="expenses" />;
  }

  const scrollToTop = () => {
    const start = window.scrollY || document.documentElement.scrollTop;
    if (start <= 0) {
      return;
    }
    const duration = Math.min(900, Math.max(420, start * 0.55));
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const nextY = start * (1 - easeOutCubic(progress));
      window.scrollTo(0, nextY);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  const openCreateExpense = () => {
    setExpenseModalMode("create");
    setEditingExpense(null);
    setExpenseFormInitial(null);
    setShowExpenseModal(true);
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setEditingExpense(null);
    setExpenseFormInitial(null);
    setExpenseModalMode("create");
  };

  const handleExpenseTouchStart = (event, expenseKey) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    activeTouchIdRef.current = touch.identifier;
    if (pressReleaseTimerRef.current) {
      window.clearTimeout(pressReleaseTimerRef.current);
      pressReleaseTimerRef.current = 0;
    }
    setPressedExpenseKey(expenseKey);
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
      setExpensesList((prevExpenses) => {
        const next = prevExpenses.filter((expense) => expense.id !== id);
        if (userId) {
          setCached("expenses", userId, next);
        }
        return next;
      });
      toast.success("Expense deleted!");
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

  if (presentMonth) {
    if (!expensesByMonth[presentMonth]) {
      expensesByMonth[presentMonth] = [];
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
          <button
            type="button"
            className={styles.iconActionBtn}
            onClick={() => handleResumeExpense(expense)}
            aria-label="Resume expense"
          >
            <FaPlay className={styles.playPauseIcon} />
          </button>
        );
      }

      return (
        <button
          type="button"
          className={styles.iconActionBtn}
          onClick={() => {
            setSelectedYear(pauseYear);
            setSelectedMonth(pauseMonth);
          }}
          aria-label="Go to pause month"
        >
          <FaRegCalendar className={styles.calendarIcon} />
        </button>
      );
    }

    return isCurrentMonth ? (
      <button
        type="button"
        className={styles.iconActionBtn}
        onClick={() => handlePauseExpense(expense)}
        aria-label="Pause expense"
      >
        <FaPause className={styles.playPauseIcon} />
      </button>
    ) : (
      <button
        type="button"
        className={styles.iconActionBtn}
        onClick={shouldEnableCalendar ? () => {
          setSelectedYear(currentYear);
          setSelectedMonth(currentMonth);
        } : undefined}
        disabled={!shouldEnableCalendar}
        aria-label={!shouldEnableCalendar ? "This expense is in the future" : "Go to current month"}
      >
        <FaRegCalendar
          className={`${styles.calendarIcon} ${!shouldEnableCalendar ? styles.disabledCalendar : ''}`}
        />
      </button>
    );
  };

  const handleEditClick = (expense) => {
    const totalValue =
      expense.totalValue != null && !Number.isNaN(Number(expense.totalValue))
        ? Number(expense.totalValue)
        : Number(expense.value);

    setExpenseModalMode("edit");
    setEditingExpense(expense);
    setExpenseFormInitial({
      name: expense.name,
      value: totalValue.toString(),
      inclusionDate: expense.inclusionDate,
      installments: expense.installments || "",
      paymentMethod: expense.method,
      pauseDate: expense.pauseDate || "",
      categoryId: expense.categoryId || DEFAULT_CATEGORY_ID,
      isMonthly: Boolean(expense.isMonthly),
    });
    setShowExpenseModal(true);
  };

  const handleExpenseFormSave = async (payload) => {
    if (!userId) {
      toast.error("You need to be signed in.");
      return;
    }

    if (expenseModalMode === "create") {
      const isMonthly = Boolean(payload.isMonthly);
      const newExpense = {
        name: payload.name.trim(),
        inclusionDate: payload.inclusionDate,
        value: Number(payload.value),
        installments:
          !isMonthly && payload.installments > 0 ? payload.installments : "",
        method: payload.paymentMethod,
        isMonthly,
        categoryId: payload.categoryId || DEFAULT_CATEGORY_ID,
        ...(isMonthly ? { status: "active" } : {}),
      };

      const expensesCollectionRef = collection(db, userId);
      const docRef = await addDoc(expensesCollectionRef, newExpense);
      const created = { ...newExpense, id: docRef.id };

      setExpensesList((prev) => {
        const next = [...prev, created];
        setCached("expenses", userId, next);
        return next;
      });

      closeExpenseModal();
      toast.success("Expense registered!");
      return;
    }

    if (!editingExpense) return;

    const isMonthly = Boolean(payload.isMonthly);
    const updateData = {
      name: payload.name,
      value: Number(payload.value),
      inclusionDate: payload.inclusionDate,
      method: payload.paymentMethod,
      categoryId: payload.categoryId || DEFAULT_CATEGORY_ID,
      isMonthly,
    };

    let shouldRefetch = false;
    const wasMonthly = Boolean(editingExpense.isMonthly);

    if (isMonthly) {
      updateData.installments = "";
      updateData.status = editingExpense.status || "active";

      if (!wasMonthly) {
        updateData.isPaused = false;
        updateData.pauseDate = null;
        shouldRefetch = true;
      }

      if (!editingExpense.isPaused && payload.pauseDate) {
        updateData.isPaused = true;
        updateData.pauseDate = payload.pauseDate;
        shouldRefetch = true;
      } else if (editingExpense.isPaused && !payload.pauseDate) {
        updateData.isPaused = false;
        updateData.pauseDate = null;
        shouldRefetch = true;
      } else if (editingExpense.isPaused && payload.pauseDate) {
        if (editingExpense.pauseDate !== payload.pauseDate) {
          updateData.pauseDate = payload.pauseDate;
          shouldRefetch = true;
        }
      }
    } else {
      updateData.installments =
        payload.installments && Number(payload.installments) > 0
          ? payload.installments
          : "";
      updateData.isPaused = false;
      updateData.pauseDate = null;
      if (wasMonthly) {
        shouldRefetch = true;
      }
    }

    if (wasMonthly !== isMonthly) {
      shouldRefetch = true;
    }

    const expenseDoc = doc(db, auth.currentUser.uid, editingExpense.id);
    await updateDoc(expenseDoc, updateData);

    if (shouldRefetch) {
      setIsLoading(true);
      setExpensesList([]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const expensesCollectionRef = collection(db, userId);
      const data = await getDocs(expensesCollectionRef);
      const filteredData = data.docs
        .filter((docItem) => !docItem.id.startsWith("earnings-"))
        .map((docItem) => ({
          ...docItem.data(),
          id: docItem.id,
        }));

      setExpensesList(filteredData);
      setCached("expenses", userId, filteredData);
      setIsLoading(false);
    } else {
      setExpensesList((prev) => {
        const next = prev.map((item) =>
          item.id === editingExpense.id ? { ...item, ...updateData } : item
        );
        setCached("expenses", userId, next);
        return next;
      });
    }

    closeExpenseModal();
    toast.success("Despesa atualizada com sucesso!");
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredMonths = sortedExpensesByMonth.filter(([monthKey]) => {
    const [year, month] = monthKey.split("-");
    return (
      (selectedYear === "All" || year === selectedYear) &&
      (selectedMonth === "All" || month === selectedMonth.padStart(2, "0"))
    );
  });

  const categoryIdsWithExpenses = new Set(
    filteredMonths.flatMap(([, expenses]) =>
      expenses.map((expense) => expense.categoryId || DEFAULT_CATEGORY_ID)
    )
  );

  const categoriesInFilter = expenseCategories.filter((category) =>
    categoryIdsWithExpenses.has(category.id)
  );

  const effectiveSelectedCategory =
    selectedCategory !== "All" && categoryIdsWithExpenses.has(selectedCategory)
      ? selectedCategory
      : "All";

  const matchesSearch = (expense) => {
    if (!normalizedSearchQuery) {
      return true;
    }

    const name = expense.name?.toLowerCase() ?? "";
    const method = expense.method?.toLowerCase() ?? "";
    const category =
      categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.name?.toLowerCase() ??
      "";

    const matchesText =
      name.includes(normalizedSearchQuery) ||
      method.includes(normalizedSearchQuery) ||
      category.includes(normalizedSearchQuery);

    // OR: text fields and (when query looks numeric) value prefix/exact match
    const matchesValue = matchesExpenseValueQuery(
      expense.value,
      searchQuery.trim()
    );

    return matchesText || matchesValue;
  };

  const matchesCategory = (expense) => {
    if (effectiveSelectedCategory === "All") {
      return true;
    }

    return (expense.categoryId || DEFAULT_CATEGORY_ID) === effectiveSelectedCategory;
  };

  const matchesFilters = (expense) =>
    matchesSearch(expense) && matchesCategory(expense);

  const hasActiveFilters =
    Boolean(normalizedSearchQuery) || effectiveSelectedCategory !== "All";

  const hasVisibleResults =
    !hasActiveFilters ||
    filteredMonths.some(([, expenses]) => expenses.some(matchesFilters));

  const goToIncome = (monthKey, status) => {
    const [year, month] = monthKey.split("-");
    const params = new URLSearchParams({ year, month });
    if (status) {
      params.set("status", status);
    }
    navigate(`/home/income?${params.toString()}`);
  };

  const clearCopyTimeouts = () => {
    copyTimeoutsRef.current.forEach((id) => clearTimeout(id));
    copyTimeoutsRef.current = [];
  };

  const copyMetricValue = async (metricKey, numericValue) => {
    const plain = Number(numericValue).toFixed(2);
    try {
      await navigator.clipboard.writeText(plain);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't copy value.");
      return;
    }

    const isEarnedMetric = metricKey.endsWith("-earned");
    const checkDelay = isEarnedMetric ? 620 : 280;
    const clearDelay = isEarnedMetric ? 1700 : 1400;

    clearCopyTimeouts();
    setCopiedMetric({ key: metricKey, phase: "copy" });

    copyTimeoutsRef.current.push(
      setTimeout(() => {
        setCopiedMetric({ key: metricKey, phase: "check" });
      }, checkDelay)
    );
    copyTimeoutsRef.current.push(
      setTimeout(() => {
        setCopiedMetric(null);
      }, clearDelay)
    );
  };

  const renderCopyableMetric = ({
    metricKey,
    label,
    numericValue,
    displayValue,
    className,
    shineClass,
    hideFeedback = false,
  }) => {
    const isActive = copiedMetric?.key === metricKey;
    const phase = isActive ? copiedMetric.phase : null;

    return (
      <button
        type="button"
        className={`${styles.metricCopyRow} ${className || ""}`}
        onClick={() => copyMetricValue(metricKey, numericValue)}
        aria-label={`Copy ${label} value`}
      >
        {label}:{" "}
        <b
          className={`${styles.metricValue} ${
            isActive ? `${styles.metricValueShine} ${shineClass || ""}` : ""
          }`}
        >
          {displayValue}
        </b>
        {!hideFeedback && phase && (
          <span
            className={`${styles.metricCopyFeedback} ${
              phase === "check" ? styles.metricCopyFeedbackDone : ""
            }`}
            aria-hidden="true"
          >
            {phase === "check" ? <FaCheck /> : <FaCopy />}
          </span>
        )}
      </button>
    );
  };

  const renderIncomeSummary = (monthKey, totalSpendings) => {
    if (isIncomeLoading) {
      return (
        <>
          <p className={styles.summaryLine}>
            Earned:{" "}
            <span className={styles.netEarningsShimmer} role="status" aria-label="Loading" />
          </p>
          <p className={styles.summaryLine}>
            Pending Income:{" "}
            <span className={styles.netEarningsShimmer} role="status" aria-label="Loading" />
          </p>
          <p className={styles.summaryLine}>
            Received:{" "}
            <span className={styles.netEarningsShimmer} role="status" aria-label="Loading" />
          </p>
          <p className={styles.totalSpendings}>
            Your Spendings: <b>-${Number(totalSpendings || 0).toFixed(2)}</b>
          </p>
          <p className={styles.netEarnings}>
            Net Earnings:{" "}
            <span className={styles.netEarningsShimmer} role="status" aria-label="Loading" />
          </p>
        </>
      );
    }

    const earned = getEarnedIncome(incomes, monthKey);
    const received = getReceivedIncomeForFinancialPeriod(incomes, monthKey);
    const pending = getPendingIncome(incomes, monthKey);
    const netValue = getNetEarnings(incomes, monthKey, totalSpendings);
    const spendingsValue = Number(totalSpendings || 0);
    const earnedMetricKey = `${monthKey}-earned`;
    const isEarnedCopying = copiedMetric?.key === earnedMetricKey;
    if (isEarnedCopying && copiedMetric.phase) {
      earnedCopyPhaseRef.current = copiedMetric.phase;
    }

    return (
      <>
        <div className={styles.earnedRow}>
          {renderCopyableMetric({
            metricKey: earnedMetricKey,
            label: "Earned",
            numericValue: earned,
            displayValue: `$${earned.toFixed(2)}`,
            className: styles.summaryEarned,
            shineClass: styles.shineNeutral,
            hideFeedback: true,
          })}
          <span
            className={`${styles.earnedCopySlot} ${
              isEarnedCopying ? styles.earnedCopySlotOpen : ""
            }`}
            aria-hidden="true"
          >
            <span
              className={`${styles.earnedCopyIcon} ${
                earnedCopyPhaseRef.current === "check"
                  ? styles.earnedCopyIconDone
                  : ""
              }`}
            >
              {earnedCopyPhaseRef.current === "check" ? (
                <FaCheck />
              ) : (
                <FaCopy />
              )}
            </span>
          </span>
          <button
            type="button"
            className={styles.earnedIncomeButton}
            onClick={(event) => {
              event.stopPropagation();
              goToIncome(monthKey);
            }}
            aria-label="Open Income page"
            title="Open Income"
          >
            <FaPencilAlt className={styles.pencilIcon} aria-hidden="true" />
          </button>
        </div>
        {renderCopyableMetric({
          metricKey: `${monthKey}-pending`,
          label: "Pending Income",
          numericValue: pending,
          displayValue: `$${pending.toFixed(2)}`,
          className:
            pending > 0 ? styles.summaryPending : styles.summaryPendingZero,
          shineClass: styles.shinePending,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-received`,
          label: "Received",
          numericValue: received,
          displayValue: `$${received.toFixed(2)}`,
          className: styles.summaryReceived,
          shineClass: styles.shineReceived,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-spendings`,
          label: "Your Spendings",
          numericValue: spendingsValue,
          displayValue: `-$${spendingsValue.toFixed(2)}`,
          className: styles.totalSpendings,
          shineClass: styles.shineNeutral,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-net`,
          label: "Net Earnings",
          numericValue: netValue,
          displayValue: `$${netValue.toFixed(2)}`,
          className: `${styles.netEarnings} ${
            netValue < 0 ? styles.netEarningsNegative : ""
          }`,
          shineClass:
            netValue < 0 ? styles.shineNegative : styles.shinePositive,
        })}
      </>
    );
  };

  const getMonthSpendingsTotal = (monthExpenses) =>
    monthExpenses.reduce((acc, cur) => acc + Number(cur.value), 0).toFixed(2);

  const renderSpendingsSummary = (monthKey, monthExpenses) =>
    renderIncomeSummary(monthKey, getMonthSpendingsTotal(monthExpenses));

  const filteredCategorySpendings =
    effectiveSelectedCategory === "All"
      ? null
      : filteredMonths
          .flatMap(([, expenses]) => expenses)
          .filter(
            (expense) =>
              (expense.categoryId || DEFAULT_CATEGORY_ID) ===
              effectiveSelectedCategory
          )
          .reduce((sum, expense) => sum + Number(expense.value), 0);

  // Keep last amount so exit animation still has a value to show.
  if (filteredCategorySpendings !== null) {
    categoryHintValueRef.current = filteredCategorySpendings;
  }

  const categoryHintTransition = {
    duration: 0.34,
    ease: [0.32, 0.72, 0, 1],
  };

  return (
    <>
      <div className={styles.expensesSectionWrapper}>
        <div className={styles.expensesSection}>
          <h2>Expenses</h2>
          <div className={styles.filterContainer}>
            <div className={styles.filter}>
              <label htmlFor="yearFilter">Filter by Year: </label>
              <select
                id="yearFilter"
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedMonth("All");
                  setSelectedCategory("All");
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
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setSelectedCategory("All");
                }}
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
            <div
              className={`${styles.filter} ${styles.categoryFilter} ${
                filteredCategorySpendings !== null
                  ? styles.categoryFilterWithHint
                  : ""
              }`}
            >
              <label htmlFor="categoryFilter">Filter by Category:</label>
              <div className={styles.categorySelectWrap}>
                <select
                  id="categoryFilter"
                  value={effectiveSelectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`${styles.selectFilters} ${styles.categorySelect}`}
                >
                  <option value="All">All</option>
                  {categoriesInFilter.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
                <AnimatePresence>
                  {filteredCategorySpendings !== null ? (
                    <motion.div
                      key="category-filter-hint"
                      className={styles.categoryFilterHintWrap}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={categoryHintTransition}
                    >
                      <span
                        className={styles.categoryFilterHint}
                        title="Temporary total for the selected category filter"
                      >
                        −${categoryHintValueRef.current.toFixed(2)}
                      </span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {filteredMonths
            .map(([monthKey, expenses], monthIndex) => {
              const [year, month] = monthKey.split("-");
              const visibleExpenses = expenses.filter(matchesFilters);

              const searchBar =
                monthIndex === 0 ? (
                  <div className={styles.searchWrap}>
                    <div className={styles.searchContainer}>
                      <input
                        type="search"
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                        aria-label="Search expenses"
                        autoComplete="off"
                        enterKeyHint="search"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className={styles.searchClearButton}
                          onClick={() => setSearchQuery("")}
                          aria-label="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hasActiveFilters && !hasVisibleResults && (
                      <p className={styles.noSearchResults}>
                        {normalizedSearchQuery && effectiveSelectedCategory !== "All"
                          ? `No expenses found for "${searchQuery.trim()}" in ${categoriesMap[effectiveSelectedCategory]?.name || "this category"}.`
                          : normalizedSearchQuery
                          ? `No expenses found for "${searchQuery.trim()}".`
                          : `No expenses found in ${categoriesMap[effectiveSelectedCategory]?.name || "this category"}.`}
                      </p>
                    )}
                  </div>
                ) : null;

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
                    <div className={styles.monthSummary}>
                      {renderSpendingsSummary(monthKey, expenses)}
                    </div>
                    {searchBar}
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

                  <div className={styles.monthSummary}>
                    {renderSpendingsSummary(monthKey, expenses)}
                  </div>
                  {searchBar}

                  {visibleExpenses.length > 0 && (
                  <div className={styles.expensesContainer}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleExpenses
                        .sort(
                          (a, b) =>
                            new Date(b.inclusionDate) -
                            new Date(a.inclusionDate)
                        )
                        .map((expense) => {
                          const expenseKey =
                            expense.id + "-" + expense.installmentNumber;

                          return (
                          <motion.div
                            key={expenseKey}
                            layout
                            className={styles.expenseLayoutItem}
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                              layout: {
                                duration: 0.42,
                                ease: [0.22, 1, 0.36, 1],
                              },
                              opacity: { duration: 0.28 },
                              scale: { duration: 0.28 },
                              y: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                            }}
                          >
                            <div
                              className={`${styles.expense} ${getBorderStyle(
                                expense.method
                              )} ${
                                pressedExpenseKey === expenseKey
                                  ? styles.expensePressed
                                  : ""
                              }`}
                              onTouchStart={(event) =>
                                handleExpenseTouchStart(event, expenseKey)
                              }
                            >
                            <button
                              className={styles.expenseEditButton}
                              onClick={() => handleEditClick(expense)}
                              title="Edit expense"
                            >
                              <FaPencilAlt className={styles.expensePencilIcon} />
                            </button>
                            <p className={styles.expenseName}>{expense.name}</p>
                            <p className={styles.categoryBadge}>
                              {categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.icon}{" "}
                              {categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.name || "Other"}
                            </p>
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
                            </div>
                          </motion.div>
                          );
                        })}
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
                  )}
                </div>
              );
            })}
        </div>
        <AnimatePresence>
          {showScrollToTop && (
            <motion.button
              className={styles.scrollToTopButton}
              onClick={scrollToTop}
              initial={{ opacity: 0, y: 28, scale: 0.86 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.9 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.9 }}
              aria-label="Scroll to top"
            >
              ↑
            </motion.button>
          )}
        </AnimatePresence>
        {!showExpenseModal && (
          <button
            type="button"
            className={styles.floatingAddButton}
            onClick={openCreateExpense}
            aria-label="Add expense"
            title="Add expense"
          >
            <span className={styles.fabIcon} aria-hidden="true">
              +
            </span>
            <span className={styles.fabLabel}>Add expense</span>
          </button>
        )}
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
        <ExpenseFormModal
          isOpen={showExpenseModal}
          mode={expenseModalMode}
          onClose={closeExpenseModal}
          onSave={async (payload) => {
            try {
              await handleExpenseFormSave(payload);
            } catch (error) {
              console.error("Expense save failed:", error);
              toast.error(
                error.message ||
                  (expenseModalMode === "create"
                    ? "Failed to register expense"
                    : "Falha ao atualizar despesa")
              );
            }
          }}
          categories={expenseCategories}
          favorites={favorites}
          recent={recentTemplates}
          isPro={isPro}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
          initialValues={expenseFormInitial}
          editingExpense={editingExpense}
        />
      </div>
    </>
  );
}

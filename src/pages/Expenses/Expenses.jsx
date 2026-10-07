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
import { useCategoryBudgets } from "../../hooks/useCategoryBudgets";
import { useSessionPeriodFilter } from "../../hooks/useSessionPeriodFilter";
import { buildRecentTemplates } from "../../services/expenseFavoritesService";
import { DEFAULT_CATEGORY_ID } from "../../constants/defaultCategories";
import { getCached, setCached } from "../../utils/dataCache";
import {
  getPageFilter,
  setPageFilter,
} from "../../utils/sessionFilters";
import { matchesExpenseValueQuery } from "../../utils/finance";
import { loadIncomesWithMigration } from "../../services/incomeService";
import {
  setExpenseExcludedFromTotals,
  setExpensesExcludedFromTotals,
} from "../../services/excludedFromTotalsService";
import {
  getEarnedIncome,
  getNetEarnings,
  getPendingIncome,
  getReceivedIncomeForFinancialPeriod,
} from "../../utils/incomeCalculations";
import { countsInTotals } from "../../utils/totalsVisibility";
import { useExcludeFromTotalsToggle } from "../../hooks/useExcludeFromTotalsToggle";
import ExcludeSplashLayer from "../../components/ExcludeSplashLayer/ExcludeSplashLayer";
import FloatingMetricsDock, {
  floatingMetricsDockStyles as dockStyles,
} from "../../components/FloatingMetricsDock/FloatingMetricsDock";
import excludeStyles from "../../styles/excludeFromTotals.module.scss";
import { useLanguage } from "../../i18n/useLanguage";
import { formatMonthName } from "../../i18n/format";
import { PAYMENT_METHOD_LABEL_KEYS } from "../../constants/quickAdd";

export default function Expenses() {
  const navigate = useNavigate();
  const { t, locale, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const { splashKey, splashMode, runToggle, isInteractiveTarget } =
    useExcludeFromTotalsToggle();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const presentMonth = `${currentYear}-${currentMonth}`;

  const [expensesList, setExpensesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const {
    selectedYear,
    selectedMonth,
    setSelectedYear,
    setSelectedMonth,
    setPeriodBoth,
  } = useSessionPeriodFilter({
    year: searchParams.get("year") || undefined,
    month: searchParams.get("month") || undefined,
  });
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
  const [selectedCategory, setSelectedCategoryState] = useState(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl) return fromUrl;
    return getPageFilter("expenses", { category: "All" }).category || "All";
  });
  const setSelectedCategory = (category) => {
    setSelectedCategoryState(category);
    setPageFilter("expenses", { category }, { category: "All" });
  };

  useEffect(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl) {
      setPageFilter("expenses", { category: fromUrl }, { category: "All" });
    }
    // Persist deep-link category into session once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { categories } = useCategories(userId);
  const expenseCategories = useMemo(
    () => getExpenseCategories(categories),
    [categories]
  );
  const categoriesMap = getCategoryMap(categories);
  const { favorites, addFavorite, removeFavorite } = useExpenseFavorites(userId);
  const { isPro } = useSubscription();
  const { budgets } = useCategoryBudgets(userId);
  const recentTemplates = useMemo(
    () => buildRecentTemplates(expensesList, 6),
    [expensesList]
  );
  const [pressedExpenseKey, setPressedExpenseKey] = useState(null);
  const activeTouchIdRef = useRef(null);
  const pressReleaseTimerRef = useRef(0);
  const categoryHintValueRef = useRef(0);
  const summaryAnchorRef = useRef(null);
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
        setExpensesList(
          cachedExpenses.map((item) => ({
            ...item,
            excludedFromTotals: Boolean(item.excludedFromTotals),
          }))
        );
        setIsLoading(false);
      }

      try {
        const data = await getDocs(expensesCollectionRef);
        if (cancelled) {
          return;
        }

        const filteredData = data.docs
          .filter((doc) => !doc.id.startsWith("earnings-"))
          .map((doc) => {
            const dataItem = doc.data();
            return {
              ...dataItem,
              id: doc.id,
              excludedFromTotals: Boolean(dataItem.excludedFromTotals),
            };
          });

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
        toast.error(t("toast.incomeSummaryFailed"));
      } finally {
        setIsIncomeLoading(false);
      }
    };

    loadIncomeFromFirestore();
  }, [userId, t]);

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
      toast.success(t("toast.expenseDeleted"));
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
      return language === "pt"
        ? `${day}/${month}/${year}`
        : `${month}/${day}/${year}`;
    } else {
      return dateString;
    }
  }

  function getMethodLabel(method) {
    const key = PAYMENT_METHOD_LABEL_KEYS[method];
    return key ? t(key) : method;
  }

  function formatValue(value) {
    return Number(value || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const renderDockMetric = (label, displayValue, className = "") => (
    <div className={`${dockStyles.metric} ${className}`.trim()}>
      <span className={dockStyles.metricLabel}>{label}</span>
      <span className={dockStyles.metricValue}>{displayValue}</span>
    </div>
  );

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
      toast.success(t("toast.expensePaused"));
    } catch (error) {
      console.error("Error pausing expense:", error);
      toast.error(t("toast.expensePauseFailed"));
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
      toast.success(t("toast.expenseResumed"));
    } catch (error) {
      console.error("Error resuming expense:", error);
      toast.error(t("toast.expenseResumeFailed"));
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
            aria-label={t("expenses.resumeAria")}
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
            setPeriodBoth(pauseYear, pauseMonth);
          }}
          aria-label={t("expenses.goToPauseMonth")}
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
        aria-label={t("expenses.pauseAria")}
      >
        <FaPause className={styles.playPauseIcon} />
      </button>
    ) : (
      <button
        type="button"
        className={styles.iconActionBtn}
        onClick={shouldEnableCalendar ? () => {
          setPeriodBoth(currentYear, currentMonth);
        } : undefined}
        disabled={!shouldEnableCalendar}
        aria-label={
          !shouldEnableCalendar
            ? t("expenses.futureExpense")
            : t("expenses.goToCurrentMonth")
        }
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
      toast.error(t("toast.needSignIn"));
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
      toast.success(t("toast.expenseRegistered"));
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
        .map((docItem) => {
          const dataItem = docItem.data();
          return {
            ...dataItem,
            id: docItem.id,
            excludedFromTotals: Boolean(dataItem.excludedFromTotals),
          };
        });

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
    toast.success(t("toast.expenseUpdated"));
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
    const methodLabel = getMethodLabel(expense.method)?.toLowerCase() ?? "";
    const category =
      categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.name?.toLowerCase() ??
      "";

    const matchesText =
      name.includes(normalizedSearchQuery) ||
      method.includes(normalizedSearchQuery) ||
      methodLabel.includes(normalizedSearchQuery) ||
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
      toast.error(t("toast.copyFailed"));
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
        aria-label={t("metrics.copyValue", { label })}
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
            {t("metrics.earned")}:{" "}
            <span
              className={styles.netEarningsShimmer}
              role="status"
              aria-label={t("common.loading")}
            />
          </p>
          <p className={styles.summaryLine}>
            {t("metrics.pendingIncome")}:{" "}
            <span
              className={styles.netEarningsShimmer}
              role="status"
              aria-label={t("common.loading")}
            />
          </p>
          <p className={styles.summaryLine}>
            {t("metrics.received")}:{" "}
            <span
              className={styles.netEarningsShimmer}
              role="status"
              aria-label={t("common.loading")}
            />
          </p>
          <p className={styles.totalSpendings}>
            {t("metrics.yourSpendings")}:{" "}
            <b>-${Number(totalSpendings || 0).toFixed(2)}</b>
          </p>
          <p className={styles.netEarnings}>
            {t("metrics.netEarnings")}:{" "}
            <span
              className={styles.netEarningsShimmer}
              role="status"
              aria-label={t("common.loading")}
            />
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
            label: t("metrics.earned"),
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
            aria-label={t("metrics.openIncomeAria")}
            title={t("metrics.openIncome")}
          >
            <FaPencilAlt className={styles.pencilIcon} aria-hidden="true" />
          </button>
        </div>
        {renderCopyableMetric({
          metricKey: `${monthKey}-pending`,
          label: t("metrics.pendingIncome"),
          numericValue: pending,
          displayValue: `$${pending.toFixed(2)}`,
          className:
            pending > 0 ? styles.summaryPending : styles.summaryPendingZero,
          shineClass: styles.shinePending,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-received`,
          label: t("metrics.received"),
          numericValue: received,
          displayValue: `$${received.toFixed(2)}`,
          className: styles.summaryReceived,
          shineClass: styles.shineReceived,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-spendings`,
          label: t("metrics.yourSpendings"),
          numericValue: spendingsValue,
          displayValue: `-$${spendingsValue.toFixed(2)}`,
          className: styles.totalSpendings,
          shineClass: styles.shineNeutral,
        })}
        {renderCopyableMetric({
          metricKey: `${monthKey}-net`,
          label: t("metrics.netEarnings"),
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
    monthExpenses
      .reduce((acc, cur) => {
        if (!countsInTotals(cur)) return acc;
        return acc + Number(cur.value);
      }, 0)
      .toFixed(2);

  const renderSpendingsSummary = (monthKey, monthExpenses) =>
    renderIncomeSummary(monthKey, getMonthSpendingsTotal(monthExpenses));

  const applyExpenseExcluded = async (expense, nextExcluded) => {
    if (!userId || !expense?.id) return;
    const previous = Boolean(expense.excludedFromTotals);
    setExpensesList((prev) => {
      const next = prev.map((item) =>
        item.id === expense.id
          ? { ...item, excludedFromTotals: nextExcluded }
          : item
      );
      setCached("expenses", userId, next);
      return next;
    });
    try {
      await setExpenseExcludedFromTotals(userId, expense.id, nextExcluded);
    } catch (error) {
      console.error(error);
      setExpensesList((prev) => {
        const next = prev.map((item) =>
          item.id === expense.id
            ? { ...item, excludedFromTotals: previous }
            : item
        );
        setCached("expenses", userId, next);
        return next;
      });
      toast.error(t("toast.expenseExcludeFailed"));
    }
  };

  const activateAllExpenses = async (monthExpenses) => {
    if (!userId) return;
    const ids = [
      ...new Set(
        monthExpenses
          .filter((item) => item.excludedFromTotals)
          .map((item) => item.id)
      ),
    ];
    if (!ids.length) return;
    setExpensesList((prev) => {
      const idSet = new Set(ids);
      const next = prev.map((item) =>
        idSet.has(item.id) ? { ...item, excludedFromTotals: false } : item
      );
      setCached("expenses", userId, next);
      return next;
    });
    try {
      await setExpensesExcludedFromTotals(userId, ids, false);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.expenseActivateFailed"));
    }
  };

  const filteredCategorySpendings =
    effectiveSelectedCategory === "All"
      ? null
      : filteredMonths
          .flatMap(([, expenses]) => expenses)
          .filter(
            (expense) =>
              countsInTotals(expense) &&
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

  const [primaryMonthKey, primaryMonthExpenses = []] = filteredMonths[0] || [];
  const dockSpendings = Number(getMonthSpendingsTotal(primaryMonthExpenses));
  const dockEarned = primaryMonthKey
    ? getEarnedIncome(incomes, primaryMonthKey)
    : 0;
  const dockPending = primaryMonthKey
    ? getPendingIncome(incomes, primaryMonthKey)
    : 0;
  const dockReceived = primaryMonthKey
    ? getReceivedIncomeForFinancialPeriod(incomes, primaryMonthKey)
    : 0;
  const dockNet = primaryMonthKey
    ? getNetEarnings(incomes, primaryMonthKey, dockSpendings)
    : 0;

  const dockFilters = (
    <>
      <select
        id="expensesDockYearFilter"
        aria-label={t("expenses.filterYear")}
        value={selectedYear}
        onChange={(e) => {
          setSelectedYear(e.target.value);
          setSelectedMonth("All");
          setSelectedCategory("All");
        }}
        className={dockStyles.pill}
      >
        <option value="All">{t("common.all")}</option>
        {sortedUniqueYears
          .filter((year) => !isNaN(year))
          .map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
      </select>
      <select
        id="expensesDockMonthFilter"
        aria-label={t("expenses.filterMonth")}
        value={selectedMonth}
        onChange={(e) => {
          setSelectedMonth(e.target.value);
          setSelectedCategory("All");
        }}
        disabled={selectedYear === "All"}
        className={dockStyles.pill}
      >
        <option value="All">{t("common.all")}</option>
        {sortedUniqueMonths.map((month) => {
          const isCurrentMonth =
            selectedYear === currentYear && month === currentMonth;
          return (
            <option key={month} value={month} data-current={isCurrentMonth}>
              {month} - {formatMonthName(month, locale)}
              {isCurrentMonth ? " 📅" : ""}
            </option>
          );
        })}
      </select>
      <select
        id="expensesDockCategoryFilter"
        aria-label={t("expenses.filterCategory")}
        value={effectiveSelectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className={dockStyles.pill}
      >
        <option value="All">{t("common.all")}</option>
        {categoriesInFilter.map((category) => (
          <option key={category.id} value={category.id}>
            {category.icon} {category.name}
          </option>
        ))}
      </select>
    </>
  );

  const dockMetrics = primaryMonthKey ? (
    <>
      {renderDockMetric(
        t("metrics.earned"),
        isIncomeLoading ? "…" : `$${formatValue(dockEarned)}`,
        dockStyles.metricEarned
      )}
      {renderDockMetric(
        t("metrics.pendingIncome"),
        isIncomeLoading ? "…" : `$${formatValue(dockPending)}`,
        !isIncomeLoading && dockPending > 0
          ? dockStyles.metricPending
          : dockStyles.metricPendingZero
      )}
      {renderDockMetric(
        t("metrics.received"),
        isIncomeLoading ? "…" : `$${formatValue(dockReceived)}`,
        dockStyles.metricReceived
      )}
      {renderDockMetric(
        t("metrics.yourSpendings"),
        `-$${formatValue(dockSpendings)}`,
        dockStyles.metricSpend
      )}
      {renderDockMetric(
        t("metrics.netEarnings"),
        isIncomeLoading ? "…" : `$${formatValue(dockNet)}`,
        `${dockStyles.metricNet} ${
          !isIncomeLoading && dockNet < 0 ? dockStyles.metricNegative : ""
        }`
      )}
    </>
  ) : null;

  return (
    <>
      <div className={styles.expensesSectionWrapper}>
        <div className={styles.expensesSection}>
          <h2>{t("expenses.title")}</h2>
          <div className={styles.filterContainer}>
            <div className={styles.filter}>
              <label htmlFor="yearFilter">{t("expenses.filterYear")} </label>
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
                <option value="All">{t("common.all")}</option>
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
              <label htmlFor="monthFilter">{t("expenses.filterMonth")} </label>
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
                <option value="All">{t("common.all")}</option>
                {sortedUniqueMonths.map((month) => {
                  const isCurrentMonth = selectedYear === currentYear && month === currentMonth;
                  return (
                    <option 
                      key={month} 
                      value={month}
                      data-current={isCurrentMonth}
                    >
                      {month} - {formatMonthName(month, locale)}
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
              <label htmlFor="categoryFilter">{t("expenses.filterCategory")}</label>
              <div className={styles.categorySelectWrap}>
                <select
                  id="categoryFilter"
                  value={effectiveSelectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`${styles.selectFilters} ${styles.categorySelect}`}
                >
                  <option value="All">{t("common.all")}</option>
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
                        title={t("expenses.categoryHintTitle")}
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
                        id="expensesPageSearch"
                        placeholder={t("expenses.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                        aria-label={t("expenses.searchAria")}
                        autoComplete="off"
                        enterKeyHint="search"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className={styles.searchClearButton}
                          onClick={() => setSearchQuery("")}
                          aria-label={t("expenses.clearSearch")}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {hasActiveFilters && !hasVisibleResults && (
                      <p className={styles.noSearchResults}>
                        {normalizedSearchQuery && effectiveSelectedCategory !== "All"
                          ? t("expenses.emptySearchCategory", {
                              query: searchQuery.trim(),
                              category:
                                categoriesMap[effectiveSelectedCategory]?.name ||
                                t("expenses.thisCategory"),
                            })
                          : normalizedSearchQuery
                          ? t("expenses.emptySearch", {
                              query: searchQuery.trim(),
                            })
                          : t("expenses.emptyCategory", {
                              category:
                                categoriesMap[effectiveSelectedCategory]?.name ||
                                t("expenses.thisCategory"),
                            })}
                      </p>
                    )}
                  </div>
                ) : null;

              // Garantir que o mês seja exibido mesmo sem despesas
              const monthHasExcluded = expenses.some(
                (expense) => expense.excludedFromTotals
              );
              const monthTitle = (
                <div className={styles.monthHeader}>
                  <h3 className={styles.month}>
                    {formatMonthName(month, locale)} {year}
                  </h3>
                  {monthHasExcluded && (
                    <button
                      type="button"
                      className={styles.activateAllBtn}
                      onClick={() => activateAllExpenses(expenses)}
                    >
                      {t("expenses.activateAll")}
                    </button>
                  )}
                </div>
              );

              if (expenses.length === 0) {
                return (
                  <div key={monthKey}>
                    {monthTitle}
                    <div className={styles.monthSummary}>
                      {renderSpendingsSummary(monthKey, expenses)}
                    </div>
                    {monthIndex === 0 ? (
                      <div ref={summaryAnchorRef} aria-hidden="true" />
                    ) : null}
                    {searchBar}
                  </div>
                );
              }

              return (
                <div key={monthKey}>
                  {monthTitle}

                  <div className={styles.monthSummary}>
                    {renderSpendingsSummary(monthKey, expenses)}
                  </div>
                  {monthIndex === 0 ? (
                    <div ref={summaryAnchorRef} aria-hidden="true" />
                  ) : null}
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
                          const isExcluded = Boolean(expense.excludedFromTotals);
                          const isSplashing = splashKey === expenseKey;
                          const splashClass = isSplashing
                            ? splashMode === "in"
                              ? excludeStyles.activating
                              : excludeStyles.splashing
                            : "";

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
                              className={`${styles.expense} ${excludeStyles.surface} ${getBorderStyle(
                                expense.method
                              )} ${
                                pressedExpenseKey === expenseKey
                                  ? styles.expensePressed
                                  : ""
                              } ${isExcluded ? excludeStyles.excluded : ""} ${splashClass}`}
                              onTouchStart={(event) =>
                                handleExpenseTouchStart(event, expenseKey)
                              }
                              onClick={(event) => {
                                if (isInteractiveTarget(event.target)) return;
                                runToggle({
                                  key: expenseKey,
                                  currentlyExcluded: isExcluded,
                                  persist: (nextExcluded) =>
                                    applyExpenseExcluded(expense, nextExcluded),
                                });
                              }}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isExcluded}
                              aria-label={t(
                                isExcluded
                                  ? "expenses.includeAria"
                                  : "expenses.excludeAria",
                                { name: expense.name }
                              )}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") {
                                  return;
                                }
                                event.preventDefault();
                                runToggle({
                                  key: expenseKey,
                                  currentlyExcluded: isExcluded,
                                  persist: (nextExcluded) =>
                                    applyExpenseExcluded(expense, nextExcluded),
                                });
                              }}
                            >
                            <ExcludeSplashLayer
                              active={isSplashing}
                              className={excludeStyles.splashLayer}
                              cornerClassName={excludeStyles.splashCorner}
                            />
                            <button
                              className={styles.expenseEditButton}
                              onClick={() => handleEditClick(expense)}
                              title={t("expenses.editTitle")}
                              type="button"
                            >
                              <FaPencilAlt className={styles.expensePencilIcon} />
                            </button>
                            <p className={styles.expenseName}>{expense.name}</p>
                            <p className={styles.categoryBadge}>
                              {categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.icon}{" "}
                              {categoriesMap[expense.categoryId || DEFAULT_CATEGORY_ID]?.name || t("common.other")}
                            </p>
                            <p className={styles.expenseValue}>
                              {expense.installments > 1 ? (
                                <>
                                  ${formatValue(expense.value)}{" "}
                                  {expense.installmentNumber}/
                                  {expense.installments}
                                  <br />
                                  <span className={styles.expenseTotal}>
                                    {t("expenses.totalLabel", {
                                      amount: `$${formatValue(expense.totalValue)}`,
                                    })}
                                  </span>
                                </>
                              ) : (
                                `$${formatValue(expense.value)}`
                              )}
                            </p>
                            <p className={styles.expenseMethod}>
                              {getMethodLabel(expense.method)}
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
                                  alt={t("expenses.deleteIconAlt")}
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
                        title={t("expenses.deleteTitle")}
                        message={t("expenses.deleteMessage")}
                        identifier={expenseToDeleteName}
                      />
                    </AnimatePresence>
                  </div>
                  )}
                </div>
              );
            })}
        </div>
        {!showExpenseModal && (
          <button
            type="button"
            className={styles.floatingAddButton}
            onClick={openCreateExpense}
            aria-label={t("expenses.add")}
            title={t("expenses.add")}
          >
            <span className={styles.fabIcon} aria-hidden="true">
              +
            </span>
            <span className={styles.fabLabel}>{t("expenses.add")}</span>
          </button>
        )}
        {showPauseModal && (
          <ConfirmationModal
            isOpen={showPauseModal}
            onRequestClose={() => setShowPauseModal(false)}
            onConfirm={handleConfirmPause}
            title={t("expenses.pauseTitle")}
            message={t("expenses.pauseMessage")}
            identifier={expenseToDeleteName}
            expenseName={expenseToDeleteName}
          />
        )}
        {showResumeModal && (
          <ConfirmationModal
            isOpen={showResumeModal}
            onRequestClose={() => setShowResumeModal(false)}
            onConfirm={handleConfirmResume}
            title={t("expenses.resumeTitle")}
            message={t("expenses.resumeMessage")}
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
                    ? t("toast.expenseRegisterFailed")
                    : t("toast.expenseUpdateFailed"))
              );
            }
          }}
          categories={expenseCategories}
          favorites={favorites}
          recent={recentTemplates}
          isPro={isPro}
          budgets={isPro ? budgets : []}
          expensesByMonth={expensesByMonth}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
          initialValues={expenseFormInitial}
          editingExpense={editingExpense}
        />
      </div>
      <FloatingMetricsDock
        anchorRef={summaryAnchorRef}
        observeKey={primaryMonthKey || "empty"}
        ariaLabel={t("metrics.dockAria")}
        metrics={dockMetrics}
        filters={dockFilters}
        handoffSearchFocusTo="#expensesPageSearch"
        search={
          <div className={dockStyles.searchContainer}>
            {!searchQuery ? (
              <span className={dockStyles.searchPlaceholder} aria-hidden="true">
                {t("expenses.searchPlaceholderShort")}
              </span>
            ) : null}
            <input
              type="search"
              id="expensesDockSearch"
              placeholder=""
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={dockStyles.searchInput}
              aria-label={t("expenses.searchAria")}
              autoComplete="off"
              enterKeyHint="search"
            />
            {searchQuery ? (
              <button
                type="button"
                className={dockStyles.searchClearButton}
                onClick={() => setSearchQuery("")}
                aria-label={t("expenses.clearSearch")}
              >
                ×
              </button>
            ) : null}
          </div>
        }
      />
    </>
  );
}

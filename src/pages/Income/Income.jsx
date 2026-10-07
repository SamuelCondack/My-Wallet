import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { FaCheck, FaCopy, FaPause, FaPencilAlt, FaPlay } from "react-icons/fa";
import bin from "../../assets/bin.png";
import { auth, db } from "../../../config/firebase";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import BottomSheet from "../../components/BottomSheet/BottomSheet";
import sheetStyles from "../../components/BottomSheet/BottomSheet.module.scss";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import IncomeModal from "../../modals/IncomeModal/IncomeModal";
import PaywallModal from "../../components/PaywallModal/PaywallModal";
import { useCategories } from "../../hooks/useCategories";
import { useSessionPeriodFilter } from "../../hooks/useSessionPeriodFilter";
import { useSubscription } from "../../hooks/useSubscription";
import {
  getCategoryMap,
  getIncomeCategories,
} from "../../services/categoriesService";
import {
  confirmIncome,
  convertIncomeToMonthly,
  convertMonthlyIncomeToOneOff,
  createIncome,
  deleteIncome,
  fetchIncomes,
  loadIncomesWithMigration,
  pauseMonthlyIncome,
  resumeMonthlyIncome,
  setIncomeExcludedFromTotals,
  setIncomesExcludedFromTotals,
  updateIncome,
} from "../../services/incomeService";
import { getCached, setCached } from "../../utils/dataCache";
import {
  getPageFilter,
  setPageFilter,
} from "../../utils/sessionFilters";
import {
  filterIncomes,
  formatDisplayDate,
  formatPeriodLabel,
  getIncomeSummaryForPeriod,
  INCOME_STATUS,
} from "../../utils/incomeCalculations";
import {
  buildExpensesByMonth,
  getMonthTotal,
} from "../../utils/expenseCalculations";
import { matchesExpenseValueQuery } from "../../utils/finance";
import { countsInTotals } from "../../utils/totalsVisibility";
import { DEFAULT_INCOME_CATEGORY_ID } from "../../constants/defaultCategories";
import { getProFeature } from "../../constants/subscription";
import { useExcludeFromTotalsToggle } from "../../hooks/useExcludeFromTotalsToggle";
import ExcludeSplashLayer from "../../components/ExcludeSplashLayer/ExcludeSplashLayer";
import FloatingMetricsDock, {
  floatingMetricsDockStyles as dockStyles,
} from "../../components/FloatingMetricsDock/FloatingMetricsDock";
import excludeStyles from "../../styles/excludeFromTotals.module.scss";
import { useLanguage } from "../../i18n/useLanguage";
import { formatMonthName } from "../../i18n/format";
import useSharedSearchFields from "../../hooks/useSharedSearchFields";
import { shiftPeriodMonth } from "../../utils/periodStep";
import styles from "./Income.module.scss";

export default function Income() {
  const navigate = useNavigate();
  const { t, locale, language } = useLanguage();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const { splashKey, splashMode, runToggle, isInteractiveTarget } =
    useExcludeFromTotalsToggle();
  const categoryHintValueRef = useRef(0);
  const summaryAnchorRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportSheetView, setExportSheetView] = useState("menu");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState([]);
  const { isPro, canStartTrial } = useSubscription();
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
  const [monthStepPulse, setMonthStepPulse] = useState({
    side: null,
    tick: 0,
  });
  const monthStepPulseTimerRef = useRef(0);
  const [selectedCategory, setSelectedCategoryState] = useState(() => {
    const fromUrl = searchParams.get("category");
    if (fromUrl) return fromUrl;
    return getPageFilter("income", { category: "All", status: "All" }).category || "All";
  });
  const [selectedStatus, setSelectedStatusState] = useState(() => {
    const fromUrl = searchParams.get("status");
    if (fromUrl) return fromUrl;
    return getPageFilter("income", { category: "All", status: "All" }).status || "All";
  });

  const setSelectedCategory = (category) => {
    setSelectedCategoryState(category);
    setPageFilter(
      "income",
      { category },
      { category: "All", status: "All" }
    );
  };

  const setSelectedStatus = (status) => {
    setSelectedStatusState(status);
    setPageFilter(
      "income",
      { status },
      { category: "All", status: "All" }
    );
  };

  useEffect(() => {
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    if (category || status) {
      setPageFilter(
        "income",
        {
          ...(category ? { category } : {}),
          ...(status ? { status } : {}),
        },
        { category: "All", status: "All" }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("edit");
  const [activeIncome, setActiveIncome] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);
  const [monthlyActionIncome, setMonthlyActionIncome] = useState(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [activateAllTarget, setActivateAllTarget] = useState(null);
  const [pressedIncomeKey, setPressedIncomeKey] = useState(null);
  const {
    searchQuery,
    pageInputRef,
    dockInputRef,
    handleSearchChange,
    clearSearchQuery,
  } = useSharedSearchFields();
  const activeTouchIdRef = useRef(null);
  const pressReleaseTimerRef = useRef(0);
  const [copiedMetric, setCopiedMetric] = useState(null);
  const copyTimeoutsRef = useRef([]);
  const spendingsCopyPhaseRef = useRef("copy");

  const { categories } = useCategories(userId);
  const incomeCategories = useMemo(
    () => getIncomeCategories(categories),
    [categories]
  );
  const categoriesMap = getCategoryMap(categories);

  const pulseMonthStepper = (side) => {
    if (monthStepPulseTimerRef.current) {
      window.clearTimeout(monthStepPulseTimerRef.current);
      monthStepPulseTimerRef.current = 0;
    }
    setMonthStepPulse((prev) => ({ side, tick: prev.tick + 1 }));
    monthStepPulseTimerRef.current = window.setTimeout(() => {
      setMonthStepPulse((prev) => ({ ...prev, side: null }));
      monthStepPulseTimerRef.current = 0;
    }, 1150);
  };

  useEffect(() => {
    return () => {
      if (monthStepPulseTimerRef.current) {
        window.clearTimeout(monthStepPulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setIncomes([]);
        setExpensesList([]);
        setIsLoading(false);
        return;
      }

      const cachedIncome = getCached("income", userId);
      const cachedExpenses = getCached("expenses", userId);
      if (cachedIncome) {
        setIncomes(cachedIncome);
      }
      if (cachedExpenses) {
        setExpensesList(cachedExpenses);
      }
      if (cachedIncome && cachedExpenses) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [incomeData, expensesSnap] = await Promise.all([
          cachedIncome
            ? Promise.resolve(cachedIncome)
            : loadIncomesWithMigration(userId),
          cachedExpenses
            ? Promise.resolve(null)
            : getDocs(collection(db, userId)),
        ]);
        if (cancelled) return;

        if (!cachedIncome) {
          setIncomes(incomeData);
        }
        if (!cachedExpenses && expensesSnap) {
          const filteredData = expensesSnap.docs
            .filter((docItem) => !docItem.id.startsWith("earnings-"))
            .map((docItem) => ({ ...docItem.data(), id: docItem.id }));
          setExpensesList(filteredData);
          setCached("expenses", userId, filteredData);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error(t("toast.incomeLoadFailed"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, t]);

  useEffect(() => {
    if (userId && !isLoading) {
      setCached("income", userId, incomes);
    }
  }, [userId, incomes, isLoading]);

  useEffect(() => {
    const params = {};
    if (selectedYear !== "All") params.year = selectedYear;
    if (selectedMonth !== "All") params.month = selectedMonth;
    if (selectedCategory !== "All") params.category = selectedCategory;
    if (selectedStatus !== "All") params.status = selectedStatus;
    setSearchParams(params, { replace: true });
  }, [
    selectedYear,
    selectedMonth,
    selectedCategory,
    selectedStatus,
    setSearchParams,
  ]);

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
        pressReleaseTimerRef.current = window.setTimeout(() => {
          setPressedIncomeKey(null);
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
    return () => {
      copyTimeoutsRef.current.forEach((id) => clearTimeout(id));
      if (pressReleaseTimerRef.current) {
        window.clearTimeout(pressReleaseTimerRef.current);
      }
    };
  }, []);

  const syncIncomes = (next) => {
    setIncomes(next);
    if (userId) {
      setCached("income", userId, next);
    }
  };

  const years = useMemo(() => {
    const set = new Set(
      incomes
        .map((item) => item.incomePeriod?.split("-")[0])
        .filter(Boolean)
    );
    set.add(currentYear);
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [incomes, currentYear]);

  const months = useMemo(() => {
    if (selectedYear === "All") {
      return [];
    }
    const set = new Set(
      incomes
        .filter((item) => item.incomePeriod?.startsWith(`${selectedYear}-`))
        .map((item) => item.incomePeriod.split("-")[1])
    );
    set.add(currentMonth);
    for (let i = 1; i <= 12; i += 1) {
      set.add(String(i).padStart(2, "0"));
    }
    return Array.from(set).sort();
  }, [incomes, selectedYear, currentMonth]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    const base = filterIncomes(incomes, {
      year: selectedYear,
      month: selectedMonth,
      categoryId: selectedCategory,
      status: selectedStatus,
    });

    if (!normalizedSearchQuery) {
      return base;
    }

    const pendingLabel = t("income.pending").toLowerCase();
    const confirmedLabel = t("income.confirmed").toLowerCase();

    return base.filter((item) => {
      const description = String(item.description || "").toLowerCase();
      const category =
        categoriesMap[item.categoryId || DEFAULT_INCOME_CATEGORY_ID]?.name?.toLowerCase() ??
        "";
      const statusLabel =
        item.status === INCOME_STATUS.PENDING ? pendingLabel : confirmedLabel;
      const matchesText =
        description.includes(normalizedSearchQuery) ||
        category.includes(normalizedSearchQuery) ||
        statusLabel.includes(normalizedSearchQuery);
      const matchesValue = matchesExpenseValueQuery(
        item.amount,
        searchQuery.trim()
      );
      return matchesText || matchesValue;
    });
  }, [
    incomes,
    selectedYear,
    selectedMonth,
    selectedCategory,
    selectedStatus,
    normalizedSearchQuery,
    searchQuery,
    categoriesMap,
    t,
  ]);

  const periodKey =
    selectedYear !== "All" && selectedMonth !== "All"
      ? `${selectedYear}-${selectedMonth}`
      : null;

  const stepDockMonth = (delta, side) => {
    pulseMonthStepper(side);
    const [fallbackYear, fallbackMonth] = (
      periodKey || `${currentYear}-${currentMonth}`
    ).split("-");
    const next = shiftPeriodMonth(
      selectedYear,
      selectedMonth,
      delta,
      fallbackYear || currentYear,
      fallbackMonth || currentMonth
    );
    setPeriodBoth(next.year, next.month);
    setSelectedCategory("All");
  };

  const summarySource = useMemo(() => {
    if (!periodKey) {
      return filtered;
    }
    return incomes.filter((item) => item.incomePeriod === periodKey);
  }, [incomes, filtered, periodKey]);

  const summary = useMemo(() => {
    if (periodKey) {
      return getIncomeSummaryForPeriod(incomes, periodKey);
    }
    const earned = summarySource.reduce((sum, item) => {
      if (!countsInTotals(item)) return sum;
      return sum + Number(item.amount);
    }, 0);
    const received = summarySource
      .filter(
        (item) =>
          countsInTotals(item) && item.status === INCOME_STATUS.CONFIRMED
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const pending = summarySource
      .filter(
        (item) => countsInTotals(item) && item.status === INCOME_STATUS.PENDING
      )
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { earned, received, pending };
  }, [incomes, periodKey, summarySource]);

  const expensesByMonth = useMemo(
    () => buildExpensesByMonth(expensesList),
    [expensesList]
  );

  const spendingsTotal = useMemo(() => {
    if (periodKey) {
      return getMonthTotal(expensesByMonth, periodKey);
    }
    if (selectedYear !== "All") {
      return Object.entries(expensesByMonth)
        .filter(([monthKey]) => monthKey.startsWith(`${selectedYear}-`))
        .reduce(
          (sum, [, monthExpenses]) =>
            sum +
            monthExpenses.reduce((monthSum, expense) => {
              if (!countsInTotals(expense)) return monthSum;
              return monthSum + (Number(expense.value) || 0);
            }, 0),
          0
        );
    }
    return Object.values(expensesByMonth).reduce(
      (sum, monthExpenses) =>
        sum +
        monthExpenses.reduce((monthSum, expense) => {
          if (!countsInTotals(expense)) return monthSum;
          return monthSum + (Number(expense.value) || 0);
        }, 0),
      0
    );
  }, [expensesByMonth, periodKey, selectedYear]);

  const netEarnings = summary.earned - spendingsTotal;

  const pendingList = filtered.filter(
    (item) => item.status === INCOME_STATUS.PENDING
  );
  const confirmedList = filtered.filter(
    (item) => item.status === INCOME_STATUS.CONFIRMED
  );

  const filteredCategoryIncomeTotal = useMemo(() => {
    if (selectedCategory === "All") return null;
    return filterIncomes(incomes, {
      year: selectedYear,
      month: selectedMonth,
      categoryId: selectedCategory,
      status: "All",
    })
      .filter(countsInTotals)
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [incomes, selectedYear, selectedMonth, selectedCategory]);

  /** Pending in the current year/month only — ignores category filter (used for All / By category). */
  const periodPendingList = useMemo(
    () =>
      filterIncomes(incomes, {
        year: selectedYear,
        month: selectedMonth,
        categoryId: "All",
        status: INCOME_STATUS.PENDING,
      }),
    [incomes, selectedYear, selectedMonth]
  );

  /** Bulk PDF paths omit excluded cards; manual select can still include them. */
  const periodPendingExportList = useMemo(
    () => periodPendingList.filter(countsInTotals),
    [periodPendingList]
  );

  const pendingByCategory = useMemo(() => {
    const groups = new Map();
    periodPendingExportList.forEach((item) => {
      const key = item.categoryId || DEFAULT_INCOME_CATEGORY_ID;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.entries())
      .map(([categoryId, items]) => {
        const category = categoriesMap[categoryId];
        const total = items.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0
        );
        return {
          categoryId,
          name: category?.name || t("common.other"),
          icon: category?.icon || "💰",
          count: items.length,
          total,
          items,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [periodPendingExportList, categoriesMap, t]);

  const exportPeriodLabel = useMemo(() => {
    if (periodKey) return formatPeriodLabel(periodKey, locale);
    if (selectedYear !== "All") return String(selectedYear);
    return t("income.allPeriods");
  }, [periodKey, selectedYear, locale, t]);

  const exportFileStem = useMemo(() => {
    const stem =
      selectedYear !== "All" && selectedMonth !== "All"
        ? `${selectedYear}-${selectedMonth}`
        : selectedYear !== "All"
          ? String(selectedYear)
          : "all";
    return `mywallet-payment-due-${stem}`;
  }, [selectedYear, selectedMonth]);

  const selectedPendingList = useMemo(
    () => pendingList.filter((item) => selectedIncomeIds.includes(item.id)),
    [pendingList, selectedIncomeIds]
  );

  const runPendingPdfExport = async ({ list }) => {
    if (isExportingPdf) return;
    if (!list.length) {
      toast.info(t("toast.noPendingExport"));
      return;
    }
    setIsExportingPdf(true);
    const toastId = toast.loading(t("toast.pdfGenerating"));
    try {
      const { downloadPendingIncomesPdf } = await import(
        "../../utils/exportPendingIncomesPdf"
      );
      await downloadPendingIncomesPdf({
        incomes: list,
        periodLabel: exportPeriodLabel,
        fileStem: exportFileStem,
        t,
        locale,
      });
      toast.update(toastId, {
        render: t("toast.pdfReady"),
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
      setExportSheetOpen(false);
      setExportSheetView("menu");
      setSelectMode(false);
      setSelectedIncomeIds([]);
    } catch (error) {
      console.error(error);
      toast.update(toastId, {
        render: t("toast.pdfFailed"),
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const openExportSheet = () => {
    if (!isPro) {
      setPaywallOpen(true);
      return;
    }
    // Allow opening when only excluded pendings remain (manual select can still export them).
    if (periodPendingList.length === 0) {
      toast.info(t("toast.noPendingExport"));
      return;
    }
    setExportSheetView("menu");
    setExportSheetOpen(true);
  };

  const applyIncomeExcluded = async (income, nextExcluded) => {
    if (!userId || !income?.id) return;
    const previous = Boolean(income.excludedFromTotals);
    setIncomes((prev) => {
      const next = prev.map((item) =>
        item.id === income.id
          ? { ...item, excludedFromTotals: nextExcluded }
          : item
      );
      setCached("income", userId, next);
      return next;
    });
    try {
      await setIncomeExcludedFromTotals(userId, income.id, nextExcluded);
    } catch (error) {
      console.error(error);
      setIncomes((prev) => {
        const next = prev.map((item) =>
          item.id === income.id
            ? { ...item, excludedFromTotals: previous }
            : item
        );
        setCached("income", userId, next);
        return next;
      });
      toast.error(t("toast.incomeExcludeFailed"));
    }
  };

  const requestActivateAllIncomes = (items, label) => {
    if (!userId) return;
    const excluded = items.filter((item) => item.excludedFromTotals);
    if (!excluded.length) return;
    setActivateAllTarget({ items, label });
  };

  const handleConfirmActivateAllIncomes = async () => {
    const target = activateAllTarget;
    setActivateAllTarget(null);
    if (!userId || !target?.items?.length) return;
    const ids = target.items
      .filter((item) => item.excludedFromTotals)
      .map((item) => item.id);
    if (!ids.length) return;
    setIncomes((prev) => {
      const idSet = new Set(ids);
      const next = prev.map((item) =>
        idSet.has(item.id) ? { ...item, excludedFromTotals: false } : item
      );
      setCached("income", userId, next);
      return next;
    });
    try {
      await setIncomesExcludedFromTotals(userId, ids, false);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.incomeActivateFailed"));
    }
  };

  const startSelectMode = () => {
    setExportSheetOpen(false);
    setExportSheetView("menu");
    setSelectMode(true);
    setSelectedIncomeIds([]);
    if (selectedStatus !== INCOME_STATUS.PENDING && selectedStatus !== "All") {
      setSelectedStatus(INCOME_STATUS.PENDING);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIncomeIds([]);
  };

  const toggleIncomeSelected = (incomeId) => {
    setSelectedIncomeIds((prev) =>
      prev.includes(incomeId)
        ? prev.filter((id) => id !== incomeId)
        : [...prev, incomeId]
    );
  };

  const openCreate = () => {
    setActiveIncome(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const clearCopyTimeouts = () => {
    copyTimeoutsRef.current.forEach((id) => clearTimeout(id));
    copyTimeoutsRef.current = [];
  };

  const formatValue = (value) =>
    Number(value || 0).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const copyMetricValue = async (metricKey, numericValue) => {
    const plain = Number(numericValue).toFixed(2);
    try {
      await navigator.clipboard.writeText(plain);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.copyFailed"));
      return;
    }

    const isSpendingsMetric = metricKey.endsWith("-spendings");
    const checkDelay = isSpendingsMetric ? 620 : 280;
    const clearDelay = isSpendingsMetric ? 1700 : 1400;

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

  const goToExpenses = () => {
    const params = new URLSearchParams();
    if (selectedYear !== "All") params.set("year", selectedYear);
    if (selectedMonth !== "All") params.set("month", selectedMonth);
    const query = params.toString();
    navigate(query ? `/home/expenses?${query}` : "/home/expenses");
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

  const handleIncomeTouchStart = (event, incomeKey) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    activeTouchIdRef.current = touch.identifier;
    if (pressReleaseTimerRef.current) {
      window.clearTimeout(pressReleaseTimerRef.current);
      pressReleaseTimerRef.current = 0;
    }
    setPressedIncomeKey(incomeKey);
  };

  const openEdit = (income) => {
    setActiveIncome(income);
    setModalMode("edit");
    setModalOpen(true);
  };

  const openConfirm = (income) => {
    setActiveIncome({
      ...income,
      receivedDate: new Date().toLocaleDateString("en-CA"),
      status: INCOME_STATUS.CONFIRMED,
    });
    setModalMode("confirm");
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (!userId) {
      toast.error(t("toast.needSignIn"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "confirm" && activeIncome?.id) {
        await confirmIncome(userId, activeIncome.id, payload.receivedDate);
        syncIncomes(
          incomes.map((item) =>
            item.id === activeIncome.id
              ? {
                  ...item,
                  status: INCOME_STATUS.CONFIRMED,
                  receivedDate: payload.receivedDate,
                }
              : item
          )
        );
        toast.success(t("toast.incomeConfirmed"));
      } else if (modalMode === "edit" && activeIncome?.id) {
        const wasMonthly = Boolean(activeIncome.isMonthly);
        const nowMonthly = Boolean(payload.isMonthly);
        let nextIncomes;

        if (!wasMonthly && nowMonthly) {
          nextIncomes = await convertIncomeToMonthly(
            userId,
            activeIncome,
            payload
          );
        } else if (wasMonthly && !nowMonthly) {
          nextIncomes = await convertMonthlyIncomeToOneOff(
            userId,
            activeIncome,
            payload
          );
        } else {
          const updated = await updateIncome(userId, activeIncome.id, {
            ...payload,
            pauseDate: undefined,
          });
          nextIncomes = incomes.map((item) =>
            item.id === activeIncome.id
              ? {
                  ...item,
                  ...updated,
                  installments: item.installments,
                  installmentNumber: item.installmentNumber,
                  installmentGroupId: item.installmentGroupId,
                  totalAmount: item.totalAmount,
                  isMonthly: nowMonthly,
                  monthlyGroupId: item.monthlyGroupId,
                  startPeriod: item.startPeriod,
                  isPaused: item.isPaused,
                  pauseDate: item.pauseDate,
                }
              : item
          );

          if (nowMonthly) {
            if (payload.pauseDate) {
              await pauseMonthlyIncome(
                userId,
                activeIncome,
                payload.pauseDate
              );
              nextIncomes = await fetchIncomes(userId);
            } else if (activeIncome.pauseDate && !payload.pauseDate) {
              nextIncomes = await resumeMonthlyIncome(userId, activeIncome);
            }
          }
        }

        syncIncomes(nextIncomes);
        toast.success(t("toast.incomeUpdated"));
      } else {
        const created = await createIncome(userId, payload);
        const createdList = Array.isArray(created) ? created : [created];
        syncIncomes([...createdList, ...incomes]);
        toast.success(
          payload.isMonthly
            ? t("toast.incomeMonthlyAdded")
            : createdList.length > 1
              ? t("toast.incomeInstallmentsAdded", { count: createdList.length })
              : t("toast.incomeAdded")
        );
      }
      setModalOpen(false);
      setActiveIncome(null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || t("toast.incomeSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || !incomeToDelete) {
      return;
    }

    setIsSubmitting(true);
    try {
      const deleted = await deleteIncome(userId, incomeToDelete.id);
      if (deleted?.isMonthly && deleted.monthlyGroupId) {
        syncIncomes(
          incomes.filter(
            (item) => item.monthlyGroupId !== deleted.monthlyGroupId
          )
        );
        toast.success(t("toast.incomeMonthlyDeleted"));
      } else {
        syncIncomes(incomes.filter((item) => item.id !== incomeToDelete.id));
        toast.success(t("toast.incomeDeleted"));
      }
      setShowDeleteModal(false);
      setIncomeToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.incomeDeleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPauseMonthly = async () => {
    if (!userId || !monthlyActionIncome) return;
    setIsSubmitting(true);
    try {
      await pauseMonthlyIncome(userId, monthlyActionIncome);
      const next = await fetchIncomes(userId);
      syncIncomes(next);
      toast.success(t("toast.incomeMonthlyPaused"));
      setShowPauseModal(false);
      setMonthlyActionIncome(null);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.incomePauseFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmResumeMonthly = async () => {
    if (!userId || !monthlyActionIncome) return;
    setIsSubmitting(true);
    try {
      const next = await resumeMonthlyIncome(userId, monthlyActionIncome);
      syncIncomes(next);
      toast.success(t("toast.incomeMonthlyResumed"));
      setShowResumeModal(false);
      setMonthlyActionIncome(null);
    } catch (error) {
      console.error(error);
      toast.error(t("toast.incomeResumeFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingComponent variant="expenses" />;
  }

  if (filteredCategoryIncomeTotal !== null) {
    categoryHintValueRef.current = filteredCategoryIncomeTotal;
  }

  const categoryHintTransition = {
    duration: 0.34,
    ease: [0.32, 0.72, 0, 1],
  };

  const renderCard = (income) => {
    const category = categoriesMap[income.categoryId];
    const isPending = income.status === INCOME_STATUS.PENDING;
    const incomeKey = income.id;
    const isSelected = selectedIncomeIds.includes(incomeKey);
    const inSelectMode = selectMode && isPending;
    const isExcluded = Boolean(income.excludedFromTotals);
    const isSplashing = splashKey === incomeKey;
    const splashClass = isSplashing
      ? splashMode === "in"
        ? excludeStyles.activating
        : excludeStyles.splashing
      : "";

    return (
      <motion.div
        key={incomeKey}
        layout
        className={styles.incomeLayoutItem}
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.28 },
          scale: { duration: 0.28 },
          y: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
        }}
      >
        <div
          className={`${styles.incomeCard} ${excludeStyles.surface} ${
            isPending ? styles.pendingCard : styles.confirmedCard
          } ${pressedIncomeKey === incomeKey ? styles.incomePressed : ""} ${
            inSelectMode && isSelected ? styles.incomeCardSelected : ""
          } ${isExcluded ? excludeStyles.excluded : ""} ${splashClass}`}
          onTouchStart={(event) => {
            if (inSelectMode) return;
            handleIncomeTouchStart(event, incomeKey);
          }}
          onClick={(event) => {
            if (inSelectMode) {
              toggleIncomeSelected(incomeKey);
              return;
            }
            if (isInteractiveTarget(event.target)) return;
            runToggle({
              key: incomeKey,
              currentlyExcluded: isExcluded,
              persist: (nextExcluded) =>
                applyIncomeExcluded(income, nextExcluded),
            });
          }}
          role="button"
          tabIndex={0}
          aria-pressed={isExcluded}
          aria-label={
            inSelectMode
              ? t(isSelected ? "income.deselectAria" : "income.selectAria", {
                  name: income.description,
                })
              : t(isExcluded ? "income.includeAria" : "income.excludeAria", {
                  name: income.description,
                })
          }
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (inSelectMode) {
              toggleIncomeSelected(incomeKey);
              return;
            }
            runToggle({
              key: incomeKey,
              currentlyExcluded: isExcluded,
              persist: (nextExcluded) =>
                applyIncomeExcluded(income, nextExcluded),
            });
          }}
        >
          <ExcludeSplashLayer
            active={isSplashing}
            className={excludeStyles.splashLayer}
            cornerClassName={excludeStyles.splashCorner}
          />
          {inSelectMode ? (
            <span
              className={`${styles.selectCheck} ${
                isSelected ? styles.selectCheckOn : ""
              }`}
              aria-hidden="true"
            >
              {isSelected ? <FaCheck /> : null}
            </span>
          ) : (
            <button
              type="button"
              className={styles.expenseEditButton}
              onClick={() => openEdit(income)}
              title={t("income.editTitle")}
              aria-label={t("income.editTitle")}
            >
              <FaPencilAlt className={styles.expensePencilIcon} />
            </button>
          )}

          <p className={styles.incomeName}>{income.description}</p>
          <p className={styles.categoryBadge}>
            {category
              ? `${category.icon} ${category.name}`
              : t("common.other")}
          </p>
          <p className={styles.incomeValue}>
            {Number(income.installments) > 1 ? (
              <>
                ${Number(income.amount).toFixed(2)}{" "}
                {income.installmentNumber}/{income.installments}
                <br />
                <span className={styles.incomeTotal}>
                  {t("income.totalLabel", {
                    amount: `$${Number(income.totalAmount || income.amount).toFixed(2)}`,
                  })}
                </span>
              </>
            ) : (
              `$${Number(income.amount).toFixed(2)}`
            )}
          </p>
          <p className={styles.expenseMethod}>
            {isPending ? t("income.pending") : t("income.confirmed")}
          </p>
          <div className={styles.incomeDetails}>
            <p className={styles.incomeDetail}>
              {t("income.periodLabel", {
                period: formatPeriodLabel(income.incomePeriod, locale),
              })}
            </p>
            <p className={styles.incomeDetail}>
              {t("income.chargeLabel", {
                date: formatDisplayDate(income.occurrenceDate, language) || "—",
              })}
            </p>
            <p className={styles.incomeDetail}>
              {t("income.expected", {
                date: formatDisplayDate(income.expectedDate, language) || "—",
              })}
            </p>
            {!isPending ? (
              <p className={styles.incomeDetail}>
                {t("income.receivedOn", {
                  date: formatDisplayDate(income.receivedDate, language) || "—",
                })}
              </p>
            ) : null}
          </div>

          {!inSelectMode && (
            <div
              className={styles.cardFooter}
              style={{
                justifyContent:
                  income.isMonthly || isPending ? "space-between" : "flex-end",
              }}
            >
              <div className={styles.cardFooterLeft}>
                {isPending ? (
                  <button
                    type="button"
                    className={styles.confirmButton}
                    onClick={() => openConfirm(income)}
                  >
                    {t("common.confirm")}
                  </button>
                ) : null}
                {income.isMonthly && (
                  <button
                    type="button"
                    className={styles.iconActionBtn}
                    onClick={() => {
                      setMonthlyActionIncome(income);
                      if (income.isPaused) {
                        setShowResumeModal(true);
                      } else {
                        setShowPauseModal(true);
                      }
                    }}
                    aria-label={
                      income.isPaused
                        ? t("income.resumeMonthlyAria")
                        : t("income.pauseMonthlyAria")
                    }
                  >
                    {income.isPaused ? (
                      <FaPlay className={styles.playPauseIcon} />
                    ) : (
                      <FaPause className={styles.playPauseIcon} />
                    )}
                  </button>
                )}
              </div>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => {
                  setIncomeToDelete(income);
                  setShowDeleteModal(true);
                }}
                aria-label={t("income.deleteAria")}
              >
                <img
                  className={styles.binImg}
                  src={bin}
                  alt={t("income.deleteIconAlt")}
                />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.page}>
        <h2>{t("income.title")}</h2>

        <div className={styles.filterContainer}>
          <div className={styles.filter}>
            <label htmlFor="incomeYearFilter">{t("income.filterYear")} </label>
            <select
              id="incomeYearFilter"
              value={selectedYear}
              className={styles.selectFilters}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedMonth("All");
                setSelectedCategory("All");
              }}
            >
              <option value="All">{t("common.all")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filter}>
            <label htmlFor="incomeMonthFilter">{t("income.filterMonth")} </label>
            <select
              id="incomeMonthFilter"
              value={selectedMonth}
              className={styles.selectFilters}
              disabled={selectedYear === "All"}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory("All");
              }}
            >
              <option value="All">{t("common.all")}</option>
              {months.map((month) => {
                const isCurrentMonth =
                  selectedYear === currentYear && month === currentMonth;
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
              filteredCategoryIncomeTotal !== null
                ? styles.categoryFilterWithHint
                : ""
            }`}
          >
            <label htmlFor="incomeCategoryFilter">{t("income.filterCategory")} </label>
            <div className={styles.categorySelectWrap}>
              <select
                id="incomeCategoryFilter"
                value={selectedCategory}
                className={`${styles.selectFilters} ${styles.categorySelect}`}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">{t("common.all")}</option>
                {incomeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              <AnimatePresence>
                {filteredCategoryIncomeTotal !== null ? (
                  <motion.div
                    key="income-category-filter-hint"
                    className={styles.categoryFilterHintWrap}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={categoryHintTransition}
                  >
                    <span
                      className={styles.categoryFilterHint}
                      title={t("income.categoryHintTitle")}
                    >
                      ${categoryHintValueRef.current.toFixed(2)}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className={styles.filter}>
            <label htmlFor="incomeStatusFilter">{t("income.filterStatus")} </label>
            <select
              id="incomeStatusFilter"
              value={selectedStatus}
              className={styles.selectFilters}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">{t("common.all")}</option>
              <option value={INCOME_STATUS.CONFIRMED}>
                {t("income.confirmed")}
              </option>
              <option value={INCOME_STATUS.PENDING}>
                {t("income.pending")}
              </option>
            </select>
          </div>
        </div>

        <div className={styles.summary}>
          <h3>
            {periodKey
              ? formatPeriodLabel(periodKey, locale)
              : selectedYear !== "All"
              ? selectedYear
              : t("income.allPeriods")}
          </h3>
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-earned`,
            label: t("metrics.earned"),
            numericValue: summary.earned,
            displayValue: `$${formatValue(summary.earned)}`,
            className: styles.summaryEarned,
            shineClass: styles.shineNeutral,
          })}
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-pending`,
            label: t("metrics.pendingIncome"),
            numericValue: summary.pending,
            displayValue: `$${formatValue(summary.pending)}`,
            className:
              summary.pending > 0
                ? styles.summaryPending
                : styles.summaryPendingZero,
            shineClass: styles.shinePending,
          })}
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-received`,
            label: t("metrics.received"),
            numericValue: summary.received,
            displayValue: `$${formatValue(summary.received)}`,
            className: styles.summaryReceived,
            shineClass: styles.shineReceived,
          })}
          {(() => {
            const spendingsMetricKey = `${periodKey || "all"}-spendings`;
            const isSpendingsCopying = copiedMetric?.key === spendingsMetricKey;
            if (isSpendingsCopying && copiedMetric.phase) {
              spendingsCopyPhaseRef.current = copiedMetric.phase;
            }
            return (
              <div className={styles.spendingsRow}>
                {renderCopyableMetric({
                  metricKey: spendingsMetricKey,
                  label: t("metrics.yourSpendings"),
                  numericValue: spendingsTotal,
                  displayValue: `-$${formatValue(spendingsTotal)}`,
                  className: styles.totalSpendings,
                  shineClass: styles.shineNeutral,
                  hideFeedback: true,
                })}
                <span
                  className={`${styles.spendingsCopySlot} ${
                    isSpendingsCopying ? styles.spendingsCopySlotOpen : ""
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`${styles.spendingsCopyIcon} ${
                      spendingsCopyPhaseRef.current === "check"
                        ? styles.spendingsCopyIconDone
                        : ""
                    }`}
                  >
                    {spendingsCopyPhaseRef.current === "check" ? (
                      <FaCheck />
                    ) : (
                      <FaCopy />
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.spendingsExpensesButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    goToExpenses();
                  }}
                  aria-label={t("metrics.openExpensesAria")}
                  title={t("metrics.openExpenses")}
                >
                  <FaPencilAlt
                    className={styles.pencilIcon}
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })()}
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-net`,
            label: t("metrics.netEarnings"),
            numericValue: netEarnings,
            displayValue: `$${formatValue(netEarnings)}`,
            className: `${styles.netEarnings} ${
              netEarnings < 0 ? styles.netEarningsNegative : ""
            }`,
            shineClass:
              netEarnings < 0 ? styles.shineNegative : styles.shinePositive,
          })}
        </div>
        <div ref={summaryAnchorRef} aria-hidden="true" />

        <div className={styles.searchWrap}>
          <div className={styles.searchContainer}>
            <input
              ref={pageInputRef}
              type="text"
              inputMode="search"
              id="incomePageSearch"
              placeholder={t("income.searchPlaceholder")}
              defaultValue={searchQuery}
              onChange={handleSearchChange}
              className={styles.searchInput}
              aria-label={t("income.searchAria")}
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="button"
              className={styles.searchClearButton}
              hidden={!searchQuery}
              tabIndex={searchQuery ? 0 : -1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSearchQuery}
              aria-label={t("income.clearSearch")}
            >
              ×
            </button>
          </div>
          {normalizedSearchQuery && filtered.length === 0 ? (
            <p className={styles.noSearchResults}>
              {selectedCategory !== "All"
                ? t("income.emptySearchCategory", {
                    query: searchQuery.trim(),
                    category:
                      categoriesMap[selectedCategory]?.name ||
                      t("income.thisCategory"),
                  })
                : t("income.emptySearch", { query: searchQuery.trim() })}
            </p>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {normalizedSearchQuery ? null : (
              <>
                <p>{t("income.emptyPeriod")}</p>
                <p>{t("income.tapToAdd")}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {(selectedStatus === "All" ||
              selectedStatus === INCOME_STATUS.PENDING) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleRow}>
                    <h3>{t("income.pending")}</h3>
                    {pendingList.some((item) => item.excludedFromTotals) &&
                      !selectMode && (
                        <button
                          type="button"
                          className={styles.activateAllBtn}
                          onClick={() =>
                            requestActivateAllIncomes(
                              pendingList,
                              t("income.pending")
                            )
                          }
                        >
                          {t("income.activateAll")}
                        </button>
                      )}
                  </div>
                  {periodPendingList.length > 0 && !selectMode && (
                    <button
                      type="button"
                      className={styles.exportPdfBtn}
                      onClick={openExportSheet}
                    >
                      {isPro
                        ? t("income.exportPdf")
                        : t("income.exportPdfPro")}
                    </button>
                  )}
                  {selectMode && (
                    <button
                      type="button"
                      className={styles.exportPdfBtn}
                      onClick={exitSelectMode}
                    >
                      {t("common.cancel")}
                    </button>
                  )}
                </div>
                {selectMode && (
                  <p className={styles.selectHint}>
                    {t("income.selectHint")}
                  </p>
                )}
                {pendingList.length === 0 ? (
                  <p className={styles.emptySection}>
                    {t("income.emptyPending")}
                  </p>
                ) : (
                  <div className={styles.cards}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {pendingList.map(renderCard)}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            )}

            {(selectedStatus === "All" ||
              selectedStatus === INCOME_STATUS.CONFIRMED) &&
              !selectMode && (
              <section className={styles.section}>
                <div className={styles.confirmedTitleRow}>
                  <h3 className={styles.confirmedTitle}>
                    {t("income.confirmed")}
                  </h3>
                  {confirmedList.some((item) => item.excludedFromTotals) && (
                    <button
                      type="button"
                      className={styles.activateAllBtn}
                      onClick={() =>
                        requestActivateAllIncomes(
                          confirmedList,
                          t("income.confirmed")
                        )
                      }
                    >
                      {t("income.activateAll")}
                    </button>
                  )}
                </div>
                {confirmedList.length === 0 ? (
                  <p className={styles.emptySection}>
                    {t("income.emptyConfirmed")}
                  </p>
                ) : (
                  <div className={styles.cards}>
                    <AnimatePresence initial={false} mode="popLayout">
                      {confirmedList.map(renderCard)}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {!selectMode && (
        <button
          type="button"
          className={styles.floatingAddButton}
          onClick={openCreate}
          aria-label={t("income.add")}
          title={t("income.add")}
        >
          <span className={styles.fabIcon} aria-hidden="true">
            +
          </span>
          <span className={styles.fabLabel}>{t("income.add")}</span>
        </button>
      )}

      {selectMode && (
        <div className={styles.selectBar}>
          <button
            type="button"
            className={styles.selectBarCancel}
            onClick={exitSelectMode}
            disabled={isExportingPdf}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className={styles.selectBarExport}
            disabled={selectedPendingList.length === 0 || isExportingPdf}
            onClick={() =>
              runPendingPdfExport({
                list: selectedPendingList,
              })
            }
          >
            {isExportingPdf
              ? t("income.generating")
              : selectedPendingList.length
                ? t("income.exportCount", { count: selectedPendingList.length })
                : t("income.export")}
          </button>
        </div>
      )}

      <BottomSheet
        isOpen={exportSheetOpen}
        onClose={() => {
          if (isExportingPdf) return;
          setExportSheetOpen(false);
          setExportSheetView("menu");
        }}
        labelledBy="income-export-title"
      >
        <header className={sheetStyles.header}>
          <h2 id="income-export-title">
            {isExportingPdf
              ? t("income.exportSheet.generatingTitle")
              : exportSheetView === "category"
                ? t("income.exportSheet.categoryTitle")
                : t("income.exportSheet.title")}
          </h2>
          <div className={sheetStyles.headerActions}>
            <button
              type="button"
              className={sheetStyles.iconBtn}
              onClick={() => {
                if (isExportingPdf) return;
                setExportSheetOpen(false);
                setExportSheetView("menu");
              }}
              aria-label={t("common.close")}
              disabled={isExportingPdf}
            >
              ×
            </button>
          </div>
        </header>

        {exportSheetView === "menu" ? (
          <div className={styles.exportMenu}>
            <p className={styles.exportMenuLead}>
              {t("income.exportSheet.period")}{" "}
              <strong>{exportPeriodLabel}</strong>
            </p>
            <button
              type="button"
              className={styles.exportMenuBtn}
              disabled={isExportingPdf || periodPendingExportList.length === 0}
              onClick={() =>
                runPendingPdfExport({
                  list: periodPendingExportList,
                })
              }
            >
              <strong>{t("income.exportSheet.allPending")}</strong>
              <span>
                {periodPendingExportList.length}{" "}
                {t(
                  periodPendingExportList.length === 1
                    ? "common.item"
                    : "common.items"
                )}
              </span>
            </button>
            <button
              type="button"
              className={styles.exportMenuBtn}
              onClick={() => setExportSheetView("category")}
              disabled={pendingByCategory.length === 0 || isExportingPdf}
            >
              <strong>{t("income.exportSheet.byCategory")}</strong>
              <span>{t("income.exportSheet.byCategoryHint")}</span>
            </button>
            <button
              type="button"
              className={styles.exportMenuBtn}
              onClick={startSelectMode}
              disabled={isExportingPdf}
            >
              <strong>{t("income.exportSheet.selectIncomes")}</strong>
              <span>{t("income.exportSheet.selectIncomesHint")}</span>
            </button>
          </div>
        ) : (
          <div className={styles.exportMenu}>
            <button
              type="button"
              className={styles.exportBackBtn}
              onClick={() => setExportSheetView("menu")}
              disabled={isExportingPdf}
            >
              ← {t("common.back")}
            </button>
            {pendingByCategory.map((group) => (
              <button
                key={group.categoryId}
                type="button"
                className={styles.exportMenuBtn}
                disabled={isExportingPdf}
                onClick={() =>
                  runPendingPdfExport({
                    list: group.items,
                  })
                }
              >
                <strong>
                  {group.icon} {group.name}
                </strong>
                <span>
                  {group.count} · ${group.total.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      <IncomeModal
        isOpen={modalOpen}
        mode={modalMode}
        onRequestClose={() => {
          if (!isSubmitting) {
            setModalOpen(false);
            setActiveIncome(null);
          }
        }}
        onSubmit={handleSave}
        initialValues={
          modalMode === "create"
            ? {
                categoryId:
                  incomeCategories[0]?.id || DEFAULT_INCOME_CATEGORY_ID,
                incomePeriod:
                  periodKey ||
                  new Date().toLocaleDateString("en-CA").slice(0, 7),
                occurrenceDate: new Date().toLocaleDateString("en-CA"),
                expectedDate: new Date().toLocaleDateString("en-CA"),
                status: INCOME_STATUS.PENDING,
              }
            : activeIncome
        }
        categories={incomeCategories}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowDeleteModal(false);
            setIncomeToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        title={t("income.deleteTitle")}
        message={
          incomeToDelete?.isMonthly
            ? t("income.deleteMonthlyMessage")
            : t("income.deleteMessage")
        }
        expenseName={incomeToDelete?.description}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={showPauseModal}
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowPauseModal(false);
            setMonthlyActionIncome(null);
          }
        }}
        onConfirm={handleConfirmPauseMonthly}
        title={t("income.pauseTitle")}
        message={t("income.pauseMessage")}
        expenseName={monthlyActionIncome?.description}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={showResumeModal}
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowResumeModal(false);
            setMonthlyActionIncome(null);
          }
        }}
        onConfirm={handleConfirmResumeMonthly}
        title={t("income.resumeTitle")}
        message={t("income.resumeMessage")}
        expenseName={monthlyActionIncome?.description}
        isSubmitting={isSubmitting}
      />

      <ConfirmationModal
        isOpen={Boolean(activateAllTarget)}
        onRequestClose={() => setActivateAllTarget(null)}
        onConfirm={handleConfirmActivateAllIncomes}
        title={t("income.activateAllTitle")}
        message={t("income.activateAllMessage")}
        identifier={activateAllTarget?.label}
        expenseName={activateAllTarget?.label}
      />

      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title={t(getProFeature("export").titleKey)}
        message={t(getProFeature("export").descriptionKey)}
        canStartTrial={canStartTrial}
      />

      <FloatingMetricsDock
        anchorRef={summaryAnchorRef}
        observeKey={`${periodKey || selectedYear || "all"}:${filtered.length}`}
        ariaLabel={t("metrics.dockAria")}
        handoffSearchFocusTo="#incomePageSearch"
        dockSearchFocusTo="#incomeDockSearch"
        search={
          <div className={dockStyles.searchContainer}>
            <input
              ref={dockInputRef}
              type="text"
              inputMode="search"
              id="incomeDockSearch"
              placeholder={t("income.searchPlaceholderShort")}
              defaultValue={searchQuery}
              onChange={handleSearchChange}
              className={dockStyles.searchInput}
              aria-label={t("income.searchAria")}
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="button"
              className={dockStyles.searchClearButton}
              hidden={!searchQuery}
              tabIndex={searchQuery ? 0 : -1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSearchQuery}
              aria-label={t("income.clearSearch")}
            >
              ×
            </button>
          </div>
        }
        metrics={
          <>
            <div className={`${dockStyles.metric} ${dockStyles.metricEarned}`}>
              <span className={dockStyles.metricLabel}>{t("metrics.earned")}</span>
              <span className={dockStyles.metricValue}>
                ${Number(summary.earned).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div
              className={`${dockStyles.metric} ${
                summary.pending > 0
                  ? dockStyles.metricPending
                  : dockStyles.metricPendingZero
              }`}
            >
              <span className={dockStyles.metricLabel}>
                {t("metrics.pendingIncome")}
              </span>
              <span className={dockStyles.metricValue}>
                ${Number(summary.pending).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={`${dockStyles.metric} ${dockStyles.metricReceived}`}>
              <span className={dockStyles.metricLabel}>
                {t("metrics.received")}
              </span>
              <span className={dockStyles.metricValue}>
                ${Number(summary.received).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={`${dockStyles.metric} ${dockStyles.metricSpend}`}>
              <span className={dockStyles.metricLabel}>
                {t("metrics.yourSpendings")}
              </span>
              <span className={dockStyles.metricValue}>
                -$
                {Number(spendingsTotal).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div
              className={`${dockStyles.metric} ${dockStyles.metricNet} ${
                netEarnings < 0 ? dockStyles.metricNegative : ""
              }`}
            >
              <span className={dockStyles.metricLabel}>
                {t("metrics.netEarnings")}
              </span>
              <span className={dockStyles.metricValue}>
                $
                {Number(netEarnings).toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <button
              key={
                monthStepPulse.side === "prev"
                  ? `prev-${monthStepPulse.tick}`
                  : "prev"
              }
              type="button"
              className={`${dockStyles.stepperBtn} ${dockStyles.monthNavPrev} ${
                monthStepPulse.side === "prev" ? dockStyles.stepperBtnPulse : ""
              }`}
              aria-label={t("metrics.prevMonth")}
              onClick={(event) => {
                event.currentTarget.blur();
                stepDockMonth(-1, "prev");
              }}
            >
              ‹
            </button>
            <button
              key={
                monthStepPulse.side === "next"
                  ? `next-${monthStepPulse.tick}`
                  : "next"
              }
              type="button"
              className={`${dockStyles.stepperBtn} ${dockStyles.monthNavNext} ${
                monthStepPulse.side === "next" ? dockStyles.stepperBtnPulse : ""
              }`}
              aria-label={t("metrics.nextMonth")}
              onClick={(event) => {
                event.currentTarget.blur();
                stepDockMonth(1, "next");
              }}
            >
              ›
            </button>
          </>
        }
        filters={
          <>
            <select
              id="incomeDockYearFilter"
              aria-label={t("income.filterYear")}
              value={selectedYear}
              className={dockStyles.pill}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedMonth("All");
                setSelectedCategory("All");
              }}
            >
              <option value="All">{t("common.all")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              id="incomeDockMonthFilter"
              aria-label={t("income.filterMonth")}
              value={selectedMonth}
              className={dockStyles.pill}
              disabled={selectedYear === "All"}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory("All");
              }}
            >
              <option value="All">{t("common.all")}</option>
              {months.map((month) => {
                const isCurrentMonth =
                  selectedYear === currentYear && month === currentMonth;
                return (
                  <option
                    key={month}
                    value={month}
                    data-current={isCurrentMonth}
                  >
                    {month} - {formatMonthName(month, locale)}
                    {isCurrentMonth ? " 📅" : ""}
                  </option>
                );
              })}
            </select>
            <select
              id="incomeDockCategoryFilter"
              aria-label={t("income.filterCategory")}
              value={selectedCategory}
              className={dockStyles.pill}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">{t("common.all")}</option>
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            <select
              id="incomeDockStatusFilter"
              aria-label={t("income.filterStatus")}
              value={selectedStatus}
              className={dockStyles.pill}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">{t("common.all")}</option>
              <option value={INCOME_STATUS.CONFIRMED}>
                {t("income.confirmed")}
              </option>
              <option value={INCOME_STATUS.PENDING}>
                {t("income.pending")}
              </option>
            </select>
          </>
        }
      />
    </div>
  );
}

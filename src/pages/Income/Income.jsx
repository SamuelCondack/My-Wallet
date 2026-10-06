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
  periodToDateInput,
} from "../../utils/incomeCalculations";
import {
  buildExpensesByMonth,
  getMonthTotal,
} from "../../utils/expenseCalculations";
import { countsInTotals } from "../../utils/totalsVisibility";
import { DEFAULT_INCOME_CATEGORY_ID } from "../../constants/defaultCategories";
import { getProFeature } from "../../constants/subscription";
import { useExcludeFromTotalsToggle } from "../../hooks/useExcludeFromTotalsToggle";
import ExcludeSplashLayer from "../../components/ExcludeSplashLayer/ExcludeSplashLayer";
import excludeStyles from "../../styles/excludeFromTotals.module.scss";
import styles from "./Income.module.scss";

export default function Income() {
  const navigate = useNavigate();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");
  const { splashKey, runToggle, isInteractiveTarget } =
    useExcludeFromTotalsToggle();
  const categoryHintValueRef = useRef(0);

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
  } = useSessionPeriodFilter({
    year: searchParams.get("year") || undefined,
    month: searchParams.get("month") || undefined,
  });
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
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [pressedIncomeKey, setPressedIncomeKey] = useState(null);
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
          toast.error("Failed to load income.");
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
  }, [userId]);

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
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const filtered = useMemo(
    () =>
      filterIncomes(incomes, {
        year: selectedYear,
        month: selectedMonth,
        categoryId: selectedCategory,
        status: selectedStatus,
      }),
    [incomes, selectedYear, selectedMonth, selectedCategory, selectedStatus]
  );

  const periodKey =
    selectedYear !== "All" && selectedMonth !== "All"
      ? `${selectedYear}-${selectedMonth}`
      : null;

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
          name: category?.name || "Other",
          icon: category?.icon || "💰",
          count: items.length,
          total,
          items,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [periodPendingExportList, categoriesMap]);

  const exportPeriodLabel = useMemo(() => {
    if (periodKey) return formatPeriodLabel(periodKey);
    if (selectedYear !== "All") return String(selectedYear);
    return "All periods";
  }, [periodKey, selectedYear]);

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
      toast.info("No pending income to export.");
      return;
    }
    setIsExportingPdf(true);
    const toastId = toast.loading("Generating PDF…");
    try {
      const { downloadPendingIncomesPdf } = await import(
        "../../utils/exportPendingIncomesPdf"
      );
      await downloadPendingIncomesPdf({
        incomes: list,
        periodLabel: exportPeriodLabel,
        fileStem: exportFileStem,
      });
      toast.update(toastId, {
        render: "PDF ready",
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
        render: "Could not export PDF.",
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
      toast.info("No pending income to export.");
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
      toast.error("Couldn't update income.");
    }
  };

  const activateAllIncomes = async (items) => {
    if (!userId) return;
    const ids = items
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
      toast.error("Couldn't activate incomes.");
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

  const openCreate = () => {
    setActiveIncome(null);
    setModalMode("create");
    setModalOpen(true);
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
      toast.error("You need to be signed in.");
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
        toast.success("Income confirmed!");
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
        toast.success("Income updated!");
      } else {
        const created = await createIncome(userId, payload);
        const createdList = Array.isArray(created) ? created : [created];
        syncIncomes([...createdList, ...incomes]);
        toast.success(
          payload.isMonthly
            ? "Monthly income added!"
            : createdList.length > 1
              ? `Added ${createdList.length} installments!`
              : "Income added!"
        );
      }
      setModalOpen(false);
      setActiveIncome(null);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to save income.");
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
        toast.success("Monthly income deleted.");
      } else {
        syncIncomes(incomes.filter((item) => item.id !== incomeToDelete.id));
        toast.success("Income deleted.");
      }
      setShowDeleteModal(false);
      setIncomeToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete income.");
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
      toast.success("Monthly income paused.");
      setShowPauseModal(false);
      setMonthlyActionIncome(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to pause income.");
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
      toast.success("Monthly income resumed.");
      setShowResumeModal(false);
      setMonthlyActionIncome(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to resume income.");
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
          } ${isExcluded ? excludeStyles.excluded : ""} ${
            isSplashing ? excludeStyles.splashing : ""
          }`}
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
              ? `${isSelected ? "Deselect" : "Select"} ${income.description}`
              : `${isExcluded ? "Include" : "Exclude"} ${income.description} from totals`
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
              title="Edit income"
              aria-label="Edit income"
            >
              <FaPencilAlt className={styles.expensePencilIcon} />
            </button>
          )}

          <p className={styles.incomeName}>{income.description}</p>
          <p className={styles.categoryBadge}>
            {category ? `${category.icon} ${category.name}` : "Other"}
          </p>
          <p className={styles.incomeValue}>
            {Number(income.installments) > 1 ? (
              <>
                ${Number(income.amount).toFixed(2)}{" "}
                {income.installmentNumber}/{income.installments}
                <br />
                <span className={styles.incomeTotal}>
                  Total: ${Number(income.totalAmount || income.amount).toFixed(2)}
                </span>
              </>
            ) : (
              `$${Number(income.amount).toFixed(2)}`
            )}
          </p>
          <p className={styles.expenseMethod}>
            {isPending ? "Pending" : "Confirmed"}
          </p>
          <p className={styles.incomeMeta}>
            {isPending
              ? `Expected ${formatDisplayDate(income.expectedDate)}`
              : `Received ${formatDisplayDate(income.receivedDate)}`}
          </p>
          <p className={styles.incomePeriod}>
            Income Period: {formatPeriodLabel(income.incomePeriod)}
          </p>

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
                    Confirm
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
                        ? "Resume monthly income"
                        : "Pause monthly income"
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
                aria-label="Delete income"
              >
                <img
                  className={styles.binImg}
                  src={bin}
                  alt="delete button"
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
        <h2>Income</h2>

        <div className={styles.filterContainer}>
          <div className={styles.filter}>
            <label htmlFor="incomeYearFilter">Filter by Year: </label>
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
              <option value="All">All</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filter}>
            <label htmlFor="incomeMonthFilter">Filter by Month: </label>
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
              <option value="All">All</option>
              {months.map((month) => {
                const isCurrentMonth =
                  selectedYear === currentYear && month === currentMonth;
                return (
                  <option
                    key={month}
                    value={month}
                    data-current={isCurrentMonth}
                  >
                    {month} -{" "}
                    {new Date(0, Number(month) - 1).toLocaleString("default", {
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
              filteredCategoryIncomeTotal !== null
                ? styles.categoryFilterWithHint
                : ""
            }`}
          >
            <label htmlFor="incomeCategoryFilter">Filter by Category: </label>
            <div className={styles.categorySelectWrap}>
              <select
                id="incomeCategoryFilter"
                value={selectedCategory}
                className={`${styles.selectFilters} ${styles.categorySelect}`}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All</option>
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
                      title="Temporary total for the selected category filter"
                    >
                      ${categoryHintValueRef.current.toFixed(2)}
                    </span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <div className={styles.filter}>
            <label htmlFor="incomeStatusFilter">Filter by Status: </label>
            <select
              id="incomeStatusFilter"
              value={selectedStatus}
              className={styles.selectFilters}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">All</option>
              <option value={INCOME_STATUS.CONFIRMED}>Confirmed</option>
              <option value={INCOME_STATUS.PENDING}>Pending</option>
            </select>
          </div>
        </div>

        <div className={styles.summary}>
          <h3>
            {periodKey
              ? formatPeriodLabel(periodKey)
              : selectedYear !== "All"
              ? selectedYear
              : "All periods"}
          </h3>
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-earned`,
            label: "Earned",
            numericValue: summary.earned,
            displayValue: `$${summary.earned.toFixed(2)}`,
            className: styles.summaryEarned,
            shineClass: styles.shineNeutral,
          })}
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-pending`,
            label: "Pending Income",
            numericValue: summary.pending,
            displayValue: `$${summary.pending.toFixed(2)}`,
            className:
              summary.pending > 0
                ? styles.summaryPending
                : styles.summaryPendingZero,
            shineClass: styles.shinePending,
          })}
          {renderCopyableMetric({
            metricKey: `${periodKey || "all"}-received`,
            label: "Received",
            numericValue: summary.received,
            displayValue: `$${summary.received.toFixed(2)}`,
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
                  label: "Your Spendings",
                  numericValue: spendingsTotal,
                  displayValue: `-$${spendingsTotal.toFixed(2)}`,
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
                  aria-label="Open Expenses page"
                  title="Open Expenses"
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
            label: "Net Earnings",
            numericValue: netEarnings,
            displayValue: `$${netEarnings.toFixed(2)}`,
            className: `${styles.netEarnings} ${
              netEarnings < 0 ? styles.netEarningsNegative : ""
            }`,
            shineClass:
              netEarnings < 0 ? styles.shineNegative : styles.shinePositive,
          })}
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No income for this period.</p>
            <p>Tap + to add a new income.</p>
          </div>
        ) : (
          <>
            {(selectedStatus === "All" ||
              selectedStatus === INCOME_STATUS.PENDING) && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitleRow}>
                    <h3>Pending</h3>
                    {pendingList.some((item) => item.excludedFromTotals) &&
                      !selectMode && (
                        <button
                          type="button"
                          className={styles.activateAllBtn}
                          onClick={() => activateAllIncomes(pendingList)}
                        >
                          Activate all
                        </button>
                      )}
                  </div>
                  {periodPendingList.length > 0 && !selectMode && (
                    <button
                      type="button"
                      className={styles.exportPdfBtn}
                      onClick={openExportSheet}
                    >
                      {isPro ? "Export PDF" : "Export PDF · Pro"}
                    </button>
                  )}
                  {selectMode && (
                    <button
                      type="button"
                      className={styles.exportPdfBtn}
                      onClick={exitSelectMode}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {selectMode && (
                  <p className={styles.selectHint}>
                    Tap cards to select, then export.
                  </p>
                )}
                {pendingList.length === 0 ? (
                  <p className={styles.emptySection}>
                    No pending income for this period.
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
                  <h3 className={styles.confirmedTitle}>Confirmed</h3>
                  {confirmedList.some((item) => item.excludedFromTotals) && (
                    <button
                      type="button"
                      className={styles.activateAllBtn}
                      onClick={() => activateAllIncomes(confirmedList)}
                    >
                      Activate all
                    </button>
                  )}
                </div>
                {confirmedList.length === 0 ? (
                  <p className={styles.emptySection}>
                    No confirmed income for this period.
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

      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            type="button"
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

      {!selectMode && (
        <button
          type="button"
          className={styles.floatingAddButton}
          onClick={openCreate}
          aria-label="Add income"
          title="Add income"
        >
          <span className={styles.fabIcon} aria-hidden="true">
            +
          </span>
          <span className={styles.fabLabel}>Add income</span>
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
            Cancel
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
              ? "Generating…"
              : `Export ${selectedPendingList.length || ""}`}
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
              ? "Generating PDF…"
              : exportSheetView === "category"
                ? "Export by category"
                : "Export pending PDF"}
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
              aria-label="Close"
              disabled={isExportingPdf}
            >
              ×
            </button>
          </div>
        </header>

        {exportSheetView === "menu" ? (
          <div className={styles.exportMenu}>
            <p className={styles.exportMenuLead}>
              Period: <strong>{exportPeriodLabel}</strong>
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
              <strong>All pending</strong>
              <span>
                {periodPendingExportList.length} item
                {periodPendingExportList.length === 1 ? "" : "s"}
              </span>
            </button>
            <button
              type="button"
              className={styles.exportMenuBtn}
              onClick={() => setExportSheetView("category")}
              disabled={pendingByCategory.length === 0 || isExportingPdf}
            >
              <strong>By category</strong>
              <span>One PDF per category</span>
            </button>
            <button
              type="button"
              className={styles.exportMenuBtn}
              onClick={startSelectMode}
              disabled={isExportingPdf}
            >
              <strong>Select incomes</strong>
              <span>Pick individual items</span>
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
              ← Back
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
                incomePeriodDate: periodKey
                  ? periodToDateInput(periodKey)
                  : new Date().toLocaleDateString("en-CA"),
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
        title="Delete Income"
        message={
          incomeToDelete?.isMonthly
            ? "This deletes the whole monthly series. Are you sure you want to delete"
            : "Are you sure you want to delete"
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
        title="Pause monthly income"
        message="Stop generating this income after this month for"
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
        title="Resume monthly income"
        message="Continue this monthly income for"
        expenseName={monthlyActionIncome?.description}
        isSubmitting={isSubmitting}
      />

      <PaywallModal
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title={getProFeature("export")?.title || "CSV & PDF export"}
        message={
          getProFeature("export")?.description ||
          "Export pending income as a PDF to share what you're owed."
        }
        canStartTrial={canStartTrial}
      />
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { FaCheck, FaCopy, FaPencilAlt } from "react-icons/fa";
import bin from "../../assets/bin.png";
import { auth } from "../../../config/firebase";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import IncomeModal from "../../modals/IncomeModal/IncomeModal";
import { useCategories } from "../../hooks/useCategories";
import { useSessionPeriodFilter } from "../../hooks/useSessionPeriodFilter";
import {
  getCategoryMap,
  getIncomeCategories,
} from "../../services/categoriesService";
import {
  confirmIncome,
  createIncome,
  deleteIncome,
  loadIncomesWithMigration,
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
import { DEFAULT_INCOME_CATEGORY_ID } from "../../constants/defaultCategories";
import styles from "./Income.module.scss";

export default function Income() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear().toString();
  const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, "0");

  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState(null);
  const [incomes, setIncomes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [pressedIncomeKey, setPressedIncomeKey] = useState(null);
  const activeTouchIdRef = useRef(null);
  const pressReleaseTimerRef = useRef(0);
  const [copiedMetric, setCopiedMetric] = useState(null);
  const copyTimeoutsRef = useRef([]);

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
        setIsLoading(false);
        return;
      }

      const cachedIncome = getCached("income", userId);
      if (cachedIncome) {
        setIncomes(cachedIncome);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await loadIncomesWithMigration(userId);
        if (!cancelled) {
          setIncomes(data);
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
    const earned = summarySource.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const received = summarySource
      .filter((item) => item.status === INCOME_STATUS.CONFIRMED)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const pending = summarySource
      .filter((item) => item.status === INCOME_STATUS.PENDING)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { earned, received, pending };
  }, [incomes, periodKey, summarySource]);

  const pendingList = filtered.filter(
    (item) => item.status === INCOME_STATUS.PENDING
  );
  const confirmedList = filtered.filter(
    (item) => item.status === INCOME_STATUS.CONFIRMED
  );

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

    clearCopyTimeouts();
    setCopiedMetric({ key: metricKey, phase: "copy" });

    copyTimeoutsRef.current.push(
      setTimeout(() => {
        setCopiedMetric({ key: metricKey, phase: "check" });
      }, 280)
    );
    copyTimeoutsRef.current.push(
      setTimeout(() => {
        setCopiedMetric(null);
      }, 1400)
    );
  };

  const renderCopyableMetric = ({
    metricKey,
    label,
    numericValue,
    displayValue,
    className,
    shineClass,
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
        {phase && (
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
        const updated = await updateIncome(userId, activeIncome.id, payload);
        syncIncomes(
          incomes.map((item) => (item.id === activeIncome.id ? updated : item))
        );
        toast.success("Income updated!");
      } else {
        const created = await createIncome(userId, payload);
        syncIncomes([created, ...incomes]);
        toast.success("Income added!");
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
      await deleteIncome(userId, incomeToDelete.id);
      syncIncomes(incomes.filter((item) => item.id !== incomeToDelete.id));
      toast.success("Income deleted.");
      setShowDeleteModal(false);
      setIncomeToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete income.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingComponent variant="expenses" />;
  }

  const renderCard = (income) => {
    const category = categoriesMap[income.categoryId];
    const isPending = income.status === INCOME_STATUS.PENDING;
    const incomeKey = income.id;

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
          className={`${styles.incomeCard} ${
            isPending ? styles.pendingCard : styles.confirmedCard
          } ${pressedIncomeKey === incomeKey ? styles.incomePressed : ""}`}
          onTouchStart={(event) => handleIncomeTouchStart(event, incomeKey)}
        >
          <button
            type="button"
            className={styles.expenseEditButton}
            onClick={() => openEdit(income)}
            title="Edit income"
            aria-label="Edit income"
          >
            <FaPencilAlt className={styles.expensePencilIcon} />
          </button>

          <p className={styles.incomeName}>{income.description}</p>
          <p className={styles.categoryBadge}>
            {category ? `${category.icon} ${category.name}` : "Other"}
          </p>
          <p className={styles.incomeValue}>
            ${Number(income.amount).toFixed(2)}
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

          <div className={styles.cardFooter}>
            {isPending ? (
              <button
                type="button"
                className={styles.confirmButton}
                onClick={() => openConfirm(income)}
              >
                Confirm
              </button>
            ) : (
              <span />
            )}
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

          <div className={styles.filter}>
            <label htmlFor="incomeCategoryFilter">Filter by Category: </label>
            <select
              id="incomeCategoryFilter"
              value={selectedCategory}
              className={styles.selectFilters}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">All</option>
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
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
            label: "Pending",
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
                <h3>Pending</h3>
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
              selectedStatus === INCOME_STATUS.CONFIRMED) && (
              <section className={styles.section}>
                <h3>Confirmed</h3>
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
        message="Are you sure you want to delete"
        expenseName={incomeToDelete?.description}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

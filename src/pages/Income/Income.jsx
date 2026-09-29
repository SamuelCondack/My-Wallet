import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "react-toastify";
import { FaPencilAlt } from "react-icons/fa";
import bin from "../../assets/bin.png";
import { auth } from "../../../config/firebase";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import IncomeModal from "../../modals/IncomeModal/IncomeModal";
import { useCategories } from "../../hooks/useCategories";
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
import { setCached } from "../../utils/dataCache";
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
  const [selectedYear, setSelectedYear] = useState(
    searchParams.get("year") || currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState(
    searchParams.get("month") || currentMonth
  );
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get("category") || "All"
  );
  const [selectedStatus, setSelectedStatus] = useState(
    searchParams.get("status") || "All"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [activeIncome, setActiveIncome] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);

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

  // Summary uses financial period only (incomePeriod), ignoring category/status filters
  // except when a single period is selected — matches Expenses month summary behavior.
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
    const earned = summarySource.reduce((sum, item) => sum + Number(item.amount), 0);
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

  const openCreate = () => {
    setActiveIncome(null);
    setModalMode("create");
    setModalOpen(true);
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
        // Confirm must not change incomePeriod.
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

    return (
      <motion.div
        key={income.id}
        className={`${styles.incomeCard} ${
          isPending ? styles.pendingCard : styles.confirmedCard
        }`}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <p className={styles.incomeName}>{income.description}</p>
        <p className={styles.incomeValue}>${Number(income.amount).toFixed(2)}</p>
        <p className={styles.incomeCategory}>
          {category ? `${category.icon} ${category.name}` : "Other"}
        </p>
        <p className={styles.incomeMeta}>
          {isPending
            ? `Expected ${formatDisplayDate(income.expectedDate)}`
            : `Received ${formatDisplayDate(income.receivedDate)}`}
        </p>
        <p className={styles.incomePeriod}>
          Income Period: {formatPeriodLabel(income.incomePeriod)}
        </p>
        <span className={styles.statusBadge}>
          {isPending ? "Pending" : "Confirmed"}
        </span>

        <div className={styles.cardActions}>
          {isPending && (
            <button
              type="button"
              className={styles.confirmButton}
              onClick={() => openConfirm(income)}
            >
              Confirm received
            </button>
          )}
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => openEdit(income)}
            aria-label="Edit income"
          >
            <FaPencilAlt />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              setIncomeToDelete(income);
              setShowDeleteModal(true);
            }}
            aria-label="Delete income"
          >
            <img src={bin} alt="" width={16} height={16} />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <h2>Income</h2>
          <button type="button" className={styles.addButton} onClick={openCreate}>
            + Add Income
          </button>
        </div>

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
              {months.map((month) => (
                <option key={month} value={month}>
                  {month} -{" "}
                  {new Date(0, Number(month) - 1).toLocaleString("default", {
                    month: "long",
                  })}
                </option>
              ))}
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
          <p className={styles.summaryEarned}>
            Earned: <b>${summary.earned.toFixed(2)}</b>
          </p>
          <p
            className={
              summary.pending > 0 ? styles.summaryPending : styles.summaryPendingZero
            }
          >
            Pending: <b>${summary.pending.toFixed(2)}</b>
          </p>
          <p className={styles.summaryReceived}>
            Received: <b>${summary.received.toFixed(2)}</b>
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No income for this period.</p>
            <button type="button" className={styles.addButton} onClick={openCreate}>
              + Add Income
            </button>
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
                    <AnimatePresence>{pendingList.map(renderCard)}</AnimatePresence>
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
                    <AnimatePresence>
                      {confirmedList.map(renderCard)}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

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
          activeIncome ||
          (modalMode === "create"
            ? {
                categoryId:
                  incomeCategories[0]?.id || DEFAULT_INCOME_CATEGORY_ID,
                incomePeriodDate: periodKey
                  ? periodToDateInput(periodKey)
                  : new Date().toLocaleDateString("en-CA"),
                expectedDate: new Date().toLocaleDateString("en-CA"),
                status: INCOME_STATUS.PENDING,
              }
            : null)
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

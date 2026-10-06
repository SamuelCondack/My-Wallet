import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import bin from "../../assets/bin.png";
import styles from "./Categories.module.scss";
import sheetStyles from "../../components/BottomSheet/BottomSheet.module.scss";
import BottomSheet from "../../components/BottomSheet/BottomSheet";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import ConfirmationModal from "../../modals/ConfirmationModal/ConfirmationModal";
import ExpenseIncomeToggle from "../../components/ExpenseIncomeToggle/ExpenseIncomeToggle";
import { auth } from "../../../config/firebase";
import { useCategories } from "../../hooks/useCategories";
import {
  deleteCategory,
  getExpenseCategories,
  getIncomeCategories,
  saveCategory,
} from "../../services/categoriesService";
import { CATEGORY_TYPE } from "../../constants/defaultCategories";
import { useT } from "../../i18n/useT";
import {
  extractEmoji,
  filterEmojiCatalog,
} from "../../constants/emojiCatalog";

const EMPTY_FORM = { name: "", color: "#3e92eb", icon: "📦" };

const DESKTOP_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#87CEEB",
  "#3e92eb",
  "#20c997",
  "#fd7e14",
  "#6f42c1",
  "#FF0000",
  "#B0B0B0",
  "#111827",
  "#f59e0b",
  "#10b981",
];

function useDesktopPickers() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export default function Categories() {
  const t = useT();
  const isDesktop = useDesktopPickers();
  const [userId, setUserId] = useState(null);
  const { categories, loading, setCategories } = useCategories(userId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [activeType, setActiveType] = useState(CATEGORY_TYPE.EXPENSE);
  const [searchQuery, setSearchQuery] = useState("");
  const [pressedKey, setPressedKey] = useState(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const activeTouchIdRef = useRef(null);
  const pressReleaseTimerRef = useRef(0);
  const customColorRef = useRef(null);
  const emojiSearchRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return unsubscribe;
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
          setPressedKey(null);
          pressReleaseTimerRef.current = 0;
        }, 220);
      }
    };

    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
      if (pressReleaseTimerRef.current) {
        window.clearTimeout(pressReleaseTimerRef.current);
      }
    };
  }, []);

  const visibleCategories = useMemo(() => {
    const list =
      activeType === CATEGORY_TYPE.INCOME
        ? getIncomeCategories(categories)
        : getExpenseCategories(categories);
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter(
      (category) =>
        category.name?.toLowerCase().includes(query) ||
        category.icon?.includes(query) ||
        category.id?.toLowerCase().includes(query)
    );
  }, [categories, activeType, searchQuery]);

  const filteredEmojis = useMemo(
    () => filterEmojiCatalog(emojiSearch),
    [emojiSearch]
  );

  const applyEmoji = (emoji) => {
    if (!emoji) {
      return;
    }
    setForm((current) => ({ ...current, icon: emoji }));
    setShowEmojiPanel(false);
    setEmojiSearch("");
  };

  const handleEmojiSearchChange = (value) => {
    const pasted = extractEmoji(value);
    // Pure emoji paste/type → apply immediately
    if (pasted && value.trim() === pasted) {
      applyEmoji(pasted);
      return;
    }
    setEmojiSearch(value);
  };

  const handleEmojiSearchKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const fromInput = extractEmoji(emojiSearch);
    if (fromInput) {
      applyEmoji(fromInput);
      return;
    }
    if (filteredEmojis[0]) {
      applyEmoji(filteredEmojis[0].emoji);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowEmojiPanel(false);
    setEmojiSearch("");
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
    setActiveType(category.type || CATEGORY_TYPE.EXPENSE);
    setShowEmojiPanel(false);
    setEmojiSearch("");
    setModalOpen(true);
  };

  const closeModal = ({ force = false } = {}) => {
    if (isSubmitting && !force) {
      return;
    }
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!userId) {
      toast.error(t("categories.toast.needSignIn"));
      return;
    }

    if (!form.name.trim()) {
      toast.error(t("categories.toast.enterName"));
      return;
    }

    const id =
      editingId ??
      `${activeType === CATEGORY_TYPE.INCOME ? "income-" : ""}${form.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now().toString(36)}`;

    const category = {
      id,
      name: form.name.trim(),
      color: form.color,
      icon: form.icon || "📦",
      type: activeType,
      order: editingId
        ? categories.find((item) => item.id === editingId)?.order ??
          categories.length
        : categories.length,
    };

    setIsSubmitting(true);

    try {
      await saveCategory(userId, category);
      setCategories((current) => {
        const exists = current.some((item) => item.id === id);
        return exists
          ? current.map((item) => (item.id === id ? category : item))
          : [...current, category];
      });
      setModalOpen(false);
      resetForm();
      toast.success(
        editingId
          ? t("categories.toast.updated", { name: category.name })
          : t("categories.toast.added", { name: category.name })
      );
    } catch (error) {
      console.error(error);
      toast.error(t("categories.toast.saveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || !categoryToDelete) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCategory(userId, categoryToDelete.id);
      setCategories((current) =>
        current.filter((item) => item.id !== categoryToDelete.id)
      );
      if (editingId === categoryToDelete.id) {
        setModalOpen(false);
        resetForm();
      }
      toast.success(
        t("categories.toast.deleted", { name: categoryToDelete.name })
      );
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error(t("categories.toast.deleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTouchStart = (event, key) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    activeTouchIdRef.current = touch.identifier;
    if (pressReleaseTimerRef.current) {
      window.clearTimeout(pressReleaseTimerRef.current);
      pressReleaseTimerRef.current = 0;
    }
    setPressedKey(key);
  };

  if (loading) {
    return <LoadingComponent variant="categories" />;
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.page}>
        <h2>{t("categories.title")}</h2>
        <p className={styles.subtitle}>{t("categories.subtitle")}</p>

        <div className={styles.typeToggleWrap}>
          <ExpenseIncomeToggle
            value={activeType}
            onChange={(next) => {
              setActiveType(next);
              setSearchQuery("");
              resetForm();
              setModalOpen(false);
            }}
            ariaLabel={t("categories.typeAria")}
          />
        </div>

        <div className={styles.searchContainer}>
          <input
            type="search"
            placeholder={t("categories.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label={t("categories.searchAria")}
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClearButton}
              onClick={() => setSearchQuery("")}
              aria-label={t("categories.clearSearch")}
            >
              ×
            </button>
          )}
        </div>

        {visibleCategories.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {searchQuery.trim()
                ? t("categories.emptySearch", { query: searchQuery.trim() })
                : activeType === CATEGORY_TYPE.INCOME
                  ? t("categories.emptyIncome")
                  : t("categories.emptyExpense")}
            </p>
            <p>{t("categories.tapToAdd")}</p>
          </div>
        ) : (
          <div className={styles.cards}>
            <AnimatePresence initial={false} mode="popLayout">
              {visibleCategories.map((category) => (
                <motion.div
                  key={category.id}
                  layout
                  className={styles.categoryLayoutItem}
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
                    className={`${styles.categoryCard} ${
                      pressedKey === category.id ? styles.categoryPressed : ""
                    }`}
                    style={{ borderColor: category.color || undefined }}
                    onTouchStart={(event) =>
                      handleTouchStart(event, category.id)
                    }
                  >
                    <button
                      type="button"
                      className={styles.expenseEditButton}
                      onClick={() => openEdit(category)}
                      title={t("categories.editTitle")}
                      aria-label={t("categories.editAria", { name: category.name })}
                    >
                      <FaPencilAlt className={styles.expensePencilIcon} />
                    </button>

                    <span
                      className={styles.categoryIcon}
                      style={{ backgroundColor: category.color }}
                    >
                      {category.icon}
                    </span>
                    <p className={styles.categoryName}>{category.name}</p>

                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={() => {
                        setCategoryToDelete(category);
                        setShowDeleteModal(true);
                      }}
                      aria-label={t("categories.deleteAria", { name: category.name })}
                    >
                      <img
                        className={styles.binImg}
                        src={bin}
                        alt={t("categories.deleteIconAlt")}
                      />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.floatingAddButton}
        onClick={openCreate}
        aria-label={t("categories.add")}
        title={t("categories.add")}
      >
        <span className={styles.fabIcon} aria-hidden="true">
          +
        </span>
        <span className={styles.fabLabel}>{t("categories.add")}</span>
      </button>

      <BottomSheet
        isOpen={modalOpen}
        onClose={closeModal}
        labelledBy="category-form-title"
      >
        <header className={sheetStyles.header}>
          <h2 id="category-form-title">
            {editingId ? t("categories.edit") : t("categories.add")}
          </h2>
          <div className={sheetStyles.headerActions}>
            <button
              type="button"
              className={sheetStyles.iconBtn}
              onClick={closeModal}
              aria-label={t("common.close")}
              disabled={isSubmitting}
            >
              <FaTimes />
            </button>
          </div>
        </header>

        <form className={sheetStyles.form} onSubmit={handleSubmit}>
          <div className={sheetStyles.scrollBody}>
            <label className={sheetStyles.fieldLabel} htmlFor="categoryName">
              {t("categories.name")}
            </label>
            <input
              id="categoryName"
              className={sheetStyles.textInput}
              placeholder={t("categories.namePlaceholder")}
              value={form.name}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  name: e.target.value,
                }))
              }
              disabled={isSubmitting}
              required
              autoFocus
              autoComplete="off"
            />

            <label className={sheetStyles.fieldLabel} htmlFor="categoryIcon">
              {t("categories.icon")}
            </label>
            {isDesktop ? (
              <div className={styles.desktopPickers}>
                <button
                  type="button"
                  className={styles.emojiTrigger}
                  onClick={() => {
                    setShowEmojiPanel((open) => {
                      const next = !open;
                      if (next) {
                        requestAnimationFrame(() => {
                          emojiSearchRef.current?.focus();
                        });
                      } else {
                        setEmojiSearch("");
                      }
                      return next;
                    });
                  }}
                  disabled={isSubmitting}
                  aria-expanded={showEmojiPanel}
                  aria-label={t("categories.chooseEmoji")}
                >
                  <span className={styles.emojiTriggerPreview}>
                    {form.icon || "📦"}
                  </span>
                  <span>{t("categories.chooseEmoji")}</span>
                </button>

                <AnimatePresence>
                  {showEmojiPanel && (
                    <motion.div
                      className={styles.emojiPanel}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <input
                        ref={emojiSearchRef}
                        type="text"
                        className={styles.emojiSearch}
                        placeholder={t("categories.emojiSearchPlaceholder")}
                        value={emojiSearch}
                        onChange={(e) =>
                          handleEmojiSearchChange(e.target.value)
                        }
                        onKeyDown={handleEmojiSearchKeyDown}
                        disabled={isSubmitting}
                        aria-label={t("categories.emojiSearchAria")}
                      />
                      <div className={styles.emojiGrid}>
                        {filteredEmojis.length === 0 ? (
                          <p className={styles.emojiEmpty}>
                            {t("categories.emojiEmpty")}
                          </p>
                        ) : (
                          filteredEmojis.map(({ emoji }) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`${styles.emojiOption} ${
                                form.icon === emoji
                                  ? styles.emojiOptionActive
                                  : ""
                              }`}
                              onClick={() => applyEmoji(emoji)}
                              aria-label={t("categories.selectEmoji", { emoji })}
                            >
                              {emoji}
                            </button>
                          ))
                        )}
                      </div>
                      <p className={styles.emojiHint}>
                        {t("categories.emojiTip")}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className={sheetStyles.fieldLabel}>{t("categories.color")}</p>
                <div className={styles.colorGrid}>
                  {DESKTOP_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`${styles.colorSwatch} ${
                        form.color.toLowerCase() === color.toLowerCase()
                          ? styles.colorSwatchActive
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        setForm((current) => ({ ...current, color }))
                      }
                      disabled={isSubmitting}
                      aria-label={t("categories.selectColor", { color })}
                    />
                  ))}
                  <button
                    type="button"
                    className={styles.customColorBtn}
                    onClick={() => customColorRef.current?.click()}
                    disabled={isSubmitting}
                    title={t("categories.customColor")}
                    aria-label={t("categories.customColor")}
                  >
                    <span
                      className={styles.customColorPreview}
                      style={{ backgroundColor: form.color }}
                    />
                    +
                  </button>
                  <input
                    ref={customColorRef}
                    type="color"
                    className={styles.hiddenColorInput}
                    value={form.color}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        color: e.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ) : (
              <div className={styles.modalRow}>
                <input
                  id="categoryIcon"
                  className={sheetStyles.textInput}
                  placeholder={t("categories.icon")}
                  value={form.icon}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      icon: e.target.value,
                    }))
                  }
                  maxLength={4}
                  disabled={isSubmitting}
                  style={{ marginBottom: 0 }}
                />
                <label
                  className={styles.mobileColorPicker}
                  title={t("categories.categoryColor")}
                >
                  <span
                    className={styles.mobileColorPreview}
                    style={{ backgroundColor: form.color || "#3e92eb" }}
                    aria-hidden="true"
                  />
                  <input
                    type="color"
                    className={styles.mobileColorInput}
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(form.color)
                        ? form.color
                        : "#3e92eb"
                    }
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        color: e.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    aria-label={t("categories.categoryColor")}
                  />
                </label>
              </div>
            )}
          </div>

          <div className={sheetStyles.footer}>
            <div className={sheetStyles.actions}>
              <button
                type="submit"
                className={sheetStyles.primaryBtn}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t("common.saving")
                  : editingId
                    ? t("common.edit")
                    : t("common.add")}
              </button>
              <button
                type="button"
                className={sheetStyles.secondaryBtn}
                onClick={closeModal}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </form>
      </BottomSheet>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowDeleteModal(false);
            setCategoryToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        title={t("categories.deleteTitle")}
        message={t("categories.deleteMessage")}
        expenseName={categoryToDelete?.name}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

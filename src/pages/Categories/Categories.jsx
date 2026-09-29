import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { FaPencilAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import bin from "../../assets/bin.png";
import styles from "./Categories.module.scss";
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
        setPressedKey(null);
      }
    };

    document.addEventListener("touchend", handleTouchEnd);
    return () => document.removeEventListener("touchend", handleTouchEnd);
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
      toast.error("You need to be signed in to manage categories.");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Enter a category name.");
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
          ? `Category "${category.name}" updated!`
          : `Category "${category.name}" added!`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to save category. Please try again.");
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
      toast.success(`Category "${categoryToDelete.name}" deleted.`);
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete category.");
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
    setPressedKey(key);
  };

  if (loading) {
    return <LoadingComponent variant="categories" />;
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.page}>
        <h2>Categories</h2>
        <p className={styles.subtitle}>
          Manage expense and income categories separately
        </p>

        <div className={styles.typeToggleWrap}>
          <ExpenseIncomeToggle
            value={activeType}
            onChange={(next) => {
              setActiveType(next);
              setSearchQuery("");
              resetForm();
              setModalOpen(false);
            }}
            ariaLabel="Category type"
          />
        </div>

        <div className={styles.searchContainer}>
          <input
            type="search"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search categories"
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

        {visibleCategories.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {searchQuery.trim()
                ? `No categories found for "${searchQuery.trim()}".`
                : `No ${activeType} categories yet.`}
            </p>
            <p>Tap + to add one.</p>
          </div>
        ) : (
          <div className={styles.cards}>
            <AnimatePresence initial={false} mode="popLayout">
              {visibleCategories.map((category) => (
                <motion.div
                  key={category.id}
                  layout
                  className={styles.categoryLayoutItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <motion.div
                    className={styles.categoryCard}
                    style={{ borderColor: category.color || undefined }}
                    animate={{
                      scale: pressedKey === category.id ? 1.05 : 1,
                    }}
                    whileHover={{ scale: 1.05 }}
                    transition={{
                      scale: { duration: 0.4, ease: "easeOut" },
                    }}
                    onTouchStart={(event) =>
                      handleTouchStart(event, category.id)
                    }
                  >
                    <button
                      type="button"
                      className={styles.expenseEditButton}
                      onClick={() => openEdit(category)}
                      title="Edit category"
                      aria-label={`Edit ${category.name}`}
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
                      aria-label={`Delete ${category.name}`}
                    >
                      <img
                        className={styles.binImg}
                        src={bin}
                        alt="delete button"
                      />
                    </button>
                  </motion.div>
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
        aria-label="Add category"
        title="Add category"
      >
        +
      </button>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>
                {editingId ? "Edit category" : "Add category"}
              </h3>
              <form className={styles.modalForm} onSubmit={handleSubmit}>
                <label className={styles.modalLabel} htmlFor="categoryName">
                  Name
                </label>
                <input
                  id="categoryName"
                  className={styles.modalInput}
                  placeholder="Category name"
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
                />

                <label className={styles.modalLabel} htmlFor="categoryIcon">
                  Icon
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
                      aria-label="Choose emoji"
                    >
                      <span className={styles.emojiTriggerPreview}>
                        {form.icon || "📦"}
                      </span>
                      <span>Choose emoji</span>
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
                            placeholder="Search or paste any emoji…"
                            value={emojiSearch}
                            onChange={(e) =>
                              handleEmojiSearchChange(e.target.value)
                            }
                            onKeyDown={handleEmojiSearchKeyDown}
                            disabled={isSubmitting}
                            aria-label="Search emoji"
                          />
                          <div className={styles.emojiGrid}>
                            {filteredEmojis.length === 0 ? (
                              <p className={styles.emojiEmpty}>
                                No matches — paste an emoji above
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
                                  aria-label={`Select ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))
                            )}
                          </div>
                          <p className={styles.emojiHint}>
                            Tip: Win + . (Windows) or Ctrl + Cmd + Space (Mac)
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <label className={styles.modalLabel}>Color</label>
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
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                      <button
                        type="button"
                        className={styles.customColorBtn}
                        onClick={() => customColorRef.current?.click()}
                        disabled={isSubmitting}
                        title="Custom color"
                        aria-label="Custom color"
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
                      className={styles.modalInput}
                      placeholder="Icon"
                      value={form.icon}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          icon: e.target.value,
                        }))
                      }
                      maxLength={4}
                      disabled={isSubmitting}
                    />
                    <input
                      type="color"
                      className={styles.modalColor}
                      value={form.color}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          color: e.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                      aria-label="Category color"
                    />
                  </div>
                )}

                <div className={styles.modalActions}>
                  <button
                    type="submit"
                    className={styles.modalPrimary}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? "Saving..."
                      : editingId
                      ? "Edit"
                      : "Add"}
                  </button>
                  <button
                    type="button"
                    className={styles.modalSecondary}
                    onClick={closeModal}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onRequestClose={() => {
          if (!isSubmitting) {
            setShowDeleteModal(false);
            setCategoryToDelete(null);
          }
        }}
        onConfirm={handleDelete}
        title="Delete Category"
        message="Are you sure you want to delete"
        expenseName={categoryToDelete?.name}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

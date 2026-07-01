import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./Categories.module.scss";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { auth } from "../../../config/firebase";
import { useCategories } from "../../hooks/useCategories";
import {
  deleteCategory,
  isDefaultCategory,
  saveCategory,
} from "../../services/categoriesService";
import { toast } from "react-toastify";

const EMPTY_FORM = { name: "", color: "#3e92eb", icon: "📦" };

export default function Categories() {
  const [userId, setUserId] = useState(null);
  const { categories, loading, setCategories } = useCategories(userId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });

    return unsubscribe;
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
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

    const id = editingId ?? form.name.trim().toLowerCase().replace(/\s+/g, "-");
    const category = {
      id,
      name: form.name.trim(),
      color: form.color,
      icon: form.icon,
      order: editingId
        ? categories.find((item) => item.id === editingId)?.order ?? categories.length
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
      resetForm();
      toast.success(
        editingId ? `Category "${category.name}" updated!` : `Category "${category.name}" added!`
      );
    } catch (error) {
      console.error(error);
      toast.error("Failed to save category. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
  };

  const handleDelete = async (category) => {
    if (!userId || deletingId) {
      return;
    }

    if (isDefaultCategory(category.id)) {
      toast.error("Default categories cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(`Delete category "${category.name}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(category.id);

    try {
      await deleteCategory(userId, category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      if (editingId === category.id) {
        resetForm();
      }
      toast.success(`Category "${category.name}" deleted.`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete category.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <LoadingComponent variant="categories" />;
  }

  return (
    <div className={styles.page}>
      <h1>Categories</h1>
      <p className={styles.subtitle}>Choose which categories appear when registering expenses</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          placeholder="Category name"
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          disabled={isSubmitting || (editingId && isDefaultCategory(editingId))}
          required
        />
        <input
          placeholder="Icon"
          value={form.icon}
          onChange={(e) => setForm((current) => ({ ...current, icon: e.target.value }))}
          maxLength={2}
          disabled={isSubmitting}
        />
        <div className={styles.colorPicker}>
          <span
            className={styles.colorPreview}
            style={{ backgroundColor: form.color }}
            aria-hidden="true"
          />
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))}
            disabled={isSubmitting}
            aria-label="Category color"
          />
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : editingId ? "Save changes" : "Add category"}
        </button>
        {editingId && (
          <button type="button" className={styles.cancelBtn} onClick={resetForm} disabled={isSubmitting}>
            Cancel
          </button>
        )}
      </form>

      <div className={styles.grid}>
        {categories.map((category) => (
          <article key={category.id} className={styles.card}>
            <span className={styles.icon} style={{ backgroundColor: category.color }}>
              {category.icon}
            </span>
            <div className={styles.cardBody}>
              <h3>{category.name}</h3>
              <div className={styles.cardActions}>
                <button type="button" onClick={() => handleEdit(category)} disabled={isSubmitting}>
                  Edit
                </button>
                {!isDefaultCategory(category.id) && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(category)}
                    disabled={isSubmitting || deletingId === category.id}
                  >
                    {deletingId === category.id ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

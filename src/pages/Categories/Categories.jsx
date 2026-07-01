import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./Categories.module.scss";
import LoadingComponent from "../../components/LoadingComponent/LoadingComponent";
import { auth } from "../../../config/firebase";
import { useCategories } from "../../hooks/useCategories";
import { saveCategory } from "../../services/categoriesService";
import { toast } from "react-toastify";

export default function Categories() {
  const [userId, setUserId] = useState(null);
  const { categories, loading, setCategories } = useCategories(userId);
  const [form, setForm] = useState({ name: "", color: "#3e92eb", icon: "📦" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });

    return unsubscribe;
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!userId) {
      toast.error("You need to be signed in to add categories.");
      return;
    }

    if (!form.name.trim()) {
      toast.error("Enter a category name.");
      return;
    }

    const id = form.name.trim().toLowerCase().replace(/\s+/g, "-");
    const category = {
      id,
      name: form.name.trim(),
      color: form.color,
      icon: form.icon,
      order: categories.length,
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
      setForm({ name: "", color: "#3e92eb", icon: "📦" });
      toast.success(`Category "${category.name}" added!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save category. Please try again.");
    } finally {
      setIsSubmitting(false);
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
          disabled={isSubmitting}
          required
        />
        <input
          placeholder="Icon"
          value={form.icon}
          onChange={(e) => setForm((current) => ({ ...current, icon: e.target.value }))}
          maxLength={2}
          disabled={isSubmitting}
        />
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add category"}
        </button>
      </form>

      <div className={styles.grid}>
        {categories.map((category) => (
          <article key={category.id} className={styles.card}>
            <span className={styles.icon} style={{ backgroundColor: category.color }}>
              {category.icon}
            </span>
            <h3>{category.name}</h3>
          </article>
        ))}
      </div>
    </div>
  );
}

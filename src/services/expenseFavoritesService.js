import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";

function favoritesCollection(userId) {
  return collection(db, `users/${userId}/expenseFavorites`);
}

export async function fetchExpenseFavorites(userId) {
  if (!userId) return [];

  try {
    const snapshot = await getDocs(
      query(favoritesCollection(userId), orderBy("createdAt", "desc"))
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (err) {
    // Fallback if createdAt index/order is missing on older docs
    console.warn("Favorites ordered query failed, falling back:", err);
    const snapshot = await getDocs(favoritesCollection(userId));
    return snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() || 0;
        const bMs = b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });
  }
}

export async function createExpenseFavorite(userId, favorite) {
  const payload = {
    name: String(favorite.name || "").trim(),
    value:
      favorite.value === "" || favorite.value == null
        ? null
        : Number(favorite.value),
    categoryId: favorite.categoryId,
    paymentMethod: favorite.paymentMethod || "Credit Card",
    createdAt: serverTimestamp(),
  };

  if (!payload.name) {
    throw new Error("Favorite needs a name.");
  }

  const ref = await addDoc(favoritesCollection(userId), payload);
  return { id: ref.id, ...payload, createdAt: new Date() };
}

export async function deleteExpenseFavorite(userId, favoriteId) {
  await deleteDoc(doc(db, `users/${userId}/expenseFavorites`, favoriteId));
}

/**
 * Build unique recent expense templates from the live list (most recent first).
 */
export function buildRecentTemplates(expenses, limit = 6) {
  const seen = new Set();
  const recent = [];

  const sorted = [...expenses].sort((a, b) => {
    const aDate = a.inclusionDate || "";
    const bDate = b.inclusionDate || "";
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return String(b.id || "").localeCompare(String(a.id || ""));
  });

  for (const expense of sorted) {
    if (!expense?.name) continue;
    const key = [
      expense.name.trim().toLowerCase(),
      Number(expense.totalValue ?? expense.value) || 0,
      expense.categoryId || "",
      expense.method || "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push({
      id: expense.id,
      name: expense.name,
      value: Number(expense.totalValue ?? expense.value) || 0,
      categoryId: expense.categoryId,
      paymentMethod: expense.method || "Credit Card",
    });
    if (recent.length >= limit) break;
  }

  return recent;
}

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

function budgetsCollection(userId) {
  return collection(db, `users/${userId}/categoryBudgets`);
}

/**
 * @returns {Promise<Array<{ id: string, categoryId: string, amount: number }>>}
 */
export async function fetchCategoryBudgets(userId) {
  if (!userId) return [];

  const snapshot = await getDocs(budgetsCollection(userId));
  return snapshot.docs.map((item) => {
    const data = item.data() || {};
    return {
      id: item.id,
      categoryId: item.id,
      amount: Number(data.amount) || 0,
      updatedAt: data.updatedAt || null,
    };
  });
}

export async function upsertCategoryBudget(userId, categoryId, amount) {
  const value = Number(amount);
  if (!userId || !categoryId) {
    throw new Error("Missing budget target.");
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a valid monthly limit.");
  }

  const payload = {
    amount: value,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, `users/${userId}/categoryBudgets`, categoryId), payload, {
    merge: true,
  });

  return {
    id: categoryId,
    categoryId,
    amount: value,
    updatedAt: new Date(),
  };
}

export async function deleteCategoryBudget(userId, categoryId) {
  if (!userId || !categoryId) return;
  await deleteDoc(doc(db, `users/${userId}/categoryBudgets`, categoryId));
}

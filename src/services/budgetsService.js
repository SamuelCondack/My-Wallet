import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { getBudgetDocId } from "../utils/finance";

export function budgetsCollection(userId) {
  return collection(db, `users/${userId}/budgets`);
}

export async function fetchBudgets(userId, monthKey) {
  const snapshot = await getDocs(budgetsCollection(userId));
  const budgets = {};

  snapshot.forEach((item) => {
    const data = item.data();
    if (!monthKey || data.monthKey === monthKey) {
      budgets[data.categoryId] = data.limit;
    }
  });

  return budgets;
}

export async function saveBudget(userId, monthKey, categoryId, limit) {
  const ref = doc(db, `users/${userId}/budgets`, getBudgetDocId(monthKey, categoryId));
  await setDoc(ref, {
    categoryId,
    monthKey,
    limit: Number(limit) || 0,
    updatedAt: new Date().toISOString(),
  });
}

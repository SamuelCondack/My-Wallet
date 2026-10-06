import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../config/firebase";
import { invalidateCached } from "../utils/dataCache";

function expenseDoc(userId, expenseId) {
  return doc(db, userId, expenseId);
}

export async function setExpenseExcludedFromTotals(userId, expenseId, excluded) {
  const excludedFromTotals = Boolean(excluded);
  await updateDoc(expenseDoc(userId, expenseId), { excludedFromTotals });
  invalidateCached("expenses", userId);
  return { excludedFromTotals };
}

export async function setExpensesExcludedFromTotals(userId, expenseIds, excluded) {
  const excludedFromTotals = Boolean(excluded);
  const ids = [...new Set((expenseIds || []).filter(Boolean))];
  if (!ids.length) return { excludedFromTotals, count: 0 };

  const batch = writeBatch(db);
  ids.forEach((expenseId) => {
    batch.update(expenseDoc(userId, expenseId), { excludedFromTotals });
  });
  await batch.commit();
  invalidateCached("expenses", userId);
  return { excludedFromTotals, count: ids.length };
}

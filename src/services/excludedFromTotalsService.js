import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../config/firebase";
import { invalidateCached } from "../utils/dataCache";
import {
  expenseUsesMonthScopedExclusion,
  nextExcludedMonths,
  normalizeExcludedMonths,
} from "../utils/totalsVisibility";

function expenseDoc(userId, expenseId) {
  return doc(db, userId, expenseId);
}

/**
 * Toggle exclusion. For monthly / installment expenses, pass monthKey so only
 * that month is excluded (same Firestore doc is projected across months).
 */
export async function setExpenseExcludedFromTotals(
  userId,
  expenseId,
  excluded,
  { monthKey, expense } = {}
) {
  if (
    monthKey &&
    expense &&
    expenseUsesMonthScopedExclusion(expense)
  ) {
    const excludedMonths = nextExcludedMonths(expense, monthKey, excluded);
    await updateDoc(expenseDoc(userId, expenseId), {
      excludedMonths,
      excludedFromTotals: false,
    });
    invalidateCached("expenses", userId);
    return { excludedMonths, excludedFromTotals: false };
  }

  const excludedFromTotals = Boolean(excluded);
  await updateDoc(expenseDoc(userId, expenseId), { excludedFromTotals });
  invalidateCached("expenses", userId);
  return { excludedFromTotals };
}

export async function setExpensesExcludedFromTotals(
  userId,
  expenseIds,
  excluded
) {
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

/**
 * Re-include several expenses for one month (Activate all).
 * ops: [{ id, expense }] where expense is the raw list item.
 */
export async function clearExpenseExclusionsForMonth(
  userId,
  monthKey,
  expenses
) {
  const list = (expenses || []).filter(Boolean);
  if (!userId || !monthKey || !list.length) {
    return { count: 0 };
  }

  const batch = writeBatch(db);
  let count = 0;

  list.forEach((expense) => {
    if (!expense?.id) return;
    if (expenseUsesMonthScopedExclusion(expense)) {
      const excludedMonths = nextExcludedMonths(expense, monthKey, false);
      batch.update(expenseDoc(userId, expense.id), {
        excludedMonths,
        excludedFromTotals: false,
      });
      count += 1;
      return;
    }
    if (expense.excludedFromTotals) {
      batch.update(expenseDoc(userId, expense.id), {
        excludedFromTotals: false,
      });
      count += 1;
    }
  });

  if (count === 0) return { count: 0 };
  await batch.commit();
  invalidateCached("expenses", userId);
  return { count };
}

export { normalizeExcludedMonths };

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { INCOME_STATUS } from "../utils/incomeCalculations";
import { getCached, invalidateCached, setCached } from "../utils/dataCache";

const MIGRATION_PREFIX = "migrated-earnings-";

function incomeCollection(userId) {
  return collection(db, `users/${userId}/income`);
}

function incomeDoc(userId, incomeId) {
  return doc(db, `users/${userId}/income`, incomeId);
}

function earningsCollection(userId) {
  return collection(db, `users/${userId}/earnings`);
}

function normalizeIncome(id, data) {
  return {
    id,
    description: data.description || "",
    amount: Number(data.amount) || 0,
    categoryId: data.categoryId || "income-other",
    incomePeriod: data.incomePeriod || "",
    expectedDate: data.expectedDate || null,
    receivedDate: data.receivedDate ?? null,
    status: data.status === INCOME_STATUS.CONFIRMED
      ? INCOME_STATUS.CONFIRMED
      : INCOME_STATUS.PENDING,
    notes: data.notes || "",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    migratedFromEarnings: Boolean(data.migratedFromEarnings),
  };
}

export function validateIncomePayload(payload, { isConfirm = false } = {}) {
  const errors = [];
  const description = (payload.description || "").trim();
  const amount = Number(payload.amount);
  const status = payload.status;

  if (!description) {
    errors.push("Description is required.");
  }
  if (!(amount > 0)) {
    errors.push("Amount must be greater than 0.");
  }
  if (!payload.categoryId) {
    errors.push("Category is required.");
  }
  if (!payload.incomePeriod || !/^\d{4}-\d{2}$/.test(payload.incomePeriod)) {
    errors.push("Income period is required.");
  }
  if (!payload.expectedDate) {
    errors.push("Expected date is required.");
  }
  if (status !== INCOME_STATUS.PENDING && status !== INCOME_STATUS.CONFIRMED) {
    errors.push("Status must be pending or confirmed.");
  }
  if ((status === INCOME_STATUS.CONFIRMED || isConfirm) && !payload.receivedDate) {
    errors.push("Received date is required for confirmed income.");
  }

  return errors;
}

export async function fetchIncomes(userId) {
  const snapshot = await getDocs(incomeCollection(userId));
  return snapshot.docs
    .map((item) => normalizeIncome(item.id, item.data()))
    .sort((a, b) => {
      const periodCompare = (b.incomePeriod || "").localeCompare(a.incomePeriod || "");
      if (periodCompare !== 0) {
        return periodCompare;
      }
      return (b.expectedDate || "").localeCompare(a.expectedDate || "");
    });
}

export async function createIncome(userId, payload, { id } = {}) {
  const errors = validateIncomePayload(payload);
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const now = new Date().toISOString();
  const status = payload.status;
  const data = {
    description: payload.description.trim(),
    amount: Number(payload.amount),
    categoryId: payload.categoryId,
    incomePeriod: payload.incomePeriod,
    expectedDate: payload.expectedDate,
    receivedDate:
      status === INCOME_STATUS.CONFIRMED ? payload.receivedDate : null,
    status,
    notes: (payload.notes || "").trim(),
    createdAt: now,
    updatedAt: now,
    migratedFromEarnings: Boolean(payload.migratedFromEarnings),
  };

  const ref = id ? incomeDoc(userId, id) : doc(incomeCollection(userId));
  await setDoc(ref, data);
  invalidateCached("income", userId);
  return normalizeIncome(ref.id, data);
}

export async function updateIncome(userId, incomeId, payload) {
  const errors = validateIncomePayload(payload);
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const status = payload.status;
  const data = {
    description: payload.description.trim(),
    amount: Number(payload.amount),
    categoryId: payload.categoryId,
    incomePeriod: payload.incomePeriod,
    expectedDate: payload.expectedDate,
    receivedDate:
      status === INCOME_STATUS.CONFIRMED ? payload.receivedDate : null,
    status,
    notes: (payload.notes || "").trim(),
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(incomeDoc(userId, incomeId), data);
  invalidateCached("income", userId);
  return normalizeIncome(incomeId, { ...payload, ...data });
}

/**
 * Confirm pending income. Never changes incomePeriod.
 */
export async function confirmIncome(userId, incomeId, receivedDate) {
  if (!receivedDate) {
    throw new Error("Received date is required.");
  }

  const data = {
    status: INCOME_STATUS.CONFIRMED,
    receivedDate,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(incomeDoc(userId, incomeId), data);
  invalidateCached("income", userId);
  return data;
}

export async function deleteIncome(userId, incomeId) {
  await deleteDoc(incomeDoc(userId, incomeId));
  invalidateCached("income", userId);
}

/**
 * Migrate legacy monthly earnings docs into Income transactions.
 * Idempotent: uses fixed ids `migrated-earnings-{YYYY-MM}`.
 * Does not delete or alter historical earnings amounts.
 */
export async function migrateEarningsToIncome(userId, existingIncomes = null) {
  const incomes = existingIncomes ?? (await fetchIncomes(userId));
  const existingIds = new Set(incomes.map((item) => item.id));

  const earningsSnapshot = await getDocs(earningsCollection(userId));
  const created = [];

  for (const earningsDoc of earningsSnapshot.docs) {
    const monthKey = earningsDoc.id;
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      continue;
    }

    const migrationId = `${MIGRATION_PREFIX}${monthKey}`;
    if (existingIds.has(migrationId)) {
      continue;
    }

    const value = Number(earningsDoc.data()?.value);
    if (!(value > 0)) {
      continue;
    }

    // Mid-month receivedDate keeps amount in the same calendar month without TZ issues.
    const receivedDate = `${monthKey}-15`;

    const record = await createIncome(
      userId,
      {
        description: "Existing income",
        amount: value,
        categoryId: "income-other",
        incomePeriod: monthKey,
        expectedDate: receivedDate,
        receivedDate,
        status: INCOME_STATUS.CONFIRMED,
        notes: "Migrated from previous monthly earnings",
        migratedFromEarnings: true,
      },
      { id: migrationId }
    );

    created.push(record);
  }

  return created;
}

export async function loadIncomesWithMigration(userId) {
  const cached = getCached("income", userId);
  let incomes = cached ?? (await fetchIncomes(userId));

  const migrated = await migrateEarningsToIncome(userId, incomes);
  if (migrated.length > 0) {
    incomes = await fetchIncomes(userId);
  }

  setCached("income", userId, incomes);
  return incomes;
}

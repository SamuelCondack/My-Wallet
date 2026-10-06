import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  horizonEndPeriod,
  INCOME_STATUS,
  monthDiff,
  periodsFromTo,
  shiftDateOnly,
  shiftPeriod,
} from "../utils/incomeCalculations";
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

function newGroupId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}`;
}

function normalizeIncome(id, data) {
  const installmentsRaw = Number(data.installments);
  const installments =
    Number.isFinite(installmentsRaw) && installmentsRaw > 1
      ? Math.floor(installmentsRaw)
      : 1;
  const installmentNumberRaw = Number(data.installmentNumber);
  const installmentNumber =
    Number.isFinite(installmentNumberRaw) && installmentNumberRaw > 0
      ? Math.floor(installmentNumberRaw)
      : 1;

  return {
    id,
    description: data.description || "",
    amount: Number(data.amount) || 0,
    categoryId: data.categoryId || "income-other",
    incomePeriod: data.incomePeriod || "",
    expectedDate: data.expectedDate || null,
    receivedDate: data.receivedDate ?? null,
    status:
      data.status === INCOME_STATUS.CONFIRMED
        ? INCOME_STATUS.CONFIRMED
        : INCOME_STATUS.PENDING,
    notes: data.notes || "",
    installments,
    installmentNumber,
    installmentGroupId: data.installmentGroupId || null,
    totalAmount:
      data.totalAmount == null ? null : Number(data.totalAmount) || 0,
    isMonthly: Boolean(data.isMonthly),
    monthlyGroupId: data.monthlyGroupId || null,
    startPeriod: data.startPeriod || null,
    isPaused: Boolean(data.isPaused),
    pauseDate: data.pauseDate || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    migratedFromEarnings: Boolean(data.migratedFromEarnings),
  };
}

function baseIncomeFields(payload, { now, statusOverride } = {}) {
  const status = statusOverride || payload.status;
  return {
    description: payload.description.trim(),
    amount: Number(payload.amount),
    categoryId: payload.categoryId,
    notes: (payload.notes || "").trim(),
    installments: 1,
    installmentNumber: 1,
    installmentGroupId: null,
    totalAmount: null,
    createdAt: now,
    updatedAt: now,
    migratedFromEarnings: Boolean(payload.migratedFromEarnings),
    status,
    receivedDate:
      status === INCOME_STATUS.CONFIRMED ? payload.receivedDate || null : null,
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
  if (
    (status === INCOME_STATUS.CONFIRMED || isConfirm) &&
    !payload.receivedDate
  ) {
    errors.push("Received date is required for confirmed income.");
  }

  return errors;
}

export async function fetchIncomes(userId) {
  const snapshot = await getDocs(incomeCollection(userId));
  return snapshot.docs
    .map((item) => normalizeIncome(item.id, item.data()))
    .sort((a, b) => {
      const periodCompare = (b.incomePeriod || "").localeCompare(
        a.incomePeriod || ""
      );
      if (periodCompare !== 0) {
        return periodCompare;
      }
      return (b.expectedDate || "").localeCompare(a.expectedDate || "");
    });
}

async function createMonthlyIncome(userId, payload) {
  const now = new Date().toISOString();
  const groupId = newGroupId("income-monthly");
  const startPeriod = payload.incomePeriod;
  let endPeriod = horizonEndPeriod();
  if (startPeriod > endPeriod) {
    endPeriod = startPeriod;
  }

  const created = [];
  const periods = periodsFromTo(startPeriod, endPeriod);

  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index];
    const isFirst = index === 0;
    const status = isFirst ? payload.status : INCOME_STATUS.PENDING;
    const data = {
      ...baseIncomeFields(payload, {
        now,
        statusOverride: status,
      }),
      incomePeriod: period,
      expectedDate: shiftDateOnly(payload.expectedDate, index),
      receivedDate:
        status === INCOME_STATUS.CONFIRMED ? payload.receivedDate || null : null,
      isMonthly: true,
      monthlyGroupId: groupId,
      startPeriod,
      isPaused: false,
      pauseDate: null,
    };
    const ref = doc(incomeCollection(userId));
    await setDoc(ref, data);
    created.push(normalizeIncome(ref.id, data));
  }

  invalidateCached("income", userId);
  return created;
}

export async function createIncome(userId, payload, { id } = {}) {
  const errors = validateIncomePayload(payload);
  if (errors.length) {
    throw new Error(errors[0]);
  }

  if (payload.isMonthly && !id) {
    return createMonthlyIncome(userId, payload);
  }

  const installmentsRaw = Number(payload.installments);
  const installments =
    !payload.isMonthly &&
    Number.isFinite(installmentsRaw) &&
    installmentsRaw > 1
      ? Math.floor(installmentsRaw)
      : 1;
  const totalAmount = Number(payload.amount);
  const status = payload.status;
  const now = new Date().toISOString();

  if (installments === 1 || id) {
    const data = {
      ...baseIncomeFields(payload, { now }),
      incomePeriod: payload.incomePeriod,
      expectedDate: payload.expectedDate,
      isMonthly: false,
      monthlyGroupId: null,
      startPeriod: null,
      isPaused: false,
      pauseDate: null,
    };

    const ref = id ? incomeDoc(userId, id) : doc(incomeCollection(userId));
    await setDoc(ref, data);
    invalidateCached("income", userId);
    return [normalizeIncome(ref.id, data)];
  }

  const groupId = newGroupId("income-group");
  const eachAmount = totalAmount / installments;
  const created = [];

  for (let index = 0; index < installments; index += 1) {
    const data = {
      description: payload.description.trim(),
      amount: eachAmount,
      categoryId: payload.categoryId,
      incomePeriod: shiftPeriod(payload.incomePeriod, index),
      expectedDate: shiftDateOnly(payload.expectedDate, index),
      receivedDate: null,
      status: INCOME_STATUS.PENDING,
      notes: (payload.notes || "").trim(),
      installments,
      installmentNumber: index + 1,
      installmentGroupId: groupId,
      totalAmount,
      isMonthly: false,
      monthlyGroupId: null,
      startPeriod: null,
      isPaused: false,
      pauseDate: null,
      createdAt: now,
      updatedAt: now,
      migratedFromEarnings: false,
    };
    const ref = doc(incomeCollection(userId));
    await setDoc(ref, data);
    created.push(normalizeIncome(ref.id, data));
  }

  invalidateCached("income", userId);
  return created;
}

/**
 * Create missing monthly occurrences through current+2 months (expense-like horizon).
 * Skips paused series beyond the pause month; never recreates confirmed months.
 */
export async function ensureMonthlyIncomeHorizon(userId, incomes) {
  const groups = new Map();
  incomes.forEach((item) => {
    if (!item.isMonthly || !item.monthlyGroupId) return;
    if (!groups.has(item.monthlyGroupId)) {
      groups.set(item.monthlyGroupId, []);
    }
    groups.get(item.monthlyGroupId).push(item);
  });

  if (groups.size === 0) {
    return [];
  }

  const created = [];
  const now = new Date().toISOString();
  const defaultEnd = horizonEndPeriod();

  for (const [groupId, members] of groups) {
    const sorted = [...members].sort((a, b) =>
      String(a.incomePeriod).localeCompare(String(b.incomePeriod))
    );
    const template = sorted[0];
    const startPeriod =
      template.startPeriod ||
      sorted.map((item) => item.incomePeriod).sort()[0];
    let endPeriod = defaultEnd;

    if (template.isPaused && template.pauseDate) {
      const pausePeriod = String(template.pauseDate).slice(0, 7);
      endPeriod = pausePeriod < endPeriod ? pausePeriod : endPeriod;
    }

    if (startPeriod > endPeriod) {
      continue;
    }

    const existing = new Set(members.map((item) => item.incomePeriod));
    const periods = periodsFromTo(startPeriod, endPeriod);

    for (const period of periods) {
      if (existing.has(period)) continue;
      const offset = monthDiff(template.incomePeriod, period);
      const data = {
        description: template.description,
        amount: Number(template.amount),
        categoryId: template.categoryId,
        incomePeriod: period,
        expectedDate: shiftDateOnly(template.expectedDate, offset),
        receivedDate: null,
        status: INCOME_STATUS.PENDING,
        notes: template.notes || "",
        installments: 1,
        installmentNumber: 1,
        installmentGroupId: null,
        totalAmount: null,
        isMonthly: true,
        monthlyGroupId: groupId,
        startPeriod,
        isPaused: Boolean(template.isPaused),
        pauseDate: template.pauseDate || null,
        createdAt: now,
        updatedAt: now,
        migratedFromEarnings: false,
      };
      const ref = doc(incomeCollection(userId));
      await setDoc(ref, data);
      created.push(normalizeIncome(ref.id, data));
    }
  }

  if (created.length > 0) {
    invalidateCached("income", userId);
  }
  return created;
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

  if (payload.pauseDate !== undefined) {
    const pauseDate = payload.pauseDate || null;
    data.pauseDate = pauseDate;
    data.isPaused = Boolean(pauseDate);
  }

  await updateDoc(incomeDoc(userId, incomeId), data);
  invalidateCached("income", userId);
  return normalizeIncome(incomeId, { ...payload, ...data });
}

/**
 * Turn an existing income into a monthly series (keeps this occurrence, fills horizon).
 */
export async function convertIncomeToMonthly(userId, income, payload) {
  const groupId = income.monthlyGroupId || newGroupId("income-monthly");
  const startPeriod = payload.incomePeriod || income.incomePeriod;
  const now = new Date().toISOString();

  await updateDoc(incomeDoc(userId, income.id), {
    description: payload.description.trim(),
    amount: Number(payload.amount),
    categoryId: payload.categoryId,
    incomePeriod: startPeriod,
    expectedDate: payload.expectedDate,
    receivedDate:
      payload.status === INCOME_STATUS.CONFIRMED
        ? payload.receivedDate || null
        : null,
    status: payload.status,
    notes: (payload.notes || "").trim(),
    installments: 1,
    installmentNumber: 1,
    installmentGroupId: null,
    totalAmount: null,
    isMonthly: true,
    monthlyGroupId: groupId,
    startPeriod,
    isPaused: Boolean(payload.pauseDate),
    pauseDate: payload.pauseDate || null,
    updatedAt: now,
  });

  invalidateCached("income", userId);
  let incomes = await fetchIncomes(userId);

  if (payload.pauseDate) {
    await pauseMonthlyIncome(
      userId,
      { ...income, monthlyGroupId: groupId, isMonthly: true },
      payload.pauseDate
    );
    incomes = await fetchIncomes(userId);
  } else {
    await ensureMonthlyIncomeHorizon(userId, incomes);
    incomes = await fetchIncomes(userId);
  }

  return incomes;
}

/**
 * Detach one occurrence from a monthly series and delete the other months.
 */
export async function convertMonthlyIncomeToOneOff(userId, income, payload) {
  if (!income?.monthlyGroupId) {
    return updateIncome(userId, income.id, payload);
  }

  const groupId = income.monthlyGroupId;
  const incomes = await fetchIncomes(userId);
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  incomes
    .filter((item) => item.monthlyGroupId === groupId)
    .forEach((item) => {
      if (item.id === income.id) {
        batch.update(incomeDoc(userId, item.id), {
          description: payload.description.trim(),
          amount: Number(payload.amount),
          categoryId: payload.categoryId,
          incomePeriod: payload.incomePeriod,
          expectedDate: payload.expectedDate,
          receivedDate:
            payload.status === INCOME_STATUS.CONFIRMED
              ? payload.receivedDate || null
              : null,
          status: payload.status,
          notes: (payload.notes || "").trim(),
          isMonthly: false,
          monthlyGroupId: null,
          startPeriod: null,
          isPaused: false,
          pauseDate: null,
          installments: 1,
          installmentNumber: 1,
          installmentGroupId: null,
          totalAmount: null,
          updatedAt: now,
        });
      } else {
        batch.delete(incomeDoc(userId, item.id));
      }
    });

  await batch.commit();
  invalidateCached("income", userId);
  return fetchIncomes(userId);
}

/**
 * Pause a monthly income series from the given date (defaults to today).
 * Removes pending occurrences after the pause month.
 */
export async function pauseMonthlyIncome(userId, income, pauseDate) {
  if (!income?.monthlyGroupId) {
    throw new Error("Not a monthly income.");
  }
  const date =
    pauseDate || new Date().toLocaleDateString("en-CA");
  const pausePeriod = String(date).slice(0, 7);
  const groupId = income.monthlyGroupId;
  const incomes = await fetchIncomes(userId);
  const members = incomes.filter((item) => item.monthlyGroupId === groupId);
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  members.forEach((item) => {
    const ref = incomeDoc(userId, item.id);
    if (
      item.status === INCOME_STATUS.PENDING &&
      item.incomePeriod > pausePeriod
    ) {
      batch.delete(ref);
      return;
    }
    batch.update(ref, {
      isPaused: true,
      pauseDate: date,
      updatedAt: now,
    });
  });

  await batch.commit();
  invalidateCached("income", userId);
  return date;
}

export async function resumeMonthlyIncome(userId, income) {
  if (!income?.monthlyGroupId) {
    throw new Error("Not a monthly income.");
  }
  const groupId = income.monthlyGroupId;
  const incomes = await fetchIncomes(userId);
  const members = incomes.filter((item) => item.monthlyGroupId === groupId);
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  members.forEach((item) => {
    batch.update(incomeDoc(userId, item.id), {
      isPaused: false,
      pauseDate: null,
      updatedAt: now,
    });
  });

  await batch.commit();
  invalidateCached("income", userId);

  const refreshed = await fetchIncomes(userId);
  await ensureMonthlyIncomeHorizon(userId, refreshed);
  return fetchIncomes(userId);
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
  const incomes = await fetchIncomes(userId);
  const target = incomes.find((item) => item.id === incomeId);
  if (target?.isMonthly && target.monthlyGroupId) {
    const batch = writeBatch(db);
    incomes
      .filter((item) => item.monthlyGroupId === target.monthlyGroupId)
      .forEach((item) => {
        batch.delete(incomeDoc(userId, item.id));
      });
    await batch.commit();
  } else {
    await deleteDoc(incomeDoc(userId, incomeId));
  }
  invalidateCached("income", userId);
  return target || null;
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

    const records = await createIncome(
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

    created.push(...(Array.isArray(records) ? records : [records]));
  }

  return created;
}

export async function loadIncomesWithMigration(userId) {
  const cached = getCached("income", userId);
  if (cached) {
    const extended = await ensureMonthlyIncomeHorizon(userId, cached);
    if (extended.length > 0) {
      const fresh = await fetchIncomes(userId);
      setCached("income", userId, fresh);
      return fresh;
    }
    return cached;
  }

  let incomes = await fetchIncomes(userId);
  const migrated = await migrateEarningsToIncome(userId, incomes);
  if (migrated.length > 0) {
    incomes = await fetchIncomes(userId);
  }

  const extended = await ensureMonthlyIncomeHorizon(userId, incomes);
  if (extended.length > 0) {
    incomes = await fetchIncomes(userId);
  }

  setCached("income", userId, incomes);
  return incomes;
}

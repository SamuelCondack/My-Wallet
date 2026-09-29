import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  ALL_DEFAULT_CATEGORIES,
  CATEGORY_TYPE,
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from "../constants/defaultCategories";

function withType(category) {
  if (category.type === CATEGORY_TYPE.INCOME || category.type === CATEGORY_TYPE.EXPENSE) {
    return category;
  }

  // Legacy categories without type are treated as expense categories.
  if (category.id?.startsWith("income-")) {
    return { ...category, type: CATEGORY_TYPE.INCOME };
  }

  return { ...category, type: CATEGORY_TYPE.EXPENSE };
}

async function backfillExpenseTypes(userId, categories) {
  const needsType = categories.filter(
    (item) => item.type !== CATEGORY_TYPE.INCOME && item.type !== CATEGORY_TYPE.EXPENSE
  );

  if (needsType.length === 0) {
    return categories.map(withType);
  }

  const batch = writeBatch(db);
  const updated = categories.map((item) => {
    const next = withType(item);
    if (item.type !== next.type) {
      batch.set(
        doc(db, `users/${userId}/categories`, item.id),
        { type: next.type },
        { merge: true }
      );
    }
    return next;
  });

  await batch.commit();
  return updated;
}

export async function fetchCategories(userId) {
  const snapshot = await getDocs(collection(db, `users/${userId}/categories`));

  if (snapshot.empty) {
    const batch = writeBatch(db);
    ALL_DEFAULT_CATEGORIES.forEach((category, index) => {
      const ref = doc(db, `users/${userId}/categories`, category.id);
      batch.set(ref, { ...category, order: index });
    });
    await batch.commit();
    return ALL_DEFAULT_CATEGORIES.map((category, index) => ({
      ...category,
      order: index,
    }));
  }

  let categories = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  categories = await backfillExpenseTypes(userId, categories);

  return categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function saveCategory(userId, category) {
  const payload = withType(category);
  await setDoc(doc(db, `users/${userId}/categories`, payload.id), payload, {
    merge: true,
  });
}

export async function deleteCategory(userId, categoryId) {
  await deleteDoc(doc(db, `users/${userId}/categories`, categoryId));
}

export function getCategoryMap(categories) {
  return categories.reduce((map, category) => {
    map[category.id] = category;
    return map;
  }, {});
}

export function isDefaultCategory(categoryId) {
  return ALL_DEFAULT_CATEGORIES.some((category) => category.id === categoryId);
}

export function getExpenseCategories(categories) {
  return categories.filter(
    (item) => (item.type || CATEGORY_TYPE.EXPENSE) === CATEGORY_TYPE.EXPENSE
  );
}

export function getIncomeCategories(categories) {
  return categories.filter((item) => item.type === CATEGORY_TYPE.INCOME);
}

export { CATEGORY_TYPE, DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES };

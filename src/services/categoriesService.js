import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { DEFAULT_CATEGORIES } from "../constants/defaultCategories";

export async function fetchCategories(userId) {
  const snapshot = await getDocs(collection(db, `users/${userId}/categories`));

  if (snapshot.empty) {
    const batch = writeBatch(db);
    DEFAULT_CATEGORIES.forEach((category, index) => {
      const ref = doc(db, `users/${userId}/categories`, category.id);
      batch.set(ref, { ...category, order: index });
    });
    await batch.commit();
    return DEFAULT_CATEGORIES.map((category, index) => ({ ...category, order: index }));
  }

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function saveCategory(userId, category) {
  await setDoc(doc(db, `users/${userId}/categories`, category.id), category, { merge: true });
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
  return DEFAULT_CATEGORIES.some((category) => category.id === categoryId);
}

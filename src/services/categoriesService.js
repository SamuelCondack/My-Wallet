import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { DEFAULT_CATEGORIES } from "../constants/defaultCategories";

export function categoriesCollection(userId) {
  return collection(db, `users/${userId}/categories`);
}

export async function fetchCategories(userId) {
  const snapshot = await getDocs(categoriesCollection(userId));

  if (snapshot.empty) {
    return seedDefaultCategories(userId);
  }

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function seedDefaultCategories(userId) {
  const batch = writeBatch(db);

  DEFAULT_CATEGORIES.forEach((category, index) => {
    const ref = doc(db, `users/${userId}/categories`, category.id);
    batch.set(ref, { ...category, order: index, archived: false });
  });

  await batch.commit();
  return DEFAULT_CATEGORIES.map((category, index) => ({
    ...category,
    order: index,
    archived: false,
  }));
}

export async function saveCategory(userId, category) {
  const ref = doc(db, `users/${userId}/categories`, category.id);
  await setDoc(ref, category, { merge: true });
}

export function getCategoryMap(categories) {
  return categories.reduce((map, category) => {
    map[category.id] = category;
    return map;
  }, {});
}

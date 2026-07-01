import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

export function goalsCollection(userId) {
  return collection(db, `users/${userId}/goals`);
}

export async function fetchGoals(userId) {
  const snapshot = await getDocs(goalsCollection(userId));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
}

export async function createGoal(userId, goal) {
  const ref = await addDoc(goalsCollection(userId), {
    ...goal,
    currentAmount: Number(goal.currentAmount) || 0,
    targetAmount: Number(goal.targetAmount) || 0,
    status: "active",
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateGoal(userId, goalId, data) {
  await updateDoc(doc(db, `users/${userId}/goals`, goalId), data);
}

export async function deleteGoal(userId, goalId) {
  await deleteDoc(doc(db, `users/${userId}/goals`, goalId));
}

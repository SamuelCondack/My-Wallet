import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";

export async function fetchExpenses(userId) {
  const snapshot = await getDocs(collection(db, userId));
  return snapshot.docs
    .filter((item) => !item.id.startsWith("earnings-"))
    .map((item) => ({ id: item.id, ...item.data() }));
}

export async function fetchEarnings(userId) {
  const snapshot = await getDocs(collection(db, `users/${userId}/earnings`));
  const earnings = {};
  snapshot.forEach((item) => {
    earnings[item.id] = Number(item.data().value || 0);
  });
  return earnings;
}

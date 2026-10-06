import { tNow } from "../i18n/translate";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export function getThemeFromProfile(profile) {
  return profile?.preferences?.theme === "dark" ? "dark" : "light";
}

export function applyDocumentTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", next === "dark" ? "#0b1220" : "#3e92eb");
  }
}

export async function updateUserTheme(userId, theme) {
  if (!userId) throw new Error(tNow("toast.needSignIn"));
  const next = theme === "dark" ? "dark" : "light";
  await setDoc(
    doc(db, "users", userId),
    {
      preferences: {
        theme: next,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return next;
}

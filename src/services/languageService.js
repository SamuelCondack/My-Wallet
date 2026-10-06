import { tNow } from "../i18n/translate";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  getLanguagePreferenceFromProfile,
  normalizeLanguagePreference,
  setStoredLanguagePreference,
} from "../i18n/language";

export function getLanguageFromProfile(profile) {
  return getLanguagePreferenceFromProfile(profile);
}

export async function updateUserLanguage(userId, language) {
  if (!userId) throw new Error(tNow("toast.needSignIn"));
  const next = normalizeLanguagePreference(language);
  setStoredLanguagePreference(next);
  await setDoc(
    doc(db, "users", userId),
    {
      preferences: {
        language: next,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return next;
}

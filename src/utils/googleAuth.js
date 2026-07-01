import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, googleProvider } from "../../config/firebase";
import { isStandaloneMode } from "./pwa";

const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/cancelled-popup-request",
]);

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function signInWithGoogle() {
  if (isStandaloneMode()) {
    return signInWithPopup(auth, googleProvider);
  }

  if (!isMobileBrowser()) {
    return signInWithPopup(auth, googleProvider);
  }

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (!POPUP_FALLBACK_CODES.has(error.code)) {
      throw error;
    }

    await signInWithRedirect(auth, googleProvider);
    return null;
  }
}

export async function resolveGoogleRedirect() {
  return getRedirectResult(auth);
}

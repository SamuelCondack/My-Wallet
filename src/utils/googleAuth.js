import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "../../config/firebase";
import { isStandaloneMode } from "./pwa";

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

  if (isMobileBrowser()) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }

  return signInWithPopup(auth, googleProvider);
}

export async function resolveGoogleRedirect() {
  return getRedirectResult(auth);
}

import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, googleProvider } from "../../config/firebase";
import { isIOS, isStandaloneMode } from "./pwa";

function shouldUseRedirect() {
  return isStandaloneMode() || isIOS();
}

export async function signInWithGoogle() {
  if (shouldUseRedirect()) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }

  return signInWithPopup(auth, googleProvider);
}

export async function resolveGoogleRedirectResult() {
  try {
    return await getRedirectResult(auth);
  } catch (error) {
    console.error("Google redirect sign-in failed:", error);
    return null;
  }
}

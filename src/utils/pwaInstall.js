const FIRST_SEEN_KEY = "mw_pwa_first_seen";
const PROFILE_DISMISS_KEY = "mw_pwa_profile_dismissed";
const BANNER_DISMISS_KEY = "mw_pwa_banner_dismissed";

/** Days of use before the Dashboard install banner appears. */
export const PWA_BANNER_MIN_DAYS = 2;

let deferredInstallPrompt = null;
const promptListeners = new Set();

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

export function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isIosSafari() {
  if (!isIosDevice() || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Chrome/Firefox/Edge on iOS use a different UA token.
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return false;
  return /Safari/i.test(ua) || !/Chrome/i.test(ua);
}

export function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMobileInstallCandidate() {
  return isIosDevice() || isAndroidDevice();
}

export function ensurePwaFirstSeen() {
  const existing = readStorage(FIRST_SEEN_KEY);
  if (existing) return existing;
  const now = new Date().toISOString();
  writeStorage(FIRST_SEEN_KEY, now);
  return now;
}

export function getPwaDaysSinceFirstSeen() {
  const raw = ensurePwaFirstSeen();
  const then = Date.parse(raw);
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export function isPwaProfileDismissed() {
  return readStorage(PROFILE_DISMISS_KEY) === "1";
}

export function dismissPwaProfile() {
  writeStorage(PROFILE_DISMISS_KEY, "1");
}

export function isPwaBannerDismissed() {
  return readStorage(BANNER_DISMISS_KEY) === "1";
}

export function dismissPwaBanner() {
  writeStorage(BANNER_DISMISS_KEY, "1");
}

function notifyPromptListeners() {
  promptListeners.forEach((listener) => listener(deferredInstallPrompt));
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export function setDeferredInstallPrompt(prompt) {
  deferredInstallPrompt = prompt;
  notifyPromptListeners();
}

export function subscribeDeferredInstallPrompt(listener) {
  promptListeners.add(listener);
  listener(deferredInstallPrompt);
  return () => promptListeners.delete(listener);
}

let installEventsBound = false;

/** Bind once at app level so the Chrome install event is never missed. */
export function bindPwaInstallEvents() {
  if (typeof window === "undefined" || installEventsBound) return;
  installEventsBound = true;

  ensurePwaFirstSeen();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event);
  });

  window.addEventListener("appinstalled", () => {
    setDeferredInstallPrompt(null);
  });
}

export async function promptPwaInstall() {
  const prompt = deferredInstallPrompt;
  if (!prompt) return { ok: false, outcome: null };
  prompt.prompt();
  const choice = await prompt.userChoice;
  setDeferredInstallPrompt(null);
  return { ok: true, outcome: choice?.outcome ?? null };
}

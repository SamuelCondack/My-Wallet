import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import {
  DEFAULT_SUBSCRIPTION,
  PLAN_ID,
  SUBSCRIPTION_STATUS,
} from "../constants/subscription";

function userRef(userId) {
  return doc(db, "users", userId);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeSubscription(raw) {
  const base = { ...DEFAULT_SUBSCRIPTION, ...(raw || {}) };
  return {
    ...base,
    planId: base.planId || PLAN_ID.FREE,
    status: base.status || SUBSCRIPTION_STATUS.NONE,
    cancelAtPeriodEnd: Boolean(base.cancelAtPeriodEnd),
    trialEndsAtMs: toMillis(base.trialEndsAt),
    currentPeriodEndMs: toMillis(base.currentPeriodEnd),
    updatedAtMs: toMillis(base.updatedAt),
  };
}

export function hasProAccess(subscription) {
  const normalized = normalizeSubscription(subscription);
  const { status, trialEndsAtMs, currentPeriodEndMs } = normalized;
  const now = Date.now();

  if (status === SUBSCRIPTION_STATUS.ACTIVE) {
    if (currentPeriodEndMs && currentPeriodEndMs < now) return false;
    return true;
  }

  if (status === SUBSCRIPTION_STATUS.TRIALING) {
    if (trialEndsAtMs && trialEndsAtMs < now) return false;
    return true;
  }

  return false;
}

export function getTrialDaysLeft(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (normalized.status !== SUBSCRIPTION_STATUS.TRIALING) return null;
  if (!normalized.trialEndsAtMs) return null;
  const diff = normalized.trialEndsAtMs - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getPlanLabel(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (hasProAccess(normalized)) {
    if (normalized.status === SUBSCRIPTION_STATUS.TRIALING) return "Pro Trial";
    return "Pro";
  }
  if (normalized.status === SUBSCRIPTION_STATUS.PAST_DUE) return "Past due";
  return "Free";
}

/** True only if this account has never started a Stripe subscription/trial. */
export function canStartTrial(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (hasProAccess(normalized)) return false;
  if (normalized.status === SUBSCRIPTION_STATUS.PAST_DUE) return false;

  const alreadyUsedTrial = Boolean(
    normalized.stripeSubscriptionId ||
      normalized.status === SUBSCRIPTION_STATUS.TRIALING ||
      normalized.status === SUBSCRIPTION_STATUS.ACTIVE ||
      normalized.status === SUBSCRIPTION_STATUS.PAST_DUE ||
      normalized.status === SUBSCRIPTION_STATUS.CANCELED
  );

  return !alreadyUsedTrial;
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return null;

  const ref = userRef(user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    const payload = {
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      subscription: {
        ...DEFAULT_SUBSCRIPTION,
        updatedAt: serverTimestamp(),
      },
    };
    await setDoc(ref, payload);
    return {
      ...payload,
      subscription: normalizeSubscription(payload.subscription),
    };
  }

  const data = snapshot.data();
  const updates = {};

  if (user.email && data.email !== user.email) updates.email = user.email;
  if (user.displayName && data.displayName !== user.displayName) {
    updates.displayName = user.displayName;
  }
  if (user.photoURL && data.photoURL !== user.photoURL) {
    updates.photoURL = user.photoURL;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
    await setDoc(ref, updates, { merge: true });
  }

  return {
    ...data,
    ...updates,
    subscription: normalizeSubscription(data.subscription),
  };
}

export function subscribeToUserProfile(userId, onChange, onError) {
  return onSnapshot(
    userRef(userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const data = snapshot.data();
      onChange({
        id: snapshot.id,
        ...data,
        subscription: normalizeSubscription(data.subscription),
      });
    },
    onError
  );
}

function getFunctionsBaseUrl() {
  const configured = import.meta.env.VITE_FUNCTIONS_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return "/.netlify/functions";
}

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to manage billing.");
  }
  return user.getIdToken();
}

async function postBillingFunction(functionName, body = {}) {
  const token = await getIdToken();
  const response = await fetch(`${getFunctionsBaseUrl()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      `Billing request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload;
}

export async function startCheckout({ successUrl, cancelUrl } = {}) {
  const origin = window.location.origin;
  return postBillingFunction("create-checkout", {
    successUrl:
      successUrl || `${origin}/home/profile?checkout=success`,
    cancelUrl: cancelUrl || `${origin}/home/profile?checkout=cancel`,
  });
}

export async function openCustomerPortal({ returnUrl } = {}) {
  const origin = window.location.origin;
  return postBillingFunction("create-portal", {
    returnUrl: returnUrl || `${origin}/home/profile?billing=updated`,
  });
}

/**
 * Opens a Stripe Checkout / Customer Portal URL in a new tab.
 * The blank tab is opened synchronously on the user gesture so popup
 * blockers do not swallow the async session create.
 * Falls back to same-tab redirect if the popup is blocked.
 */
export async function openStripeSession(createSession) {
  const tab = window.open("about:blank", "_blank");

  try {
    const result = await createSession();
    const url = result?.url;
    if (!url) {
      throw new Error("Billing URL missing.");
    }

    if (tab && !tab.closed) {
      try {
        tab.opener = null;
      } catch {
        /* ignore cross-browser opener lock */
      }
      tab.location.href = url;
      return { mode: "tab", url };
    }

    window.location.assign(url);
    return { mode: "redirect", url };
  } catch (error) {
    try {
      tab?.close();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export async function syncSubscription() {
  return postBillingFunction("sync-subscription", {});
}

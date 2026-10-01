import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../config/firebase";
import {
  DEFAULT_SUBSCRIPTION,
  SUBSCRIPTION_STATUS,
} from "../constants/subscription";
import {
  ensureUserProfile,
  getPlanLabel,
  getTrialDaysLeft,
  hasProAccess,
  canStartTrial as checkCanStartTrial,
  normalizeSubscription,
  subscribeToUserProfile,
} from "../services/subscriptionService";

/**
 * Live subscription state for the signed-in user.
 * Missing / failed profile → treated as Free (safe default).
 */
export function useSubscription() {
  const [user, setUser] = useState(auth.currentUser);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let unsubProfile = null;
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!active) return;

      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await ensureUserProfile(nextUser);
        if (!active) return;

        unsubProfile = subscribeToUserProfile(
          nextUser.uid,
          (nextProfile) => {
            if (!active) return;
            setProfile(nextProfile);
            setLoading(false);
          },
          (err) => {
            if (!active) return;
            console.error("Subscription listener failed:", err);
            setError(err);
            setLoading(false);
          }
        );
      } catch (err) {
        if (!active) return;
        console.error("Failed to ensure user profile:", err);
        setError(err);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const subscription = useMemo(
    () =>
      normalizeSubscription(profile?.subscription || DEFAULT_SUBSCRIPTION),
    [profile]
  );

  const isPro = hasProAccess(subscription);
  const trialDaysLeft = getTrialDaysLeft(subscription);
  const planLabel = getPlanLabel(subscription);
  const isTrialing = subscription.status === SUBSCRIPTION_STATUS.TRIALING;
  const isPastDue = subscription.status === SUBSCRIPTION_STATUS.PAST_DUE;
  const canStartTrial = checkCanStartTrial(subscription);

  /**
   * Gate helper for Pro-only UI.
   * @returns {{ allowed: boolean, reason: 'ok' | 'loading' | 'free' | 'past_due' }}
   */
  const requirePro = () => {
    if (loading) return { allowed: false, reason: "loading" };
    if (isPastDue) return { allowed: false, reason: "past_due" };
    if (!isPro) return { allowed: false, reason: "free" };
    return { allowed: true, reason: "ok" };
  };

  return {
    user,
    profile,
    subscription,
    loading,
    error,
    isPro,
    isTrialing,
    isPastDue,
    trialDaysLeft,
    planLabel,
    canStartTrial,
    requirePro,
  };
}

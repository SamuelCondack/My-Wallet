import { useEffect } from "react";
import { useSubscription } from "../hooks/useSubscription";
import {
  applyDocumentTheme,
  getThemeFromProfile,
} from "../services/themeService";

/**
 * Keeps document theme in sync with the signed-in user's Firestore preference.
 */
export default function ThemeSync() {
  const { user, profile, loading } = useSubscription();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      applyDocumentTheme("light");
      return;
    }
    applyDocumentTheme(getThemeFromProfile(profile));
  }, [loading, user, profile]);

  return null;
}

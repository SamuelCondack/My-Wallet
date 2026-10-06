import PropTypes from "prop-types";
import { useSubscription } from "../../hooks/useSubscription";
import { LanguageProvider } from "../../i18n/LanguageContext";
import { getStoredLanguagePreference } from "../../i18n/language";
import { getLanguageFromProfile } from "../../services/languageService";

/**
 * Syncs language preference from Firestore profile when signed in.
 */
export default function LanguageSync({ children }) {
  const { user, profile, loading } = useSubscription();

  let preference = getStoredLanguagePreference();
  if (!loading && user && profile) {
    preference = getLanguageFromProfile(profile);
  }

  return (
    <LanguageProvider preference={preference}>{children}</LanguageProvider>
  );
}

LanguageSync.propTypes = {
  children: PropTypes.node,
};

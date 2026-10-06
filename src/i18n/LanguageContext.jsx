import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import {
  getLocale,
  getStoredLanguagePreference,
  LANGUAGE,
  resolveLanguage,
  setStoredLanguagePreference,
} from "./language";
import { createTranslator } from "./translate";

export const LanguageContext = createContext({
  preference: LANGUAGE.SYSTEM,
  language: LANGUAGE.EN,
  locale: getLocale(LANGUAGE.EN),
  setPreference: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children, preference: preferenceProp }) {
  const [preference, setPreferenceState] = useState(() =>
    getStoredLanguagePreference()
  );

  useEffect(() => {
    if (preferenceProp == null) return;
    setPreferenceState(preferenceProp);
    setStoredLanguagePreference(preferenceProp);
  }, [preferenceProp]);

  const language = useMemo(
    () => resolveLanguage(preference),
    [preference]
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setPreference = useCallback((next) => {
    const saved = setStoredLanguagePreference(next);
    setPreferenceState(saved);
  }, []);

  const t = useMemo(() => createTranslator(language), [language]);

  const value = useMemo(
    () => ({
      preference,
      language,
      locale: getLocale(language),
      setPreference,
      t,
    }),
    [preference, language, setPreference, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

LanguageProvider.propTypes = {
  children: PropTypes.node,
  preference: PropTypes.oneOf([LANGUAGE.EN, LANGUAGE.PT, LANGUAGE.SYSTEM]),
};

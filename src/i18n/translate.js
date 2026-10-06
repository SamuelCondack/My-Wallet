import en from "./messages/en";
import pt from "./messages/pt";
import {
  getStoredLanguagePreference,
  LANGUAGE,
  resolveLanguage,
} from "./language";

const catalogs = {
  [LANGUAGE.EN]: en,
  [LANGUAGE.PT]: pt,
};

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] == null) return "";
    return String(vars[key]);
  });
}

export function translate(language, key, vars) {
  const catalog = catalogs[language] || en;
  const template = catalog[key] ?? en[key] ?? key;
  return interpolate(template, vars);
}

/**
 * Translate using the currently stored language preference. For code that
 * runs outside React (services, hooks that throw user-facing errors).
 */
export function tNow(key, vars) {
  return translate(resolveLanguage(getStoredLanguagePreference()), key, vars);
}

export function createTranslator(language) {
  return (key, vars) => translate(language, key, vars);
}

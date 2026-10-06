export const LANGUAGE = {
  EN: "en",
  PT: "pt",
  SYSTEM: "system",
};

export const LANGUAGE_STORAGE_KEY = "mw_language";

/** BCP-47 locale used for dates / numbers per resolved UI language. */
export const LOCALE_BY_LANGUAGE = {
  [LANGUAGE.EN]: "en-US",
  [LANGUAGE.PT]: "pt-BR",
};

export function getLocale(language) {
  return LOCALE_BY_LANGUAGE[language] || LOCALE_BY_LANGUAGE[LANGUAGE.EN];
}

export function detectBrowserLanguage() {
  if (typeof navigator === "undefined") return LANGUAGE.EN;
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
    navigator.userLanguage,
  ].filter(Boolean);

  for (const raw of candidates) {
    if (String(raw).toLowerCase().startsWith("pt")) {
      return LANGUAGE.PT;
    }
  }
  return LANGUAGE.EN;
}

export function normalizeLanguagePreference(value) {
  if (value === LANGUAGE.EN || value === LANGUAGE.PT || value === LANGUAGE.SYSTEM) {
    return value;
  }
  return LANGUAGE.SYSTEM;
}

export function resolveLanguage(preference) {
  const pref = normalizeLanguagePreference(preference);
  if (pref === LANGUAGE.SYSTEM) {
    return detectBrowserLanguage();
  }
  return pref;
}

export function getStoredLanguagePreference() {
  try {
    return normalizeLanguagePreference(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return LANGUAGE.SYSTEM;
  }
}

export function setStoredLanguagePreference(preference) {
  const next = normalizeLanguagePreference(preference);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // ignore quota / private mode
  }
  return next;
}

export function getLanguagePreferenceFromProfile(profile) {
  return normalizeLanguagePreference(profile?.preferences?.language);
}

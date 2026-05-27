import { translations } from "./translations";

export const DEFAULT_LANGUAGE = "fr";
export const LANGUAGE_STORAGE_KEY = "showscore.language";
export const SUPPORTED_LANGUAGES = [
  { code: "fr", labelKey: "language.french", shortLabel: "FR" },
  { code: "en", labelKey: "language.english", shortLabel: "EN" },
];

export function normalizeLanguage(value) {
  const language = String(value || "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return translations[language] ? language : "";
}

export function detectBrowserLanguage(navigatorLike = getBrowserNavigator()) {
  const candidates = [
    ...(Array.isArray(navigatorLike?.languages) ? navigatorLike.languages : []),
    navigatorLike?.language,
  ];

  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);

    if (language) {
      return language;
    }
  }

  return "";
}

export function loadStoredLanguage(storage = getBrowserStorage()) {
  try {
    return normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch (error) {
    return "";
  }
}

export function saveStoredLanguage(language, storage = getBrowserStorage()) {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    // Ignore storage failures. The app can still run with the in-memory language.
  }
}

export function getInitialLanguage({
  storage = getBrowserStorage(),
  navigatorLike = getBrowserNavigator(),
} = {}) {
  return (
    loadStoredLanguage(storage) ||
    detectBrowserLanguage(navigatorLike) ||
    DEFAULT_LANGUAGE
  );
}

function getBrowserNavigator() {
  return typeof window === "undefined" ? undefined : window.navigator;
}

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function translate(language, key, params = {}) {
  const value =
    getTranslationValue(translations[language], key) ??
    getTranslationValue(translations[DEFAULT_LANGUAGE], key) ??
    key;

  if (typeof value !== "string") {
    return key;
  }

  return interpolate(value, params);
}

function getTranslationValue(source, key) {
  return String(key || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, segment) => {
      if (!current || typeof current !== "object") {
        return undefined;
      }

      return current[segment];
    }, source);
}

function interpolate(value, params) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, name) => {
    const replacement = params[name.trim()];
    return replacement == null ? match : String(replacement);
  });
}

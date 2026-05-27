import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  getInitialLanguage,
  normalizeLanguage,
  saveStoredLanguage,
  translate,
} from "./i18n";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => getInitialLanguage());

  const setLanguage = (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage) || DEFAULT_LANGUAGE;
    setLanguageState(normalized);
    saveStoredLanguage(normalized);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}

export function useTranslation() {
  const { t, language } = useI18n();

  return { t, language };
}

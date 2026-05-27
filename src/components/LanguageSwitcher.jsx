import React from "react";
import { SUPPORTED_LANGUAGES } from "../features/i18n/i18n";
import { useI18n } from "../features/i18n/I18nProvider";

function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div style={wrapStyle} role="group" aria-label={t("language.label")}>
      {SUPPORTED_LANGUAGES.map((option) => {
        const isActive = option.code === language;

        return (
          <button
            key={option.code}
            type="button"
            onClick={() => setLanguage(option.code)}
            style={buttonStyle(isActive)}
            aria-pressed={isActive}
            title={t(option.labelKey)}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}

const wrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  overflow: "hidden",
  background: "#fff",
};

const buttonStyle = (isActive) => ({
  border: "none",
  borderRight: "1px solid #e2e8f0",
  padding: "6px 9px",
  background: isActive ? "#111827" : "#fff",
  color: isActive ? "#fff" : "#334155",
  fontWeight: 900,
  cursor: "pointer",
});

export default LanguageSwitcher;

import React, { useState } from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

function ShareButton({ url, title = "ShowScore", text, label, style }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const buttonLabel = label || t("common.share");

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();

    const absoluteUrl = getAbsoluteUrl(url);

    try {
      if (navigator.share) {
        const shareData = {
          title,
          url: absoluteUrl,
        };

        if (text) {
          shareData.text = text;
        }

        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        window.prompt(t("common.sharePrompt"), absoluteUrl);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Erreur partage:", error);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      style={{ ...shareButtonStyle, ...style }}
    >
      {copied ? t("common.linkCopied") : buttonLabel}
    </button>
  );
}

function getAbsoluteUrl(url) {
  const value = String(url || "").trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${window.location.origin}${value || window.location.pathname}`;
}

const shareButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

export default ShareButton;

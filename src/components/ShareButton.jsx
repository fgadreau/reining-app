import React, { useState } from "react";

function ShareButton({ url, title = "ShowScore", label = "Partager", style }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();

    const absoluteUrl = getAbsoluteUrl(url);

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url: absoluteUrl,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        window.prompt("Lien à partager", absoluteUrl);
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
      {copied ? "Lien copié" : label}
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

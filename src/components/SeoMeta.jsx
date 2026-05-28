import { useEffect } from "react";

const DEFAULT_TITLE = "ShowScore | Vitrine publique";
const DEFAULT_DESCRIPTION =
  "Consulte les shows publics, le live, l'ordre de passage et les feuilles de pointage officielles publiees dans ShowScore.";
const DEFAULT_IMAGE_PATH = "/favicon.ico?v=showscore";
const SITE_NAME = "ShowScore";

function getAbsoluteUrl(value) {
  if (typeof window === "undefined") {
    return value || "";
  }

  try {
    return new URL(value || "/", window.location.origin).toString();
  } catch (error) {
    return window.location.origin;
  }
}

function getDefaultImageUrl() {
  const publicUrl = process.env.PUBLIC_URL || "";
  return getAbsoluteUrl(`${publicUrl}${DEFAULT_IMAGE_PATH}`);
}

function getShareImageUrl(imageUrl) {
  const value = String(imageUrl || "").trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return getAbsoluteUrl(value);
  }

  return getDefaultImageUrl();
}

function upsertMeta(selector, attributes, content) {
  if (typeof document === "undefined" || !content) {
    return;
  }

  let tag = document.head.querySelector(selector);

  if (!tag) {
    tag = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => {
      tag.setAttribute(name, value);
    });
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

function setMetaName(name, content) {
  upsertMeta(`meta[name="${name}"]`, { name }, content);
}

function setMetaProperty(property, content) {
  upsertMeta(`meta[property="${property}"]`, { property }, content);
}

function setCanonical(url) {
  if (typeof document === "undefined" || !url) {
    return;
  }

  let tag = document.head.querySelector('link[rel="canonical"]');

  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }

  tag.setAttribute("href", url);
}

function applySeo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  imageUrl,
  robots = "index,follow",
}) {
  const nextTitle = String(title || DEFAULT_TITLE).trim();
  const nextDescription = String(description || DEFAULT_DESCRIPTION).trim();
  const canonicalUrl = getAbsoluteUrl(canonicalPath || window.location.pathname);
  const shareImageUrl = getShareImageUrl(imageUrl);

  document.title = nextTitle;
  setMetaName("description", nextDescription);
  setMetaName("robots", robots);
  setMetaProperty("og:title", nextTitle);
  setMetaProperty("og:description", nextDescription);
  setMetaProperty("og:type", "website");
  setMetaProperty("og:url", canonicalUrl);
  setMetaProperty("og:site_name", SITE_NAME);
  setMetaProperty("og:image", shareImageUrl);
  setMetaName("twitter:card", "summary");
  setMetaName("twitter:title", nextTitle);
  setMetaName("twitter:description", nextDescription);
  setMetaName("twitter:image", shareImageUrl);
  setCanonical(canonicalUrl);
}

function SeoMeta({ title, description, canonicalPath, imageUrl, robots }) {
  useEffect(() => {
    applySeo({ title, description, canonicalPath, imageUrl, robots });

    return () => {
      applySeo({
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        canonicalPath: "/public",
        imageUrl: DEFAULT_IMAGE_PATH,
      });
    };
  }, [canonicalPath, description, imageUrl, robots, title]);

  return null;
}

export default SeoMeta;

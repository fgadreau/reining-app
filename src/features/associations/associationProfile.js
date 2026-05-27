export function normalizeAssociationWebsiteUrl(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getAssociationWebsiteHref(association) {
  return normalizeAssociationWebsiteUrl(association?.websiteUrl);
}

export function getAssociationInitials(association) {
  const shortName = String(association?.shortName || "").trim();

  if (shortName) {
    return shortName.slice(0, 4).toUpperCase();
  }

  const words = String(association?.name || "Association")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

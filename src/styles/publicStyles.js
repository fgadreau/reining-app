export const publicColors = {
  page: "#f5f6f8",
  surface: "#ffffff",
  surfaceSoft: "#f8fafc",
  border: "#d8dee8",
  borderStrong: "#b6c2d2",
  text: "#101827",
  muted: "#66758d",
  softText: "#42526b",
  primary: "#101827",
  primaryText: "#ffffff",
  blue: "#1d4ed8",
  blueSoft: "#eef5ff",
  green: "#167a4b",
  greenSoft: "#eafbf2",
  greenBorder: "#99e4b8",
  amber: "#9a5a16",
  amberSoft: "#fff7e8",
  red: "#a32929",
  redSoft: "#fff3f3",
};

export const publicPageStyle = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  backgroundColor: publicColors.page,
  minHeight: "100vh",
  padding: "12px",
  boxSizing: "border-box",
  color: publicColors.text,
};

export const publicHeroStyle = {
  background: publicColors.surface,
  borderRadius: 8,
  padding: 16,
  border: `1px solid ${publicColors.border}`,
  boxShadow: "0 10px 28px rgba(16, 24, 39, 0.08)",
  marginBottom: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

export const publicCardStyle = {
  background: publicColors.surface,
  borderRadius: 8,
  padding: 14,
  border: `1px solid ${publicColors.border}`,
  boxShadow: "0 8px 20px rgba(16, 24, 39, 0.06)",
};

export const publicPrimaryActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${publicColors.primary}`,
  background: publicColors.primary,
  color: publicColors.primaryText,
  textDecoration: "none",
  fontWeight: 850,
  cursor: "pointer",
  boxSizing: "border-box",
};

export const publicSecondaryActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "10px 14px",
  borderRadius: 8,
  border: `1px solid ${publicColors.borderStrong}`,
  background: publicColors.surface,
  color: publicColors.text,
  textDecoration: "none",
  fontWeight: 800,
  cursor: "pointer",
  boxSizing: "border-box",
};

export const publicEyebrowStyle = {
  color: publicColors.muted,
  fontWeight: 850,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

export const publicTitleStyle = {
  margin: "3px 0",
  fontSize: 28,
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: "anywhere",
};

export const publicSubtitleStyle = {
  color: publicColors.softText,
  lineHeight: 1.35,
};

export const publicMutedTextStyle = {
  color: publicColors.muted,
  lineHeight: 1.35,
};

export const publicBadgeStyle = (tone = "neutral") => {
  const palette = getBadgePalette(tone);

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "4px 9px",
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    fontWeight: 850,
    fontSize: 13,
    whiteSpace: "nowrap",
  };
};

export const publicEmptyStateStyle = {
  ...publicCardStyle,
  color: publicColors.muted,
  lineHeight: 1.35,
};

export function getBadgePalette(tone) {
  if (tone === "live" || tone === "success") {
    return {
      border: publicColors.greenBorder,
      background: publicColors.greenSoft,
      color: publicColors.green,
    };
  }

  if (tone === "info") {
    return {
      border: "#bfdbfe",
      background: publicColors.blueSoft,
      color: publicColors.blue,
    };
  }

  if (tone === "warn") {
    return {
      border: "#f3d18a",
      background: publicColors.amberSoft,
      color: publicColors.amber,
    };
  }

  if (tone === "danger") {
    return {
      border: "#f1b5b5",
      background: publicColors.redSoft,
      color: publicColors.red,
    };
  }

  return {
    border: publicColors.border,
    background: publicColors.surfaceSoft,
    color: publicColors.softText,
  };
}

const TV_DISPLAY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TV_DISPLAY_CODE_LENGTH = 6;
const LAST_TV_DISPLAY_KEY = "showscore.tvDisplay.lastShortcut.v1";

export function normalizeTvDisplayShortCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, TV_DISPLAY_CODE_LENGTH);
}

export function buildTvDisplayShortCode(showId) {
  const source = String(showId || "").trim();
  if (!source) return "";

  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  let value = hash >>> 0;
  let code = "";
  for (let index = 0; index < TV_DISPLAY_CODE_LENGTH; index += 1) {
    code =
      TV_DISPLAY_CODE_ALPHABET[value % TV_DISPLAY_CODE_ALPHABET.length] + code;
    value = Math.floor(value / TV_DISPLAY_CODE_ALPHABET.length);
  }

  return code;
}

export function buildTvDisplayCompetitionShortCode(showId) {
  const source = String(showId || "").trim();
  return source ? buildTvDisplayShortCode(`competition:${source}`) : "";
}

export function buildTvDisplayLivestreamShortCode(showId) {
  const source = String(showId || "").trim();
  return source ? buildTvDisplayShortCode(`livestream:${source}`) : "";
}

export function getTvDisplayShortcutPath(showId) {
  const code = buildTvDisplayShortCode(showId);
  return code ? `/tv/${code}` : "/tv";
}

export function getTvDisplayCompetitionShortcutPath(showId) {
  const code = buildTvDisplayCompetitionShortCode(showId);
  return code ? `/tv/${code}` : "/tv";
}

export function getTvDisplayLivestreamShortcutPath(showId) {
  const code = buildTvDisplayLivestreamShortCode(showId);
  return code ? `/tv/${code}` : "/tv";
}

export function rememberTvDisplayShortcut(show) {
  if (typeof localStorage === "undefined") return;

  const showId = String(show?.id || show?.showId || "").trim();
  const associationId = String(
    show?.associationId || show?.organizationId || ""
  ).trim();
  const requestedMode = String(show?.mode || show?.tvDisplayMode || "")
    .trim()
    .toLowerCase();
  const mode = ["competition", "livestream"].includes(requestedMode)
    ? requestedMode
    : "general";
  const arena = String(
    show?.arena || show?.tvDisplayArena || show?.tvDisplayVideoArena || ""
  ).trim();
  const code =
    normalizeTvDisplayShortCode(show?.code) ||
    (mode === "competition"
      ? buildTvDisplayCompetitionShortCode(showId)
      : mode === "livestream"
        ? buildTvDisplayLivestreamShortCode(showId)
        : buildTvDisplayShortCode(showId));

  if (!showId || !associationId || !code) return;

  try {
    localStorage.setItem(
      LAST_TV_DISPLAY_KEY,
      JSON.stringify({
        code,
        showId,
        associationId,
        showName: String(show?.name || show?.showName || "").trim(),
        mode,
        arena,
      })
    );
  } catch (error) {
    console.error("Erreur mémorisation raccourci écran TV:", error);
  }
}

export function getRememberedTvDisplayShortcut() {
  if (typeof localStorage === "undefined") return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_TV_DISPLAY_KEY) || "");
    const code = normalizeTvDisplayShortCode(parsed?.code);
    const showId = String(parsed?.showId || "").trim();
    const associationId = String(parsed?.associationId || "").trim();
    const requestedMode = String(parsed?.mode || "").trim().toLowerCase();
    const mode = ["competition", "livestream"].includes(requestedMode)
      ? requestedMode
      : "general";

    if (!code || !showId || !associationId) return null;

    return {
      code,
      showId,
      associationId,
      showName: String(parsed?.showName || "").trim(),
      mode,
      arena: String(parsed?.arena || "").trim(),
    };
  } catch (error) {
    return null;
  }
}

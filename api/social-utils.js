const DEFAULT_SITE_NAME = "ShowScore";
const DEFAULT_DESCRIPTION =
  "Shows publics, live, horaires et resultats publies dans ShowScore.";
const DEFAULT_IMAGE_PATH = "/favicon.ico?v=showscore";
const FALLBACK_SUPABASE_URL = "https://srzzituovoxkvvlaesxa.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_pNwsFl8clhcq1QpHa8_O4w_joshGiJN";

function getSupabaseConfig() {
  const supabaseUrl = String(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      FALLBACK_SUPABASE_URL
  ).replace(/\/+$/, "");
  const supabaseKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      FALLBACK_SUPABASE_PUBLISHABLE_KEY
  ).trim();

  return { supabaseUrl, supabaseKey };
}

async function supabaseGet(path, params) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase social preview request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchAssociation(associationId) {
  const rows = await supabaseGet("organizations", {
    select: "id,name,short_name,logo_url",
    id: `eq.${associationId}`,
    limit: "1",
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name || "",
    shortName: row.short_name || "",
    logoDataUrl: row.logo_url || "",
  };
}

async function fetchPublicChampionshipSeason(associationId) {
  const rows = await supabaseGet("show_score_public_championship_seasons", {
    select:
      "season_id,organization_id,title,season_year,status,public_payload,updated_at",
    organization_id: `eq.${associationId}`,
    status: "in.(published,final)",
    order: "updated_at.desc",
    limit: "1",
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  const payload =
    row.public_payload && typeof row.public_payload === "object"
      ? row.public_payload
      : {};

  return {
    ...payload,
    id: row.season_id || payload.id || "",
    associationId: row.organization_id || payload.associationId || "",
    title: row.title || payload.title || "",
    year: row.season_year || payload.year || "",
    status: row.status || payload.status || "published",
    updatedAt: row.updated_at || payload.updatedAt || "",
  };
}

function getOrigin(req) {
  const protocol =
    String(req.headers["x-forwarded-proto"] || "").split(",")[0] || "https";
  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "showscore.app"
  ).split(",")[0];

  return `${protocol}://${host}`;
}

function getRequestUrl(req) {
  return new URL(req.url || "/", getOrigin(req));
}

function getQueryValue(req, key) {
  const directValue = req.query?.[key];

  if (Array.isArray(directValue)) {
    return String(directValue[0] || "").trim();
  }

  if (directValue != null) {
    return String(directValue || "").trim();
  }

  return String(getRequestUrl(req).searchParams.get(key) || "").trim();
}

function getAbsoluteUrl(req, path) {
  return new URL(path || "/", getOrigin(req)).toString();
}

function getAssociationLabel(association) {
  return (
    association?.shortName ||
    association?.name ||
    "Association ShowScore"
  );
}

function buildAssociationPreviewMetadata({ association, associationId, req }) {
  const associationName = getAssociationLabel(association);
  const path = `/public/associations/${encodeURIComponent(associationId)}`;

  return {
    title: `${associationName} | Shows publics | ${DEFAULT_SITE_NAME}`,
    description: `Shows publics, live, horaires et resultats de ${associationName}.`,
    url: getAbsoluteUrl(req, path),
    imageUrl: getAbsoluteUrl(
      req,
      `/api/social-image?associationId=${encodeURIComponent(associationId)}`
    ),
    imageAlt: `${associationName} logo`,
  };
}

function buildChampionshipPreviewMetadata({
  association,
  associationId,
  season,
  req,
}) {
  const associationName = getAssociationLabel(association);
  const seasonTitle = season?.title || "Championnat de saison";
  const year = String(season?.year || "").trim();
  const titleWithYear =
    year && !seasonTitle.includes(year) ? `${seasonTitle} ${year}` : seasonTitle;
  const path = `/public/associations/${encodeURIComponent(
    associationId
  )}/championnat`;

  return {
    title: `${titleWithYear} | ${associationName} | ${DEFAULT_SITE_NAME}`,
    description: `Classement du championnat de saison publie par ${associationName}.`,
    url: getAbsoluteUrl(req, path),
    imageUrl: getAbsoluteUrl(
      req,
      `/api/social-image?associationId=${encodeURIComponent(associationId)}`
    ),
    imageAlt: `${associationName} logo`,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPreviewHtml(metadata) {
  const title = metadata.title || DEFAULT_SITE_NAME;
  const description = metadata.description || DEFAULT_DESCRIPTION;
  const url = metadata.url || "";
  const imageUrl = metadata.imageUrl || DEFAULT_IMAGE_PATH;
  const imageAlt = metadata.imageAlt || DEFAULT_SITE_NAME;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index,follow">
    <link rel="canonical" href="${escapeHtml(url)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:site_name" content="${DEFAULT_SITE_NAME}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
  </head>
  <body>
    <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>
  </body>
</html>`;
}

function parseDataImage(value) {
  const source = String(value || "").trim();
  const match = source.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);

  if (!match) return null;

  try {
    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], "base64"),
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  DEFAULT_IMAGE_PATH,
  buildAssociationPreviewMetadata,
  buildChampionshipPreviewMetadata,
  fetchAssociation,
  fetchPublicChampionshipSeason,
  getAbsoluteUrl,
  getQueryValue,
  parseDataImage,
  renderPreviewHtml,
};

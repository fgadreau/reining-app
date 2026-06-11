import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PUBLIC_LIVE_STATUSES = new Set([
  "live",
  "live_no_score",
  "live_scoring",
  "live_finished",
]);

loadEnvFile(".env");
loadEnvFile(".env.local");

const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || "").trim();
const supabaseKey = (
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  ""
).trim();

const issues = [];
const warnings = [];
const passes = [];

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) return;

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) return;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function addPass(message) {
  passes.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function addIssue(message) {
  issues.push(message);
}

function byId(rows) {
  return new Map(rows.filter((row) => row?.id).map((row) => [row.id, row]));
}

function groupBy(rows, key) {
  const grouped = new Map();

  rows.forEach((row) => {
    const value = row?.[key];
    if (!value) return;
    const currentRows = grouped.get(value) || [];
    currentRows.push(row);
    grouped.set(value, currentRows);
  });

  return grouped;
}

function getRestHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };
}

function getRestUrl(resourceName) {
  return `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/${resourceName}`;
}

function getSupabaseHost() {
  try {
    return new URL(supabaseUrl).hostname;
  } catch (error) {
    return "url Supabase invalide";
  }
}

function getErrorMessage(errorPayload, fallback) {
  if (errorPayload?.message) return errorPayload.message;
  if (errorPayload?.hint) return errorPayload.hint;
  return fallback;
}

function getNetworkErrorMessage(error) {
  const code = error?.cause?.code || error?.code;
  const host = error?.cause?.hostname || getSupabaseHost();

  if (code) return `${code} sur ${host}`;
  if (error?.message) return error.message;
  return "erreur reseau inconnue";
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
}

async function fetchRows(tableName, columns, label = tableName, filters = {}) {
  const url = new URL(getRestUrl(tableName));
  url.searchParams.set("select", columns);
  url.searchParams.set("limit", "1000");

  Object.entries(filters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  let response;

  try {
    response = await fetch(url, {
      headers: getRestHeaders(),
    });
  } catch (error) {
    addIssue(`${label}: appel reseau impossible (${getNetworkErrorMessage(error)})`);
    return null;
  }

  const payload = await readJsonResponse(response);

  if (!response.ok) {
    addIssue(
      `${label}: lecture anon refusee ou migration manquante (${getErrorMessage(
        payload,
        response.statusText
      )})`
    );
    return null;
  }

  return Array.isArray(payload) ? payload : [];
}

async function callRpc(functionName, payload) {
  let response;

  try {
    response = await fetch(getRestUrl(`rpc/${functionName}`), {
      method: "POST",
      headers: {
        ...getRestHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      data: null,
      error: {
        message: `appel reseau impossible (${getNetworkErrorMessage(error)})`,
      },
    };
  }

  const responsePayload = await readJsonResponse(response);

  return {
    data: responsePayload,
    error: response.ok
      ? null
      : {
          message: getErrorMessage(responsePayload, response.statusText),
        },
  };
}

async function probeDraftShows() {
  const data = await fetchRows("shows", "id,status", "draft shows", {
    status: "eq.draft",
  });

  if (data === null) return;

  if (Array.isArray(data) && data.length > 0) {
    addIssue("Un visiteur anonyme peut lire au moins un show draft.");
    return;
  }

  addPass("Aucun show draft n'est lisible par un visiteur anonyme.");
}

async function probeTimingFunction(shows) {
  const targetShowIds = shows.length
    ? shows.slice(0, 3).map((show) => show.id)
    : ["smoke-non-existent-show"];

  for (const showId of targetShowIds) {
    const { error } = await callRpc("public_show_timing_summary", {
      target_show_id: showId,
    });

    if (error) {
      addIssue(
        `public_show_timing_summary: RPC indisponible pour anon (${error.message})`
      );
      return;
    }
  }

  addPass("La RPC publique public_show_timing_summary repond en anon.");
}

function checkReturnedShows(shows) {
  if (!shows.length) {
    addWarning(
      "Aucun show public n'est visible en anon; les checks positifs de vitrine sont limites."
    );
    return;
  }

  shows
    .filter((show) => show.status !== "active")
    .forEach((show) => {
      addIssue(`Show non actif visible en anon: ${show.id} (${show.status || "sans statut"})`);
    });

  if (shows.every((show) => show.status === "active")) {
    addPass("Tous les shows lisibles en anon sont actifs.");
  }
}

function checkChildRowsStayOnPublicShows({ rows, showMap, label, getShowId }) {
  rows.forEach((row) => {
    const showId = getShowId(row);
    if (!showId) return;

    const show = showMap.get(showId);
    if (!show) {
      addIssue(`${label}: ligne lisible en anon sans show public actif (${row.id || showId})`);
    }
  });

  if (rows.length) {
    addPass(`${label}: ${rows.length} ligne(s) lisible(s), toutes rattachees a un show public.`);
  }
}

function checkPublicationStates({ publicationStates, officialByClassId }) {
  publicationStates.forEach((publication) => {
    if (PUBLIC_LIVE_STATUSES.has(publication.status)) return;

    if (publication.status === "published") {
      const official = officialByClassId.get(publication.class_id);
      if (!official) {
        addIssue(
          `publication_states: statut published visible sans official_result public (${publication.class_id})`
        );
      }
      return;
    }

    addIssue(
      `publication_states: statut non public visible en anon (${publication.class_id}: ${publication.status})`
    );
  });

  if (publicationStates.length) {
    addPass("Les publication_states anon sont live ou published avec resultat officiel public.");
  }
}

function checkOfficialResults(officialResults) {
  officialResults.forEach((official) => {
    if (official.finalized !== true || !official.secretariat_validated_at) {
      addIssue(
        `official_results: resultat visible sans finalisation/validation secretariat (${official.class_id})`
      );
    }
  });

  if (officialResults.length) {
    addPass("Les official_results anon sont finalises et valides par le secretariat.");
  }
}

function checkResultPublications(resultPublications) {
  resultPublications.forEach((publication) => {
    const groups = Array.isArray(publication.result_groups)
      ? publication.result_groups
      : [];

    if (publication.status !== "published" || groups.length === 0) {
      addIssue(
        `class_result_publications: publication visible sans statut published/groupes (${publication.class_id})`
      );
    }
  });

  if (resultPublications.length) {
    addPass("Les resultats par classe/division visibles sont explicitement publies.");
  }
}

function checkScoringSessions({ sessions, publicationByClassId, label }) {
  sessions.forEach((session) => {
    const publications = publicationByClassId.get(session.class_id) || [];
    const hasLivePublication = publications.some((publication) =>
      PUBLIC_LIVE_STATUSES.has(publication.status)
    );

    if (!hasLivePublication) {
      addIssue(`${label}: session visible sans publication live (${session.class_id})`);
    }
  });

  if (sessions.length) {
    addPass(`${label}: les sessions visibles ont une publication live.`);
  }
}

function checkPaidWarmups({ paidWarmups, showMap }) {
  paidWarmups.forEach((warmup) => {
    const show = showMap.get(warmup.show_id);

    if (!show) {
      addIssue(`paid_warmups: warmup visible sans show public (${warmup.id})`);
      return;
    }

    if (!warmup.is_public_live && show.is_schedule_public !== true) {
      addIssue(
        `paid_warmups: warmup visible sans live public ni horaire public (${warmup.id})`
      );
    }
  });

  if (paidWarmups.length) {
    addPass("Les paid warmups anon sont live publics ou dans un horaire public.");
  }
}

function printReport({ counts, samplePath }) {
  console.log("Smoke test vitrine publique Supabase (anon)");
  console.log("");
  console.log("Compteurs anon:");
  Object.entries(counts).forEach(([label, count]) => {
    console.log(`- ${label}: ${count}`);
  });

  if (samplePath) {
    console.log("");
    console.log(`Page publique a ouvrir comme visiteur: ${samplePath}`);
  }

  if (passes.length) {
    console.log("");
    console.log("OK:");
    passes.forEach((message) => console.log(`- ${message}`));
  }

  if (warnings.length) {
    console.log("");
    console.log("A verifier:");
    warnings.forEach((message) => console.log(`- ${message}`));
  }

  if (issues.length) {
    console.log("");
    console.log("Problemes:");
    issues.forEach((message) => console.log(`- ${message}`));
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Supabase n'est pas configure. Ajoute REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_PUBLISHABLE_KEY."
  );
  process.exit(1);
}

await probeDraftShows();

const associations = await fetchRows(
  "associations",
  "id,name,short_name",
  "associations"
) || [];
const shows = await fetchRows(
  "shows",
  "id,association_id,name,status,is_schedule_public,is_livestream_public,livestream_url",
  "shows"
) || [];
const days = await fetchRows("days", "id,show_id", "days") || [];
const classes = await fetchRows("classes", "id,show_id,day_id", "classes") || [];
const paidWarmups = await fetchRows(
  "paid_warmups",
  "id,show_id,is_public_live",
  "paid_warmups"
) || [];
const publicationStates = await fetchRows(
  "publication_states",
  "class_id,status",
  "publication_states"
) || [];
const officialResults = await fetchRows(
  "official_results",
  "class_id,finalized,secretariat_validated_at",
  "official_results"
) || [];
const resultPublications = await fetchRows(
  "class_result_publications",
  "class_id,status,result_groups",
  "class_result_publications"
) || [];
const scoringSessions = await fetchRows(
  "scoring_sessions",
  "class_id",
  "scoring_sessions"
) || [];
const judgeScoringSessions = await fetchRows(
  "judge_scoring_sessions",
  "class_id",
  "judge_scoring_sessions"
) || [];

const associationMap = byId(associations);
const showMap = byId(shows);
const classMap = byId(classes);
const officialByClassId = new Map(
  officialResults.map((official) => [official.class_id, official])
);
const publicationByClassId = groupBy(publicationStates, "class_id");

checkReturnedShows(shows);
checkChildRowsStayOnPublicShows({
  rows: days,
  showMap,
  label: "days",
  getShowId: (row) => row.show_id,
});
checkChildRowsStayOnPublicShows({
  rows: classes,
  showMap,
  label: "classes",
  getShowId: (row) => row.show_id,
});
checkPaidWarmups({ paidWarmups, showMap });
checkPublicationStates({ publicationStates, officialByClassId });
checkOfficialResults(officialResults);
checkResultPublications(resultPublications);
checkScoringSessions({
  sessions: scoringSessions,
  publicationByClassId,
  label: "scoring_sessions",
});
checkScoringSessions({
  sessions: judgeScoringSessions,
  publicationByClassId,
  label: "judge_scoring_sessions",
});
await probeTimingFunction(shows);

classes.forEach((classRow) => {
  if (!showMap.has(classRow.show_id)) {
    return;
  }

  if (!classMap.has(classRow.id)) {
    addIssue(`classes: classe publique introuvable dans la map locale (${classRow.id})`);
  }
});

const sampleShow = shows.find((show) => associationMap.has(show.association_id));
const samplePath = sampleShow
  ? `/public/associations/${sampleShow.association_id}/shows/${sampleShow.id}`
  : "";

printReport({
  counts: {
    associations: associations.length,
    shows: shows.length,
    days: days.length,
    classes: classes.length,
    paid_warmups: paidWarmups.length,
    publication_states: publicationStates.length,
    official_results: officialResults.length,
    class_result_publications: resultPublications.length,
    scoring_sessions: scoringSessions.length,
    judge_scoring_sessions: judgeScoringSessions.length,
  },
  samplePath,
});

if (issues.length > 0) {
  process.exit(1);
}

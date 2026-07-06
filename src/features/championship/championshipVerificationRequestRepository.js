import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  formatChampionshipMoney,
  formatChampionshipPoints,
} from "./championshipPoints";

export const CHAMPIONSHIP_VERIFICATION_FUNCTION =
  "send-championship-verification-request";

export const CHAMPIONSHIP_VERIFICATION_SCOPES = {
  SELECTED_SHOWS: "selected_shows",
  SEASON: "season",
};

export function validateChampionshipVerificationForm(form = {}, classEntry = null) {
  const errors = {};
  const scope = normalizeScope(form.scope);

  if (!String(form.requesterName || "").trim()) {
    errors.requesterName = "required";
  }

  if (!isValidEmail(form.requesterEmail)) {
    errors.requesterEmail = "email";
  }

  if (!String(form.classId || "").trim() || !classEntry) {
    errors.classId = "required";
  }

  if (
    scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS &&
    !normalizeShowKeys(form.showKeys).length
  ) {
    errors.showKeys = "required";
  }

  if (!String(form.rider || "").trim()) {
    errors.rider = "required";
  }

  if (!String(form.horse || "").trim()) {
    errors.horse = "required";
  }

  if (!String(form.explanation || "").trim()) {
    errors.explanation = "required";
  }

  return errors;
}

export function buildChampionshipVerificationPayload({
  associationId = "",
  association = null,
  season = null,
  championshipUrl = "",
  form = {},
  classEntry = null,
  submittedAt = new Date().toISOString(),
} = {}) {
  const scope = normalizeScope(form.scope);
  const showKeys = normalizeShowKeys(form.showKeys);
  const selectedShowKeySet = new Set(showKeys);
  const events = Array.isArray(classEntry?.events) ? classEntry.events : [];
  const selectedEvents =
    scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON
      ? events
      : events.filter((event) => selectedShowKeySet.has(event.eventKey));
  const matchedTeam = findChampionshipVerificationTeam(
    classEntry,
    form.rider,
    form.horse
  );

  return {
    source: "showscore_public_championship",
    submittedAt,
    championshipUrl: String(championshipUrl || "").trim(),
    association: {
      id: String(associationId || association?.id || season?.associationId || "").trim(),
      name: String(association?.name || association?.shortName || "").trim(),
      shortName: String(association?.shortName || "").trim(),
    },
    season: {
      id: String(season?.id || "").trim(),
      title: String(season?.title || "").trim(),
      year: String(season?.year || "").trim(),
      status: String(season?.status || "").trim(),
      updatedAt: season?.updatedAt || season?.importedAt || "",
    },
    requester: {
      name: String(form.requesterName || "").trim(),
      email: String(form.requesterEmail || "").trim().toLowerCase(),
    },
    request: {
      classId: String(classEntry?.id || form.classId || "").trim(),
      className: String(classEntry?.name || "").trim(),
      scope,
      shows: selectedEvents.map(toVerificationShow),
      rider: String(form.rider || "").trim(),
      horse: String(form.horse || "").trim(),
      explanation: String(form.explanation || "").trim(),
    },
    currentStanding: matchedTeam ? toVerificationStanding(matchedTeam, selectedEvents) : null,
  };
}

export async function sendChampionshipVerificationRequestRepository(payload) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  try {
    const response = await supabase.functions.invoke(
      CHAMPIONSHIP_VERIFICATION_FUNCTION,
      {
        body: payload,
      }
    );

    if (response.error) throw response.error;

    return {
      ok: true,
      data: response.data || null,
    };
  } catch (error) {
    console.error("Erreur envoi demande verification championnat:", error);
    return {
      ok: false,
      reason: "send_failed",
      error,
    };
  }
}

export function findChampionshipVerificationTeam(classEntry, rider, horse) {
  const riderKey = normalizeSearchText(rider);
  const horseKey = normalizeSearchText(horse);

  if (!riderKey || !horseKey || !Array.isArray(classEntry?.teams)) {
    return null;
  }

  return (
    classEntry.teams.find(
      (team) =>
        normalizeSearchText(team.rider) === riderKey &&
        normalizeSearchText(team.horse) === horseKey
    ) ||
    classEntry.teams.find(
      (team) =>
        normalizeSearchText(team.rider).includes(riderKey) &&
        normalizeSearchText(team.horse).includes(horseKey)
    ) ||
    null
  );
}

function normalizeScope(scope) {
  return scope === CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON
    ? CHAMPIONSHIP_VERIFICATION_SCOPES.SEASON
    : CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS;
}

function normalizeShowKeys(showKeys) {
  return Array.from(
    new Set(
      (Array.isArray(showKeys) ? showKeys : [])
        .map((key) => String(key || "").trim())
        .filter(Boolean)
    )
  );
}

function toVerificationShow(event) {
  return {
    eventKey: event.eventKey || "",
    label: event.label || event.showName || event.showNum || "",
    showNum: event.showNum || "",
    showName: event.showName || "",
    classCode: event.classCode || "",
    className: event.className || "",
    goType: event.goType || "",
    goNum: event.goNum || "",
    resultCount: event.resultCount || 0,
  };
}

function toVerificationStanding(team, selectedEvents) {
  const selectedEventKeys = new Set(
    selectedEvents.map((event) => event.eventKey).filter(Boolean)
  );
  const details = (Array.isArray(team.details) ? team.details : []).filter(
    (detail) =>
      selectedEventKeys.size === 0 || selectedEventKeys.has(detail.eventKey)
  );

  return {
    rank: team.rank || null,
    rider: team.rider || "",
    horse: team.horse || "",
    totalPoints: formatChampionshipPoints(team.totalPoints),
    totalMoney: formatChampionshipMoney(team.totalMoney),
    details: details.map((detail) => ({
      eventKey: detail.eventKey || "",
      eventLabel: detail.eventLabel || detail.showName || detail.showNum || "",
      showNum: detail.showNum || "",
      showName: detail.showName || "",
      classCode: detail.classCode || "",
      className: detail.className || "",
      placeNum: detail.rawPlaceNum || detail.placeNum || "",
      totalScore: detail.rawTotalScore || detail.totalScore || "",
      points: formatChampionshipPoints(detail.points),
      moneyWon: formatChampionshipMoney(detail.moneyWon),
      sourceFileName: detail.sourceFileName || "",
      sourceRowNumber: detail.sourceRowNumber || "",
    })),
  };
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

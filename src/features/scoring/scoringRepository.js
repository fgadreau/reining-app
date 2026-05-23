import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  clearScoringData as clearScoringDataLocal,
  loadActiveManoeuvre as loadActiveManoeuvreLocal,
  loadScoringRuns as loadScoringRunsLocal,
  saveActiveManoeuvre as saveActiveManoeuvreLocal,
  saveScoringRuns as saveScoringRunsLocal,
} from "./scoringStorage";

function toScoringSession(row, classId) {
  return {
    classId,
    runs: Array.isArray(row?.runs) ? row.runs : [],
    activeManoeuvre:
      row?.active_manoeuvre && typeof row.active_manoeuvre === "object"
        ? row.active_manoeuvre
        : null,
    startedAt: row?.started_at || null,
  };
}

function getLocalScoringSession(classId) {
  return {
    classId,
    runs: loadScoringRunsLocal(classId),
    activeManoeuvre: loadActiveManoeuvreLocal(classId),
  };
}

async function upsertScoringSession(classId, updates = {}) {
  const supabase = getSupabaseClient();

  if (!supabase) return;

  try {
    const row = {
      class_id: classId,
    };

    if (updates.runs !== undefined) {
      row.runs = Array.isArray(updates.runs) ? updates.runs : [];
    }

    if (updates.activeManoeuvre !== undefined) {
      row.active_manoeuvre = updates.activeManoeuvre;
    }

    if (updates.startedAt !== undefined) {
      row.started_at = updates.startedAt;
    }

    const { error } = await supabase.from("scoring_sessions").upsert(row);

    if (error) throw error;
  } catch (error) {
    console.error("Erreur sauvegarde scoring Supabase:", error);
  }
}

export function loadScoringRuns(classId) {
  return loadScoringRunsLocal(classId);
}

export function saveScoringRuns(classId, runs) {
  saveScoringRunsLocal(classId, runs);
}

export function loadActiveManoeuvre(classId) {
  return loadActiveManoeuvreLocal(classId);
}

export function saveActiveManoeuvre(classId, activeManoeuvre) {
  saveActiveManoeuvreLocal(classId, activeManoeuvre);
}

export function clearScoringData(classId) {
  clearScoringDataLocal(classId);
}

export async function loadScoringSessionRepository(classId) {
  const localSession = getLocalScoringSession(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSession;
  }

  try {
    const { data, error } = await supabase
      .from("scoring_sessions")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localSession;

    const session = toScoringSession(data, classId);
    saveScoringRunsLocal(classId, session.runs);
    saveActiveManoeuvreLocal(classId, session.activeManoeuvre);
    return session;
  } catch (error) {
    console.error("Erreur chargement scoring Supabase:", error);
    return localSession;
  }
}

export async function loadScoringRunsRepository(classId) {
  const session = await loadScoringSessionRepository(classId);
  return session.runs;
}

export async function loadActiveManoeuvreRepository(classId) {
  const session = await loadScoringSessionRepository(classId);
  return session.activeManoeuvre;
}

export async function saveScoringRunsRepository(classId, runs) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  saveScoringRunsLocal(classId, normalizedRuns);
  await upsertScoringSession(classId, { runs: normalizedRuns });
  return normalizedRuns;
}

export async function saveScoringStartedAtRepository(classId, startedAt) {
  await upsertScoringSession(classId, { startedAt: startedAt || null });
}

export async function saveActiveManoeuvreRepository(classId, activeManoeuvre) {
  const normalizedActiveManoeuvre = activeManoeuvre ?? null;
  saveActiveManoeuvreLocal(classId, normalizedActiveManoeuvre);
  await upsertScoringSession(classId, {
    activeManoeuvre: normalizedActiveManoeuvre,
  });
  return normalizedActiveManoeuvre;
}

export async function clearScoringDataRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("scoring_sessions")
        .delete()
        .eq("class_id", classId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression scoring Supabase:", error);
    }
  }

  clearScoringDataLocal(classId);
}

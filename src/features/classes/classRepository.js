import {
  getAllClasses,
  getClassById,
  getClassesByDayId,
} from "./classSelectors";
import {
  createClass,
  deleteClass,
  saveClasses,
  updateClass,
} from "./classStorage";
import { getClassOfficialData } from "./classOfficialData";
import { getClassRecord } from "./classRecordStorage";
import { getOfficialResultRepository } from "./officialResultRepository";
import {
  getClassSetup,
  saveClassSetup,
} from "./classSetupStorage";
import {
  deleteClassSetupRepository,
  getClassSetupRepository,
  saveClassSetupRepository,
} from "./classSetupRepository";
import { getClassStatus } from "./classStatusSelectors";
import {
  loadScoringRuns,
  loadScoringSessionRepository,
} from "../scoring/scoringRepository";
import {
  loadJudgeScoringSessionsForClassLocal,
} from "../scoring/judgeScoringSessionStorage";
import {
  loadJudgeScoringSessionsForClassRepository,
} from "../scoring/judgeScoringSessionRepository";
import { normalizeClassJudges } from "./classJudges";
import {
  deletePublicationState,
  getPublicationState,
} from "../publication/publicationRepository";
import {
  deletePublicationStateRepository,
  getPublicationStateRepository,
  getPublicationStatesForClassesRepository,
} from "../publication/publicationCloudRepository";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { buildPatternTimingStats } from "./classTimeAnalytics";
import { MIN_MEASURED_RUN_SECONDS } from "./classTiming";
import { getPatternDisplayName } from "../patterns/patternDefinitions";

function toClass(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "",
    classCode: row.class_code || "",
    arena: row.arena || "",
    pattern: row.pattern || "",
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    judgeName: row.judge_name || "",
    sortOrder: row.sort_order || 1,
  };
}

function toClassRow(classItem, options = {}) {
  const includeCustomPattern = options.includeCustomPattern !== false;
  const row = {
    id: classItem.id,
    association_id: classItem.associationId,
    show_id: classItem.showId,
    day_id: classItem.dayId,
    name: classItem.name || "",
    class_code: classItem.classCode || "",
    arena: classItem.arena || "",
    pattern: classItem.pattern || "",
    judge_name: classItem.judgeName || "",
    sort_order: Number(classItem.sortOrder) || 1,
  };

  if (includeCustomPattern) {
    row.custom_pattern = classItem.customPattern || null;
  }

  return row;
}

function isCustomPatternColumnMissingError(error) {
  return String(error?.message || "").includes("custom_pattern");
}

function isArenaColumnMissingError(error) {
  return String(error?.message || "").includes("arena");
}

function saveClassLocally(classItem) {
  const exists = getAllClasses().some((item) => item.id === classItem.id);

  if (exists) {
    updateClass(classItem.id, classItem);
  } else {
    createClass(classItem);
  }

  return classItem;
}

function mergeClassesById(currentClasses, nextClasses) {
  const merged = new Map();
  currentClasses.forEach((classItem) => merged.set(classItem.id, classItem));
  nextClasses.forEach((classItem) => merged.set(classItem.id, classItem));
  return Array.from(merged.values());
}

async function buildTimingDataForClasses(classes) {
  return Promise.all(
    classes.map(async (classItem) => {
      const [setup, scoringSession] = await Promise.all([
        getClassSetupRepository(classItem.id),
        loadScoringSessionRepository(classItem.id),
      ]);

      return {
        classItem,
        setup,
        scoringRuns: scoringSession.runs,
        status: getClassStatus(classItem),
      };
    })
  );
}

export function getClassFullData(classId) {
  const classItem = getClassById(classId);
  const setup = getClassSetup(classId);
  const record = getClassRecord(classId);
  const official = getClassOfficialData(classId, classItem);
  const scoringRuns = loadScoringRuns(classId);
  const scoringSession = {
    classId,
    runs: scoringRuns,
    activeManoeuvre: null,
    updatedAt: getLatestRunActivityAt(scoringRuns),
  };
  const publication = getPublicationState(classId);
  const judges = normalizeClassJudges({
    judges: setup?.judges,
    judgeName: setup?.judgeName || classItem?.judgeName,
  });
  const judgeSessions =
    judges.length > 1
      ? loadJudgeScoringSessionsForClassLocal(classId, judges)
      : [];

  return {
    classItem,
    setup,
    record,
    official,
    publication,
    scoringSession,
    judges,
    judgeSessions,
    scoringRuns,
    status: official.isFinalized ? "completed" : getClassStatus(classItem),
  };
}

export function getClassesForDay(dayId) {
  return getClassesByDayId(dayId);
}

export async function getAccessibleClassTimingDataRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return buildTimingDataForClasses(getAllClasses());
  }

  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("pattern", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const classes = Array.isArray(data) ? data.map(toClass) : [];
    saveClasses(mergeClassesById(getAllClasses(), classes));

    return buildTimingDataForClasses(classes);
  } catch (error) {
    console.error("Erreur chargement analytics classes Supabase:", error);
    return buildTimingDataForClasses(getAllClasses());
  }
}

function toPatternTimingStat(row) {
  return {
    pattern: getPatternDisplayName(row.pattern) || row.pattern || "Sans pattern",
    classCount: Number(row.class_count) || 0,
    runCount: Number(row.run_count) || 0,
    timedRunCount: Number(row.timed_run_count) || 0,
    averageRunSeconds:
      row.average_run_seconds == null ? null : Number(row.average_run_seconds),
    medianRunSeconds:
      row.median_run_seconds == null ? null : Number(row.median_run_seconds),
  };
}

function mergePatternTimingStats(stats) {
  const groups = new Map();

  stats.forEach((stat) => {
    if (!groups.has(stat.pattern)) {
      groups.set(stat.pattern, {
        ...stat,
        averageWeight:
          stat.averageRunSeconds == null
            ? 0
            : stat.averageRunSeconds * stat.timedRunCount,
        medianWeight:
          stat.medianRunSeconds == null
            ? 0
            : stat.medianRunSeconds * stat.timedRunCount,
      });
      return;
    }

    const group = groups.get(stat.pattern);
    const currentTimedRunCount = group.timedRunCount;
    const nextTimedRunCount = stat.timedRunCount;
    const totalTimedRunCount = currentTimedRunCount + nextTimedRunCount;

    group.classCount += stat.classCount;
    group.runCount += stat.runCount;
    group.timedRunCount = totalTimedRunCount;

    if (stat.averageRunSeconds != null) {
      group.averageWeight += stat.averageRunSeconds * nextTimedRunCount;
    }

    if (stat.medianRunSeconds != null) {
      group.medianWeight += stat.medianRunSeconds * nextTimedRunCount;
    }

    group.averageRunSeconds =
      totalTimedRunCount > 0 ? group.averageWeight / totalTimedRunCount : null;
    group.medianRunSeconds =
      totalTimedRunCount > 0 ? group.medianWeight / totalTimedRunCount : null;
  });

  return Array.from(groups.values())
    .map(({ averageWeight, medianWeight, ...stat }) => stat)
    .sort((a, b) => String(a.pattern).localeCompare(String(b.pattern)));
}

export async function getGlobalPatternTimingStatsRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return buildPatternTimingStats(await buildTimingDataForClasses(getAllClasses()));
  }

  try {
    const { data, error } = await supabase.rpc("global_pattern_timing_stats", {
      min_duration_seconds: MIN_MEASURED_RUN_SECONDS,
    });

    if (error) throw error;

    return Array.isArray(data)
      ? mergePatternTimingStats(data.map(toPatternTimingStat))
      : [];
  } catch (error) {
    console.error("Erreur chargement stats globales par pattern:", error);
    const accessibleClassRows = await getAccessibleClassTimingDataRepository();
    return buildPatternTimingStats(accessibleClassRows);
  }
}

export async function getClassFullDataRepository(classId) {
  const classItem = getClassById(classId);
  const [setup, publication] = await Promise.all([
    getClassSetupRepository(classId),
    getPublicationStateRepository(classId),
  ]);
  const record = getClassRecord(classId);
  const officialResult = await getOfficialResultRepository(classId);
  const official = getClassOfficialData(classId, classItem, officialResult);
  const scoringSession = await loadScoringSessionRepository(classId);
  const judges = normalizeClassJudges({
    judges: setup?.judges,
    judgeName: setup?.judgeName || classItem?.judgeName,
  });
  const judgeSessions =
    judges.length > 1
      ? await loadJudgeScoringSessionsForClassRepository(classId, judges)
      : [];

  return {
    classItem,
    setup,
    record,
    official,
    publication,
    scoringSession,
    judges,
    judgeSessions,
    scoringRuns: scoringSession.runs,
    status: official.isFinalized ? "completed" : getClassStatus(classItem),
  };
}

function getLatestRunActivityAt(runs) {
  const timestamps = (Array.isArray(runs) ? runs : [])
    .map((run) => run?.completedAt || run?.startedAt || null)
    .filter(Boolean)
    .sort();

  return timestamps[timestamps.length - 1] || null;
}

export async function getClassesForDayRepository(dayId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getClassesByDayId(dayId);
  }

  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("day_id", dayId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const classes = Array.isArray(data) ? data.map(toClass) : [];
    const otherLocalClasses = getAllClasses().filter(
      (classItem) => classItem.dayId !== dayId
    );
    saveClasses([...otherLocalClasses, ...classes]);
    await Promise.all(
      classes.flatMap((classItem) => [
        getClassSetupRepository(classItem.id),
        getOfficialResultRepository(classItem.id),
      ])
    );
    await getPublicationStatesForClassesRepository(
      classes.map((classItem) => classItem.id)
    );

    return classes;
  } catch (error) {
    console.error("Erreur chargement classes Supabase:", error);
    return getClassesByDayId(dayId);
  }
}

export function createClassItem(newClass) {
  createClass(newClass);
  return newClass;
}

export async function saveClassItemRepository(classItem) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("classes").upsert(toClassRow(classItem));
      if (error) throw error;
    } catch (error) {
      if (isCustomPatternColumnMissingError(error) || isArenaColumnMissingError(error)) {
        try {
          const legacyRow = toClassRow(classItem, {
            includeCustomPattern: !isCustomPatternColumnMissingError(error),
          });
          delete legacyRow.arena;

          const { error: legacyError } = await supabase
            .from("classes")
            .upsert(legacyRow);

          if (legacyError) throw legacyError;
          return saveClassLocally(classItem);
        } catch (legacyError) {
          console.error("Erreur sauvegarde classe Supabase:", legacyError);
          return saveClassLocally(classItem);
        }
      }

      console.error("Erreur sauvegarde classe Supabase:", error);
    }
  }

  return saveClassLocally(classItem);
}

export function updateClassItem(classId, updates) {
  updateClass(classId, updates);
}

export function saveSetupForClass(classId, setup) {
  saveClassSetup(classId, setup);
}

export function saveSetupForClassRepository(classId, setup) {
  return saveClassSetupRepository(classId, setup);
}

export function deleteClassCompletely(classId) {
  deleteClass(classId);
  deletePublicationState(classId);
}

export async function deleteClassCompletelyRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression classe Supabase:", error);
    }
  }

  await deleteClassSetupRepository(classId);
  await deletePublicationStateRepository(classId);
  deleteClass(classId);
}

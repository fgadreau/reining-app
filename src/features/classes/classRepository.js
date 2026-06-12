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
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { buildPatternTimingStats } from "./classTimeAnalytics";
import { MIN_MEASURED_RUN_SECONDS } from "./classTiming";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  normalizeClassScheduleStart,
} from "./classSchedule";
import { getPatternDisplayName } from "../patterns/patternDefinitions";

function toClass(row) {
  const scheduleStart = normalizeClassScheduleStart({
    startMode: row.schedule_start_mode,
    startTime: row.schedule_start_time || row.scheduled_time,
  });

  return {
    id: row.id,
    associationId: row.organization_id || row.association_id,
    showId: row.show_id,
    dayId: row.show_day_id || row.day_id,
    name: row.name || "",
    classCode: row.code || row.class_code || "",
    arena: row.arena || "",
    pattern: row.pattern || "",
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    scheduleStartMode: scheduleStart.startMode,
    scheduleStartTime: scheduleStart.startTime,
    isEventBlock: Boolean(row.is_event_block),
    judgeName: row.judge_name || "",
    sortOrder: row.sort_order || 1,
    updatedAt: row.updated_at || null,
  };
}

function toClassRow(classItem, options = {}) {
  const includeCustomPattern = options.includeCustomPattern !== false;
  const includeScheduleStart = options.includeScheduleStart !== false;
  const includeArena = options.includeArena !== false;
  const scheduleStart = normalizeClassScheduleStart(classItem);
  const row = {
    id: classItem.id,
    organization_id: classItem.associationId,
    show_id: classItem.showId,
    show_day_id: classItem.dayId,
    name: classItem.name || "",
    code: classItem.classCode || "",
    pattern: classItem.pattern || "",
    judge_name: classItem.judgeName || "",
    sort_order: Number(classItem.sortOrder) || 1,
  };

  if (includeArena) {
    row.arena = classItem.arena || "";
  }

  if (includeCustomPattern) {
    row.custom_pattern = classItem.customPattern || null;
  }

  if (includeScheduleStart) {
    row.schedule_start_mode =
      scheduleStart.startMode || CLASS_START_MODE_AFTER_PREVIOUS;
    row.scheduled_time = scheduleStart.startTime || null;
  }

  return row;
}

function getSupabaseErrorText(error) {
  return [error?.message, error?.details, error?.hint]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function isScoringClass(classItem) {
  return !classItem?.isEventBlock;
}

function isCustomPatternColumnMissingError(error) {
  return getSupabaseErrorText(error).includes("custom_pattern");
}

function isArenaColumnMissingError(error) {
  return getSupabaseErrorText(error).includes("arena");
}

function isScheduleStartColumnMissingError(error) {
  const message = getSupabaseErrorText(error);
  return (
    message.includes("schedule_start_mode") ||
    message.includes("schedule_start_time") ||
    message.includes("scheduled_time")
  );
}

function isEventBlockColumnMissingError(error) {
  return getSupabaseErrorText(error).includes("is_event_block");
}

function saveClassLocally(classItem) {
  if (!isScoringClass(classItem)) {
    return classItem;
  }

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

export function buildClassWithSetupScheduleStart(classItem, setup) {
  if (!classItem) return classItem;

  const scheduleStart = normalizeClassScheduleStart({
    ...classItem,
    ...setup?.scheduleDetails,
  });

  if (
    String(classItem.scheduleStartMode || "") ===
      String(scheduleStart.startMode || "") &&
    String(classItem.scheduleStartTime || "") ===
      String(scheduleStart.startTime || "")
  ) {
    return classItem;
  }

  return {
    ...classItem,
    scheduleStartMode: scheduleStart.startMode,
    scheduleStartTime: scheduleStart.startTime,
  };
}

async function upsertClassRowWithColumnFallback(supabase, classItem) {
  const options = {
    includeCustomPattern: true,
    includeScheduleStart: true,
    includeArena: true,
  };
  let lastError = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const { error } = await supabase.from("classes").upsert(toClassRow(classItem, options));

      if (error) throw error;
      return;
    } catch (error) {
      lastError = error;

      if (isCustomPatternColumnMissingError(error) && options.includeCustomPattern) {
        options.includeCustomPattern = false;
        continue;
      }

      if (isArenaColumnMissingError(error) && options.includeArena) {
        options.includeArena = false;
        continue;
      }

      if (
        isScheduleStartColumnMissingError(error) &&
        options.includeScheduleStart
      ) {
        options.includeScheduleStart = false;
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function syncClassScheduleStartFromSetupRepository(classItem, setup) {
  const nextClass = buildClassWithSetupScheduleStart(classItem, setup);

  if (!nextClass || nextClass === classItem) {
    return classItem;
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      await upsertClassRowWithColumnFallback(supabase, nextClass);
    } catch (error) {
      console.error("Erreur resynchronisation horaire bloc Supabase:", error);
    }
  }

  return saveClassLocally(nextClass);
}

async function buildTimingDataForClasses(classes) {
  return Promise.all(
    classes.filter(isScoringClass).map(async (classItem) => {
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
    let result = await supabase
      .from("classes")
      .select("*")
      .eq("is_event_block", false)
      .order("pattern", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (result.error && isEventBlockColumnMissingError(result.error)) {
      result = await supabase
        .from("classes")
        .select("*")
        .order("pattern", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
    }

    if (result.error) throw result.error;

    const classes = Array.isArray(result.data)
      ? result.data.map(toClass).filter(isScoringClass)
      : [];
    saveClasses(mergeClassesById(getAllClasses(), classes));

    return buildTimingDataForClasses(classes);
  } catch (error) {
    console.error("Erreur chargement analytics blocs Supabase:", error);
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
    let result = await supabase
      .from("classes")
      .select("*")
      .eq("show_day_id", dayId)
      .eq("is_event_block", false)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (result.error && isEventBlockColumnMissingError(result.error)) {
      result = await supabase
        .from("classes")
        .select("*")
        .eq("show_day_id", dayId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
    }

    if (result.error) throw result.error;

    const classes = Array.isArray(result.data)
      ? result.data.map(toClass).filter(isScoringClass)
      : [];
    const otherLocalClasses = getAllClasses().filter(
      (classItem) => classItem.dayId !== dayId
    );
    saveClasses([...otherLocalClasses, ...classes]);
    const classesWithSetups = await Promise.all(
      classes.map(async (classItem) => {
        const [setup] = await Promise.all([
          getClassSetupRepository(classItem.id),
          getOfficialResultRepository(classItem.id),
        ]);

        return {
          classItem,
          setup,
        };
      })
    );
    const syncedClasses = await Promise.all(
      classesWithSetups.map(({ classItem, setup }) =>
        syncClassScheduleStartFromSetupRepository(classItem, setup)
      )
    );
    saveClasses([...otherLocalClasses, ...syncedClasses]);
    await getPublicationStatesForClassesRepository(
      syncedClasses.map((classItem) => classItem.id)
    );

    return syncedClasses;
  } catch (error) {
    console.error("Erreur chargement blocs Supabase:", error);
    return getClassesByDayId(dayId);
  }
}

export function createClassItem(newClass) {
  createClass(newClass);
  return newClass;
}

export async function saveClassItemRepository(classItem) {
  const supabase = getSupabaseClient();
  const isExistingClass = Boolean(getClassById(classItem.id));

  if (supabase) {
    try {
      await upsertClassRowWithColumnFallback(supabase, classItem);
    } catch (error) {
      console.error("Erreur sauvegarde bloc Supabase:", error);
    }
  }

  const savedClass = saveClassLocally(classItem);
  trackClassSaveEvent(savedClass, isExistingClass);
  return savedClass;
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
  const existingClass = getClassById(classId);

  if (supabase) {
    try {
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression bloc Supabase:", error);
    }
  }

  await deleteClassSetupRepository(classId);
  await deletePublicationStateRepository(classId);
  deleteClass(classId);

  trackEvent({
    eventName: "class_deleted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: existingClass?.associationId,
    showId: existingClass?.showId,
    dayId: existingClass?.dayId,
    classId,
    metadata: {
      name: existingClass?.name || "",
      classCode: existingClass?.classCode || "",
    },
  });
}

function trackClassSaveEvent(classItem, isExistingClass) {
  trackEvent({
    eventName: isExistingClass ? "class_updated" : "class_created",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: classItem.associationId,
    showId: classItem.showId,
    dayId: classItem.dayId,
    classId: classItem.id,
    metadata: {
      name: classItem.name,
      classCode: classItem.classCode,
      pattern: classItem.pattern,
    },
  });
}

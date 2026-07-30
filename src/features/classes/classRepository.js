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
import {
  getOfficialResultRepository,
  getOfficialResultsForClassesRepository,
} from "./officialResultRepository";
import {
  getClassSetup,
  saveClassSetup,
} from "./classSetupStorage";
import {
  deleteClassSetupRepository,
  getClassSetupRepository,
  getClassSetupsForClassesRepository,
  saveClassSetupRepository,
} from "./classSetupRepository";
import { getClassStatus } from "./classStatusSelectors";
import {
  loadScoringRuns,
  loadScoringSessionRepository,
  loadScoringSessionsForClassesRepository,
} from "../scoring/scoringRepository";
import {
  loadJudgeScoringSessionsForClassLocal,
} from "../scoring/judgeScoringSessionStorage";
import {
  loadJudgeScoringSessionsForClassRepository,
  loadJudgeScoringSessionsForClassesRepository,
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
import {
  getAnnouncerLiveSession,
  getAnnouncerLiveSessionRepository,
  getAnnouncerLiveSessionsForClassesRepository,
} from "../live/announcerLiveRepository";

function toClass(row) {
  const scheduleStart = normalizeClassScheduleStart({
    startMode: row.schedule_start_mode,
    startTime: row.schedule_start_time || row.scheduled_time,
  });
  const eligibilityRules =
    row.eligibility_rules &&
    typeof row.eligibility_rules === "object" &&
    !Array.isArray(row.eligibility_rules)
      ? row.eligibility_rules
      : {};

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
    eligibilityRules,
    concurrentClassId:
      typeof eligibilityRules.concurrent_class_id === "string"
        ? eligibilityRules.concurrent_class_id
        : "",
    concurrentGroupLabel:
      typeof eligibilityRules.concurrent_group_label === "string"
        ? eligibilityRules.concurrent_group_label
        : "",
    scoringGroupId:
      row.scoring_group_id ||
      (typeof eligibilityRules.scoring_group_id === "string"
        ? eligibilityRules.scoring_group_id
        : ""),
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
  const announcerSession = getAnnouncerLiveSession(classId, setup?.runs);
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
    announcerSession,
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
  const [scoringSession, announcerSession] = await Promise.all([
    loadScoringSessionRepository(classId),
    getAnnouncerLiveSessionRepository(classId, setup?.runs),
  ]);
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
    announcerSession,
    judges,
    judgeSessions,
    scoringRuns: scoringSession.runs,
    status: official.isFinalized ? "completed" : getClassStatus(classItem),
  };
}

export async function getClassFullDataForClassesRepository(classItems) {
  const uniqueClasses = Array.from(
    new Map(
      (Array.isArray(classItems) ? classItems : [])
        .filter((classItem) => classItem?.id)
        .map((classItem) => [classItem.id, classItem])
    ).values()
  );
  const classIds = uniqueClasses.map((classItem) => classItem.id);

  if (classIds.length === 0) {
    return {};
  }

  const [
    setupsByClassId,
    publicationsByClassId,
    officialResultsByClassId,
    scoringSessionsByClassId,
  ] = await Promise.all([
    getClassSetupsForClassesRepository(classIds),
    getPublicationStatesForClassesRepository(classIds),
    getOfficialResultsForClassesRepository(classIds),
    loadScoringSessionsForClassesRepository(classIds),
  ]);
  const syncedClasses = await Promise.all(
    uniqueClasses.map((classItem) =>
      syncClassScheduleStartFromSetupRepository(
        classItem,
        setupsByClassId[classItem.id]
      )
    )
  );
  saveClasses(mergeClassesById(getAllClasses(), syncedClasses));

  const setupRunsByClassId = classIds.reduce((runs, classId) => {
    runs[classId] = setupsByClassId[classId]?.runs || [];
    return runs;
  }, {});
  const judgesByClassId = syncedClasses.reduce((judges, classItem) => {
    const setup = setupsByClassId[classItem.id];
    const normalizedJudges = normalizeClassJudges({
      judges: setup?.judges,
      judgeName: setup?.judgeName || classItem?.judgeName,
    });

    if (normalizedJudges.length > 1) {
      judges[classItem.id] = normalizedJudges;
    }

    return judges;
  }, {});
  const [
    announcerSessionsByClassId,
    judgeSessionsByClassId,
  ] = await Promise.all([
    getAnnouncerLiveSessionsForClassesRepository(
      classIds,
      setupRunsByClassId
    ),
    loadJudgeScoringSessionsForClassesRepository(judgesByClassId),
  ]);

  return syncedClasses.reduce((result, classItem) => {
    const classId = classItem.id;
    const setup = setupsByClassId[classId];
    const officialResult = officialResultsByClassId[classId];
    const official = getClassOfficialData(
      classId,
      classItem,
      officialResult
    );
    const scoringSession = scoringSessionsByClassId[classId] || {
      classId,
      runs: [],
      activeManoeuvre: null,
    };
    const judges = normalizeClassJudges({
      judges: setup?.judges,
      judgeName: setup?.judgeName || classItem?.judgeName,
    });

    result[classId] = {
      classItem,
      setup,
      record: getClassRecord(classId),
      official,
      publication: publicationsByClassId[classId],
      scoringSession,
      announcerSession: announcerSessionsByClassId[classId],
      judges,
      judgeSessions: judgeSessionsByClassId[classId] || [],
      scoringRuns: scoringSession.runs,
      status: official.isFinalized ? "completed" : getClassStatus(classItem),
    };

    return result;
  }, {});
}

function getLatestRunActivityAt(runs) {
  const timestamps = (Array.isArray(runs) ? runs : [])
    .map((run) => run?.completedAt || run?.startedAt || null)
    .filter(Boolean)
    .sort();

  return timestamps[timestamps.length - 1] || null;
}

export async function getClassesForDayDataRepository(
  dayId,
  { hydrateDetails = true } = {}
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const classes = getClassesByDayId(dayId);
    const setupsByClassId = classes.reduce((setups, classItem) => {
      setups[classItem.id] = getClassSetup(classItem.id);
      return setups;
    }, {});

    return {
      classes,
      setupsByClassId,
      officialResultsByClassId: {},
      publicationsByClassId: {},
    };
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

    if (!hydrateDetails) {
      return {
        classes,
        setupsByClassId: {},
        officialResultsByClassId: {},
        publicationsByClassId: {},
      };
    }

    const classIds = classes.map((classItem) => classItem.id);
    const [
      setupsByClassId,
      officialResultsByClassId,
      publicationsByClassId,
    ] = await Promise.all([
      getClassSetupsForClassesRepository(classIds),
      getOfficialResultsForClassesRepository(classIds),
      getPublicationStatesForClassesRepository(classIds),
    ]);
    const syncedClasses = await Promise.all(
      classes.map((classItem) =>
        syncClassScheduleStartFromSetupRepository(
          classItem,
          setupsByClassId[classItem.id]
        )
      )
    );
    saveClasses([...otherLocalClasses, ...syncedClasses]);

    return {
      classes: syncedClasses,
      setupsByClassId,
      officialResultsByClassId,
      publicationsByClassId,
    };
  } catch (error) {
    console.error("Erreur chargement blocs Supabase:", error);
    const classes = getClassesByDayId(dayId);
    const setupsByClassId = classes.reduce((setups, classItem) => {
      setups[classItem.id] = getClassSetup(classItem.id);
      return setups;
    }, {});

    return {
      classes,
      setupsByClassId,
      officialResultsByClassId: {},
      publicationsByClassId: {},
    };
  }
}

export async function getClassesForDayRepository(dayId, options) {
  const data = await getClassesForDayDataRepository(dayId, options);
  return data.classes;
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

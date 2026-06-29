import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
} from "../classes/classRepository";
import { loadAssociations } from "../associations/associationsData";
import { normalizeSponsorLogos } from "../associations/sponsorLogos";
import { getShowsByAssociationId, getShowById } from "../shows/showSelectors";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import { getPaidWarmupsByDayId } from "../paidWarmups/paidWarmupStorage";
import { buildPaidWarmupLiveView } from "../paidWarmups/paidWarmupLive";
import { hasPublicLivestream } from "../livestream/livestreamEmbed";
import {
  formatScoreValue,
  formatTotalValue,
  isScoredRunComplete,
  parseScoreTotalValue,
} from "../../utils/scoring";
import {
  buildClassTimingRow,
  buildPatternTimingStats,
  getClassPatternValue,
} from "../classes/classTimeAnalytics";
import {
  buildShowScheduleSections,
  buildShowSchedulePreviewSections,
  countScheduleItems,
} from "../schedule/showSchedule";
import {
  LIVE_SCHEDULE_ITEM_TYPES,
  buildLiveScheduleItems,
  findFirstPendingPaidWarmupBeforeItem,
  findNextScheduleItemInArena,
  findScheduleItem,
  getScheduleArenaKey,
  isPaidWarmupScheduleLiveEligible,
  toPublicScheduleItem,
} from "../schedule/liveSchedule";
import {
  LIVE_QUEUE_ITEM_TYPES,
  buildLiveQueueItems,
  getLiveDragItemId,
} from "../live/liveQueueItems";
import {
  compareScheduleItemsByStart,
  hasClassScheduleDetails,
  normalizeClassScheduleDetails,
} from "../classes/classSchedule";
import { MIN_MEASURED_RUN_SECONDS } from "../classes/classTiming";
import {
  getPatternDisplayName,
  getPatternHeaders,
  getPatternManeuverDescription,
  isNoPatternValue,
} from "../patterns/patternDefinitions";
import { normalizeJudgeScoringSession } from "../scoring/judgeScoringSessionStorage";
import {
  buildMultiJudgeLiveRuns,
  getMultiJudgeLiveUpdatedAt,
  hasMultiJudgeLiveSetup,
} from "../scoring/multiJudgeLiveData";
import {
  RESULT_PUBLICATION_STATUSES,
  getClassResultPublication,
  getResultPublicationsForClassesRepository,
} from "../results/resultPublicationRepository";
import { normalizeResultGroups } from "../results/classResults";
import { buildLiveClassStandings } from "../results/liveClassStandings";
import {
  LIVE_SCORE_DISPLAY_MODES,
  PUBLICATION_STATUSES,
  getLiveScoreDisplayMode,
  isLivePublicationStatus,
} from "./publicationRepository";

function toAssociation(row) {
  return {
    id: row.id,
    name: row.name || "",
    shortName: row.short_name || "",
    timezone: row.timezone || "",
    logoDataUrl: row.logo_url || null,
    websiteUrl: row.website_url || "",
    sponsorLogos: normalizeSponsorLogos(row.sponsor_logos),
  };
}

function toShow(row) {
  const status =
    row.status === "open"
      ? "active"
      : row.status === "closed"
        ? "completed"
        : row.status || "draft";

  return {
    id: row.id,
    associationId: row.organization_id || row.association_id,
    name: row.name || "",
    venue: row.venue || "",
    location: row.location || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status,
    livestreamUrl: row.livestream_url || "",
    isLivestreamPublic: Boolean(row.is_livestream_public),
    isSchedulePublic: Boolean(
      row.is_public || row.is_schedule_public || row.show_schedule_public
    ),
  };
}

function isShowPubliclyActive(show) {
  return String(show?.status || "").trim() === "active";
}

function buildEmptyPublicShowView() {
  return {
    sections: [],
    resultSections: [],
    publishedClassCount: 0,
    publishedResultClassCount: 0,
    liveClass: null,
    liveClasses: [],
    livePaidWarmup: null,
    livePaidWarmups: [],
    liveClassCount: 0,
    scheduleSections: [],
    scheduleItemCount: 0,
    classIds: [],
  };
}

function toDay(row) {
  return {
    id: row.id,
    associationId: row.organization_id,
    showId: row.show_id,
    label: row.day_name || "",
    date: row.day_date || "",
    sortOrder: row.sort_order || 1,
  };
}

function toClass(row) {
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
    scheduleStartMode: row.schedule_start_mode || "",
    scheduleStartTime: row.schedule_start_time || row.scheduled_time || "",
    judgeName: row.judge_name || "",
    sortOrder: row.sort_order || 1,
    isEventBlock: Boolean(row.is_event_block),
  };
}

function getSupabaseErrorText(error) {
  return [error?.message, error?.details, error?.hint]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function isEventBlockColumnMissingError(error) {
  return getSupabaseErrorText(error).includes("is_event_block");
}

async function fetchPublicClassesForDay(supabase, dayId) {
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

  return result;
}

function toPublicationState(row) {
  return {
    classId: row.class_id,
    status: row.status || PUBLICATION_STATUSES.HIDDEN,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    publicUrl: row.public_url || null,
  };
}

function toResultPublication(row) {
  return {
    classId: row.class_id,
    status: row.status || RESULT_PUBLICATION_STATUSES.HIDDEN,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    resultGroups: normalizeResultGroups(row.result_groups),
  };
}

function toOfficialResult(row) {
  return {
    classId: row.class_id,
    judgeName: row.judge_name || "",
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeSignedAt: row.judge_signed_at || null,
    secretariatValidatedAt: row.secretariat_validated_at || null,
    isFinalized: Boolean(row.finalized),
    isSecretariatValidated: Boolean(row.secretariat_validated_at),
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    officialRuns: Array.isArray(row.official_runs) ? row.official_runs : [],
  };
}

function toScoringSession(row) {
  return {
    classId: row.class_id,
    runs: Array.isArray(row.runs) ? row.runs : [],
    activeManoeuvre:
      row.active_manoeuvre && typeof row.active_manoeuvre === "object"
        ? row.active_manoeuvre
        : null,
    updatedAt: row.updated_at || null,
  };
}

function toClassSetup(row) {
  return {
    classId: row.class_id,
    pattern: row.pattern || "",
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    runs: Array.isArray(row.runs) ? row.runs : [],
    scheduleDetails: normalizeClassScheduleDetails(row.schedule_details),
    judges: Array.isArray(row.judges) ? row.judges : [],
    blockClasses: Array.isArray(row.block_classes) ? row.block_classes : [],
    dragInterval: row.drag_interval || null,
    dragDurationMinutes: row.drag_duration_minutes,
    updatedAt: row.updated_at || null,
  };
}

function toJudgeScoringSession(row) {
  return normalizeJudgeScoringSession({
    classId: row.class_id,
    judgeId: row.judge_id,
    judgeName: row.judge_name || "",
    claimedBy: row.claimed_by || null,
    claimedByEmail: row.claimed_by_email || null,
    claimedAt: row.claimed_at || null,
    runs: Array.isArray(row.runs) ? row.runs : [],
    activeManoeuvre:
      row.active_manoeuvre && typeof row.active_manoeuvre === "object"
        ? row.active_manoeuvre
        : null,
    judgeSignature: row.judge_signature || null,
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeSignedAt: row.judge_signed_at || null,
    updatedAt: row.updated_at || null,
  });
}

function toPaidWarmup(row) {
  return {
    id: row.id,
    associationId: row.organization_id || row.association_id,
    showId: row.show_id,
    dayId: row.show_day_id || row.day_id,
    name: row.name || "",
    arena: row.arena || "",
    durationMinutesPerRider: row.duration_minutes_per_rider,
    dragInterval: row.drag_interval,
    dragDurationMinutes: row.drag_duration_minutes,
    scheduleStartMode: row.schedule_start_mode || "",
    scheduleStartTime: row.schedule_start_time || row.scheduled_time || "",
    isPublicLive: Boolean(row.is_public_live),
    activeEntryId: row.active_entry_id || null,
    activeStartedAt: row.active_started_at || null,
    entries: Array.isArray(row.entries) ? row.entries : [],
    sortOrder: row.sort_order || 1,
    updatedAt: row.updated_at || null,
  };
}

export function getPublicShowView(showId) {
  const show = getShowById(showId);
  if (!isShowPubliclyActive(show)) {
    return buildEmptyPublicShowView();
  }

  const liveClasses = [];
  const livePaidWarmups = [];
  const classIds = [];
  const timingSections = [];
  const sections = getDaysByShowId(showId).map((day) => {
    const classRows = [];
    const resultClasses = [];
    const paidWarmups = getPaidWarmupsByDayId(day.id);
    paidWarmups
      .filter(isPaidWarmupScheduleLiveEligible)
      .forEach((warmup) => {
        livePaidWarmups.push(buildPaidWarmupLiveView(warmup));
      });
    const classViews = getClassesForDay(day.id).map((classItem) => {
      if (classItem.id) {
        classIds.push(classItem.id);
      }
      resultClasses.push(
        ...buildPublicResultClassViews({
          classItem,
          resultPublication: getClassResultPublication(classItem.id),
        })
      );

      const classData = getClassFullData(classItem.id);
      classRows.push(classData);
      const liveClass = buildPublicLiveClassView({
        classItem: classData.classItem,
        setup: classData.setup,
        publication: classData.publication,
        scoringSession: classData.scoringSession,
        judgeSessions: classData.judgeSessions,
      });

      if (liveClass) {
        liveClasses.push(liveClass);
      }

      return buildPublicClassView(classData);
    });
    timingSections.push({ day, classRows, paidWarmups });

    return {
      day,
      classes: classViews.filter(Boolean),
      resultClasses,
    };
  });

  const resultSections = sections
    .map((section) => ({
      day: section.day,
      classes: section.resultClasses,
    }))
    .filter((section) => section.classes.length > 0);
  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const publishedResultClassCount = resultSections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const primaryLiveClasses = findPrimaryLiveClassesByArena(liveClasses);
  const timingByClassId = buildLocalPublicTimingByClassId(
    timingSections,
    primaryLiveClasses
  );
  const liveState = buildResolvedPublicLiveState({
    timingSections,
    liveClasses: primaryLiveClasses,
    livePaidWarmups,
    timingByClassId,
  });
  const scheduleSections = show?.isSchedulePublic
    ? buildShowSchedulePreviewSections({ daySections: timingSections })
    : [];

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    resultSections,
    publishedClassCount,
    publishedResultClassCount,
    liveClass: liveState.liveClasses[0] || null,
    liveClasses: liveState.liveClasses,
    livePaidWarmup: liveState.livePaidWarmups[0] || null,
    livePaidWarmups: liveState.livePaidWarmups,
    liveClassCount: liveState.liveClasses.length + liveState.livePaidWarmups.length,
    scheduleSections,
    scheduleItemCount: countScheduleItems(scheduleSections),
    classIds,
  };
}

export async function getPublicShowViewRepository(showId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    return getPublicShowViewFromSupabase(showId, supabase);
  }

  const show = getShowById(showId);
  if (!isShowPubliclyActive(show)) {
    return buildEmptyPublicShowView();
  }

  const sections = await Promise.all(
    (await getDaysByShowRepository(showId)).map(async (day) => {
      const paidWarmups = getPaidWarmupsByDayId(day.id);
      const livePaidWarmups = paidWarmups
        .filter(isPaidWarmupScheduleLiveEligible)
        .map((warmup) => buildPaidWarmupLiveView(warmup));
      const classes = getClassesForDay(day.id);
      const resultPublicationsByClassId =
        await getResultPublicationsForClassesRepository(
          classes.map((classItem) => classItem.id)
        );
      const classEntries = await Promise.all(
        classes.map(async (classItem) => {
          const resultClasses = buildPublicResultClassViews({
            classItem,
            resultPublication: resultPublicationsByClassId[classItem.id],
          });
          const classData = await getClassFullDataRepository(classItem.id);
          const liveClass = buildPublicLiveClassView({
            classItem: classData.classItem,
            setup: classData.setup,
            publication: classData.publication,
            scoringSession: classData.scoringSession,
            judgeSessions: classData.judgeSessions,
          });

          return {
            classId: classItem.id || null,
            classRow: classData,
            classView: buildPublicClassView(classData),
            resultClasses,
            liveClass,
          };
        })
      );

      return {
        day,
        classes: classEntries.map((entry) => entry.classView).filter(Boolean),
        resultClasses: classEntries.flatMap((entry) => entry.resultClasses),
        timingSection: {
          day,
          classRows: classEntries.map((entry) => entry.classRow),
          paidWarmups,
        },
        liveClasses: classEntries
          .map((entry) => entry.liveClass)
          .filter(Boolean),
        livePaidWarmups,
        classIds: classEntries.map((entry) => entry.classId).filter(Boolean),
      };
    })
  );
  const timingSections = sections.map((section) => section.timingSection);
  const liveClasses = sections.flatMap((section) => section.liveClasses || []);
  const livePaidWarmups = sections.flatMap(
    (section) => section.livePaidWarmups || []
  );
  const classIds = sections.flatMap((section) => section.classIds || []);

  const resultSections = sections
    .map((section) => ({
      day: section.day,
      classes: section.resultClasses,
    }))
    .filter((section) => section.classes.length > 0);
  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const publishedResultClassCount = resultSections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const primaryLiveClasses = findPrimaryLiveClassesByArena(liveClasses);
  const timingByClassId = buildLocalPublicTimingByClassId(
    timingSections,
    primaryLiveClasses
  );
  const liveState = buildResolvedPublicLiveState({
    timingSections,
    liveClasses: primaryLiveClasses,
    livePaidWarmups,
    timingByClassId,
  });
  const scheduleSections = show?.isSchedulePublic
    ? buildShowSchedulePreviewSections({ daySections: timingSections })
    : [];

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    resultSections,
    publishedClassCount,
    publishedResultClassCount,
    liveClass: liveState.liveClasses[0] || null,
    liveClasses: liveState.liveClasses,
    livePaidWarmup: liveState.livePaidWarmups[0] || null,
    livePaidWarmups: liveState.livePaidWarmups,
    liveClassCount: liveState.liveClasses.length + liveState.livePaidWarmups.length,
    scheduleSections,
    scheduleItemCount: countScheduleItems(scheduleSections),
    classIds,
  };
}

export function subscribePublicShowViewRepository(showId, classIds, onChange) {
  const supabase = getSupabaseClient();

  if (!supabase || typeof onChange !== "function") {
    return () => {};
  }

  const uniqueClassIds = Array.from(
    new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))
  );
  const channel = supabase.channel(`public-show:${showId}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "shows",
      filter: `id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "show_days",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "classes",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "show_score_paid_warmups",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "show_score_publication_states",
    },
    onChange
  );

  uniqueClassIds.forEach((classId) => {
    [
      "show_score_official_results",
      "class_result_publications",
      "show_score_scoring_sessions",
      "show_score_judge_sessions",
      "show_score_class_setups",
    ].forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `class_id=eq.${classId}`,
        },
        onChange
      );
    });
  });

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR") {
      console.error("Erreur abonnement temps réel résultats publics Supabase.");
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

async function getPublicShowViewFromSupabase(showId, supabase) {
  try {
    const { data: showRow, error: showError } = await supabase
      .from("shows")
      .select("*")
      .eq("id", showId)
      .maybeSingle();
    if (showError) throw showError;
    const show = showRow ? toShow(showRow) : null;
    if (!isShowPubliclyActive(show)) {
      return buildEmptyPublicShowView();
    }

    const { data: dayRows, error: daysError } = await supabase
      .from("show_days")
      .select("*")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true })
      .order("day_date", { ascending: true, nullsFirst: false });

    if (daysError) throw daysError;

    const days = Array.isArray(dayRows) ? dayRows.map(toDay) : [];
    const timingByClassId = await getPublicShowTimingByClassId(showId, supabase);
    const sections = await Promise.all(
      days.map(async (day) => {
        const [classResult, paidWarmupResult] = await Promise.all([
          fetchPublicClassesForDay(supabase, day.id),
          supabase
            .from("show_score_paid_warmups")
            .select("*")
            .eq("show_day_id", day.id)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
        ]);

        if (classResult.error) throw classResult.error;
        if (paidWarmupResult.error) {
          console.error(
            "Erreur chargement paid warmups publics Supabase:",
            paidWarmupResult.error
          );
        }

        const paidWarmups = (paidWarmupResult.data || []).map(toPaidWarmup);
        const livePaidWarmups = paidWarmups
          .filter(isPaidWarmupScheduleLiveEligible)
          .map((warmup) => buildPaidWarmupLiveView(warmup));

        const classes = Array.isArray(classResult.data)
          ? classResult.data
              .map(toClass)
              .filter((classItem) => !classItem.isEventBlock)
              .sort(compareScheduleItemsByStart)
          : [];
        const classIds = classes.map((classItem) => classItem.id).filter(Boolean);

        if (!classIds.length) {
          return {
            day,
            classes: [],
            resultClasses: [],
            timingSection: { day, classRows: [], paidWarmups },
            liveClasses: [],
            livePaidWarmups,
            classIds,
          };
        }

        const [
          publicationResult,
          officialResult,
          scoringResult,
          judgeScoringResult,
          setupResult,
          resultPublicationsByClassId,
        ] = await Promise.all([
            supabase
              .from("show_score_publication_states")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("show_score_official_results")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("show_score_scoring_sessions")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("show_score_judge_sessions")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("show_score_class_setups")
              .select("*")
              .in("class_id", classIds),
            getPublicResultPublicationMap(supabase, classIds),
          ]);

        if (publicationResult.error) throw publicationResult.error;
        if (officialResult.error) throw officialResult.error;
        if (scoringResult.error) {
          console.error("Erreur chargement live public Supabase:", scoringResult.error);
        }
        if (judgeScoringResult.error) {
          console.error(
            "Erreur chargement live juges public Supabase:",
            judgeScoringResult.error
          );
        }
        if (setupResult.error) {
          console.error("Erreur chargement setup public Supabase:", setupResult.error);
        }

        const publicationsByClassId = new Map(
          (publicationResult.data || []).map((row) => [
            row.class_id,
            toPublicationState(row),
          ])
        );
        const officialByClassId = new Map(
          (officialResult.data || []).map((row) => [
            row.class_id,
            toOfficialResult(row),
          ])
        );
        const scoringByClassId = new Map(
          (scoringResult.data || []).map((row) => [
            row.class_id,
            toScoringSession(row),
          ])
        );
        const judgeScoringByClassId = new Map();
        (judgeScoringResult.data || []).forEach((row) => {
          const current = judgeScoringByClassId.get(row.class_id) || [];
          current.push(toJudgeScoringSession(row));
          judgeScoringByClassId.set(row.class_id, current);
        });
        const setupByClassId = new Map(
          (setupResult.data || []).map((row) => [row.class_id, toClassSetup(row)])
        );

        const classEntries = classes.map((classItem) => {
          const publication = publicationsByClassId.get(classItem.id);
          const setup = setupByClassId.get(classItem.id) || null;
          const resultClasses = buildPublicResultClassViews({
            classItem,
            resultPublication: resultPublicationsByClassId.get(classItem.id),
          });
          const liveClass = buildPublicLiveClassView({
            classItem,
            setup,
            publication,
            scoringSession: scoringByClassId.get(classItem.id),
            judgeSessions: judgeScoringByClassId.get(classItem.id) || [],
          });
          const scoringSession = scoringByClassId.get(classItem.id);

          return {
            classView: buildPublicClassView({
              classItem,
              setup,
              publication,
              official: officialByClassId.get(classItem.id),
              scoringRuns: [],
            }),
            resultClasses,
            liveClass,
            timingClassRow: {
              classItem,
              setup,
              publication,
              official: officialByClassId.get(classItem.id),
              scoringRuns: scoringSession?.runs || [],
              status: "public",
            },
          };
        });
        const timingSection = {
          day,
          classRows: classEntries.map((entry) => entry.timingClassRow),
          paidWarmups,
        };

        return {
          day,
          classes: classEntries.map((entry) => entry.classView).filter(Boolean),
          resultClasses: classEntries.flatMap((entry) => entry.resultClasses),
          timingSection,
          liveClasses: classEntries
            .map((entry) => entry.liveClass)
            .filter(Boolean),
          livePaidWarmups,
          classIds,
        };
      })
    );
    const timingSections = sections.map((section) => section.timingSection);
    const liveClasses = sections.flatMap((section) => section.liveClasses || []);
    const livePaidWarmups = sections.flatMap(
      (section) => section.livePaidWarmups || []
    );
    const allClassIds = sections.flatMap((section) => section.classIds || []);

    const resultSections = sections
      .map((section) => ({
        day: section.day,
        classes: section.resultClasses,
      }))
      .filter((section) => section.classes.length > 0);
    const publishedClassCount = sections.reduce(
      (total, section) => total + section.classes.length,
      0
    );
    const publishedResultClassCount = resultSections.reduce(
      (total, section) => total + section.classes.length,
      0
    );
    const primaryLiveClasses = findPrimaryLiveClassesByArena(liveClasses);
    const liveState = buildResolvedPublicLiveState({
      timingSections,
      liveClasses: primaryLiveClasses,
      livePaidWarmups,
      timingByClassId,
    });
    const scheduleSections = show?.isSchedulePublic
      ? buildShowSchedulePreviewSections({ daySections: timingSections })
      : [];

    return {
      sections: sections.filter((section) => section.classes.length > 0),
      resultSections,
      publishedClassCount,
      publishedResultClassCount,
      liveClass: liveState.liveClasses[0] || null,
      liveClasses: liveState.liveClasses,
      livePaidWarmup: liveState.livePaidWarmups[0] || null,
      livePaidWarmups: liveState.livePaidWarmups,
      liveClassCount: liveState.liveClasses.length + liveState.livePaidWarmups.length,
      scheduleSections,
      scheduleItemCount: countScheduleItems(scheduleSections),
      classIds: allClassIds,
    };
  } catch (error) {
    console.error("Erreur chargement résultats publics Supabase:", error);
    return getPublicShowView(showId);
  }
}

async function getPublicShowTimingByClassId(showId, supabase) {
  try {
    const { data, error } = await supabase.rpc("public_show_timing_summary", {
      target_show_id: showId,
      min_duration_seconds: MIN_MEASURED_RUN_SECONDS,
    });

    if (error) throw error;

    return new Map(
      (Array.isArray(data) ? data : []).map((row) => [
        row.class_id,
        normalizePublicTiming(row),
      ])
    );
  } catch (error) {
    console.error("Erreur chargement estimations publiques Supabase:", error);
    return new Map();
  }
}

async function getPublicResultPublicationMap(supabase, classIds) {
  try {
    const { data, error } = await supabase
      .from("class_result_publications")
      .select("*")
      .in("class_id", classIds);

    if (error) throw error;

    return new Map(
      (Array.isArray(data) ? data : []).map((row) => [
        row.class_id,
        toResultPublication(row),
      ])
    );
  } catch (error) {
    console.error("Erreur chargement résultats publics Supabase:", error);
    return new Map(
      classIds.map((classId) => [classId, getClassResultPublication(classId)])
    );
  }
}

export async function getPublicAssociationsRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return filterAssociationsWithPublicShows(loadAssociations());
  }

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return filterAssociationsWithPublicShows(
      Array.isArray(data) ? data.map(toAssociation) : []
    );
  } catch (error) {
    console.error("Erreur chargement associations publiques Supabase:", error);
    return [];
  }
}

async function filterAssociationsWithPublicShows(associations) {
  const associationsWithShows = await Promise.all(
    associations.map(async (association) => {
      const shows = await getPublicShowsByAssociationRepository(association.id);
      return shows.length > 0 ? association : null;
    })
  );

  return associationsWithShows.filter(Boolean);
}

export async function getPublicAssociationRepository(associationId) {
  const supabase = getSupabaseClient();
  const localAssociation =
    loadAssociations().find((association) => association.id === associationId) ||
    null;

  if (!supabase) {
    return localAssociation;
  }

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", associationId)
      .maybeSingle();

    if (error) throw error;
    const association = data ? toAssociation(data) : null;

    if (
      association &&
      !association.sponsorLogos.length &&
      localAssociation?.sponsorLogos?.length
    ) {
      return {
        ...association,
        sponsorLogos: localAssociation.sponsorLogos,
      };
    }

    return association || localAssociation;
  } catch (error) {
    console.error("Erreur chargement association publique Supabase:", error);
    return localAssociation;
  }
}

export async function getPublicShowRepository(showId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    const show = getShowById(showId) || null;
    return isShowPubliclyActive(show) ? show : null;
  }

  try {
    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .eq("id", showId)
      .maybeSingle();

    if (error) throw error;
    const show = data ? toShow(data) : null;
    return isShowPubliclyActive(show) ? show : null;
  } catch (error) {
    console.error("Erreur chargement show public Supabase:", error);
    return null;
  }
}

export async function getPublicShowsByAssociationRepository(associationId) {
  const supabase = getSupabaseClient();

  try {
    const shows = supabase
      ? await getPublicShowsByAssociationFromSupabase(associationId, supabase)
      : getShowsByAssociationId(associationId);
    const showsWithCounts = await Promise.all(
      shows.map(async (show) => {
        const view = await getPublicShowViewRepository(show.id);
        return {
          ...show,
          publishedClassCount: view.publishedClassCount,
          publishedResultClassCount: view.publishedResultClassCount || 0,
          liveClassCount: view.liveClassCount || 0,
          scheduleItemCount: view.scheduleItemCount || 0,
        };
      })
    );

    return showsWithCounts.filter(
      (show) =>
        isShowPubliclyActive(show) &&
        (show.publishedClassCount > 0 ||
          show.publishedResultClassCount > 0 ||
          show.liveClassCount > 0 ||
          show.scheduleItemCount > 0 ||
          hasPublicLivestream(show))
    );
  } catch (error) {
    console.error("Erreur chargement shows publics:", error);
    return [];
  }
}

async function getPublicShowsByAssociationFromSupabase(associationId, supabase) {
  const { data, error } = await supabase
    .from("shows")
    .select("*")
    .eq("organization_id", associationId)
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) throw error;

  return Array.isArray(data) ? data.map(toShow) : [];
}

function buildLocalPublicTimingByClassId(timingSections, liveClasses) {
  const liveClassIds = new Set(
    (Array.isArray(liveClasses) ? liveClasses : [liveClasses])
      .filter(Boolean)
      .map((classView) => classView.classId)
  );

  if (liveClassIds.size === 0) {
    return new Map();
  }

  const now = new Date();
  const allClassRows = timingSections.flatMap((section) => section.classRows);
  const patternAverageByValue = new Map(
    buildPatternTimingStats(allClassRows).map((stat) => [
      stat.pattern,
      stat.averageRunSeconds,
    ])
  );
  const timingByClassId = new Map();

  timingSections.forEach((section) => {
    const rows = section.classRows.map((classData) =>
      buildClassTimingRow({
        classData,
        day: section.day,
        now,
        patternAverageRunSeconds:
          patternAverageByValue.get(getClassPatternValue(classData)) || null,
      })
    );
    rows.forEach((liveRow, liveIndex) => {
      if (!liveClassIds.has(liveRow.classId)) {
        return;
      }

      const daySummary = buildPublicRemainingSummary(rows.slice(liveIndex), now);
      timingByClassId.set(liveRow.classId, {
        classEstimatedEndAt: liveRow.estimatedEndAt,
        dayEstimatedEndAt: daySummary.estimatedEndAt,
        classRemainingSeconds: liveRow.remainingSeconds,
        dayRemainingSeconds: daySummary.remainingSeconds,
        classRemainingRuns: liveRow.remainingRuns,
        dayRemainingRuns: daySummary.remainingRuns,
        estimatedAt: now.toISOString(),
      });
    });
  });

  return timingByClassId;
}

function buildPublicRemainingSummary(rows, now) {
  const remainingRuns = rows.reduce(
    (total, row) => total + Math.max(row.remainingRuns || 0, 0),
    0
  );
  const hasUnknownRemaining = rows.some(
    (row) => row.remainingRuns > 0 && row.remainingSeconds == null
  );

  if (hasUnknownRemaining) {
    return {
      remainingRuns,
      remainingSeconds: null,
      estimatedEndAt: null,
    };
  }

  const remainingSeconds = rows.reduce(
    (total, row) =>
      total + (Number.isFinite(row.remainingSeconds) ? row.remainingSeconds : 0),
    0
  );

  return {
    remainingRuns,
    remainingSeconds,
    estimatedEndAt: new Date(now.getTime() + remainingSeconds * 1000).toISOString(),
  };
}

function attachPublicTiming(classView, timingByClassId) {
  if (!classView) return null;

  const timing = timingByClassId.get(classView.classId) || null;

  return {
    ...classView,
    timing,
    dragBreak: classView.dragBreak || timing?.dragBreak || null,
  };
}

function normalizePublicTiming(row) {
  return {
    classEstimatedEndAt: row.class_estimated_end_at || null,
    dayEstimatedEndAt: row.day_estimated_end_at || null,
    classRemainingSeconds:
      row.class_remaining_seconds == null
        ? null
        : Number(row.class_remaining_seconds),
    dayRemainingSeconds:
      row.day_remaining_seconds == null ? null : Number(row.day_remaining_seconds),
    classRemainingRuns:
      row.class_remaining_runs == null ? null : Number(row.class_remaining_runs),
    dayRemainingRuns:
      row.day_remaining_runs == null ? null : Number(row.day_remaining_runs),
    estimatedAt: row.estimated_at || null,
    dragBreak: row.is_drag_due
      ? {
          isActive: true,
          startedAt: row.drag_started_at || null,
          durationMinutes:
            row.drag_duration_minutes == null
              ? null
              : Number(row.drag_duration_minutes),
          durationSeconds:
            row.drag_duration_minutes == null
              ? null
              : Number(row.drag_duration_minutes) * 60,
          remainingSeconds:
            row.drag_remaining_seconds == null
              ? null
              : Number(row.drag_remaining_seconds),
        }
      : null,
  };
}

export function buildPublicClassView(classData) {
  const publication = classData.publication;
  const official = classData.official;

  if (
    publication?.status !== PUBLICATION_STATUSES.PUBLISHED ||
    !official?.isSecretariatValidated
  ) {
    return null;
  }

  const classItem = classData.classItem;
  const officialRuns = Array.isArray(official.officialRuns)
    ? official.officialRuns
    : [];
  const patternValue =
    official.patternValue ||
    official.pattern ||
    classData.setup?.pattern ||
    classItem?.pattern ||
    "";
  const customPattern =
    official.customPattern ||
    classData.setup?.customPattern ||
    classItem?.customPattern ||
    null;
  const runs = buildPublicScoresheetRuns(
    officialRuns.length > 0 ? officialRuns : classData.scoringRuns || [],
    patternValue,
    customPattern
  );
  const judgeNames = Array.from(
    new Set(
      runs
        .map((run) => String(run.judgeName || "").trim())
        .filter(Boolean)
    )
  );

  return {
    classId: classItem?.id,
    className: classItem?.name || "Bloc",
    classCode: classItem?.classCode || "",
    arena: classItem?.arena || "",
    pattern:
      getPatternDisplayName(patternValue, customPattern) ||
      official.pattern ||
      classData.setup?.pattern ||
      classItem?.pattern ||
      "",
    publishedAt: publication.publishedAt,
    finalizedAt: official.finalizedAt,
    judgeName: judgeNames.length === 1 ? judgeNames[0] : official.judgeName,
    judgeNames,
    isMultiJudge: judgeNames.length > 1,
    runs,
  };
}

export function buildPublicResultClassViews({ classItem, resultPublication }) {
  if (
    resultPublication?.status !== RESULT_PUBLICATION_STATUSES.PUBLISHED ||
    !Array.isArray(resultPublication.resultGroups)
  ) {
    return [];
  }

  return resultPublication.resultGroups
    .filter((group) => Array.isArray(group.entries) && group.entries.length > 0)
    .map((group) => ({
      id: group.id || `${classItem?.id || "class"}-${group.code}`,
      sourceClassId: classItem?.id,
      className: group.className || classItem?.name || "Classe/division",
      classCode: group.classCode || group.code || classItem?.classCode || "",
      parentClassName: group.parentClassName || classItem?.name || "",
      pattern: group.pattern || "",
      publishedAt: resultPublication.publishedAt,
      entries: group.entries,
    }));
}

export function buildPublicLiveClassView({
  classItem,
  setup,
  publication,
  scoringSession,
  judgeSessions = [],
}) {
  const publicationStatus = publication?.status || PUBLICATION_STATUSES.HIDDEN;

  if (!isLivePublicationStatus(publicationStatus)) {
    return null;
  }

  const scoringRuns = Array.isArray(scoringSession?.runs)
    ? scoringSession.runs
    : [];
  const setupRuns = Array.isArray(setup?.runs) ? setup.runs : [];
  const patternValue = setup?.pattern || classItem?.pattern || "";
  const customPattern = setup?.customPattern || classItem?.customPattern || null;
  const isScheduleOnly = isNoPatternValue(patternValue);
  const scheduleDetails = normalizeClassScheduleDetails(setup?.scheduleDetails);
  const scheduleRunCount =
    Number.parseInt(scheduleDetails.participantCount, 10) || 0;

  if (isScheduleOnly) {
    if (scheduleDetails.isCompleted) {
      return null;
    }

    return {
      classId: classItem?.id,
      className: classItem?.name || "Bloc",
      classCode: classItem?.classCode || "",
      arena: classItem?.arena || "",
      publicationStatus,
      showScores: false,
      showScoreDetails: false,
      isScheduleOnly: true,
      isComplete: Boolean(scheduleDetails.isCompleted),
      scheduleDetails,
      hasScheduleDetails: hasClassScheduleDetails(scheduleDetails),
      runCount: scheduleRunCount,
      liveUpdatedAt: setup?.updatedAt || null,
      pattern: getPatternDisplayName(patternValue, customPattern) || "",
      activeRun: null,
      nextRun: null,
      secondNextRun: null,
      upcomingRuns: [],
      orderRuns: [],
      passedRuns: [],
      lastPassedRuns: [],
      latestScore: null,
      dragBreak: null,
    };
  }

  const isMultiJudgeLive = hasMultiJudgeLiveSetup({
    judges: setup?.judges,
    judgeSessions,
  });
  const requestedLiveScoreDisplayMode = getLiveScoreDisplayMode(
    publicationStatus
  );
  const liveScoreDisplayMode =
    isMultiJudgeLive &&
    requestedLiveScoreDisplayMode === LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS
      ? LIVE_SCORE_DISPLAY_MODES.COMPLETED_TOTAL
      : requestedLiveScoreDisplayMode;
  const showScores = liveScoreDisplayMode !== LIVE_SCORE_DISPLAY_MODES.HIDDEN;
  const showScoreDetails =
    liveScoreDisplayMode === LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS;
  const sourceRuns = isMultiJudgeLive
    ? buildMultiJudgeLiveRuns({
        setupRuns,
        judgeSessions,
        judges: setup?.judges,
        pattern: patternValue,
        customPattern,
        headers: getPatternHeaders(patternValue, customPattern),
      })
    : scoringRuns.length > 0
      ? scoringRuns
      : setupRuns;
  const mergedRuns = sourceRuns.map((run, index) =>
    mergeLiveRunWithSetupRun(run, setupRuns, index)
  );
  const runs = mergedRuns.map((run, index) =>
    normalizePublicLiveRun(run, index, patternValue, customPattern, {
      liveScoreDisplayMode,
    })
  );
  const classStandings = showScores
    ? buildLiveClassStandings({
        runs,
        setupRuns,
        blockClasses: setup?.blockClasses,
        classItem,
      })
    : [];

  const activeRun = isMultiJudgeLive
    ? runs.find((run) => run.isActive) || null
    : runs.find((run) => run.draw === scoringSession?.activeManoeuvre?.draw) ||
      runs.find((run) => run.isActive) ||
      null;
  const activeDragItem = buildActiveClassDragItem({
    activeManoeuvre: scoringSession?.activeManoeuvre,
    runs,
    dragDurationMinutes: setup?.dragDurationMinutes,
  });
  const liveQueue = buildLiveQueueItems({
    items: runs,
    activeItem: activeRun,
    activeDragItem,
    dragInterval: setup?.dragInterval,
    dragDurationMinutes: setup?.dragDurationMinutes,
    itemType: LIVE_QUEUE_ITEM_TYPES.RUN,
    isAvailable: (run) => !runIsPassed(run) && !run.isReview,
    isPassed: runIsPassed,
  });
  const upcomingRuns = findUpcomingRuns(runs, activeRun);
  const nextRun = upcomingRuns[0] || null;
  const secondNextRun = upcomingRuns[1] || null;
  const passedRuns = findPassedRuns(runs).filter(
    (run) => !isSameRun(run, activeRun)
  );
  const lastPassedRuns = findLastPassedRuns(runs, activeRun, 2);
  const orderRuns = liveQueue.orderItems;
  const dragBreak = buildPublicClassDragBreak({
    runs,
    nextRun,
    activeDragItem,
    dragDurationMinutes: setup?.dragDurationMinutes,
  });

  return {
    classId: classItem?.id,
    className: classItem?.name || "Bloc",
    classCode: classItem?.classCode || "",
    arena: classItem?.arena || "",
    publicationStatus,
    showScores,
    showScoreDetails,
    liveUpdatedAt:
      scoringSession?.updatedAt ||
      getMultiJudgeLiveUpdatedAt(judgeSessions) ||
      getLatestRunActivityAt(runs) ||
      null,
    pattern:
      getPatternDisplayName(
        patternValue,
        customPattern
      ) ||
      patternValue ||
      "",
    activeRun,
    nextRun,
    secondNextRun,
    nextLiveItem: liveQueue.nextLiveItem,
    secondNextLiveItem: liveQueue.secondNextLiveItem,
    upcomingLiveItems: liveQueue.upcomingLiveItems,
    upcomingRuns,
    orderRuns,
    passedRuns,
    lastPassedRuns,
    latestScore: showScores ? lastPassedRuns.find(runHasScore) || null : null,
    classStandings,
    activeDragItem,
    dragBreak,
  };
}

function mergeLiveRunWithSetupRun(run, setupRuns, index) {
  const setupRun = findMatchingSetupRun(setupRuns, run, index);

  if (!setupRun) {
    return run;
  }

  const classCodes =
    Array.isArray(run?.classCodes) && run.classCodes.length
      ? run.classCodes
      : setupRun.classCodes;

  return {
    ...setupRun,
    ...run,
    classCodes,
  };
}

function findMatchingSetupRun(setupRuns, sourceRun, index) {
  const sourceRuns = Array.isArray(setupRuns) ? setupRuns : [];
  const draw = sourceRun?.draw ?? sourceRun?.order ?? index + 1;

  return (
    sourceRuns.find((run) => run?.id && run.id === sourceRun?.id) ||
    sourceRuns.find((run) => String(run?.draw ?? run?.order ?? "") === String(draw)) ||
    null
  );
}

function normalizePublicLiveRun(
  run,
  index,
  pattern,
  customPattern = null,
  options = {}
) {
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
  const headers = getPatternHeaders(pattern, customPattern);
  const liveScoreDisplayMode =
    options.liveScoreDisplayMode || LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS;
  const isComplete =
    Boolean(run?.isComplete) ||
    isScoredRunComplete(
      {
        ...run,
        scores,
        penalties,
      },
      headers.length
    );
  const showScoreDetails =
    liveScoreDisplayMode === LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS;
  const showScores =
    showScoreDetails ||
    (liveScoreDisplayMode === LIVE_SCORE_DISPLAY_MODES.COMPLETED_TOTAL &&
      isComplete);
  const scoreTotal = formatTotalValue(run.scoreTotal);
  const penTotal = formatTotalValue(run.penTotal);
  const note = run.note || "";
  const judgeScores = Array.isArray(run.judgeScores)
    ? run.judgeScores
        .map((judgeScore) => ({
          judgeId: judgeScore?.judgeId || "",
          judgeName: judgeScore?.judgeName || "",
          scoreTotal: formatTotalValue(judgeScore?.scoreTotal),
        }))
        .filter((judgeScore) => String(judgeScore.scoreTotal).trim())
    : [];

  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    classCodes: Array.isArray(run.classCodes) ? run.classCodes : [],
    scoreTotal: showScores ? scoreTotal : "",
    judgeScores: showScores ? judgeScores : [],
    penTotal: showScoreDetails ? penTotal : "",
    note: showScoreDetails ? note : "",
    hasScore: showScores && runHasScore({ scoreTotal }),
    isPassed: isPublicRunPassed({
      ...run,
      scoreTotal,
      isComplete,
    }),
    isComplete,
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
    durationSeconds: run.durationSeconds || null,
    isActive: Boolean(run.isActive),
    isReview: String(run.scoreTotal ?? "").trim() === "Review",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      description: getPatternManeuverDescription(name, pattern, customPattern),
      score: showScoreDetails ? formatScoreValue(scores[manoeuvreIndex]) : "",
      penalty: showScoreDetails ? penalties[manoeuvreIndex] || "" : "",
    })),
  };
}

function findPrimaryLiveClass(liveClasses) {
  return (
    liveClasses.find((classView) => classView.activeDragItem) ||
    liveClasses.find((classView) => classView.activeRun) ||
    liveClasses.find((classView) => classView.latestScore) ||
    liveClasses[0] ||
    null
  );
}

function buildResolvedPublicLiveState({
  timingSections,
  liveClasses,
  livePaidWarmups,
  timingByClassId,
}) {
  const scheduleItems = buildPublicLiveScheduleItems(timingSections);
  const scheduleRowsByItemKey = buildScheduleRowsByItemKey(timingSections);
  const paidWarmupViewsById = buildPaidWarmupViewsById({
    timingSections,
    scheduleItems,
  });
  const liveClassesByArena = groupPrimaryLiveClassesByArena(liveClasses);
  const livePaidWarmupsByArena = groupPrimaryLivePaidWarmupsByArena(
    livePaidWarmups.map((warmup) =>
      attachScheduleArenaToWarmup(warmup, scheduleItems)
    )
  );
  const arenaKeys = new Set([
    ...liveClassesByArena.keys(),
    ...livePaidWarmupsByArena.keys(),
  ]);
  const resolvedLiveClasses = [];
  const resolvedLivePaidWarmups = [];

  arenaKeys.forEach((arenaKey) => {
    const explicitWarmup = livePaidWarmupsByArena.get(arenaKey);

    if (explicitWarmup) {
      resolvedLivePaidWarmups.push(
        attachNextScheduleItem({
          view: explicitWarmup,
          scheduleItems,
          scheduleRowsByItemKey,
          type: LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
          itemId: explicitWarmup.id,
        })
      );
      return;
    }

    const explicitClass = liveClassesByArena.get(arenaKey);
    if (!explicitClass) return;

    const classScheduleItem = findScheduleItem(
      scheduleItems,
      LIVE_SCHEDULE_ITEM_TYPES.CLASS,
      explicitClass.classId
    );
    const pendingWarmup = classScheduleItem
      ? findFirstPendingPaidWarmupBeforeItem(scheduleItems, classScheduleItem)
      : null;
    const pendingWarmupView = pendingWarmup
      ? paidWarmupViewsById.get(pendingWarmup.itemId)
      : null;

    if (pendingWarmupView) {
      resolvedLivePaidWarmups.push(
        attachNextScheduleItem({
          view: pendingWarmupView,
          scheduleItems,
          scheduleRowsByItemKey,
          type: LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
          itemId: pendingWarmupView.id,
        })
      );
      return;
    }

    resolvedLiveClasses.push(
      attachNextScheduleItem({
        view: attachPublicTiming(explicitClass, timingByClassId),
        scheduleItems,
        scheduleRowsByItemKey,
        type: LIVE_SCHEDULE_ITEM_TYPES.CLASS,
        itemId: explicitClass.classId,
      })
    );
  });

  return {
    liveClasses: resolvedLiveClasses.filter(Boolean),
    livePaidWarmups: resolvedLivePaidWarmups.filter(Boolean),
  };
}

function buildPublicLiveScheduleItems(timingSections) {
  const sourceSections = Array.isArray(timingSections) ? timingSections : [];
  const days = sourceSections.map((section) => section.day).filter(Boolean);
  const classes = sourceSections.flatMap((section) =>
    (section.classRows || [])
      .map((classData) => classData?.classItem || null)
      .filter(Boolean)
  );
  const paidWarmups = sourceSections.flatMap(
    (section) => section.paidWarmups || []
  );

  return buildLiveScheduleItems({ classes, paidWarmups, days });
}

function buildScheduleRowsByItemKey(timingSections) {
  const sections = buildShowScheduleSections({ daySections: timingSections });
  const rows = sections.flatMap((section) => section.rows || []);

  return new Map(
    rows
      .filter((row) => Boolean(row?.itemId || row?.classId))
      .map((row) => [
        getScheduleItemKey(row.itemType, row.itemId || row.classId),
        row,
      ])
  );
}

function buildPaidWarmupViewsById({ timingSections, scheduleItems }) {
  const arenaByWarmupId = new Map(
    (Array.isArray(scheduleItems) ? scheduleItems : [])
      .filter((item) => item.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP)
      .map((item) => [item.itemId, item.effectiveArena || ""])
  );
  const allWarmups = (Array.isArray(timingSections) ? timingSections : [])
    .flatMap((section) => section.paidWarmups || [])
    .filter((warmup) => warmup?.id);

  return new Map(
    allWarmups.map((warmup) => [
      warmup.id,
      buildPaidWarmupLiveView({
        ...warmup,
        arena: warmup.arena || arenaByWarmupId.get(warmup.id) || "",
      }),
    ])
  );
}

function attachScheduleArenaToWarmup(warmup, scheduleItems) {
  const scheduleItem = findScheduleItem(
    scheduleItems,
    LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
    warmup?.id
  );

  return {
    ...warmup,
    arena: warmup?.arena || scheduleItem?.effectiveArena || "",
  };
}

function attachNextScheduleItem({
  view,
  scheduleItems,
  scheduleRowsByItemKey,
  type,
  itemId,
}) {
  if (!view) return null;

  const scheduleItem = findScheduleItem(scheduleItems, type, itemId);
  const scheduleRow = scheduleRowsByItemKey?.get(
    getScheduleItemKey(type, itemId)
  );
  const nextScheduleItem = scheduleItem
    ? findNextScheduleItemInArena(
        scheduleItems,
        scheduleItem,
        scheduleItem.effectiveArena
      )
    : null;

  return {
    ...view,
    arena: view.arena || scheduleItem?.effectiveArena || "",
    nextScheduleItem: buildPublicNextScheduleItem({
      scheduleItem: nextScheduleItem,
      scheduleRow: nextScheduleItem
        ? scheduleRowsByItemKey?.get(
            getScheduleItemKey(nextScheduleItem.type, nextScheduleItem.itemId)
          )
        : null,
      currentScheduleRow: scheduleRow,
    }),
  };
}

function buildPublicNextScheduleItem({
  scheduleItem,
  scheduleRow,
  currentScheduleRow,
}) {
  const publicItem = toPublicScheduleItem(scheduleItem);

  if (!publicItem) return null;

  const hasFixedStart = Boolean(
    scheduleRow?.scheduleStartMode === "fixed" && scheduleRow?.plannedStartAt
  );
  const scheduleEstimatedStartAt = scheduleRow?.scheduleStartUsesFallback
    ? null
    : scheduleRow?.estimatedStartAt || null;
  const currentEstimatedEndAt = currentScheduleRow?.scheduleStartUsesFallback
    ? null
    : currentScheduleRow?.estimatedEndAt || null;
  const estimatedStartAt =
    scheduleEstimatedStartAt || currentEstimatedEndAt || null;
  const startAt = hasFixedStart
    ? scheduleRow.plannedStartAt
    : estimatedStartAt;

  return {
    ...publicItem,
    dayDate: scheduleRow?.dayDate || "",
    dayLabel: scheduleRow?.dayLabel || "",
    startAt: startAt || null,
    startKind: hasFixedStart ? "fixed" : startAt ? "estimated" : "unknown",
    plannedStartAt: scheduleRow?.plannedStartAt || null,
    estimatedStartAt: estimatedStartAt || null,
  };
}

function getScheduleItemKey(type, itemId) {
  return `${type || LIVE_SCHEDULE_ITEM_TYPES.CLASS}:${itemId || ""}`;
}

function findPrimaryLiveClassesByArena(liveClasses) {
  return Array.from(groupPrimaryLiveClassesByArena(liveClasses).values());
}

function groupPrimaryLiveClassesByArena(liveClasses) {
  const groups = new Map();

  (Array.isArray(liveClasses) ? liveClasses : []).forEach((classView) => {
    const arenaKey = getScheduleArenaKey(classView?.arena);
    const currentGroup = groups.get(arenaKey) || [];

    groups.set(arenaKey, [...currentGroup, classView]);
  });

  return new Map(
    Array.from(groups.entries())
      .map(([arenaKey, group]) => [arenaKey, findPrimaryLiveClass(group)])
      .filter(([, classView]) => Boolean(classView))
  );
}

function findPrimaryLivePaidWarmup(livePaidWarmups) {
  return (
    livePaidWarmups.find((warmup) => warmup.activeDragItem) ||
    livePaidWarmups.find((warmup) => warmup.activeEntry) ||
    livePaidWarmups.find((warmup) => warmup.isDragDue) ||
    livePaidWarmups[0] ||
    null
  );
}

function groupPrimaryLivePaidWarmupsByArena(livePaidWarmups) {
  const groups = new Map();

  (Array.isArray(livePaidWarmups) ? livePaidWarmups : []).forEach((warmup) => {
    const arenaKey = getScheduleArenaKey(warmup?.arena);
    const currentGroup = groups.get(arenaKey) || [];

    groups.set(arenaKey, [...currentGroup, warmup]);
  });

  return new Map(
    Array.from(groups.entries())
      .map(([arenaKey, group]) => [arenaKey, findPrimaryLivePaidWarmup(group)])
      .filter(([, warmup]) => Boolean(warmup))
  );
}

function buildPublicClassDragBreak({
  runs,
  nextRun,
  activeDragItem,
  dragDurationMinutes,
}) {
  const normalizedDragDurationMinutes = Number.parseInt(dragDurationMinutes, 10);

  if (!activeDragItem) {
    return null;
  }

  const durationMinutes =
    Number.isFinite(normalizedDragDurationMinutes) &&
    normalizedDragDurationMinutes >= 0
      ? normalizedDragDurationMinutes
      : 8;

  return {
    isActive: true,
    startedAt: activeDragItem.startedAt || null,
    durationMinutes,
    durationSeconds: durationMinutes * 60,
    nextRun,
  };
}

function buildActiveClassDragItem({
  activeManoeuvre,
  runs,
  dragDurationMinutes,
}) {
  if (activeManoeuvre?.type !== LIVE_QUEUE_ITEM_TYPES.DRAG) {
    return null;
  }

  const afterIndex = Number.isInteger(activeManoeuvre.afterIndex)
    ? activeManoeuvre.afterIndex
    : findLastIndex(runs, runIsPassed);
  const afterItem = runs[afterIndex] || null;
  const durationMinutes = Number.parseInt(
    activeManoeuvre.durationMinutes ?? dragDurationMinutes,
    10
  );

  return {
    type: LIVE_QUEUE_ITEM_TYPES.DRAG,
    id: getLiveDragItemId(afterItem, afterIndex),
    itemId: getLiveDragItemId(afterItem, afterIndex),
    afterIndex,
    afterDraw: afterItem?.draw || activeManoeuvre.afterDraw || afterIndex + 1,
    startedAt: activeManoeuvre.startedAt || null,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : 8,
  };
}

function findUpcomingRuns(runs, activeRun) {
  if (!runs.length) return [];

  const activeIndex = activeRun
    ? runs.findIndex((run) => isSameRun(run, activeRun))
    : -1;
  const sourceRuns = activeIndex >= 0 ? runs.slice(activeIndex + 1) : runs;

  return sourceRuns.filter(
    (run) => !isSameRun(run, activeRun) && !runIsPassed(run) && !run.isReview
  );
}

function findPassedRuns(runs) {
  return runs.filter(runIsPassed).reverse();
}

function findLastPassedRuns(runs, activeRun, count) {
  if (!activeRun) {
    return findPassedRuns(runs).slice(0, count);
  }

  const activeIndex = runs.findIndex((run) => isSameRun(run, activeRun));

  if (activeIndex <= 0) {
    return [];
  }

  return runs.slice(0, activeIndex).filter(runIsPassed).slice(-count).reverse();
}

function runHasScore(run) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(run?.hasScore || (score && score !== "Review"));
}

function runIsPassed(run) {
  return Boolean(run?.isPassed || runHasScore(run));
}

function isPublicRunPassed(run) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(
    run?.isComplete ||
      run?.completedAt ||
      ["done", "completed", "passed"].includes(String(run?.status || "")) ||
      (score && score !== "Review")
  );
}

function buildLiveRunOrder({ runs, activeRun, nextRun, secondNextRun }) {
  return runs.map((run) => ({
    ...run,
    liveOrderStatus: getLiveRunOrderStatus({
      run,
      activeRun,
      nextRun,
      secondNextRun,
    }),
  }));
}

function getLiveRunOrderStatus({ run, activeRun, nextRun, secondNextRun }) {
  if (isSameRun(run, activeRun)) return "active";
  if (isSameRun(run, nextRun)) return "preparation";
  if (isSameRun(run, secondNextRun)) return "waiting";
  if (runIsPassed(run)) return "passed";
  return "upcoming";
}

function isSameRun(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  return String(a.draw ?? "") === String(b.draw ?? "");
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }

  return -1;
}

function getLatestRunActivityAt(runs) {
  const timestamps = (Array.isArray(runs) ? runs : [])
    .map((run) => run?.completedAt || run?.startedAt || null)
    .filter(Boolean)
    .sort();

  return timestamps[timestamps.length - 1] || null;
}

export function sortPublicResults(runs) {
  return [...runs]
    .map((run, index) => normalizePublicRun(run, index))
    .sort((a, b) => {
      const aScore = parsePublicScore(a.scoreTotal);
      const bScore = parsePublicScore(b.scoreTotal);

      if (aScore != null && bScore != null && aScore !== bScore) {
        return bScore - aScore;
      }

      if (aScore != null && bScore == null) return -1;
      if (aScore == null && bScore != null) return 1;

      return a.draw - b.draw;
    })
    .map((run, index) => ({
      ...run,
      rank: index + 1,
    }));
}

export function buildPublicScoresheetRuns(
  runs,
  pattern = "",
  customPattern = null
) {
  return [...runs]
    .map((run, index) => normalizePublicRun(run, index, pattern, customPattern))
    .sort(compareRunsByDraw);
}

function normalizePublicRun(run, index, pattern = "", customPattern = null) {
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
  const headers = getPatternHeaders(pattern, customPattern);

  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    judgeId: run.judgeId || "",
    judgeName: run.judgeName || "",
    judgeOrder: getPublicRunJudgeOrder(run, index),
    scoreTotal: formatTotalValue(run.scoreTotal),
    penTotal: formatTotalValue(run.penTotal),
    note: run.note || "",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      description: getPatternManeuverDescription(name, pattern, customPattern),
      score: formatScoreValue(scores[manoeuvreIndex]),
      penalty: penalties[manoeuvreIndex] || "",
    })),
  };
}

function compareRunsByDraw(a, b) {
  const aDraw = Number.parseFloat(a.draw);
  const bDraw = Number.parseFloat(b.draw);

  if (Number.isFinite(aDraw) && Number.isFinite(bDraw) && aDraw !== bDraw) {
    return aDraw - bDraw;
  }

  if (!Number.isFinite(aDraw) || !Number.isFinite(bDraw)) {
    const drawComparison = String(a.draw || "").localeCompare(String(b.draw || ""));
    if (drawComparison !== 0) {
      return drawComparison;
    }
  }

  const aJudgeOrder = Number(a.judgeOrder);
  const bJudgeOrder = Number(b.judgeOrder);
  if (
    Number.isFinite(aJudgeOrder) &&
    Number.isFinite(bJudgeOrder) &&
    aJudgeOrder !== bJudgeOrder
  ) {
    return aJudgeOrder - bJudgeOrder;
  }

  return String(a.judgeName || "").localeCompare(String(b.judgeName || ""));
}

function parsePublicScore(value) {
  const parsed = parseScoreTotalValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPublicRunJudgeOrder(run, fallbackIndex = 0) {
  const explicitOrder = Number(run?.judgeOrder);

  if (Number.isFinite(explicitOrder)) {
    return explicitOrder;
  }

  const judgeIdMatch = String(run?.judgeId || "").match(/(\d+)$/);
  const judgeIdOrder = judgeIdMatch ? Number(judgeIdMatch[1]) : null;

  return Number.isFinite(judgeIdOrder) ? judgeIdOrder : fallbackIndex + 1;
}

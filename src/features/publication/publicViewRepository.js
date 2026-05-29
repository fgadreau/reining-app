import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
} from "../classes/classRepository";
import { loadAssociations } from "../associations/associationsData";
import { getShowsByAssociationId, getShowById } from "../shows/showSelectors";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import { getPaidWarmupsByDayId } from "../paidWarmups/paidWarmupStorage";
import { buildPaidWarmupLiveView } from "../paidWarmups/paidWarmupLive";
import { isScoredRunComplete } from "../../utils/scoring";
import {
  buildClassTimingRow,
  buildPatternTimingStats,
  getClassPatternValue,
} from "../classes/classTimeAnalytics";
import {
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
    logoDataUrl: row.logo_data_url || null,
    websiteUrl: row.website_url || "",
  };
}

function toShow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    name: row.name || "",
    venue: row.venue || "",
    location: row.location || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status || "draft",
  };
}

function toDay(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    label: row.label || "",
    date: row.date || "",
    sortOrder: row.sort_order || 1,
  };
}

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

function toPublicationState(row) {
  return {
    classId: row.class_id,
    status: row.status || PUBLICATION_STATUSES.HIDDEN,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    publicUrl: row.public_url || null,
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
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "",
    durationMinutesPerRider: row.duration_minutes_per_rider,
    dragInterval: row.drag_interval,
    dragDurationMinutes: row.drag_duration_minutes,
    isPublicLive: Boolean(row.is_public_live),
    activeEntryId: row.active_entry_id || null,
    activeStartedAt: row.active_started_at || null,
    entries: Array.isArray(row.entries) ? row.entries : [],
    sortOrder: row.sort_order || 1,
    updatedAt: row.updated_at || null,
  };
}

export function getPublicShowView(showId) {
  const liveClasses = [];
  const livePaidWarmups = [];
  const classIds = [];
  const timingSections = [];
  const sections = getDaysByShowId(showId).map((day) => {
    const classRows = [];
    getPaidWarmupsByDayId(day.id)
      .filter((warmup) => warmup.isPublicLive)
      .forEach((warmup) => {
        livePaidWarmups.push(buildPaidWarmupLiveView(warmup));
      });
    const classViews = getClassesForDay(day.id).map((classItem) => {
      if (classItem.id) {
        classIds.push(classItem.id);
      }

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
    timingSections.push({ day, classRows });

    return {
      day,
      classes: classViews.filter(Boolean),
    };
  });

  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const primaryLiveClass = findPrimaryLiveClass(liveClasses);
  const activePaidWarmupCount = countActivePaidWarmups(livePaidWarmups);
  const primaryLivePaidWarmup = findPrimaryLivePaidWarmup(livePaidWarmups);
  const timingByClassId = buildLocalPublicTimingByClassId(
    timingSections,
    liveClasses
  );
  const timedLiveClasses = liveClasses.map((classView) =>
    attachPublicTiming(classView, timingByClassId)
  );

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
    liveClass: attachPublicTiming(primaryLiveClass, timingByClassId),
    liveClasses: timedLiveClasses,
    livePaidWarmup: primaryLivePaidWarmup,
    liveClassCount: liveClasses.length + activePaidWarmupCount,
    classIds,
  };
}

export async function getPublicShowViewRepository(showId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    return getPublicShowViewFromSupabase(showId, supabase);
  }

  const liveClasses = [];
  const livePaidWarmups = [];
  const classIds = [];
  const timingSections = [];
  const sections = await Promise.all(
    (await getDaysByShowRepository(showId)).map(async (day) => {
      getPaidWarmupsByDayId(day.id)
        .filter((warmup) => warmup.isPublicLive)
        .forEach((warmup) => {
          livePaidWarmups.push(buildPaidWarmupLiveView(warmup));
        });
      const classes = getClassesForDay(day.id);
      const classRows = [];
      const classViews = await Promise.all(
        classes.map(async (classItem) => {
          if (classItem.id) {
            classIds.push(classItem.id);
          }

          const classData = await getClassFullDataRepository(classItem.id);
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
        })
      );
      timingSections.push({ day, classRows });

      return {
        day,
        classes: classViews.filter(Boolean),
      };
    })
  );

  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );
  const primaryLiveClass = findPrimaryLiveClass(liveClasses);
  const activePaidWarmupCount = countActivePaidWarmups(livePaidWarmups);
  const primaryLivePaidWarmup = findPrimaryLivePaidWarmup(livePaidWarmups);
  const timingByClassId = buildLocalPublicTimingByClassId(
    timingSections,
    liveClasses
  );
  const timedLiveClasses = liveClasses.map((classView) =>
    attachPublicTiming(classView, timingByClassId)
  );

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
    liveClass: attachPublicTiming(primaryLiveClass, timingByClassId),
    liveClasses: timedLiveClasses,
    livePaidWarmup: primaryLivePaidWarmup,
    liveClassCount: liveClasses.length + activePaidWarmupCount,
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
      table: "days",
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
      table: "paid_warmups",
      filter: `show_id=eq.${showId}`,
    },
    onChange
  );

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "publication_states",
    },
    onChange
  );

  uniqueClassIds.forEach((classId) => {
    [
      "official_results",
      "scoring_sessions",
      "judge_scoring_sessions",
      "class_setups",
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
    const { data: dayRows, error: daysError } = await supabase
      .from("days")
      .select("*")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true })
      .order("date", { ascending: true, nullsFirst: false });

    if (daysError) throw daysError;

    const days = Array.isArray(dayRows) ? dayRows.map(toDay) : [];
    const timingByClassId = await getPublicShowTimingByClassId(showId, supabase);
    const liveClasses = [];
    const livePaidWarmups = [];
    const allClassIds = [];
    const sections = await Promise.all(
      days.map(async (day) => {
        const [classResult, paidWarmupResult] = await Promise.all([
          supabase
            .from("classes")
            .select("*")
            .eq("day_id", day.id)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase
            .from("paid_warmups")
            .select("*")
            .eq("day_id", day.id)
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

        (paidWarmupResult.data || []).map(toPaidWarmup).forEach((warmup) => {
          if (warmup.isPublicLive) {
            livePaidWarmups.push(buildPaidWarmupLiveView(warmup));
          }
        });

        const classes = Array.isArray(classResult.data)
          ? classResult.data.map(toClass)
          : [];
        const classIds = classes.map((classItem) => classItem.id).filter(Boolean);
        allClassIds.push(...classIds);

        if (!classIds.length) {
          return { day, classes: [] };
        }

        const [
          publicationResult,
          officialResult,
          scoringResult,
          judgeScoringResult,
          setupResult,
        ] = await Promise.all([
            supabase
              .from("publication_states")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("official_results")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("scoring_sessions")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("judge_scoring_sessions")
              .select("*")
              .in("class_id", classIds),
            supabase
              .from("class_setups")
              .select("*")
              .in("class_id", classIds),
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

        const classViews = classes.map((classItem) => {
          const publication = publicationsByClassId.get(classItem.id);
          const setup = setupByClassId.get(classItem.id) || null;
          const liveClass = buildPublicLiveClassView({
            classItem,
            setup,
            publication,
            scoringSession: scoringByClassId.get(classItem.id),
            judgeSessions: judgeScoringByClassId.get(classItem.id) || [],
          });

          if (liveClass) {
            liveClasses.push(liveClass);
          }

          return buildPublicClassView({
            classItem,
            setup,
            publication,
            official: officialByClassId.get(classItem.id),
            scoringRuns: [],
          });
        });

        return {
          day,
          classes: classViews.filter(Boolean),
        };
      })
    );

    const publishedClassCount = sections.reduce(
      (total, section) => total + section.classes.length,
      0
    );
    const primaryLiveClass = findPrimaryLiveClass(liveClasses);
    const activePaidWarmupCount = countActivePaidWarmups(livePaidWarmups);
    const primaryLivePaidWarmup = findPrimaryLivePaidWarmup(livePaidWarmups);
    const timedLiveClasses = liveClasses.map((classView) =>
      attachPublicTiming(classView, timingByClassId)
    );

    return {
      sections: sections.filter((section) => section.classes.length > 0),
      publishedClassCount,
      liveClass: attachPublicTiming(primaryLiveClass, timingByClassId),
      liveClasses: timedLiveClasses,
      livePaidWarmup: primaryLivePaidWarmup,
      liveClassCount: liveClasses.length + activePaidWarmupCount,
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

export async function getPublicAssociationsRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return filterAssociationsWithPublicShows(loadAssociations());
  }

  try {
    const { data, error } = await supabase
      .from("associations")
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

  if (!supabase) {
    return (
      loadAssociations().find((association) => association.id === associationId) ||
      null
    );
  }

  try {
    const { data, error } = await supabase
      .from("associations")
      .select("*")
      .eq("id", associationId)
      .maybeSingle();

    if (error) throw error;
    return data ? toAssociation(data) : null;
  } catch (error) {
    console.error("Erreur chargement association publique Supabase:", error);
    return null;
  }
}

export async function getPublicShowRepository(showId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getShowById(showId) || null;
  }

  try {
    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .eq("id", showId)
      .maybeSingle();

    if (error) throw error;
    return data ? toShow(data) : null;
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
          liveClassCount: view.liveClassCount || 0,
        };
      })
    );

    return showsWithCounts.filter(
      (show) => show.publishedClassCount > 0 || show.liveClassCount > 0
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
    .eq("association_id", associationId)
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
    className: classItem?.name || "Classe",
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
      className: classItem?.name || "Classe",
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
  const runs = sourceRuns.map((run, index) =>
    normalizePublicLiveRun(run, index, patternValue, customPattern, {
      liveScoreDisplayMode,
    })
  );

  const activeRun = isMultiJudgeLive
    ? runs.find((run) => run.isActive) || null
    : runs.find((run) => run.draw === scoringSession?.activeManoeuvre?.draw) ||
      runs.find((run) => run.isActive) ||
      null;
  const upcomingRuns = findUpcomingRuns(runs, activeRun);
  const nextRun = upcomingRuns[0] || null;
  const secondNextRun = upcomingRuns[1] || null;
  const passedRuns = findPassedRuns(runs);
  const lastPassedRuns = findLastPassedRuns(runs, activeRun, 2);
  const orderRuns = buildLiveRunOrder({
    runs,
    activeRun,
    nextRun,
    secondNextRun,
  });
  const dragBreak = buildPublicClassDragBreak({
    runs,
    activeRun,
    nextRun,
    dragInterval: setup?.dragInterval,
    dragDurationMinutes: setup?.dragDurationMinutes,
  });

  return {
    classId: classItem?.id,
    className: classItem?.name || "Classe",
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
    upcomingRuns,
    orderRuns,
    passedRuns,
    lastPassedRuns,
    latestScore: showScores ? passedRuns.find(runHasScore) || null : null,
    dragBreak,
  };
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
  const scoreTotal = run.scoreTotal ?? "";
  const penTotal = run.penTotal ?? "";
  const note = run.note || "";
  const judgeScores = Array.isArray(run.judgeScores)
    ? run.judgeScores
        .map((judgeScore) => ({
          judgeId: judgeScore?.judgeId || "",
          judgeName: judgeScore?.judgeName || "",
          scoreTotal: judgeScore?.scoreTotal ?? "",
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
      score: showScoreDetails ? scores[manoeuvreIndex] || "" : "",
      penalty: showScoreDetails ? penalties[manoeuvreIndex] || "" : "",
    })),
  };
}

function findPrimaryLiveClass(liveClasses) {
  return (
    liveClasses.find((classView) => classView.activeRun) ||
    liveClasses.find((classView) => classView.latestScore) ||
    liveClasses[0] ||
    null
  );
}

function findPrimaryLivePaidWarmup(livePaidWarmups) {
  return (
    livePaidWarmups.find((warmup) => warmup.activeEntry) ||
    livePaidWarmups.find((warmup) => warmup.isDragDue) ||
    null
  );
}

function countActivePaidWarmups(livePaidWarmups) {
  return livePaidWarmups.filter(
    (warmup) => warmup.activeEntry || warmup.isDragDue
  ).length;
}

function buildPublicClassDragBreak({
  runs,
  activeRun,
  nextRun,
  dragInterval,
  dragDurationMinutes,
}) {
  const normalizedDragInterval = Number.parseInt(dragInterval, 10);
  const normalizedDragDurationMinutes = Number.parseInt(dragDurationMinutes, 10);
  const completedRuns = runs.filter(runIsPassed);

  if (
    activeRun ||
    !nextRun ||
    !Number.isFinite(normalizedDragInterval) ||
    normalizedDragInterval <= 0 ||
    completedRuns.length === 0 ||
    completedRuns.length % normalizedDragInterval !== 0
  ) {
    return null;
  }

  const durationMinutes =
    Number.isFinite(normalizedDragDurationMinutes) &&
    normalizedDragDurationMinutes >= 0
      ? normalizedDragDurationMinutes
      : 8;
  const lastCompletedRun = completedRuns[completedRuns.length - 1];

  return {
    isActive: true,
    startedAt: lastCompletedRun?.completedAt || null,
    durationMinutes,
    durationSeconds: durationMinutes * 60,
    nextRun,
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
    scoreTotal: run.scoreTotal ?? "",
    penTotal: run.penTotal ?? "",
    note: run.note || "",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      description: getPatternManeuverDescription(name, pattern, customPattern),
      score: scores[manoeuvreIndex] || "",
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
  const parsed = Number.parseFloat(String(value ?? ""));
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

import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
  getClassesForDayRepository,
} from "../classes/classRepository";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import { getPaidWarmupsByDayId } from "../paidWarmups/paidWarmupStorage";
import { getPaidWarmupsForDayRepository } from "../paidWarmups/paidWarmupRepository";
import { buildPaidWarmupLiveView } from "../paidWarmups/paidWarmupLive";
import {
  hasClassScheduleDetails,
  normalizeClassScheduleDetails,
} from "../classes/classSchedule";
import {
  getPatternDisplayName,
  getPatternHeaders,
  isNoPatternValue,
  patternHasRailAdjustment,
} from "../patterns/patternDefinitions";
import { buildProvisionalRanking } from "../scoring/provisionalRanking";
import {
  buildMultiJudgeLiveRuns,
  getMultiJudgeLiveUpdatedAt,
  hasMultiJudgeLiveSetup,
} from "../scoring/multiJudgeLiveData";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { getPublicationStatusLabel } from "../publication/publicationRepository";
import { loadActiveManoeuvre } from "../scoring/scoringRepository";
import { formatScoreValue, formatTotalValue } from "../../utils/scoring";

const ANNOUNCER_CLASS_REALTIME_TABLES = [
  "scoring_sessions",
  "judge_scoring_sessions",
  "class_setups",
  "publication_states",
  "official_results",
];

export function getAnnouncerShowView(showId) {
  const days = getDaysByShowId(showId);

  const sections = days.map((day) => {
    const classes = getClassesForDay(day.id).map((classItem) =>
      buildAnnouncerClassView(getClassFullData(classItem.id))
    );
    const paidWarmups = getPaidWarmupsByDayId(day.id).map((warmup) =>
      buildPaidWarmupLiveView(warmup)
    );

    return {
      day,
      classes,
      paidWarmups,
    };
  });

  const allClasses = sections.flatMap((section) => section.classes);
  const allPaidWarmups = sections.flatMap((section) => section.paidWarmups);

  const activeClasses = findActiveClasses(allClasses);
  const activeClass = activeClasses[0] || null;
  const activePaidWarmup =
    allPaidWarmups.find((item) => item.activeEntry) || null;

  return {
    sections,
    activeClass,
    activeClasses,
    activePaidWarmup,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentPassedRuns(allClasses, 4),
  };
}

export async function getAnnouncerShowViewRepository(showId) {
  const days = await getDaysByShowRepository(showId);

  const sections = await Promise.all(
    days.map(async (day) => {
      const [classes, paidWarmups] = await Promise.all([
        getClassesForDayRepository(day.id),
        getPaidWarmupsForDayRepository(day.id),
      ]);
      const classViews = await Promise.all(
        classes.map(async (classItem) =>
          buildAnnouncerClassView(
            await getClassFullDataRepository(classItem.id)
          )
        )
      );

      return {
        day,
        classes: classViews,
        paidWarmups: paidWarmups.map((warmup) => buildPaidWarmupLiveView(warmup)),
      };
    })
  );

  const allClasses = sections.flatMap((section) => section.classes);
  const allPaidWarmups = sections.flatMap((section) => section.paidWarmups);

  const activeClasses = findActiveClasses(allClasses);
  const activeClass = activeClasses[0] || null;
  const activePaidWarmup =
    allPaidWarmups.find((item) => item.activeEntry) || null;

  return {
    sections,
    activeClass,
    activeClasses,
    activePaidWarmup,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentPassedRuns(allClasses, 4),
  };
}

export function subscribeAnnouncerShowViewRepository(
  showId,
  classIds,
  onChange
) {
  const supabase = getSupabaseClient();

  if (!supabase || typeof onChange !== "function") {
    return () => {};
  }

  const uniqueClassIds = Array.from(
    new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))
  );
  const channelName = `announcer-show:${showId}`;
  const channel = supabase.channel(channelName);

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

  uniqueClassIds.forEach((classId) => {
    ANNOUNCER_CLASS_REALTIME_TABLES.forEach((table) => {
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
      console.error("Erreur abonnement temps réel annonceur Supabase.");
    }
  });

  return () => {
    supabase.removeChannel(channel);
  };
}

export function buildAnnouncerClassView(classData) {
  const classItem = classData.classItem;
  const classId = classItem?.id;
  const scoringRuns = Array.isArray(classData.scoringRuns)
    ? classData.scoringRuns
    : [];
  const setupRuns = Array.isArray(classData.setup?.runs)
    ? classData.setup.runs
    : [];
  const pattern = classData.setup?.pattern || classItem?.pattern || "";
  const customPattern =
    classData.setup?.customPattern || classItem?.customPattern || null;
  const isScheduleOnly = isNoPatternValue(pattern);
  const scheduleDetails = normalizeClassScheduleDetails(
    classData.setup?.scheduleDetails
  );
  const headers = getPatternHeaders(pattern, customPattern);
  const hasRailAdjustment = patternHasRailAdjustment(pattern, customPattern);
  const isMultiJudgeLive = hasMultiJudgeLiveSetup({
    judges: classData.setup?.judges,
    judgeSessions: classData.judgeSessions,
  });
  const sourceRuns = isMultiJudgeLive
    ? buildMultiJudgeLiveRuns({
        setupRuns,
        judgeSessions: classData.judgeSessions,
        judges: classData.setup?.judges,
        pattern,
        customPattern,
        headers,
      })
    : scoringRuns.length > 0
      ? scoringRuns
      : setupRuns;
  const runs = sourceRuns.map((run, index) =>
    normalizeRunForAnnouncer(run, index, headers)
  );
  const isOfficiallyCompleted = Boolean(
    classData.setup?.finalized ||
      classData.setup?.judgeSignedAt ||
      classItem?.finalized ||
      classItem?.judgeSignedAt ||
      classData.status === "completed"
  );
  const activeManoeuvre =
    classId && !isOfficiallyCompleted && !isMultiJudgeLive
      ? loadActiveManoeuvre(classId)
      : null;
  const activeRun =
    isOfficiallyCompleted
      ? null
      : isMultiJudgeLive
        ? runs.find((run) => run.isActive) || null
        : runs.find((run) => run.draw === activeManoeuvre?.draw) ||
          runs.find((run) => run.isActive) ||
          null;

  const publicationStatus = classData.publication?.status || "hidden";

  if (isScheduleOnly) {
    return {
      classId,
      className: classItem?.name || "Classe",
      classCode: classItem?.classCode || "",
      arena: classItem?.arena || "",
      pattern: getPatternDisplayName(pattern, customPattern) || "",
      headers,
      status: classData.status,
      publicationStatus,
      publicationStatusLabel: getPublicationStatusLabel(publicationStatus),
      liveUpdatedAt: classData.setup?.updatedAt || null,
      runCount: Number.parseInt(scheduleDetails.participantCount, 10) || 0,
      scoringStarted: false,
      isComplete: Boolean(scheduleDetails.isCompleted),
      isScheduleOnly: true,
      scheduleDetails,
      hasScheduleDetails: hasClassScheduleDetails(scheduleDetails),
      hasRailAdjustment: false,
      provisionalRanking: [],
      activeRun: null,
      nextRun: null,
      secondNextRun: null,
      upcomingRuns: [],
      orderRuns: [],
      passedRuns: [],
      latestScore: null,
      lastPassedRuns: [],
      lastCompletedRuns: [],
    };
  }

  const latestScore = findLatestRunWithScore(runs);
  const upcomingRuns = isOfficiallyCompleted ? [] : findUpcomingRuns(runs, activeRun);
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
  const scoringStarted = runs.some(runHasData);
  const isComplete =
    isOfficiallyCompleted ||
    (runs.length > 0 && scoringStarted && !activeRun && !nextRun);
  const provisionalRanking =
    hasRailAdjustment && isComplete ? buildProvisionalRanking(runs) : [];

  return {
    classId,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    arena: classItem?.arena || "",
    pattern: getPatternDisplayName(pattern, customPattern) || pattern,
    headers,
    status: classData.status,
    publicationStatus,
    publicationStatusLabel: getPublicationStatusLabel(publicationStatus),
    liveUpdatedAt:
      classData.scoringSession?.updatedAt ||
      getMultiJudgeLiveUpdatedAt(classData.judgeSessions) ||
      getLatestRunActivityAt(runs) ||
      null,
    runCount: runs.length,
    scoringStarted,
    isComplete,
    hasRailAdjustment,
    provisionalRanking,
    activeRun,
    nextRun,
    secondNextRun,
    upcomingRuns,
    orderRuns,
    passedRuns,
    latestScore,
    lastPassedRuns,
    lastCompletedRuns: lastPassedRuns,
  };
}

function findActiveClasses(classes) {
  return classes.filter(
    (item) =>
      item.activeRun ||
      (item.scoringStarted && item.nextRun) ||
      (item.isScheduleOnly &&
        !item.isComplete &&
        item.publicationStatus === "live_no_score")
  );
}

function normalizeRunForAnnouncer(run, index, headers) {
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
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
    scoreTotal: formatTotalValue(run.scoreTotal),
    judgeScores,
    penTotal: formatTotalValue(run.penTotal),
    note: run.note || "",
    status: run.status || "",
    isActive: Boolean(run.isActive),
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
    scores,
    penalties,
    isComplete: Boolean(run.isComplete),
    isReview: String(run.scoreTotal ?? "").trim() === "Review",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      score: formatScoreValue(scores[manoeuvreIndex]),
      penalty: penalties[manoeuvreIndex] || "",
    })),
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

function findLatestRunWithScore(runs) {
  return [...runs].reverse().find(runHasScore) || null;
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

function findLatestScoredRun(classes) {
  const classWithScore = [...classes]
    .reverse()
    .find((classView) => classView.latestScore);

  if (!classWithScore) return null;

  return {
    classId: classWithScore.classId,
    className: classWithScore.className,
    run: classWithScore.latestScore,
  };
}

function wrapClassRuns(classView, runs) {
  return runs.map((run) => ({
    classId: classView.classId,
    className: classView.className,
    run,
  }));
}

function findRecentPassedRuns(classes, count) {
  return classes
    .flatMap((classView, classIndex) =>
      wrapClassRuns(
        classView,
        classView.passedRuns || classView.lastPassedRuns || []
      ).map((entry) => ({
        ...entry,
        classIndex,
        runOrder: getRunOrder(entry.run),
        completedAt: Date.parse(entry.run?.completedAt || ""),
      }))
    )
    .sort((a, b) => {
      const aCompletedAt = Number.isFinite(a.completedAt) ? a.completedAt : 0;
      const bCompletedAt = Number.isFinite(b.completedAt) ? b.completedAt : 0;

      if (aCompletedAt !== bCompletedAt) return aCompletedAt - bCompletedAt;
      if (a.classIndex !== b.classIndex) return a.classIndex - b.classIndex;
      return a.runOrder - b.runOrder;
    })
    .slice(-count)
    .reverse()
    .map(({ classIndex, runOrder, ...entry }) => entry);
}

function getRunOrder(run) {
  const parsed = Number.parseInt(run?.draw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLatestRunActivityAt(runs) {
  const timestamps = (Array.isArray(runs) ? runs : [])
    .map((run) => run?.completedAt || run?.startedAt || null)
    .filter(Boolean)
    .sort();

  return timestamps[timestamps.length - 1] || null;
}

function runHasScore(run) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(score && score !== "Review");
}

function runIsPassed(run) {
  const status = String(run?.status || "");
  return Boolean(
    runHasScore(run) ||
      run?.completedAt ||
      ["done", "completed", "passed"].includes(status)
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

function runHasData(run) {
  const hasScores = run.scores.some((value) => String(value || "").trim());
  const hasPenalties = run.penalties.some((value) => String(value || "").trim());
  return run.isActive || hasScores || hasPenalties || runHasScore(run);
}

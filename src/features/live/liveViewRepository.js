import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
  getClassesForDayRepository,
} from "../classes/classRepository";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import {
  getPatternDisplayName,
  getPatternHeaders,
} from "../patterns/patternDefinitions";
import { PUBLICATION_STATUSES } from "../publication/publicationRepository";
import { loadActiveManoeuvre } from "../scoring/scoringRepository";

export function getAnnouncerShowView(showId) {
  const days = getDaysByShowId(showId);

  const sections = days.map((day) => {
    const classes = getClassesForDay(day.id).map((classItem) =>
      buildAnnouncerClassView(getClassFullData(classItem.id))
    );

    return {
      day,
      classes,
    };
  });

  const allClasses = sections.flatMap((section) => section.classes);

  const activeClass =
    allClasses.find((item) => item.activeRun) ||
    allClasses.find((item) => item.status === "in_progress") ||
    allClasses.find((item) => item.scoringStarted) ||
    null;

  return {
    sections,
    activeClass,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentPassedRuns(allClasses, 2, activeClass),
  };
}

export async function getAnnouncerShowViewRepository(showId) {
  const days = await getDaysByShowRepository(showId);

  const sections = await Promise.all(
    days.map(async (day) => {
      const classes = await getClassesForDayRepository(day.id);
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
      };
    })
  );

  const allClasses = sections.flatMap((section) => section.classes);

  const activeClass =
    allClasses.find((item) => item.activeRun) ||
    allClasses.find((item) => item.status === "in_progress") ||
    allClasses.find((item) => item.scoringStarted) ||
    null;

  return {
    sections,
    activeClass,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentPassedRuns(allClasses, 2, activeClass),
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
  const headers = getPatternHeaders(pattern);
  const sourceRuns = scoringRuns.length > 0 ? scoringRuns : setupRuns;
  const runs = sourceRuns.map((run, index) =>
    normalizeRunForAnnouncer(run, index, headers)
  );
  const activeManoeuvre = classId ? loadActiveManoeuvre(classId) : null;
  const activeRun =
    runs.find((run) => run.draw === activeManoeuvre?.draw) ||
    runs.find((run) => run.isActive) ||
    null;

  const publicationStatus = classData.publication?.status || "hidden";
  const canShowScores = canShowLatestScore(publicationStatus);
  const latestScore = canShowScores ? findLatestRunWithScore(runs) : null;
  const lastPassedRuns = findLastPassedRuns(runs, activeRun, 2).map((run) =>
    canShowScores ? run : hideScoreDetails(run)
  );

  return {
    classId,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    pattern: getPatternDisplayName(pattern) || pattern,
    headers,
    status: classData.status,
    publicationStatus,
    runCount: runs.length,
    scoringStarted: runs.some(runHasData),
    activeRun,
    nextRun: findNextRun(runs, activeRun),
    latestScore,
    lastPassedRuns,
    lastCompletedRuns: lastPassedRuns,
  };
}

function canShowLatestScore(publicationStatus) {
  return [
    PUBLICATION_STATUSES.LIVE,
    PUBLICATION_STATUSES.OFFICIAL,
    PUBLICATION_STATUSES.PUBLISHED,
  ].includes(publicationStatus);
}

function normalizeRunForAnnouncer(run, index, headers) {
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];

  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    scoreTotal: run.scoreTotal ?? "",
    penTotal: run.penTotal ?? "",
    status: run.status || "",
    isActive: Boolean(run.isActive),
    scores,
    penalties,
    isReview: String(run.scoreTotal ?? "").trim() === "Review",
    manoeuvres: headers.map((name, manoeuvreIndex) => ({
      name,
      score: scores[manoeuvreIndex] || "",
      penalty: penalties[manoeuvreIndex] || "",
    })),
  };
}

function findNextRun(runs, activeRun) {
  if (!runs.length) return null;

  if (!activeRun) {
    return runs.find((run) => !runHasScore(run) && !run.isReview) || null;
  }

  const activeIndex = runs.findIndex((run) =>
    run.id ? run.id === activeRun.id : run.draw === activeRun.draw
  );

  if (activeIndex < 0) return null;

  return (
    runs.slice(activeIndex + 1).find((run) => !runHasScore(run) && !run.isReview) ||
    null
  );
}

function findLatestRunWithScore(runs) {
  return [...runs].reverse().find(runHasScore) || null;
}

function findLastCompletedRuns(runs, count) {
  return runs.filter(runHasScore).slice(-count).reverse();
}

function findLastPassedRuns(runs, activeRun, count) {
  if (!activeRun) {
    return findLastCompletedRuns(runs, count);
  }

  const activeIndex = runs.findIndex((run) =>
    run.id ? run.id === activeRun.id : run.draw === activeRun.draw
  );

  if (activeIndex <= 0) {
    return [];
  }

  return runs.slice(0, activeIndex).slice(-count).reverse();
}

function hideScoreDetails(run) {
  return {
    ...run,
    scoreTotal: "",
    penTotal: "",
    manoeuvres: run.manoeuvres.map((manoeuvre) => ({
      ...manoeuvre,
      score: "",
      penalty: "",
    })),
  };
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

function findRecentPassedRuns(classes, count, activeClass) {
  if (activeClass?.activeRun) {
    return wrapClassRuns(
      activeClass,
      (activeClass.lastPassedRuns || []).slice(0, count)
    );
  }

  return classes
    .flatMap((classView, classIndex) =>
      wrapClassRuns(classView, classView.lastPassedRuns || []).map((entry) => ({
        ...entry,
        classIndex,
        runOrder: getRunOrder(entry.run),
      }))
    )
    .sort((a, b) => {
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

function runHasScore(run) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(score && score !== "Review");
}

function runHasData(run) {
  const hasScores = run.scores.some((value) => String(value || "").trim());
  const hasPenalties = run.penalties.some((value) => String(value || "").trim());
  return run.isActive || hasScores || hasPenalties || runHasScore(run);
}

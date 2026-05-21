import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
  getClassesForDayRepository,
} from "../classes/classRepository";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import { getPatternHeaders } from "../patterns/patternDefinitions";
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

  return {
    sections,
    activeClass:
      allClasses.find((item) => item.activeRun) ||
      allClasses.find((item) => item.status === "in_progress") ||
      allClasses.find((item) => item.scoringStarted) ||
      null,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentScoredRuns(allClasses, 2),
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

  return {
    sections,
    activeClass:
      allClasses.find((item) => item.activeRun) ||
      allClasses.find((item) => item.status === "in_progress") ||
      allClasses.find((item) => item.scoringStarted) ||
      null,
    latestScore: findLatestScoredRun(allClasses),
    recentResults: findRecentScoredRuns(allClasses, 2),
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
  const lastCompletedRuns = canShowScores
    ? findLastCompletedRuns(runs, 2)
    : [];

  return {
    classId,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    pattern,
    headers,
    status: classData.status,
    publicationStatus,
    runCount: runs.length,
    scoringStarted: runs.some(runHasData),
    activeRun,
    nextRun: findNextRun(runs, activeRun),
    latestScore,
    lastCompletedRuns,
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

function findRecentScoredRuns(classes, count) {
  return classes
    .flatMap((classView) =>
      classView.lastCompletedRuns.map((run) => ({
        classId: classView.classId,
        className: classView.className,
        run,
      }))
    )
    .slice(-count)
    .reverse();
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

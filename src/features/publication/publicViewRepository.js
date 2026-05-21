import {
  getClassFullData,
  getClassFullDataRepository,
  getClassesForDay,
  getClassesForDayRepository,
} from "../classes/classRepository";
import { getDaysByShowRepository } from "../days/dayRepository";
import { getDaysByShowId } from "../days/daySelectors";
import { PUBLICATION_STATUSES } from "./publicationRepository";

export function getPublicShowView(showId) {
  const sections = getDaysByShowId(showId).map((day) => {
    const classes = getClassesForDay(day.id)
      .map((classItem) => buildPublicClassView(getClassFullData(classItem.id)))
      .filter(Boolean);

    return {
      day,
      classes,
    };
  });

  const publishedClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
  };
}

export async function getPublicShowViewRepository(showId) {
  const sections = await Promise.all(
    (await getDaysByShowRepository(showId)).map(async (day) => {
      const classes = await getClassesForDayRepository(day.id);
      const classViews = await Promise.all(
        classes.map(async (classItem) =>
          buildPublicClassView(await getClassFullDataRepository(classItem.id))
        )
      );

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

  return {
    sections: sections.filter((section) => section.classes.length > 0),
    publishedClassCount,
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
  const runs = sortPublicResults(
    officialRuns.length > 0 ? officialRuns : classData.scoringRuns || []
  );

  return {
    classId: classItem?.id,
    className: classItem?.name || "Classe",
    classCode: classItem?.classCode || "",
    pattern: official.pattern || classData.setup?.pattern || classItem?.pattern || "",
    publishedAt: publication.publishedAt,
    finalizedAt: official.finalizedAt,
    judgeName: official.judgeName,
    runs,
  };
}

export function sortPublicResults(runs) {
  return [...runs]
    .map(normalizePublicRun)
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

function normalizePublicRun(run, index) {
  return {
    id: run.id,
    draw: run.draw ?? run.order ?? index + 1,
    backNumber: run.backNumber || "",
    rider: run.rider || "",
    horse: run.horse || "",
    owner: run.owner || "",
    scoreTotal: run.scoreTotal ?? "",
    penTotal: run.penTotal ?? "",
  };
}

function parsePublicScore(value) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

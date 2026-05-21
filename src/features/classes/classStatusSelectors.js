import { getClassSetup } from "./classSetupStorage";
import { hasScoringStarted } from "../scoring/scoringSelectors";

function hasValidPattern(setup, classItem) {
  return Boolean(setup?.pattern || classItem?.pattern);
}

function hasRuns(setup) {
  return Array.isArray(setup?.runs) && setup.runs.length > 0;
}

function isFinalizedFromClass(classItem) {
  return Boolean(
    classItem?.finalized ||
      classItem?.status === "completed" ||
      classItem?.judgeSignedAt
  );
}

function isFinalizedFromSetup(setup) {
  return Boolean(setup?.finalized || setup?.judgeSignedAt);
}

export function getClassStatus(classItem) {
  if (!classItem?.id) return "draft";

  if (isFinalizedFromClass(classItem)) {
    return "completed";
  }

  const setup = getClassSetup(classItem.id);

  if (isFinalizedFromSetup(setup)) {
    return "completed";
  }

  const patternOk = hasValidPattern(setup, classItem);
  const runsOk = hasRuns(setup);
  const scoringStarted = hasScoringStarted(classItem.id);

  if (!patternOk || !runsOk) {
    return "draft";
  }

  if (scoringStarted) {
    return "in_progress";
  }

  return "ready";
}

export function getClassStatusLabel(status) {
  switch (status) {
    case "draft":
      return "Draft";
    case "ready":
      return "Setup prêt";
    case "in_progress":
      return "En cours";
    case "completed":
      return "Terminée";
    default:
      return "—";
  }
}
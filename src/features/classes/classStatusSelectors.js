import { getClassSetup } from "./classSetupStorage";
import { hasScoringStarted } from "../scoring/scoringSelectors";
import {
  isCustomPatternReady,
  isNoPatternValue,
} from "../patterns/patternDefinitions";

function hasValidPattern(setup, classItem) {
  const pattern = setup?.pattern || classItem?.pattern;
  const customPattern = setup?.customPattern || classItem?.customPattern || null;

  if (isNoPatternValue(pattern)) {
    return true;
  }

  return Boolean(pattern) && isCustomPatternReady(pattern, customPattern);
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

export function isClassScoringFinalized(classData) {
  return Boolean(
    classData?.official?.isFinalized ||
      classData?.official?.finalized ||
      classData?.official?.judgeSignedAt ||
      isFinalizedFromSetup(classData?.setup) ||
      isFinalizedFromClass(classData?.classItem)
  );
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
  const isScheduleOnly = isNoPatternValue(setup?.pattern || classItem?.pattern);

  if (!patternOk || (!isScheduleOnly && !runsOk)) {
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

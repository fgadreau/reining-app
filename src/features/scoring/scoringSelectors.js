import { getClassById } from "../classes/classSelectors";
import { getRunsByClassId } from "../runs/runSelectors";
import { loadClassSetup } from "../../utils/classLocalStorage";
import { loadScoringRuns } from "./scoringStorage";

function normalizeRunShape(run) {
  return {
    id: run.id,
    draw: run.draw,
    backNumber: run.backNumber || "",
    riderName: run.riderName || "",
    horseName: run.horseName || "",
    ownerName: run.ownerName || "",
    status: run.status || "",
    penalties: run.penalties || ["", "", "", "", "", "", "", ""],
    scores: run.scores || ["", "", "", "", "", "", "", ""],
    penTotal: run.penaltyTotal ?? run.penTotal ?? "",
    scoreTotal: run.finalScore ?? run.scoreTotal ?? "",
  };
}

export function getScoreTableRunsForClass(classId) {
  const classItem = getClassById(classId);

  const setupRuns = loadClassSetup(classId);
  const baseRuns = setupRuns && setupRuns.length > 0 ? setupRuns : getRunsByClassId(classId);

  return baseRuns.map((run) => {
    const normalized = normalizeRunShape(run);

    return {
      ...normalized,
      isActive: classItem?.activeRunId === run.id,
    };
  });
}

function hasNonEmptyValue(value) {
  return String(value || "").trim() !== "";
}

function runHasScoringData(run) {
  const scores = Array.isArray(run?.scores) ? run.scores : [];
  const penalties = Array.isArray(run?.penalties) ? run.penalties : [];
  const isActive = Boolean(run?.isActive);

  const hasScores = scores.some(hasNonEmptyValue);
  const hasPenalties = penalties.some(hasNonEmptyValue);

  return hasScores || hasPenalties || isActive;
}

export function getSavedScoringRunsForClass(classId) {
  return loadScoringRuns(classId);
}

export function hasScoringStarted(classId) {
  const runs = getSavedScoringRunsForClass(classId);
  return runs.some(runHasScoringData);
}

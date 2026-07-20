import { createId } from "../../utils/createId";
import { recalculateRun, runHasVideoReview } from "../../utils/scoring";

const TEST_DRAW_PARTICIPANTS = [
  ["101", "Amélie Tremblay", "Silver Moon", "Écurie du Nord"],
  ["102", "Marc-André Roy", "Custom Spark", "Ferme des Pins"],
  ["103", "Sophie Gagnon", "Whiz N Chrome", "Sophie Gagnon"],
  ["104", "Alex Martin", "Smart Little Rey", "Ranch Martin"],
  ["105", "Camille Bouchard", "Shining Dream", "Julie Bouchard"],
  ["106", "Louis Côté", "Gunna Be Ready", "Écurie Côté"],
  ["107", "Émilie Fortin", "Electric Star", "Ferme Fortin"],
  ["108", "Samuel Bergeron", "Spooks Golden Boy", "Ranch Bergeron"],
];

export const TEST_DRAW_RUN_COUNT = TEST_DRAW_PARTICIPANTS.length;
export const TEST_DRAG_INTERVAL = 4;

export function isScoringTestAssociation(association) {
  return Boolean(association?.isTestMode);
}

export function buildScoringTestDraw() {
  return TEST_DRAW_PARTICIPANTS.map(
    ([backNumber, rider, horse, owner], index) => ({
      id: createId("run"),
      order: index + 1,
      draw: index + 1,
      backNumber,
      rider,
      horse,
      owner,
      classCodes: [],
    })
  );
}

function getTestScoreValue(options, seed) {
  const normalizedOptions = Array.isArray(options) ? options : [];
  if (normalizedOptions.length === 0) return "0";

  const neutralIndex = normalizedOptions.indexOf("0");
  const baseIndex = neutralIndex >= 0
    ? neutralIndex
    : Math.floor(normalizedOptions.length / 2);
  const offsets = [0, 1, 0, -1, 1, 0, -1];
  const nextIndex = Math.min(
    Math.max(baseIndex + offsets[seed % offsets.length], 0),
    normalizedOptions.length - 1
  );

  return normalizedOptions[nextIndex];
}

export function buildCompletedScoringTestRun({
  run,
  runIndex,
  maneuverCount,
  scoreOptionsByIndex,
  scoringCalculationOptions,
  completedAt = new Date().toISOString(),
}) {
  if (!run || runHasVideoReview(run)) return run;

  const scores = Array.from({ length: maneuverCount }, (_, maneuverIndex) => {
    const existingScore = run.scores?.[maneuverIndex];
    if (String(existingScore ?? "").trim()) return existingScore;

    return getTestScoreValue(
      scoreOptionsByIndex?.[maneuverIndex],
      runIndex + maneuverIndex
    );
  });
  const penalties = Array.from(
    { length: maneuverCount },
    (_, maneuverIndex) => run.penalties?.[maneuverIndex] || ""
  );

  return recalculateRun(
    {
      ...run,
      scores,
      penalties,
      startedAt: run.startedAt || completedAt,
      completedAt,
      durationSeconds:
        run.durationSeconds || 145 + ((runIndex * 11) % 35),
      isActive: false,
    },
    scoringCalculationOptions
  );
}

export function getScoringTestFillRange({
  runs,
  maneuverCount,
  dragInterval,
  isRunLocked = () => false,
  fillOne = false,
}) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const startIndex = normalizedRuns.findIndex(
    (run, index) =>
      !isRunLocked(run, index) &&
      !runHasVideoReview(run) &&
      !run.scores?.slice(0, maneuverCount).every((score) =>
        String(score ?? "").trim()
      )
  );

  if (startIndex < 0) return null;
  if (fillOne) return { startIndex, endIndex: startIndex };

  const normalizedInterval = Number.parseInt(dragInterval, 10);
  const endIndex =
    Number.isFinite(normalizedInterval) && normalizedInterval > 0
      ? Math.min(
          Math.ceil((startIndex + 1) / normalizedInterval) *
            normalizedInterval -
            1,
          normalizedRuns.length - 1
        )
      : normalizedRuns.length - 1;

  return { startIndex, endIndex };
}

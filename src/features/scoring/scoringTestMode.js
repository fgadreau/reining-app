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

const TEST_RUN_NOTES = [
  "Run propre et régulière.",
  "Léger manque de contrôle au rollback.",
  "",
  "Bonne cadence et bons arrêts.",
  "À revoir : entrée du deuxième spin.",
  "",
];

export const TEST_DRAW_RUN_COUNT = 12;
export const TEST_DRAW_MAX_RUN_COUNT = 100;
export const TEST_DRAG_INTERVAL = 4;

export function isScoringTestAssociation(association) {
  return Boolean(association?.isTestMode);
}

export function buildScoringTestDraw(runCount = TEST_DRAW_RUN_COUNT) {
  const normalizedCount = Math.min(
    Math.max(Number.parseInt(runCount, 10) || TEST_DRAW_RUN_COUNT, 1),
    TEST_DRAW_MAX_RUN_COUNT
  );

  return Array.from({ length: normalizedCount }, (_, index) => {
    const [, rider, horse, owner] =
      TEST_DRAW_PARTICIPANTS[index % TEST_DRAW_PARTICIPANTS.length];
    const cycle = Math.floor(index / TEST_DRAW_PARTICIPANTS.length) + 1;
    const cycleSuffix = cycle > 1 ? ` ${cycle}` : "";

    return {
      id: createId("run"),
      order: index + 1,
      draw: index + 1,
      backNumber: String(101 + index),
      rider: `${rider}${cycleSuffix}`,
      horse: `${horse}${cycleSuffix}`,
      owner: `${owner}${cycleSuffix}`,
      classCodes: [],
    };
  });
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

function getTestPenaltyValue(penaltyOptions, runIndex) {
  const usableOptions = (Array.isArray(penaltyOptions) ? penaltyOptions : [])
    .map((option) => String(option || "").trim())
    .filter(
      (option) =>
        option &&
        !/score|scratch|révision|revision|disqualification|no score|op/i.test(
          option
        )
    );

  if (runIndex % 3 === 0 || usableOptions.length === 0) return "";
  return usableOptions[(runIndex - 1) % usableOptions.length];
}

export function buildCompletedScoringTestRun({
  run,
  runIndex,
  maneuverCount,
  scoreOptionsByIndex,
  penaltyOptions,
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
  const testPenalty = getTestPenaltyValue(penaltyOptions, runIndex);
  const testPenaltyIndex =
    maneuverCount > 0 ? (runIndex * 2 + 1) % maneuverCount : -1;
  const penalties = Array.from({ length: maneuverCount }, (_, maneuverIndex) => {
    const existingPenalty = run.penalties?.[maneuverIndex];
    if (String(existingPenalty ?? "").trim()) return existingPenalty;
    return maneuverIndex === testPenaltyIndex ? testPenalty : "";
  });

  return recalculateRun(
    {
      ...run,
      scores,
      penalties,
      note: String(run.note || "").trim()
        ? run.note
        : TEST_RUN_NOTES[runIndex % TEST_RUN_NOTES.length],
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

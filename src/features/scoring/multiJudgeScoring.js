import {
  PATTERN_DISCIPLINES,
  getPatternDiscipline,
} from "../patterns/patternDefinitions";

const COMBINED_SCORE_DISCIPLINES = new Set([
  PATTERN_DISCIPLINES.REINING,
  PATTERN_DISCIPLINES.RANCH_RIDING,
  PATTERN_DISCIPLINES.WESTERN_RIDING,
]);

export function classUsesCombinedJudgeScore(patternValue, customPattern = null) {
  return COMBINED_SCORE_DISCIPLINES.has(
    getPatternDiscipline(patternValue, customPattern)
  );
}

export function parseJudgeScoreTotal(value) {
  const score = Number(String(value ?? "").trim());
  return Number.isFinite(score) ? score : null;
}

export function buildCombinedJudgeScore(judgeRuns = []) {
  const scoredJudges = judgeRuns
    .map((judgeRun) => ({
      ...judgeRun,
      numericScore: parseJudgeScoreTotal(judgeRun?.scoreTotal),
    }))
    .filter((judgeRun) => judgeRun.numericScore !== null);

  if (scoredJudges.length === 0 || scoredJudges.length !== judgeRuns.length) {
    return {
      scoreTotal: "",
      retainedJudges: [],
      droppedJudges: [],
      isComplete: false,
    };
  }

  const sortedByScore = [...scoredJudges].sort(
    (a, b) => a.numericScore - b.numericScore
  );
  const droppedJudges =
    scoredJudges.length === 5
      ? [sortedByScore[0], sortedByScore[sortedByScore.length - 1]]
      : [];
  const droppedIds = new Set(droppedJudges.map((judgeRun) => judgeRun.judgeId));
  const retainedJudges = scoredJudges.filter(
    (judgeRun) => !droppedIds.has(judgeRun.judgeId)
  );
  const total = retainedJudges.reduce(
    (sum, judgeRun) => sum + judgeRun.numericScore,
    0
  );

  return {
    scoreTotal: total.toFixed(1),
    retainedJudges,
    droppedJudges,
    isComplete: true,
  };
}

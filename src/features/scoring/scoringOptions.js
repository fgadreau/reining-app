import {
  isRanchRidingPattern,
  isWesternRidingPattern,
} from "../patterns/patternDefinitions";

export const SCORE_OPTIONS = ["-1.5", "-1", "-0.5", "0", "+0.5", "+1", "+1.5"];

const REINING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["½", "1", "2", "5", "Score 0"],
  specialPenaltyTokens: ["Score 0", "No score", "Scratch", "Révision vidéo"],
  statusPenaltyOptions: ["No score", "Scratch", "Révision vidéo"],
};

const RANCH_RIDING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["1", "3", "5"],
  specialPenaltyTokens: ["OP", "Score 0", "Révision vidéo"],
  statusPenaltyOptions: ["OP", "Score 0", "Révision vidéo"],
};

const WESTERN_RIDING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["½", "1", "3", "5"],
  specialPenaltyTokens: ["Score 0", "Disqualification", "Révision vidéo"],
  statusPenaltyOptions: ["Score 0", "Disqualification", "Révision vidéo"],
};

export function getScoringOptionsForPattern(patternValue) {
  if (isWesternRidingPattern(patternValue)) {
    return WESTERN_RIDING_OPTIONS;
  }

  return isRanchRidingPattern(patternValue)
    ? RANCH_RIDING_OPTIONS
    : REINING_OPTIONS;
}

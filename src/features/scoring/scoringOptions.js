import {
  OVERALL_FORM_EFFECTIVENESS_HEADER,
  RANCH_APPEARANCE_HEADER,
  isPerformanceCustomPattern,
  isRanchRidingPattern,
  isSlidingContestPattern,
  isTrailPattern,
  isWesternRidingPattern,
} from "../patterns/patternDefinitions";

export const SCORE_OPTIONS = ["-1½", "-1", "-½", "0", "+½", "+1", "+1½"];
export const PERFORMANCE_SCORE_OPTIONS = [
  "-3",
  "-2½",
  "-2",
  "-1½",
  "-1",
  "-½",
  "0",
  "+½",
  "+1",
  "+1½",
  "+2",
  "+2½",
  "+3",
];
export const OVERALL_FORM_EFFECTIVENESS_OPTIONS = [
  "0",
  "½",
  "1",
  "1½",
  "2",
  "2½",
  "3",
  "3½",
  "4",
  "4½",
  "5",
];

const REINING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["½", "1", "2", "5", "Score 0"],
  specialPenaltyTokens: ["Score 0", "No score", "Scratch", "Révision vidéo"],
  statusPenaltyOptions: ["No score", "Scratch", "Révision vidéo"],
};

const SLIDING_CONTEST_OPTIONS = {
  ...REINING_OPTIONS,
  scoreOptions: PERFORMANCE_SCORE_OPTIONS,
};

const RANCH_RIDING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["1", "3", "5"],
  specialPenaltyTokens: ["OP", "Score 0", "Révision vidéo"],
  statusPenaltyOptions: ["OP", "Score 0", "Révision vidéo"],
  penaltyDisabledHeaders: [RANCH_APPEARANCE_HEADER],
};

const WESTERN_RIDING_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["½", "1", "3", "5"],
  specialPenaltyTokens: ["Score 0", "Disqualification", "Révision vidéo"],
  statusPenaltyOptions: ["Score 0", "Disqualification", "Révision vidéo"],
};

const TRAIL_OPTIONS = {
  scoreOptions: SCORE_OPTIONS,
  penaltyOptions: ["½", "1", "3", "5"],
  specialPenaltyTokens: ["Score 0", "Disqualification", "Révision vidéo"],
  statusPenaltyOptions: ["Score 0", "Disqualification", "Révision vidéo"],
};

const PERFORMANCE_CUSTOM_OPTIONS = {
  baseScore: 70,
  scoreOptions: PERFORMANCE_SCORE_OPTIONS,
  scoreOptionsByHeader: {
    [OVERALL_FORM_EFFECTIVENESS_HEADER]: OVERALL_FORM_EFFECTIVENESS_OPTIONS,
  },
  penaltyOptions: ["3", "5", "10"],
  specialPenaltyTokens: ["Disqualification", "Révision vidéo"],
  statusPenaltyOptions: ["Disqualification", "Révision vidéo"],
  penaltyDisabledHeaders: [OVERALL_FORM_EFFECTIVENESS_HEADER],
};

export function getScoringOptionsForPattern(patternValue, customPattern = null) {
  if (isSlidingContestPattern(patternValue)) {
    return SLIDING_CONTEST_OPTIONS;
  }

  if (isPerformanceCustomPattern(patternValue, customPattern)) {
    return PERFORMANCE_CUSTOM_OPTIONS;
  }

  if (isTrailPattern(patternValue, customPattern)) {
    return TRAIL_OPTIONS;
  }

  if (isWesternRidingPattern(patternValue, customPattern)) {
    return WESTERN_RIDING_OPTIONS;
  }

  return isRanchRidingPattern(patternValue, customPattern)
    ? RANCH_RIDING_OPTIONS
    : REINING_OPTIONS;
}

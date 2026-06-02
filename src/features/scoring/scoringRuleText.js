import { OVERALL_FORM_EFFECTIVENESS_HEADER } from "../patterns/patternDefinitions";
import { getScoringOptionsForPattern } from "./scoringOptions";
import { formatScoreValue, parseScoreValue } from "../../utils/scoring";

function safeText(value) {
  return String(value ?? "");
}

function formatRuleOptions(options = []) {
  return options.map((option) => safeText(option)).filter(Boolean).join(" / ");
}

function formatScoreOptionForRule(option) {
  return formatScoreValue(option) || safeText(option);
}

function getScoreStepText(scoreOptions = []) {
  const numericOptions = scoreOptions
    .map((option) => parseScoreValue(option))
    .filter((option) => Number.isFinite(option));

  if (numericOptions.length < 2) {
    return "";
  }

  const usesHalfPointSteps = numericOptions.every((option, index) => {
    if (index === 0) return true;
    return Math.abs(option - numericOptions[index - 1] - 0.5) < 0.001;
  });

  return usesHalfPointSteps ? " by 1/2 point" : "";
}

function getScoreRuleText(scoreOptions = []) {
  const firstOption = safeText(scoreOptions[0]);
  const lastOption = safeText(scoreOptions[scoreOptions.length - 1]);
  const firstScore = parseScoreValue(firstOption);
  const lastScore = parseScoreValue(lastOption);

  if (firstOption === "-3" && lastOption === "+3") {
    return "MANEUVER SCORES: -3 Extremely Poor   -2 Very Poor   -1 Poor   0 Average   +1 Good   +2 Very Good   +3 Excellent (1/2 point increments)";
  }

  if (
    firstOption &&
    lastOption &&
    (Math.abs(firstScore + 1.5) > 0.001 ||
      Math.abs(lastScore - 1.5) > 0.001)
  ) {
    return `MANEUVER SCORES: ${formatScoreOptionForRule(
      firstOption
    )} to ${formatScoreOptionForRule(lastOption)}${getScoreStepText(
      scoreOptions
    )}`;
  }

  return "MANEUVER SCORES: -1½ Extremely Poor   -1 Very Poor   -½ Poor   0 Correct   +½ Good   +1 Very Good   +1½ Excellent";
}

export function getScoreRuleLines(patternValue, customPattern) {
  const scoringOptions = getScoringOptionsForPattern(patternValue, customPattern);
  const lines = [getScoreRuleText(scoringOptions.scoreOptions)];
  const penaltyOptions = formatRuleOptions(scoringOptions.penaltyOptions);
  const specialOptions = formatRuleOptions(
    (scoringOptions.statusPenaltyOptions || []).filter(
      (option) => option !== "Révision vidéo"
    )
  );

  if (scoringOptions.scoreOptionsByHeader?.[OVERALL_FORM_EFFECTIVENESS_HEADER]) {
    lines.push("F&E / Overall form and effectiveness: 0 to 5, no penalties in that cell");
  }

  if (penaltyOptions || specialOptions) {
    lines.push(
      [
        penaltyOptions ? `PENALTIES: ${penaltyOptions}` : "",
        specialOptions ? `SPECIAL: ${specialOptions}` : "",
      ]
        .filter(Boolean)
        .join("   ")
    );
  }

  return lines;
}

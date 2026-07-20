export const CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH = 8000;

function normalizeRuleText(value) {
  return String(value || "")
    .trim()
    .slice(0, CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH);
}

export function normalizeChampionshipRules(source = {}) {
  const normalizedSource = source || {};

  return {
    rulesStatement: normalizeRuleText(normalizedSource.rulesStatement),
    pointsExplanation: normalizeRuleText(normalizedSource.pointsExplanation),
  };
}

export function hasChampionshipRules(source = {}) {
  const rules = normalizeChampionshipRules(source);
  return Boolean(rules.rulesStatement || rules.pointsExplanation);
}

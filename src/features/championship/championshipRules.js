export const CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH = 8000;

function normalizeRuleText(value) {
  return String(value || "")
    .trim()
    .slice(0, CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH);
}

export function normalizeChampionshipRules(source = {}) {
  return {
    rulesStatement: normalizeRuleText(source.rulesStatement),
    pointsExplanation: normalizeRuleText(source.pointsExplanation),
  };
}

export function hasChampionshipRules(source = {}) {
  const rules = normalizeChampionshipRules(source);
  return Boolean(rules.rulesStatement || rules.pointsExplanation);
}

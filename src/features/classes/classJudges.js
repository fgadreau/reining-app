export const MAX_CLASS_JUDGES = 5;
export const DEFAULT_JUDGE_ID = "judge-1";

function normalizeJudgeName(value, trimName = true) {
  const name = String(value || "");
  return trimName ? name.trim() : name;
}

export function createClassJudge(index = 0, name = "", options = {}) {
  const order = index + 1;
  const trimName = options.trimName !== false;

  return {
    id: `judge-${order}`,
    name: normalizeJudgeName(name, trimName),
    order,
  };
}

export function normalizeClassJudges(input = {}, options = {}) {
  const trimNames = options.trimNames !== false;
  const sourceJudges = Array.isArray(input?.judges) ? input.judges : [];
  const legacyJudgeName = normalizeJudgeName(input?.judgeName, trimNames);
  const normalized = [];
  const usedIds = new Set();

  sourceJudges.slice(0, MAX_CLASS_JUDGES).forEach((judge, index) => {
    const fallback = createClassJudge(index, "", { trimName: trimNames });
    const rawId = String(judge?.id || fallback.id).trim();
    const id = rawId && !usedIds.has(rawId) ? rawId : fallback.id;

    usedIds.add(id);
    normalized.push({
      id,
      name: normalizeJudgeName(judge?.name, trimNames),
      order: Number.isFinite(Number(judge?.order))
        ? Number(judge.order)
        : index + 1,
    });
  });

  if (normalized.length === 0) {
    normalized.push(createClassJudge(0, legacyJudgeName, { trimName: trimNames }));
  }

  return normalized
    .slice(0, MAX_CLASS_JUDGES)
    .sort((a, b) => a.order - b.order)
    .map((judge, index) => ({
      ...judge,
      id: judge.id || createClassJudge(index).id,
      order: index + 1,
    }));
}

export function getPrimaryJudgeName(input = {}) {
  const [primaryJudge] = normalizeClassJudges(input);
  return primaryJudge?.name || "";
}

export function getJudgeDisplayName(judge, index = 0) {
  const name = String(judge?.name || "").trim();
  return name || `Juge ${index + 1}`;
}

export function isMultiJudgeSetup(input = {}) {
  return normalizeClassJudges(input).length > 1;
}

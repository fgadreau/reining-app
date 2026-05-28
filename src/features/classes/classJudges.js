export const MAX_CLASS_JUDGES = 5;
export const DEFAULT_JUDGE_ID = "judge-1";

export function createClassJudge(index = 0, name = "") {
  const order = index + 1;

  return {
    id: `judge-${order}`,
    name: String(name || "").trim(),
    order,
  };
}

export function normalizeClassJudges(input = {}) {
  const sourceJudges = Array.isArray(input?.judges) ? input.judges : [];
  const legacyJudgeName = String(input?.judgeName || "").trim();
  const normalized = [];
  const usedIds = new Set();

  sourceJudges.slice(0, MAX_CLASS_JUDGES).forEach((judge, index) => {
    const fallback = createClassJudge(index);
    const rawId = String(judge?.id || fallback.id).trim();
    const id = rawId && !usedIds.has(rawId) ? rawId : fallback.id;

    usedIds.add(id);
    normalized.push({
      id,
      name: String(judge?.name || "").trim(),
      order: Number.isFinite(Number(judge?.order))
        ? Number(judge.order)
        : index + 1,
    });
  });

  if (normalized.length === 0) {
    normalized.push(createClassJudge(0, legacyJudgeName));
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

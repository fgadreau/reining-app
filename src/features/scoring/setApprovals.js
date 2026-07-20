import { runHasVideoReview } from "../../utils/scoring";

export const SET_APPROVAL_MODES = {
  PER_SET: "per_set",
  CLASS_END: "class_end",
};

export function normalizeSetApprovalMode(value) {
  return value === SET_APPROVAL_MODES.PER_SET
    ? SET_APPROVAL_MODES.PER_SET
    : SET_APPROVAL_MODES.CLASS_END;
}

export function normalizeSetApproval(approval = {}) {
  const startIndex = Number(approval.startIndex);
  const endIndex = Number(approval.endIndex);

  return {
    id: String(approval.id || ""),
    setNumber: Math.max(Number.parseInt(approval.setNumber, 10) || 1, 1),
    startIndex:
      Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 0,
    endIndex:
      Number.isInteger(endIndex) && endIndex >= 0 ? endIndex : 0,
    startDraw: approval.startDraw ?? null,
    endDraw: approval.endDraw ?? null,
    runKeys: Array.isArray(approval.runKeys)
      ? approval.runKeys.map(String).filter(Boolean)
      : [],
    runs: Array.isArray(approval.runs) ? approval.runs : [],
    judgeId: String(approval.judgeId || ""),
    judgeName: String(approval.judgeName || "").trim(),
    judgeSignature: approval.judgeSignature || null,
    signedAt: approval.signedAt || null,
    sentAt: approval.sentAt || approval.signedAt || null,
    pdfFileName: String(approval.pdfFileName || ""),
  };
}

export function normalizeSetApprovals(value) {
  return (Array.isArray(value) ? value : [])
    .map(normalizeSetApproval)
    .filter(
      (approval) =>
        approval.id &&
        approval.signedAt &&
        approval.judgeSignature &&
        approval.endIndex >= approval.startIndex
    )
    .sort(
      (first, second) =>
        first.setNumber - second.setNumber ||
        first.startIndex - second.startIndex
    );
}

export function getRunApprovalKey(run, index = 0) {
  if (run?.id) return `id:${run.id}`;
  if (run?.draw != null) return `draw:${run.draw}`;
  return `index:${index}`;
}

export function getLockedRunKeys(approvals) {
  return new Set(
    normalizeSetApprovals(approvals).flatMap((approval) => approval.runKeys)
  );
}

export function getNextSetRange({ runs, approvals, endIndex }) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const normalizedEndIndex = Math.min(
    Math.max(Number.parseInt(endIndex, 10) || 0, 0),
    Math.max(normalizedRuns.length - 1, 0)
  );
  const normalizedApprovals = normalizeSetApprovals(approvals);
  const lastApprovedEndIndex = normalizedApprovals.reduce(
    (latest, approval) => Math.max(latest, approval.endIndex),
    -1
  );
  const startIndex = lastApprovedEndIndex + 1;

  if (
    normalizedRuns.length === 0 ||
    startIndex < 0 ||
    startIndex > normalizedEndIndex
  ) {
    return null;
  }

  const setRuns = normalizedRuns.slice(startIndex, normalizedEndIndex + 1);

  return {
    setNumber: normalizedApprovals.length + 1,
    startIndex,
    endIndex: normalizedEndIndex,
    startDraw: setRuns[0]?.draw ?? startIndex + 1,
    endDraw:
      setRuns[setRuns.length - 1]?.draw ?? normalizedEndIndex + 1,
    runs: setRuns,
  };
}

export function getPendingVideoReviewRunsForSet(setRange) {
  return (setRange?.runs || []).filter(runHasVideoReview);
}

export function buildSetApproval({
  setRange,
  judgeId = "",
  judgeName,
  judgeSignature,
  signedAt = new Date().toISOString(),
  pdfFileName = "",
}) {
  if (!setRange || !judgeSignature || !String(judgeName || "").trim()) {
    return null;
  }

  const runs = setRange.runs.map((run) => ({
    ...run,
    isActive: false,
  }));
  const runKeys = runs.map((run, offset) =>
    getRunApprovalKey(run, setRange.startIndex + offset)
  );
  const normalizedJudgeId = String(judgeId || "");

  return normalizeSetApproval({
    id: [
      normalizedJudgeId || "single",
      setRange.setNumber,
      signedAt,
    ].join(":"),
    ...setRange,
    runs,
    runKeys,
    judgeId: normalizedJudgeId,
    judgeName,
    judgeSignature,
    signedAt,
    sentAt: signedAt,
    pdfFileName,
  });
}

export function areAllRunsApproved(runs, approvals) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const lockedKeys = getLockedRunKeys(approvals);

  return (
    normalizedRuns.length > 0 &&
    normalizedRuns.every((run, index) =>
      lockedKeys.has(getRunApprovalKey(run, index))
    )
  );
}

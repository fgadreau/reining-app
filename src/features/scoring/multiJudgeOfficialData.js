import {
  getJudgeDisplayName,
  normalizeClassJudges,
} from "../classes/classJudges";

export function runHasScoringData(run) {
  const scores = Array.isArray(run?.scores) ? run.scores : [];
  const penalties = Array.isArray(run?.penalties) ? run.penalties : [];

  return (
    run?.isActive ||
    scores.some((value) => String(value || "").trim()) ||
    penalties.some((value) => String(value || "").trim()) ||
    String(run?.note || "").trim()
  );
}

export function getJudgeSheetSummary(classData) {
  const judges = normalizeClassJudges({
    judges: classData?.judges || classData?.setup?.judges,
    judgeName: classData?.setup?.judgeName || classData?.classItem?.judgeName,
  });
  const sessions = Array.isArray(classData?.judgeSessions)
    ? classData.judgeSessions
    : [];
  const sessionByJudgeId = new Map(
    sessions.map((session) => [session?.judgeId, session])
  );
  const rows = judges.map((judge, index) => {
    const session = sessionByJudgeId.get(judge.id) || {};
    const runs = Array.isArray(session.runs) ? session.runs : [];
    const signed = Boolean(session.finalized && session.judgeSignature);
    const started = Boolean(
      signed ||
        session.claimedBy ||
        session.activeManoeuvre ||
        runs.some(runHasScoringData)
    );

    return {
      judge,
      session,
      index,
      displayName: getJudgeDisplayName(judge, index),
      started,
      signed,
    };
  });
  const isMultiJudge = judges.length > 1;

  return {
    judges,
    rows,
    isMultiJudge,
    anyStarted: rows.some((row) => row.started),
    allSigned: isMultiJudge && rows.length > 0 && rows.every((row) => row.signed),
  };
}

export function buildMultiJudgeOfficialRuns(classData, judgeRows = null) {
  const rows = Array.isArray(judgeRows)
    ? judgeRows
    : getJudgeSheetSummary(classData).rows;
  const setupRuns = Array.isArray(classData?.setup?.runs)
    ? classData.setup.runs
    : [];

  if (setupRuns.length === 0) {
    return rows.flatMap((row) =>
      (Array.isArray(row.session?.runs) ? row.session.runs : []).map((run) => ({
        ...run,
        judgeId: row.judge.id,
        judgeName: row.session?.judgeName || row.displayName,
        judgeOrder: row.judge.order || row.index + 1,
      }))
    );
  }

  return setupRuns.flatMap((setupRun, index) =>
    rows.map((row) => {
      const judgeRun = findMatchingJudgeRun(row.session?.runs, setupRun, index);

      return {
        ...setupRun,
        ...(judgeRun || {}),
        draw: setupRun.draw ?? setupRun.order ?? judgeRun?.draw ?? index + 1,
        order: setupRun.order ?? index + 1,
        backNumber: setupRun.backNumber || judgeRun?.backNumber || "",
        rider: setupRun.rider || judgeRun?.rider || "",
        horse: setupRun.horse || judgeRun?.horse || "",
        owner: setupRun.owner || judgeRun?.owner || "",
        judgeId: row.judge.id,
        judgeName: row.session?.judgeName || row.displayName,
        judgeOrder: row.judge.order || row.index + 1,
      };
    })
  );
}

export function getJudgeSignatureEntries(classData, judgeRows = null) {
  const rows = Array.isArray(judgeRows)
    ? judgeRows
    : getJudgeSheetSummary(classData).rows;

  return rows.map((row) => ({
    judgeId: row.judge.id,
    judgeName: row.session?.judgeName || row.displayName,
    judgeSignature: row.session?.judgeSignature || null,
    finalizedAt: row.session?.finalizedAt || row.session?.judgeSignedAt || null,
    judgeSignedAt: row.session?.judgeSignedAt || row.session?.finalizedAt || null,
  }));
}

export function getLatestTimestamp(values) {
  const sortedValues = values.filter(Boolean).sort();
  return sortedValues[sortedValues.length - 1] || new Date().toISOString();
}

function findMatchingJudgeRun(runs, setupRun, index) {
  const judgeRuns = Array.isArray(runs) ? runs : [];
  const setupDraw = setupRun?.draw ?? setupRun?.order ?? index + 1;

  return (
    judgeRuns.find((run) => run?.id && run.id === setupRun?.id) ||
    judgeRuns.find((run) => (run?.draw ?? run?.order) === setupDraw) ||
    null
  );
}

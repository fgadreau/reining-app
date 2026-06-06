import {
  formatTotalValue,
  parseScoreTotalValue,
} from "../../utils/scoring";
import {
  getPatternDisplayName,
} from "../patterns/patternDefinitions";
import {
  buildCombinedJudgeScore,
  classUsesCombinedJudgeScore,
} from "../scoring/multiJudgeScoring";
import {
  getJudgeSheetSummary,
} from "../scoring/multiJudgeOfficialData";

function normalizeClassCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeBlockClasses(value) {
  return Array.from(
    new Map(
      (Array.isArray(value) ? value : [])
        .map((classEntry) => {
          const code = normalizeClassCode(classEntry?.code);
          if (!code) return null;

          return [
            code,
            {
              code,
              name: String(classEntry?.name || "").trim(),
              classNumber: String(classEntry?.classNumber || "").trim(),
              association: String(classEntry?.association || "").trim(),
            },
          ];
        })
        .filter(Boolean)
    ).values()
  );
}

export function normalizeResultGroups(value) {
  return (Array.isArray(value) ? value : [])
    .map((group) => ({
      id: String(group?.id || group?.code || "").trim(),
      sourceClassId: group?.sourceClassId || group?.source_class_id || "",
      code: normalizeClassCode(group?.code),
      className: String(group?.className || group?.class_name || "").trim(),
      classCode: normalizeClassCode(group?.classCode || group?.class_code),
      parentClassName: String(
        group?.parentClassName || group?.parent_class_name || ""
      ).trim(),
      pattern: String(group?.pattern || "").trim(),
      entries: normalizeResultEntries(group?.entries),
    }))
    .filter((group) => group.id && group.entries.length > 0);
}

export function buildClassResultGroups(classData) {
  const classItem = classData?.classItem || {};
  const setup = classData?.setup || {};
  const patternValue = setup.pattern || classItem.pattern || "";
  const customPattern = setup.customPattern || classItem.customPattern || null;
  const pattern =
    getPatternDisplayName(patternValue, customPattern) || patternValue || "";
  const setupRuns = Array.isArray(setup.runs) ? setup.runs : [];
  const blockClasses = normalizeBlockClasses(setup.blockClasses);
  const blockClassByCode = new Map(
    blockClasses.map((classEntry) => [classEntry.code, classEntry])
  );
  const runs = buildResultSourceRuns(classData);
  const fallbackCode = normalizeClassCode(classItem.classCode) || "RESULTS";
  const groupsByCode = new Map();

  runs.forEach((run, index) => {
    const setupRun = findMatchingSetupRun(setupRuns, run, index);
    const classCodes = getRunClassCodes(run, setupRun, fallbackCode);
    const entry = normalizeResultEntry(
      {
        ...setupRun,
        ...run,
        classCodes,
      },
      index
    );

    classCodes.forEach((code) => {
      const blockClass = blockClassByCode.get(code);
      const group = getOrCreateGroup(groupsByCode, {
        sourceClassId: classItem.id,
        code,
        className:
          blockClass?.name ||
          (code === fallbackCode ? classItem.name : "") ||
          code,
        classCode: code,
        parentClassName: classItem.name || "",
        pattern,
      });

      group.entries.push(entry);
    });
  });

  return Array.from(groupsByCode.values())
    .map((group) => ({
      ...group,
      entries: rankResultEntries(group.entries),
    }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function buildResultSourceRuns(classData) {
  const judgeSummary = getJudgeSheetSummary(classData);

  if (judgeSummary.isMultiJudge && Array.isArray(classData?.setup?.runs)) {
    return buildMultiJudgeResultRuns(classData, judgeSummary.rows);
  }

  const officialRuns = Array.isArray(classData?.official?.officialRuns)
    ? classData.official.officialRuns
    : [];

  if (officialRuns.length > 0) return officialRuns;

  return Array.isArray(classData?.scoringRuns) ? classData.scoringRuns : [];
}

function buildMultiJudgeResultRuns(classData, judgeRows) {
  const setup = classData?.setup || {};
  const classItem = classData?.classItem || {};
  const setupRuns = Array.isArray(setup.runs) ? setup.runs : [];
  const patternValue = setup.pattern || classItem.pattern || "";
  const customPattern = setup.customPattern || classItem.customPattern || null;
  const canCombineScores = classUsesCombinedJudgeScore(patternValue, customPattern);

  if (!canCombineScores) {
    return Array.isArray(classData?.official?.officialRuns)
      ? classData.official.officialRuns
      : [];
  }

  return setupRuns.map((setupRun, index) => {
    const judgeRuns = judgeRows
      .map((row) => {
        const run = findMatchingSetupRun(row.session?.runs, setupRun, index);
        if (!run) return null;

        return {
          ...run,
          judgeId: row.judge.id,
          judgeName: row.session?.judgeName || row.displayName,
          judgeOrder: row.judge.order || row.index + 1,
        };
      })
      .filter(Boolean);
    const combinedScore = buildCombinedJudgeScore(judgeRuns);

    return {
      ...setupRun,
      scoreTotal: combinedScore.scoreTotal || "",
      judgeScores: judgeRuns.map((run) => ({
        judgeId: run.judgeId,
        judgeName: run.judgeName,
        scoreTotal: formatTotalValue(run.scoreTotal),
      })),
    };
  });
}

function findMatchingSetupRun(runs, sourceRun, index) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  const draw = sourceRun?.draw ?? sourceRun?.order ?? index + 1;

  return (
    sourceRuns.find((run) => run?.id && run.id === sourceRun?.id) ||
    sourceRuns.find((run) => (run?.draw ?? run?.order) === draw) ||
    null
  );
}

function getRunClassCodes(run, setupRun, fallbackCode) {
  const sourceCodes = Array.isArray(run?.classCodes) && run.classCodes.length
    ? run.classCodes
    : Array.isArray(setupRun?.classCodes)
      ? setupRun.classCodes
      : [];
  const codes = sourceCodes.map(normalizeClassCode).filter(Boolean);

  return codes.length ? Array.from(new Set(codes)) : [fallbackCode];
}

function getOrCreateGroup(groupsByCode, groupDetails) {
  const key = groupDetails.code;

  if (!groupsByCode.has(key)) {
    groupsByCode.set(key, {
      id: `${groupDetails.sourceClassId || "class"}-${key}`,
      ...groupDetails,
      entries: [],
    });
  }

  return groupsByCode.get(key);
}

function normalizeResultEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map(normalizeResultEntry);
}

function normalizeResultEntry(run, index = 0) {
  return {
    id: run?.id || `${run?.draw ?? index + 1}-${run?.backNumber || index}`,
    rank: run?.rank ?? index + 1,
    draw: run?.draw ?? run?.order ?? index + 1,
    order: run?.order ?? index + 1,
    backNumber: run?.backNumber || "",
    rider: run?.rider || "",
    horse: run?.horse || "",
    owner: run?.owner || "",
    scoreTotal: formatTotalValue(run?.scoreTotal),
    penTotal: formatTotalValue(run?.penTotal),
    status: String(run?.status || "").trim(),
    judgeScores: Array.isArray(run?.judgeScores) ? run.judgeScores : [],
    classCodes: Array.isArray(run?.classCodes)
      ? run.classCodes.map(normalizeClassCode).filter(Boolean)
      : [],
  };
}

function rankResultEntries(entries) {
  return [...entries]
    .sort(compareResultEntries)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function compareResultEntries(a, b) {
  const aScore = parseResultScore(a.scoreTotal);
  const bScore = parseResultScore(b.scoreTotal);

  if (aScore != null && bScore != null && aScore !== bScore) {
    return bScore - aScore;
  }

  if (aScore != null && bScore == null) return -1;
  if (aScore == null && bScore != null) return 1;

  const aDraw = Number(a.draw);
  const bDraw = Number(b.draw);

  if (Number.isFinite(aDraw) && Number.isFinite(bDraw) && aDraw !== bDraw) {
    return aDraw - bDraw;
  }

  return String(a.rider || "").localeCompare(String(b.rider || ""));
}

function parseResultScore(value) {
  const parsed = parseScoreTotalValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

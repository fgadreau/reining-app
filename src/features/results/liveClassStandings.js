import { formatTotalValue, parseScoreTotalValue } from "../../utils/scoring";
import { normalizeBlockClasses } from "./classResults";

const DEFAULT_VISIBLE_ENTRIES = null;

function normalizeClassCode(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*-\s*/g, "-")
    .toUpperCase();
}

export function buildLiveClassStandings({
  runs = [],
  setupRuns = [],
  blockClasses = [],
  classItem = {},
  visibleEntryCount = DEFAULT_VISIBLE_ENTRIES,
} = {}) {
  const hasExplicitClassGroups = hasClassStandingSource({
    runs,
    setupRuns,
    blockClasses,
  });
  const sourceRuns = Array.isArray(runs) ? runs : [];
  if (!sourceRuns.length) return [];

  const normalizedBlockClasses = normalizeBlockClasses(blockClasses);
  const blockClassByCode = new Map(
    normalizedBlockClasses.map((classEntry) => [classEntry.code, classEntry])
  );
  const blockClassOrder = new Map(
    normalizedBlockClasses.map((classEntry, index) => [classEntry.code, index])
  );
  const fallbackCode = normalizeClassCode(classItem?.classCode) || "RESULTS";
  const groupsByCode = new Map();

  sourceRuns.forEach((run, index) => {
    const setupRun = findMatchingSetupRun(setupRuns, run, index);
    const explicitClassCodes = getRunClassCodes(run, setupRun);
    const classCodes =
      explicitClassCodes.length || hasExplicitClassGroups
        ? explicitClassCodes
        : [fallbackCode];

    if (!classCodes.length) return;

    const entry = normalizeStandingEntry(
      mergeStandingRunWithSetupRun(run, setupRun, classCodes),
      index
    );

    if (!entry) return;

    classCodes.forEach((code) => {
      const blockClass = blockClassByCode.get(code);
      const group = getOrCreateGroup(groupsByCode, {
        sourceClassId: classItem?.id,
        code,
        className:
          blockClass?.name ||
          (code === fallbackCode ? classItem?.name : "") ||
          code,
        classCode: code,
        parentClassName: classItem?.name || "",
      });

      group.entries.push(entry);
    });
  });

  return Array.from(groupsByCode.values())
    .map((group) => {
      const entries = rankStandingEntries(group.entries);

      return {
        ...group,
        entries,
        visibleEntries: getVisibleStandingEntries(entries, visibleEntryCount),
        entryCount: entries.length,
      };
    })
    .filter((group) => group.entries.length > 0)
    .sort((a, b) => compareStandingGroups(a, b, blockClassOrder));
}

function getVisibleStandingEntries(entries, visibleEntryCount) {
  const limit = Number.parseInt(visibleEntryCount, 10);

  if (!Number.isFinite(limit) || limit <= 0) {
    return entries;
  }

  return entries.slice(0, limit);
}

function hasClassStandingSource({ runs, setupRuns, blockClasses }) {
  return (
    normalizeBlockClasses(blockClasses).length > 0 ||
    hasRunClassCodes(runs) ||
    hasRunClassCodes(setupRuns)
  );
}

function hasRunClassCodes(runs) {
  return (Array.isArray(runs) ? runs : []).some(
    (run) => getRunClassCodes(run, null).length > 0
  );
}

function getRunClassCodes(run, setupRun) {
  const sourceCodes =
    Array.isArray(run?.classCodes) && run.classCodes.length
      ? run.classCodes
      : Array.isArray(setupRun?.classCodes)
        ? setupRun.classCodes
        : [];

  return Array.from(
    new Set(sourceCodes.map(normalizeClassCode).filter(Boolean))
  );
}

function findMatchingSetupRun(runs, sourceRun, index) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  const draw = sourceRun?.draw ?? sourceRun?.order ?? index + 1;

  return (
    sourceRuns.find((run) => run?.id && run.id === sourceRun?.id) ||
    sourceRuns.find((run) => String(run?.draw ?? run?.order ?? "") === String(draw)) ||
    null
  );
}

function getOrCreateGroup(groupsByCode, groupDetails) {
  if (!groupsByCode.has(groupDetails.code)) {
    groupsByCode.set(groupDetails.code, {
      id: `${groupDetails.sourceClassId || "class"}-${groupDetails.code}`,
      ...groupDetails,
      entries: [],
    });
  }

  return groupsByCode.get(groupDetails.code);
}

function mergeStandingRunWithSetupRun(run, setupRun, classCodes) {
  return {
    ...setupRun,
    ...run,
    backNumber: run?.backNumber || setupRun?.backNumber || "",
    rider: run?.rider || setupRun?.rider || "",
    horse: run?.horse || setupRun?.horse || "",
    owner: run?.owner || setupRun?.owner || "",
    classCodes,
  };
}

function normalizeStandingEntry(run, index = 0) {
  const scoreTotal = formatTotalValue(run?.scoreTotal);
  const cleanScore = String(scoreTotal || "").trim();

  if (!cleanScore || cleanScore === "Review") {
    return null;
  }

  return {
    id: run?.id || `${run?.draw ?? index + 1}-${run?.backNumber || index}`,
    draw: run?.draw ?? run?.order ?? index + 1,
    order: run?.order ?? index + 1,
    backNumber: run?.backNumber || "",
    rider: run?.rider || "",
    horse: run?.horse || "",
    owner: run?.owner || "",
    riderContactId: run?.riderContactId || "",
    memberNrha: run?.memberNrha || "",
    horseId: run?.horseId || "",
    horseNrha: run?.horseNrha || "",
    scoreTotal,
    scoreValue: parseStandingScore(scoreTotal),
    status: String(run?.status || "").trim(),
  };
}

function rankStandingEntries(entries) {
  return [...entries]
    .sort(compareStandingEntries)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function compareStandingEntries(a, b) {
  if (a.scoreValue != null && b.scoreValue != null && a.scoreValue !== b.scoreValue) {
    return b.scoreValue - a.scoreValue;
  }

  if (a.scoreValue != null && b.scoreValue == null) return -1;
  if (a.scoreValue == null && b.scoreValue != null) return 1;

  const aDraw = Number(a.draw);
  const bDraw = Number(b.draw);

  if (Number.isFinite(aDraw) && Number.isFinite(bDraw) && aDraw !== bDraw) {
    return aDraw - bDraw;
  }

  return String(a.rider || "").localeCompare(String(b.rider || ""));
}

function compareStandingGroups(a, b, blockClassOrder) {
  const aOrder = blockClassOrder.get(a.code);
  const bOrder = blockClassOrder.get(b.code);

  if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  if (Number.isFinite(aOrder)) return -1;
  if (Number.isFinite(bOrder)) return 1;

  return String(a.code || "").localeCompare(String(b.code || ""));
}

function parseStandingScore(value) {
  const parsed = parseScoreTotalValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

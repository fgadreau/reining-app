import { createId } from "../../utils/createId";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  normalizeDragDurationMinutes,
  normalizeDragInterval,
} from "./classTiming";
import { normalizeCustomPattern } from "../patterns/patternDefinitions";

const STORAGE_KEY = "reining_class_setup_v1";

export function getAllClassSetups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture class setup storage:", error);
    return {};
  }
}

export function getClassSetup(classId) {
  const all = getAllClassSetups();
  const setup = all[classId];

  if (!setup) {
    return normalizeSetup();
  }

  return normalizeSetup(setup);
}

export function saveClassSetup(classId, setup) {
  try {
    const all = getAllClassSetups();
    all[classId] = normalizeSetup(setup);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Erreur sauvegarde class setup storage:", error);
  }
}

export function deleteClassSetup(classId) {
  try {
    const all = getAllClassSetups();
    delete all[classId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error("Erreur suppression class setup storage:", error);
  }
}

export function normalizeClassSetup(setup = {}) {
  return normalizeSetup(setup);
}

export function createEmptyRun(nextOrder = 1) {
  return {
    id: createId("run"),
    order: nextOrder,
    backNumber: "",
    rider: "",
    horse: "",
    owner: "",
  };
}

function normalizeDraw(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export function normalizeRun(run, index = 0) {
  const draw = normalizeDraw(run?.draw);

  return {
    id: run?.id ?? createId("run"),
    order: run?.order ?? index + 1,
    ...(draw !== null ? { draw } : {}),
    backNumber: run?.backNumber ?? "",
    rider: run?.rider ?? "",
    horse: run?.horse ?? "",
    owner: run?.owner ?? "",
  };
}

export function resequenceRuns(runs) {
  return runs.map((run, index) => ({
    ...run,
    order: index + 1,
  }));
}

function normalizeSetup(setup = {}) {
  const pattern = setup.pattern ?? "";

  return {
    ...setup,
    pattern,
    customPattern: normalizeCustomPattern(setup.customPattern, pattern),
    runs: Array.isArray(setup.runs) ? setup.runs.map(normalizeRun) : [],
    isDrawImported: Boolean(setup.isDrawImported),
    startedAt: setup.startedAt ?? null,
    dragInterval: normalizeDragInterval(setup.dragInterval),
    dragDurationMinutes: normalizeDragDurationMinutes(
      setup.dragDurationMinutes ?? DEFAULT_DRAG_DURATION_MINUTES
    ),
    finalized: Boolean(setup.finalized),
    finalizedAt: setup.finalizedAt ?? null,
    judgeName: setup.judgeName ?? "",
    judgeSignature: setup.judgeSignature ?? null,
    judgeSignedAt: setup.judgeSignedAt ?? null,
    finalPdf: setup.finalPdf ?? null,
    finalPdfFileName: setup.finalPdfFileName ?? null,
  };
}

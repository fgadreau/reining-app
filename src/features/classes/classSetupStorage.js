import { createId } from "../../utils/createId";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  normalizeDragDurationMinutes,
  normalizeDragInterval,
} from "./classTiming";
import { getPrimaryJudgeName, normalizeClassJudges } from "./classJudges";
import { normalizeClassScheduleDetails } from "./classSchedule";
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
    classCodes: [],
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function firstDefinedValue(source, keys) {
  for (const key of keys) {
    if (hasOwn(source, key) && source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeStringId(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim();
}

function normalizeStringIdArray(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map(normalizeStringId)
        .filter(Boolean)
    )
  );
}

function normalizeStringArray(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

export function getRunIntegrationMetadata(run = {}) {
  const metadata = {};
  const idFields = [
    ["runId", ["runId", "run_id"]],
    ["blockRunId", ["blockRunId", "block_run_id"]],
    ["entryId", ["entryId", "entry_id"]],
    ["classId", ["classId", "class_id"]],
    ["blockId", ["blockId", "block_id"]],
    ["divisionId", ["divisionId", "division_id"]],
    ["horseId", ["horseId", "horse_id"]],
    ["riderContactId", ["riderContactId", "rider_contact_id"]],
    ["ownerContactId", ["ownerContactId", "owner_contact_id"]],
    ["payerContactId", ["payerContactId", "payer_contact_id"]],
  ];
  const idArrayFields = [
    ["blockRunIds", ["blockRunIds", "block_run_ids"]],
    ["blockIds", ["blockIds", "block_ids"]],
    ["classIds", ["classIds", "class_ids"]],
    ["entryIds", ["entryIds", "entry_ids"]],
    ["divisionIds", ["divisionIds", "division_ids"]],
  ];

  idFields.forEach(([targetKey, sourceKeys]) => {
    const value = normalizeStringId(firstDefinedValue(run, sourceKeys));
    if (value) {
      metadata[targetKey] = value;
    }
  });

  idArrayFields.forEach(([targetKey, sourceKeys]) => {
    const values = normalizeStringIdArray(firstDefinedValue(run, sourceKeys));
    if (values.length) {
      metadata[targetKey] = values;
    }
  });

  const divisionNames = normalizeStringArray(
    firstDefinedValue(run, ["divisionNames", "division_names"])
  );
  if (divisionNames.length) {
    metadata.divisionNames = divisionNames;
  }

  if (hasOwn(run, "isLate") || hasOwn(run, "is_late")) {
    metadata.isLate = Boolean(firstDefinedValue(run, ["isLate", "is_late"]));
  }

  const drawGroup = String(
    firstDefinedValue(run, ["drawGroup", "draw_group"]) || ""
  ).trim();
  if (drawGroup) {
    metadata.drawGroup = drawGroup;
  }

  return metadata;
}

function normalizeDraw(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

export function normalizeRun(run, index = 0) {
  const draw = normalizeDraw(run?.draw);
  const classCodes = normalizeClassCodes(run?.classCodes);

  return {
    id: run?.id ?? createId("run"),
    order: run?.order ?? index + 1,
    ...(draw !== null ? { draw } : {}),
    backNumber: run?.backNumber ?? "",
    rider: run?.rider ?? "",
    horse: run?.horse ?? "",
    owner: run?.owner ?? "",
    ...getRunIntegrationMetadata(run),
    classCodes,
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
  const judges = normalizeClassJudges(setup);
  const judgeName = getPrimaryJudgeName({ judges, judgeName: setup.judgeName });
  const scheduleDetails = normalizeClassScheduleDetails(
    setup.scheduleDetails || setup.schedule_details || setup.customPattern?.scheduleDetails
  );

  return {
    ...setup,
    pattern,
    customPattern: normalizeCustomPattern(setup.customPattern, pattern),
    scheduleDetails,
    judges,
    blockClasses: normalizeBlockClasses(setup.blockClasses),
    runs: Array.isArray(setup.runs) ? setup.runs.map(normalizeRun) : [],
    isDrawImported: Boolean(setup.isDrawImported),
    startedAt: setup.startedAt ?? null,
    dragInterval: normalizeDragInterval(setup.dragInterval),
    dragDurationMinutes: normalizeDragDurationMinutes(
      setup.dragDurationMinutes ?? DEFAULT_DRAG_DURATION_MINUTES
    ),
    finalized: Boolean(setup.finalized),
    finalizedAt: setup.finalizedAt ?? null,
    judgeName,
    judgeSignature: setup.judgeSignature ?? null,
    judgeSignedAt: setup.judgeSignedAt ?? null,
    finalPdf: setup.finalPdf ?? null,
    finalPdfFileName: setup.finalPdfFileName ?? null,
  };
}

function normalizeClassCodes(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((code) =>
          String(code || "")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\s*-\s*/g, "-")
            .toUpperCase()
        )
        .filter(Boolean)
    )
  );
}

function normalizeBlockClasses(value) {
  return Array.from(
    new Map(
      (Array.isArray(value) ? value : [])
        .map((classEntry) => {
          const code = String(classEntry?.code || "")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\s*-\s*/g, "-")
            .toUpperCase();
          if (!code) return null;

          return [
            code,
            {
              ...(classEntry?.id ? { id: String(classEntry.id).trim() } : {}),
              ...(classEntry?.divisionId || classEntry?.division_id
                ? {
                    divisionId: String(
                      classEntry.divisionId || classEntry.division_id
                    ).trim(),
                  }
                : {}),
              ...(classEntry?.classId || classEntry?.class_id
                ? {
                    classId: String(
                      classEntry.classId || classEntry.class_id
                    ).trim(),
                  }
                : {}),
              ...(classEntry?.blockId || classEntry?.block_id
                ? {
                    blockId: String(
                      classEntry.blockId || classEntry.block_id
                    ).trim(),
                  }
                : {}),
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

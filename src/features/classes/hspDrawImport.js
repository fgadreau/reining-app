import { createId } from "../../utils/createId";
import { normalizeClassSetup } from "./classSetupStorage";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function firstText(source, keys) {
  for (const key of keys) {
    const value = cleanText(source?.[key]);
    if (value) return value;
  }

  return "";
}

function firstTextFromSources(sources, keys) {
  for (const source of sources) {
    const value = firstText(source, keys);
    if (value) return value;
  }

  return "";
}

function normalizeClassCode(value) {
  return cleanText(value).replace(/\s*-\s*/g, "-").toUpperCase();
}

function uniqueValues(values) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function getArrayValues(source, keys) {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) {
      return source[key];
    }
  }

  return [];
}

function parseDivisionDisplayName(value) {
  const text = cleanText(value);
  if (!text) {
    return { code: "", name: "" };
  }

  const match = text.match(/^([A-Z0-9][A-Z0-9 -]*?)\s+-\s+(.+)$/i);
  if (!match) {
    return {
      code: normalizeClassCode(text),
      name: text,
    };
  }

  return {
    code: normalizeClassCode(match[1]),
    name: cleanText(match[2]),
  };
}

function normalizeDivision(division = {}) {
  const displayName = firstText(division, [
    "displayName",
    "display_name",
    "divisionName",
    "division_name",
    "name",
  ]);
  const parsedDisplay = parseDivisionDisplayName(displayName);
  const code =
    normalizeClassCode(
      firstText(division, [
        "code",
        "classCode",
        "class_code",
        "divisionCode",
        "division_code",
      ])
    ) || parsedDisplay.code;

  if (!code) return null;

  const id = firstText(division, ["id", "divisionId", "division_id"]);
  const classId = firstText(division, ["classId", "class_id"]);
  const blockId = firstText(division, ["blockId", "block_id"]);

  return {
    ...(id ? { id, divisionId: id } : {}),
    ...(classId ? { classId } : {}),
    ...(blockId ? { blockId } : {}),
    code,
    name: cleanText(
      firstText(division, ["name", "divisionName", "division_name"]) ||
        parsedDisplay.name
    ),
    classNumber:
      firstText(division, ["classNumber", "class_number", "number"]) || code,
    association: firstText(division, [
      "association",
      "organizationCode",
      "organization_code",
    ]),
  };
}

function getDrawBlocks(draw = {}) {
  return [
    ...(Array.isArray(draw.blocks) ? draw.blocks : []),
    ...(Array.isArray(draw.concurrentBlocks) ? draw.concurrentBlocks : []),
    ...(Array.isArray(draw.concurrent_blocks) ? draw.concurrent_blocks : []),
  ];
}

function getBlockId(block = {}) {
  return firstText(block, ["id", "blockId", "block_id", "classId", "class_id"]);
}

function getBlockDivisions(block = {}) {
  const blockId = getBlockId(block);
  const classId = firstText(block, ["classId", "class_id"]) || blockId;

  return [
    ...(Array.isArray(block.divisions) ? block.divisions : []),
    ...(Array.isArray(block.blockClasses) ? block.blockClasses : []),
    ...(Array.isArray(block.block_classes) ? block.block_classes : []),
    ...(Array.isArray(block.classes) ? block.classes : []),
  ].map((division) => ({
    ...division,
    blockId: division?.blockId || division?.block_id || blockId,
    classId: division?.classId || division?.class_id || classId,
  }));
}

function getDrawDivisions(draw = {}) {
  return [
    ...(Array.isArray(draw.divisions) ? draw.divisions : []),
    ...(Array.isArray(draw.blockClasses) ? draw.blockClasses : []),
    ...(Array.isArray(draw.block_classes) ? draw.block_classes : []),
    ...(Array.isArray(draw.classes) ? draw.classes : []),
    ...getDrawBlocks(draw).flatMap(getBlockDivisions),
  ]
    .map(normalizeDivision)
    .filter(Boolean);
}

function buildDivisionIndexes(divisions) {
  const byId = new Map();

  divisions.forEach((division) => {
    if (division.divisionId) {
      byId.set(division.divisionId, division);
    }
  });

  return { byId };
}

function getRunEntries(run = {}) {
  const explicitEntries =
    run.entries ||
    run.entryRefs ||
    run.entry_refs ||
    run.classEntries ||
    run.class_entries;

  if (Array.isArray(explicitEntries) && explicitEntries.length) {
    return explicitEntries;
  }

  const entryIds = uniqueValues(run.entryIds || run.entry_ids || []);
  const divisionIds = uniqueValues(run.divisionIds || run.division_ids || []);

  if (entryIds.length || divisionIds.length) {
    const maxLength = Math.max(entryIds.length, divisionIds.length);
    return Array.from({ length: maxLength }, (_, index) => ({
      entryId: entryIds[index] || "",
      divisionId: divisionIds[index] || "",
    }));
  }

  if (run.entryId || run.entry_id || run.divisionId || run.division_id) {
    return [
      {
        entryId: run.entryId || run.entry_id || "",
        divisionId: run.divisionId || run.division_id || "",
        divisionName: run.divisionName || run.division_name || "",
        divisionCode: run.divisionCode || run.division_code || "",
      },
    ];
  }

  return [];
}

function getEntryDivision(entry = {}, divisionById) {
  const divisionId = firstText(entry, ["divisionId", "division_id", "id"]);
  const directDivision = entry.division
    ? normalizeDivision(entry.division)
    : normalizeDivision({
        id: divisionId,
        code: entry.divisionCode || entry.division_code,
        name: entry.divisionName || entry.division_name,
      });

  return divisionById.get(divisionId) || directDivision;
}

function getRunDivisionDisplays(run = {}) {
  return Array.isArray(run.divisionNames)
    ? run.divisionNames
    : Array.isArray(run.division_names)
      ? run.division_names
      : [];
}

function getRunDivisionIds(run = {}) {
  const divisionIds = uniqueValues(run.divisionIds || run.division_ids || []);
  const directDivisionId = firstText(run, ["divisionId", "division_id"]);

  if (directDivisionId) {
    divisionIds.push(directDivisionId);
  }

  return uniqueValues(divisionIds);
}

function getRunDivisionCodes(run, entries, divisionById) {
  const codes = entries
    .map((entry) => getEntryDivision(entry, divisionById)?.code || "")
    .filter(Boolean);

  getRunDivisionDisplays(run).forEach((display) => {
    codes.push(parseDivisionDisplayName(display).code);
  });

  const directCode = normalizeClassCode(
    firstText(run, ["divisionCode", "division_code", "classCode", "class_code"])
  );
  if (directCode) {
    codes.push(directCode);
  }

  return uniqueValues(codes.map(normalizeClassCode));
}

function getRunDivisionNames(run, entries, divisionById) {
  const names = entries
    .map((entry) => {
      const division = getEntryDivision(entry, divisionById);
      return division?.name || "";
    })
    .filter(Boolean);

  getRunDivisionDisplays(run).forEach((display) => {
    const parsed = parseDivisionDisplayName(display);
    names.push(parsed.name || display);
  });

  return uniqueValues(names);
}

function collectBlockClasses(divisions, runs, divisionById) {
  const classesByCode = new Map();

  divisions.forEach((division) => {
    classesByCode.set(division.code, division);
  });

  runs.forEach((run) => {
    const entries = getRunEntries(run);

    entries.forEach((entry) => {
      const division = getEntryDivision(entry, divisionById);
      if (division?.code && !classesByCode.has(division.code)) {
        classesByCode.set(division.code, division);
      }
    });

    const runDivisionIds = getRunDivisionIds(run);

    getRunDivisionDisplays(run).forEach((display, index) => {
      const division = normalizeDivision({
        id: runDivisionIds[index] || runDivisionIds[0] || "",
        displayName: display,
      });
      if (division?.code && !classesByCode.has(division.code)) {
        classesByCode.set(division.code, division);
      }
    });
  });

  return Array.from(classesByCode.values());
}

function getRunsFromDraw(draw = {}) {
  if (Array.isArray(draw.runs)) return draw.runs;
  if (Array.isArray(draw.draw?.runs)) return draw.draw.runs;
  if (Array.isArray(draw.block?.runs)) return draw.block.runs;

  const blocks = getDrawBlocks(draw);

  if (blocks.length) {
    return blocks.flatMap((block) => {
      const blockId = getBlockId(block);
      const classId = firstText(block, ["classId", "class_id"]) || blockId;

      return (Array.isArray(block.runs) ? block.runs : []).map((run) => ({
        ...run,
        blockId: run.blockId || run.block_id || block.id || block.blockId,
        classId: run.classId || run.class_id || classId,
      }));
    });
  }

  return [];
}

function withOptionalArray(target, key, values) {
  const normalizedValues = uniqueValues(values);

  if (normalizedValues.length) {
    target[key] = normalizedValues;
  }
}

function toImportedRun(run, index, divisionById) {
  const entries = getRunEntries(run);
  const classCodes = getRunDivisionCodes(run, entries, divisionById);
  const fallbackId =
    firstText(run, ["id", "runId", "run_id", "entryId", "entry_id"]) ||
    createId("hsp_run");
  const draw = Number(run.draw ?? run.order ?? run.orderOfGo ?? run.order_of_go);
  const order = Number.isFinite(draw) && draw !== 0 ? draw : index + 1;
  const entryIds = uniqueValues(
    entries.map((entry) => firstText(entry, ["entryId", "entry_id", "id"]))
  );
  const divisionIds = uniqueValues(
    entries.map((entry) => firstText(entry, ["divisionId", "division_id"]))
  );
  const blockRunId = firstText(run, ["blockRunId", "block_run_id"]);
  const classId = firstText(run, ["classId", "class_id"]);
  const blockId = firstText(run, ["blockId", "block_id"]);
  const importedRun = {
    id: fallbackId,
    order,
    draw: order,
    backNumber: firstText(run, [
      "backNumber",
      "back_number",
      "entryNumber",
      "entry_number",
    ]),
    rider: firstText(run, ["rider", "riderName", "rider_name"]),
    horse: firstText(run, ["horse", "horseName", "horse_name"]),
    owner: firstText(run, ["owner", "ownerName", "owner_name"]),
    runId: firstText(run, ["runId", "run_id"]) || fallbackId,
    blockRunId,
    entryId: firstText(run, ["entryId", "entry_id"]) || entryIds[0] || "",
    classId,
    blockId,
    divisionId:
      firstText(run, ["divisionId", "division_id"]) || divisionIds[0] || "",
    horseId: firstText(run, ["horseId", "horse_id"]),
    riderContactId: firstText(run, ["riderContactId", "rider_contact_id"]),
    horseNrha: firstTextFromSources([run, ...entries], [
      "horseNrha",
      "horse_nrha",
      "horseNumber",
      "horse_number",
      "horseRegistrationNumber",
      "horse_registration_number",
      "registrationNumber",
      "registration_number",
    ]),
    memberNrha: firstTextFromSources([run, ...entries], [
      "memberNrha",
      "member_nrha",
      "riderNrha",
      "rider_nrha",
      "memberNumber",
      "member_number",
    ]),
    ownerContactId: firstText(run, ["ownerContactId", "owner_contact_id"]),
    payerContactId: firstText(run, ["payerContactId", "payer_contact_id"]),
    ...(entryIds.length ? { entryIds } : {}),
    ...(divisionIds.length ? { divisionIds } : {}),
    divisionNames: getRunDivisionNames(run, entries, divisionById),
    ...(run.isLate != null || run.is_late != null
      ? { isLate: Boolean(run.isLate ?? run.is_late) }
      : {}),
    drawGroup: firstText(run, ["drawGroup", "draw_group"]),
    classCodes,
  };

  withOptionalArray(importedRun, "blockRunIds", [
    blockRunId,
    ...getArrayValues(run, ["blockRunIds", "block_run_ids"]),
  ]);
  withOptionalArray(importedRun, "classIds", [
    classId,
    ...getArrayValues(run, ["classIds", "class_ids"]),
  ]);
  withOptionalArray(importedRun, "blockIds", [
    blockId,
    ...getArrayValues(run, ["blockIds", "block_ids"]),
  ]);

  return importedRun;
}

function mergeRunArrays(left, right, key, fallbackKeys = []) {
  return uniqueValues([
    ...(Array.isArray(left?.[key]) ? left[key] : []),
    ...fallbackKeys.map((fallbackKey) => left?.[fallbackKey]),
    ...(Array.isArray(right?.[key]) ? right[key] : []),
    ...fallbackKeys.map((fallbackKey) => right?.[fallbackKey]),
  ]);
}

function mergeImportedRun(left, right) {
  const merged = {
    ...left,
    order: Math.min(left.order, right.order),
    draw: Math.min(left.draw, right.draw),
    backNumber: left.backNumber || right.backNumber,
    rider: left.rider || right.rider,
    horse: left.horse || right.horse,
    owner: left.owner || right.owner,
    blockRunId: left.blockRunId || right.blockRunId,
    entryId: left.entryId || right.entryId,
    classId: left.classId || right.classId,
    blockId: left.blockId || right.blockId,
    divisionId: left.divisionId || right.divisionId,
    horseId: left.horseId || right.horseId,
    riderContactId: left.riderContactId || right.riderContactId,
    ownerContactId: left.ownerContactId || right.ownerContactId,
    payerContactId: left.payerContactId || right.payerContactId,
    classCodes: uniqueValues([
      ...(left.classCodes || []),
      ...(right.classCodes || []),
    ]),
    divisionNames: uniqueValues([
      ...(left.divisionNames || []),
      ...(right.divisionNames || []),
    ]),
  };

  withOptionalArray(
    merged,
    "entryIds",
    mergeRunArrays(left, right, "entryIds", ["entryId"])
  );
  withOptionalArray(
    merged,
    "divisionIds",
    mergeRunArrays(left, right, "divisionIds", ["divisionId"])
  );
  withOptionalArray(
    merged,
    "blockRunIds",
    mergeRunArrays(left, right, "blockRunIds", ["blockRunId"])
  );
  withOptionalArray(
    merged,
    "classIds",
    mergeRunArrays(left, right, "classIds", ["classId"])
  );
  withOptionalArray(
    merged,
    "blockIds",
    mergeRunArrays(left, right, "blockIds", ["blockId"])
  );

  return merged;
}

function mergeConcurrentRuns(runs) {
  const mergedRuns = [];
  const indexByRunId = new Map();

  runs.forEach((run) => {
    const key = run.runId || run.id;

    if (!key || !indexByRunId.has(key)) {
      indexByRunId.set(key, mergedRuns.length);
      mergedRuns.push(run);
      return;
    }

    const existingIndex = indexByRunId.get(key);
    mergedRuns[existingIndex] = mergeImportedRun(mergedRuns[existingIndex], run);
  });

  return mergedRuns;
}

function normalizeImportedRuns(runs, divisionById) {
  return mergeConcurrentRuns(
    runs
      .map((run, index) => toImportedRun(run, index, divisionById))
      .filter((run) => run.backNumber || run.rider || run.horse)
  )
    .sort((a, b) => a.order - b.order)
    .map((run, index) => ({
      ...run,
      order: index + 1,
    }));
}

function buildSource(draw) {
  return {
    type: "hsp",
    organizationId: firstText(draw, ["organizationId", "organization_id"]),
    showId: firstText(draw, ["showId", "show_id"]),
    classId: firstText(draw, ["classId", "class_id"]),
    blockId: firstText(draw, ["blockId", "block_id"]),
    importedAt:
      firstText(draw, ["importedAt", "imported_at"]) ||
      new Date().toISOString(),
  };
}

export function normalizeHspDrawImport(draw = {}) {
  const sourceRuns = getRunsFromDraw(draw);
  const divisions = getDrawDivisions(draw);
  const { byId: divisionById } = buildDivisionIndexes(divisions);
  const runs = normalizeImportedRuns(sourceRuns, divisionById);
  const blockClasses = collectBlockClasses(divisions, sourceRuns, divisionById);

  return {
    runs,
    blockClasses,
    dragInterval: null,
    dragBreaks: 0,
    source: buildSource(draw),
  };
}

export function buildClassSetupFromHspDraw(draw = {}, baseSetup = {}) {
  const importedDraw = normalizeHspDrawImport(draw);

  return normalizeClassSetup({
    ...baseSetup,
    runs: importedDraw.runs,
    blockClasses: importedDraw.blockClasses,
    isDrawImported: importedDraw.runs.length > 0,
    hspSource: importedDraw.source,
  });
}

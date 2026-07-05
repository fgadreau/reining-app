import {
  getChampionshipClassByCode,
  getChampionshipClassLabel,
  getExcludedClassCodeReason,
  normalizeClassCode,
} from "./championshipClasses";
import { parseChampionshipCsv } from "./championshipCsvParser";
import { calculateChampionshipPoints, toNumber } from "./championshipPoints";
import { createId } from "../../utils/createId";

export function buildChampionshipDatasetFromCsv({
  csvText,
  fileName = "",
  seasonTitle = "",
  year = "",
  status = "draft",
} = {}) {
  const importBatch = buildChampionshipImportBatchFromCsv({ csvText, fileName });

  return buildChampionshipDatasetFromImports({
    imports: [importBatch],
    seasonTitle,
    year,
    status,
  });
}

export function buildChampionshipImportBatchFromCsv({
  csvText,
  fileName = "",
  importedAt = "",
  id = "",
} = {}) {
  const parsed = parseChampionshipCsv(csvText, fileName);
  const importId = id || createId("championship-import");
  const importedOn = importedAt || new Date().toISOString();
  const normalizedRows = normalizeCsvRows(parsed.rows, parsed.index, {
    fileName,
    importId,
  });

  return {
    id: importId,
    fileName: fileName || "CSV import",
    importedAt: importedOn,
    rowCount: normalizedRows.length,
    rows: normalizedRows,
  };
}

export function buildChampionshipDatasetFromImports({
  imports = [],
  seasonTitle = "",
  year = "",
  status = "draft",
} = {}) {
  const normalizedImports = normalizeImportBatches(imports);
  const importedRows = normalizedImports.flatMap((importBatch, importIndex) =>
    importBatch.rows.map((row) => ({
      ...row,
      sourceImportId: row.sourceImportId || importBatch.id,
      sourceFileName: row.sourceFileName || importBatch.fileName,
      sourceImportOrder: importIndex,
      sourceImportedAt: importBatch.importedAt,
    }))
  );
  const activeImportedRows = importedRows.filter(
    (row) => !isChampionshipRowIgnored(row)
  );
  const deduped = dedupeImportedRows(activeImportedRows);
  const analysis = analyzeRows(deduped.rows);
  const standings = buildStandings(analysis.includedRows);

  return {
    id: "",
    title: seasonTitle || "Championnat de saison",
    year: year || "",
    status,
    imports: normalizedImports,
    importCount: normalizedImports.length,
    importedAt: getLatestImportedAt(normalizedImports),
    rowCount: importedRows.length,
    ignoredRowCount: importedRows.length - activeImportedRows.length,
    uniqueRowCount: deduped.rows.length,
    duplicateRowCount: deduped.duplicateRows.length,
    ...standings,
    validation: {
      ...analysis.validation,
      importedRows: importedRows.length,
      ignoredRows: importedRows.length - activeImportedRows.length,
      uniqueRows: deduped.rows.length,
      duplicateRows: deduped.duplicateRows,
    },
  };
}

export function normalizePersonKey(value) {
  const source = String(value || "").trim();
  let swapped = source;

  if (source.includes(",")) {
    const parts = source.split(",");
    const last = (parts[0] || "").trim();
    const first = (parts.slice(1).join(",") || "").trim();
    swapped = `${first} ${last}`.trim();
  }

  return normalizeSearchKey(swapped);
}

export function normalizeHorseKey(value) {
  return normalizeSearchKey(value);
}

export function buildChampionshipEventKey(row) {
  return [row.showNum, row.classCode, row.goType, row.goNum]
    .map((value) => String(value || "").trim())
    .join("|");
}

export function buildChampionshipResultDuplicateKey(row) {
  const eventKey = buildChampionshipEventKey(row);
  if (!eventKey || !row?.teamKey) return "";

  return `${eventKey}|${row.teamKey}`;
}

export function isChampionshipRowIgnored(row) {
  return Boolean(row?.ignoredForChampionship);
}

export function getChampionshipEventLabelKey(eventLike) {
  return String(eventLike?.showNum || eventLike?.showName || eventLike?.label || "")
    .trim();
}

export function applyChampionshipEventLabels(dataset, labelsByShow = {}) {
  if (!dataset || !Array.isArray(dataset.classes)) {
    return dataset;
  }

  const getLabel = (eventLike) => {
    const key = getChampionshipEventLabelKey(eventLike);
    return (
      String(labelsByShow[key] || "").trim() ||
      eventLike.label ||
      eventLike.eventLabel ||
      eventLike.showName ||
      ""
    );
  };

  return {
    ...dataset,
    publicEventLabels: labelsByShow,
    classes: dataset.classes.map((classEntry) => ({
      ...classEntry,
      events: classEntry.events.map((event) => ({
        ...event,
        label: getLabel(event),
      })),
      teams: classEntry.teams.map((team) => ({
        ...team,
        details: team.details.map((detail) => ({
          ...detail,
          eventLabel: getLabel(detail),
        })),
      })),
    })),
  };
}

function normalizeSearchKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCsvRows(rows, index, { fileName = "", importId = "" } = {}) {
  return rows.map((row, rowIndex) => {
    const rider = cell(row, index.Member);
    const horse = cell(row, index.Horse);
    const riderKey = normalizePersonKey(rider);
    const horseKey = normalizeHorseKey(horse);
    const classCode = normalizeClassCode(cell(row, index.ClassCode));

    return {
      sourceFileName: fileName || "",
      sourceImportId: importId || "",
      sourceRowNumber: rowIndex + 2,
      showNum: cell(row, index.ShowNum),
      showName: cell(row, index.ShowName),
      className: cell(row, index.ClassName),
      classCode,
      patternNum: cell(row, index.PatternNum),
      entryCount: toNumber(cell(row, index.EntryCount)),
      shownCount: toNumber(cell(row, index.ShownCount)),
      goType: cell(row, index.GoType),
      goNum: cell(row, index.GoNum),
      horse,
      horseNrha: cell(row, index.HorseNrha),
      rider,
      memberNrha: cell(row, index.MemberNrha),
      backNumber: cell(row, index.BackNum),
      placeNum: toNumber(cell(row, index.PlaceNum)),
      totalScore: toNumber(cell(row, index.TotalScore)),
      moneyWon: toNumber(cell(row, index.MoneyWon)),
      riderKey,
      horseKey,
      teamKey: riderKey && horseKey ? `${riderKey}|${horseKey}` : "",
    };
  });
}

function cell(row, index) {
  return String(row[index] || "").trim();
}

function analyzeRows(rows) {
  const includedRows = [];
  const validation = {
    importedRows: rows.length,
    includedRows: 0,
    excludedRows: 0,
    noPointRows: 0,
    unmappedClasses: [],
    excludedClasses: [],
    anomalies: [],
  };
  const unmappedByCode = new Map();
  const excludedByCode = new Map();

  rows.forEach((row) => {
    const excluded = getExcludedClassCodeReason(row.classCode);
    if (excluded) {
      validation.excludedRows += 1;
      addClassSummary(excludedByCode, row, excluded.reason);
      return;
    }

    const championshipClass = getChampionshipClassByCode(row.classCode);
    if (!championshipClass) {
      addClassSummary(unmappedByCode, row, "Classe non mappee au championnat.");
      return;
    }

    if (row.entryCount <= 0) {
      validation.anomalies.push({
        type: "entry_count_zero",
        severity: "warning",
        message: `${row.classCode} ${row.className}: EntryCount est a 0.`,
        row,
      });
    }

    if (row.totalScore > 0 && row.placeNum <= 0) {
      validation.anomalies.push({
        type: "score_without_place",
        severity: "warning",
        message: `${row.classCode} ${row.className}: score present sans placement.`,
        row,
      });
    }

    includedRows.push({
      ...row,
      championshipClassId: championshipClass.id,
      championshipClassName: getChampionshipClassLabel(championshipClass),
      championshipClassOrder: championshipClass.order,
    });
  });

  validation.includedRows = includedRows.length;
  validation.unmappedClasses = Array.from(unmappedByCode.values());
  validation.excludedClasses = Array.from(excludedByCode.values());

  return {
    includedRows,
    validation,
  };
}

function normalizeImportBatches(imports) {
  if (!Array.isArray(imports)) return [];

  return imports
    .map((importBatch, index) => {
      const importId = importBatch?.id || createId("championship-import");
      const fileName = importBatch?.fileName || `CSV ${index + 1}`;
      const rows = Array.isArray(importBatch?.rows)
        ? importBatch.rows.map((row) => ({
            ...row,
            sourceImportId: row.sourceImportId || importId,
            sourceFileName: row.sourceFileName || fileName,
          }))
        : [];

      return {
        id: importId,
        fileName,
        importedAt: importBatch?.importedAt || "",
        rowCount: importBatch?.rowCount ?? rows.length,
        rows,
      };
    })
    .filter((importBatch) => importBatch.rows.length > 0);
}

function dedupeImportedRows(rows) {
  const rowsByKey = new Map();
  const duplicateRows = [];

  rows.forEach((row) => {
    const duplicateKey = buildChampionshipResultDuplicateKey(row);
    if (!duplicateKey) {
      rowsByKey.set(createId("championship-row"), row);
      return;
    }

    const previous = rowsByKey.get(duplicateKey);
    if (previous) {
      duplicateRows.push({
        type: "duplicate_result",
        severity: "info",
        key: duplicateKey,
        message: `${row.classCode} ${row.className}: ${row.rider} / ${row.horse} dans ${row.showName || row.showNum} remplace une ligne deja importee (${previous.sourceFileName || "CSV precedent"}).`,
        previousSourceFileName: previous.sourceFileName,
        previousSourceRowNumber: previous.sourceRowNumber,
        sourceFileName: row.sourceFileName,
        sourceRowNumber: row.sourceRowNumber,
        row,
      });
    }

    rowsByKey.set(duplicateKey, row);
  });

  return {
    rows: Array.from(rowsByKey.values()),
    duplicateRows,
  };
}

function getLatestImportedAt(imports) {
  return imports
    .map((importBatch) => importBatch.importedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function addClassSummary(map, row, reason) {
  const key = `${row.classCode}|${row.className}`;

  if (!map.has(key)) {
    map.set(key, {
      classCode: row.classCode,
      className: row.className,
      reason,
      rows: 0,
    });
  }

  map.get(key).rows += 1;
}

function buildStandings(rows) {
  const rowsWithPoints = applyTiePoints(rows);
  const classesById = new Map();
  const eventsByKey = new Map();
  const teamByClassAndKey = new Map();

  rowsWithPoints.forEach((row) => {
    const classEntry = getOrCreateClassEntry(classesById, row);
    const event = getOrCreateEventEntry(eventsByKey, classEntry, row);

    event.totalPoints += row.points;
    event.totalMoney += row.moneyWon;
    event.resultCount += 1;

    if (!row.teamKey) {
      return;
    }

    const teamEntry = getOrCreateTeamEntry(teamByClassAndKey, classEntry, row);
    teamEntry.totalPoints += row.points;
    teamEntry.totalMoney += row.moneyWon;
    teamEntry.details.push({
      eventKey: event.eventKey,
      eventLabel: event.label,
      showNum: row.showNum,
      showName: row.showName,
      classCode: row.classCode,
      className: row.className,
      goType: row.goType,
      goNum: row.goNum,
      entryCount: row.entryCount,
      shownCount: row.shownCount,
      placeNum: row.placeNum,
      totalScore: row.totalScore,
      moneyWon: row.moneyWon,
      points: row.points,
      sourceFileName: row.sourceFileName,
      sourceRowNumber: row.sourceRowNumber,
    });
  });

  const classes = Array.from(classesById.values())
    .map((classEntry) => {
      const teams = Array.from(teamByClassAndKey.values())
        .filter((team) => team.championshipClassId === classEntry.id)
        .filter((team) => team.totalPoints > 0 || team.totalMoney > 0)
        .sort(compareTeams);
      const rankedTeams = applyRanks(teams);

      return {
        ...classEntry,
        events: classEntry.events.sort((a, b) => a.order - b.order),
        teams: rankedTeams,
      };
    })
    .filter((classEntry) => classEntry.events.length > 0)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const eventCount = classes.reduce(
    (total, classEntry) => total + classEntry.events.length,
    0
  );
  const teamCount = classes.reduce(
    (total, classEntry) => total + classEntry.teams.length,
    0
  );

  return {
    classCount: classes.length,
    eventCount,
    teamCount,
    classes,
  };
}

function applyTiePoints(rows) {
  const tieCounts = new Map();

  rows.forEach((row) => {
    const maxPoints = Math.min(Math.max(row.entryCount, 0), 10);
    if (row.placeNum <= 0 || row.placeNum > maxPoints) return;

    const tieKey = `${buildChampionshipEventKey(row)}|${row.placeNum}`;
    tieCounts.set(tieKey, (tieCounts.get(tieKey) || 0) + 1);
  });

  return rows.map((row) => {
    const tieKey = `${buildChampionshipEventKey(row)}|${row.placeNum}`;
    const tieCount = tieCounts.get(tieKey) || 1;

    return {
      ...row,
      points: calculateChampionshipPoints(row.entryCount, row.placeNum, tieCount),
      tieCount,
    };
  });
}

function getOrCreateClassEntry(classesById, row) {
  if (!classesById.has(row.championshipClassId)) {
    classesById.set(row.championshipClassId, {
      id: row.championshipClassId,
      name: row.championshipClassName,
      order: row.championshipClassOrder,
      events: [],
    });
  }

  return classesById.get(row.championshipClassId);
}

function getOrCreateEventEntry(eventsByKey, classEntry, row) {
  const eventKey = buildChampionshipEventKey(row);

  if (!eventsByKey.has(eventKey)) {
    const event = {
      eventKey,
      label: row.showName || row.showNum || "Show",
      showNum: row.showNum,
      showName: row.showName,
      classCode: row.classCode,
      className: row.className,
      goType: row.goType,
      goNum: row.goNum,
      order: eventsByKey.size + 1,
      totalPoints: 0,
      totalMoney: 0,
      resultCount: 0,
    };
    eventsByKey.set(eventKey, event);
    classEntry.events.push(event);
  }

  return eventsByKey.get(eventKey);
}

function getOrCreateTeamEntry(teamByClassAndKey, classEntry, row) {
  const key = `${classEntry.id}|${row.teamKey}`;

  if (!teamByClassAndKey.has(key)) {
    teamByClassAndKey.set(key, {
      championshipClassId: classEntry.id,
      teamKey: row.teamKey,
      rider: row.rider,
      horse: row.horse,
      totalPoints: 0,
      totalMoney: 0,
      rank: null,
      details: [],
    });
  }

  return teamByClassAndKey.get(key);
}

function compareTeams(a, b) {
  const pointDiff = b.totalPoints - a.totalPoints;
  if (Math.abs(pointDiff) > 1e-9) return pointDiff;

  return `${a.rider} ${a.horse}`.localeCompare(`${b.rider} ${b.horse}`);
}

function applyRanks(teams) {
  let previousPoints = null;
  let previousRank = 0;

  return teams.map((team, index) => {
    const rank =
      previousPoints != null && Math.abs(team.totalPoints - previousPoints) < 1e-9
        ? previousRank
        : index + 1;

    previousPoints = team.totalPoints;
    previousRank = rank;

    return {
      ...team,
      rank,
      details: team.details.sort((a, b) => a.eventKey.localeCompare(b.eventKey)),
    };
  });
}

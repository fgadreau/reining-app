import {
  getChampionshipClassByCode,
  getChampionshipClassLabel,
  getExcludedClassCodeReason,
  normalizeClassCode,
} from "./championshipClasses";
import { parseChampionshipCsv } from "./championshipCsvParser";
import { calculateChampionshipPoints, toNumber } from "./championshipPoints";
import { createId } from "../../utils/createId";

const CHAMPIONSHIP_MONTH_ORDER = new Map(
  [
    ["jan", 1],
    ["janvier", 1],
    ["january", 1],
    ["feb", 2],
    ["fevrier", 2],
    ["february", 2],
    ["mar", 3],
    ["mars", 3],
    ["march", 3],
    ["apr", 4],
    ["avril", 4],
    ["april", 4],
    ["mai", 5],
    ["may", 5],
    ["jun", 6],
    ["juin", 6],
    ["june", 6],
    ["jul", 7],
    ["juillet", 7],
    ["july", 7],
    ["aug", 8],
    ["aout", 8],
    ["august", 8],
    ["sep", 9],
    ["sept", 9],
    ["septembre", 9],
    ["september", 9],
    ["oct", 10],
    ["octobre", 10],
    ["october", 10],
    ["nov", 11],
    ["novembre", 11],
    ["november", 11],
    ["dec", 12],
    ["decembre", 12],
    ["december", 12],
  ].map(([label, order]) => [label, order])
);

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
  corrections = {},
  seasonTitle = "",
  year = "",
  status = "draft",
} = {}) {
  const normalizedCorrections = normalizeChampionshipCorrections(corrections);
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
  const correctedRows = applyChampionshipDisqualifications(
    analysis.includedRows,
    normalizedCorrections.disqualifications
  );
  const standings = buildStandings(correctedRows);

  return {
    id: "",
    title: seasonTitle || "Championnat de saison",
    year: year || "",
    status,
    corrections: normalizedCorrections,
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
      disqualificationCount: normalizedCorrections.disqualifications.length,
    },
  };
}

export function stripChampionshipMoneyData(dataset) {
  if (!dataset || typeof dataset !== "object") return dataset;

  const classes = Array.isArray(dataset.classes)
    ? dataset.classes.map((classEntry) => ({
        ...classEntry,
        events: Array.isArray(classEntry?.events)
          ? classEntry.events.map(({ totalMoney, ...event }) => ({
              ...event,
              results: Array.isArray(event.results)
                ? event.results.map(stripMoneyFields)
                : [],
            }))
          : [],
        teams: Array.isArray(classEntry?.teams)
          ? classEntry.teams.map(({ totalMoney, ...team }) => ({
              ...team,
              details: Array.isArray(team.details)
                ? team.details.map(stripMoneyFields)
                : [],
            }))
          : [],
      }))
    : dataset.classes;
  const imports = Array.isArray(dataset.imports)
    ? dataset.imports.map((importBatch) => ({
        ...importBatch,
        rows: Array.isArray(importBatch.rows)
          ? importBatch.rows.map(stripMoneyFields)
          : [],
      }))
    : dataset.imports;
  const corrections = normalizeChampionshipCorrections(dataset.corrections);

  return {
    ...dataset,
    classes,
    imports,
    corrections,
  };
}

function stripMoneyFields(source) {
  if (!source || typeof source !== "object") return source;

  const { moneyWon, rawMoneyWon, totalMoney, ...rest } = source;
  return rest;
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

export function normalizeChampionshipIdentityId(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function buildChampionshipRiderKey({
  rider = "",
  memberNrha = "",
  riderContactId = "",
} = {}) {
  const memberId = normalizeChampionshipIdentityId(memberNrha);
  if (memberId) return `member:${memberId}`;

  const contactId = normalizeChampionshipIdentityId(riderContactId);
  if (contactId) return `rider-contact:${contactId}`;

  const nameKey = normalizePersonKey(rider);
  return nameKey ? `rider-name:${nameKey}` : "";
}

export function buildChampionshipHorseKey({
  horse = "",
  horseNrha = "",
  horseId = "",
} = {}) {
  const nrhaId = normalizeChampionshipIdentityId(horseNrha);
  if (nrhaId) return `horse-nrha:${nrhaId}`;

  const stableHorseId = normalizeChampionshipIdentityId(horseId);
  if (stableHorseId) return `horse-id:${stableHorseId}`;

  const nameKey = normalizeHorseKey(horse);
  return nameKey ? `horse-name:${nameKey}` : "";
}

export function buildChampionshipTeamKey({
  rider = "",
  horse = "",
  memberNrha = "",
  horseNrha = "",
  riderContactId = "",
  horseId = "",
} = {}) {
  const riderKey = buildChampionshipRiderKey({
    rider,
    memberNrha,
    riderContactId,
  });
  const horseKey = buildChampionshipHorseKey({ horse, horseNrha, horseId });

  return riderKey && horseKey ? `${riderKey}|${horseKey}` : "";
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

export function buildChampionshipDisqualificationKey(row) {
  if (!row || typeof row !== "object") return "";

  const sourceImportId = String(row.sourceImportId || "").trim();
  const sourceRowNumber = String(row.sourceRowNumber || "").trim();

  if (sourceImportId && sourceRowNumber) {
    return `source:${sourceImportId}:${sourceRowNumber}`;
  }

  const eventKey = row.eventKey || buildChampionshipEventKey(row);
  const championshipClassId = String(row.championshipClassId || "").trim();
  const teamKey = String(row.teamKey || "").trim();

  if (eventKey && championshipClassId && teamKey) {
    return `team:${championshipClassId}:${eventKey}:${teamKey}`;
  }

  return "";
}

export function normalizeChampionshipCorrections(corrections = {}) {
  const disqualifications = Array.isArray(corrections?.disqualifications)
    ? corrections.disqualifications
        .map(normalizeChampionshipDisqualification)
        .filter(Boolean)
    : [];

  return {
    ...corrections,
    disqualifications,
  };
}

export function isChampionshipRowIgnored(row) {
  return Boolean(row?.ignoredForChampionship);
}

export function getChampionshipEventLabelKey(eventLike) {
  return String(eventLike?.showNum || eventLike?.key || eventLike?.showName || eventLike?.label || "")
    .trim();
}

export function applyChampionshipEventLabels(
  dataset,
  labelsByShow = {},
  orderByShow = {}
) {
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
  const getPublicOrder = (eventLike) => {
    const key = getChampionshipEventLabelKey(eventLike);
    const explicitOrder = toNumber(orderByShow[key]);
    const existingOrder = toNumber(eventLike?.publicOrder);
    const order = explicitOrder > 0 ? explicitOrder : existingOrder;

    return order > 0 ? order : undefined;
  };

  return {
    ...dataset,
    shows: Array.isArray(dataset.shows)
      ? dataset.shows
          .map((show) => ({
            ...show,
            label: getLabel(show),
            publicOrder: getPublicOrder(show),
          }))
          .sort(compareChampionshipOccurrences)
      : dataset.shows,
    publicEventLabels: labelsByShow,
    publicEventOrder: orderByShow,
    classes: dataset.classes.map((classEntry) => ({
      ...classEntry,
      events: classEntry.events
        .map((event) => ({
          ...event,
          label: getLabel(event),
          publicOrder: getPublicOrder(event),
          results: Array.isArray(event.results)
            ? event.results.map((result) => ({
                ...result,
                eventLabel: getLabel(event),
                publicOrder: getPublicOrder(event),
              }))
            : event.results,
        }))
        .sort(compareChampionshipOccurrences),
      teams: classEntry.teams.map((team) => ({
        ...team,
        details: team.details
          .map((detail) => ({
            ...detail,
            eventLabel: getLabel(detail),
            publicOrder: getPublicOrder(detail),
          }))
          .sort(compareChampionshipOccurrences),
      })),
    })),
  };
}

export function ensureChampionshipOccurrenceResults(dataset) {
  if (!dataset) {
    return dataset;
  }

  if (
    hasCompleteOccurrenceResults(dataset) ||
    !Array.isArray(dataset.imports) ||
    dataset.imports.length === 0
  ) {
    return applyChampionshipEventLabels(
      dataset,
      dataset.publicEventLabels || {},
      dataset.publicEventOrder || {}
    );
  }

  const rebuilt = buildChampionshipDatasetFromImports({
    imports: dataset.imports,
    corrections: dataset.corrections || {},
    seasonTitle: dataset.title,
    year: dataset.year,
    status: dataset.status,
  });
  const labeled = applyChampionshipEventLabels(
    {
      ...rebuilt,
      id: dataset.id || rebuilt.id,
      associationId: dataset.associationId || rebuilt.associationId,
      createdAt: dataset.createdAt || rebuilt.createdAt,
      updatedAt: dataset.updatedAt || rebuilt.updatedAt,
    },
    dataset.publicEventLabels || {},
    dataset.publicEventOrder || {}
  );

  return {
    ...dataset,
    ...labeled,
    imports: dataset.imports,
    corrections: normalizeChampionshipCorrections(dataset.corrections),
    publicEventLabels: dataset.publicEventLabels || {},
    publicEventOrder: dataset.publicEventOrder || {},
  };
}

export function getChampionshipIncludedShows(dataset) {
  if (Array.isArray(dataset?.shows) && dataset.shows.length > 0) {
    return dataset.shows
      .map(normalizeIncludedShow)
      .filter((show) => show.key)
      .sort(compareChampionshipOccurrences);
  }

  const showsByKey = new Map();
  const classes = Array.isArray(dataset?.classes) ? dataset.classes : [];

  classes.forEach((classEntry) => {
    const events = Array.isArray(classEntry?.events) ? classEntry.events : [];

    events.forEach((event) => {
      const key = getChampionshipEventLabelKey(event);
      if (!key) return;

      if (!showsByKey.has(key)) {
        showsByKey.set(key, {
          key,
          label: event.label || event.showName || event.showNum || "Show",
          showNum: event.showNum,
          showName: event.showName,
          order: showsByKey.size + 1,
          occurrenceCount: 0,
          resultCount: 0,
        });
      }

      const show = showsByKey.get(key);
      show.occurrenceCount += 1;
      show.resultCount += event.resultCount || 0;
    });
  });

  return Array.from(showsByKey.values()).sort(compareChampionshipOccurrences);
}

export function buildChampionshipFunFacts(dataset) {
  const classes = Array.isArray(dataset?.classes) ? dataset.classes : [];
  const highestScores = [];
  const highestRanchRidingScores = [];
  const highestReiningScores = [];
  const teamsByKey = new Map();
  const ridersByKey = new Map();
  const horsesByKey = new Map();

  classes.forEach((classEntry) => {
    const events = Array.isArray(classEntry?.events) ? classEntry.events : [];
    const teams = Array.isArray(classEntry?.teams) ? classEntry.teams : [];
    const isRanchRidingClass = isRanchRidingChampionshipClass(classEntry);

    events.forEach((event) => {
      const results = Array.isArray(event?.results) ? event.results : [];

      results.forEach((result) => {
        const score = toNumber(result.totalScore);
        if (score <= 0) return;

        const entry = {
          rider: result.rider || "",
          horse: result.horse || "",
          className: classEntry.name || result.championshipClassName || "",
          showLabel:
            event.label || result.eventLabel || result.showName || result.showNum || "",
          score,
        };

        highestScores.push(entry);

        if (isRanchRidingClass) {
          highestRanchRidingScores.push(entry);
        } else {
          highestReiningScores.push(entry);
        }
      });
    });

    teams.forEach((team) => {
      const details = Array.isArray(team?.details) ? team.details : [];

      if (details.length > 0) {
        const key = team.teamKey || `${team.rider || ""}|${team.horse || ""}`;
        const entry = teamsByKey.get(key) || {
          rider: team.rider || "",
          horse: team.horse || "",
          classNames: [],
          classCount: 0,
          podiumCount: 0,
          scoreEntries: [],
          totalPoints: 0,
        };

        entry.classCount += details.length;
        if (classEntry.name && !entry.classNames.includes(classEntry.name)) {
          entry.classNames.push(classEntry.name);
        }
        teamsByKey.set(key, entry);

        details.forEach((detail) => {
          if (isPodiumPlacement(detail)) {
            entry.podiumCount += 1;
          }

          const score = toNumber(detail.totalScore || detail.rawTotalScore);
          if (score > 0) {
            entry.scoreEntries.push({
              score,
              showNum: detail.showNum || "",
              sourceImportedAt: detail.sourceImportedAt || "",
              sourceImportOrder: detail.sourceImportOrder,
              sourceRowNumber: detail.sourceRowNumber,
              sequence: entry.scoreEntries.length,
            });
          }

          const points = toNumber(detail.points);
          if (points <= 0) return;

          entry.totalPoints += points;
          addPointAggregate(ridersByKey, normalizePersonKey(team.rider), {
            rider: team.rider || "",
            horse: "",
            relationKey: "horse",
            relationName: team.horse || "",
            className: classEntry.name || "",
            points,
          });
          addPointAggregate(horsesByKey, normalizeHorseKey(team.horse), {
            rider: "",
            horse: team.horse || "",
            relationKey: "rider",
            relationName: team.rider || "",
            className: classEntry.name || "",
            points,
          });
        });
      }
    });
  });

  const teamFacts = Array.from(teamsByKey.values()).map((team) => {
    const { scoreEntries, ...teamFact } = team;
    const progression = buildScoreProgression(scoreEntries);

    return {
      ...teamFact,
      ...(progression || {}),
      className: team.classNames.join(", "),
    };
  });

  return {
    highestScore: pickLeader(highestScores, compareHighestScores),
    highestReiningScore: pickLeader(highestReiningScores, compareHighestScores),
    highestRanchRidingScore: pickLeader(
      highestRanchRidingScores,
      compareHighestScores
    ),
    topRiderPoints: pickLeaders(
      Array.from(ridersByKey.values()),
      comparePointLeaders,
      "totalPoints"
    ),
    topHorsePoints: pickLeaders(
      Array.from(horsesByKey.values()),
      comparePointLeaders,
      "totalPoints"
    ),
    topTeamPoints: pickLeaders(
      teamFacts.filter((team) => toNumber(team.totalPoints) > 0),
      comparePointLeaders,
      "totalPoints"
    ),
    mostPodiums: pickLeaders(
      teamFacts.filter((team) => toNumber(team.podiumCount) > 0),
      comparePodiumLeaders,
      "podiumCount"
    ),
    bestProgression: pickLeaders(
      teamFacts.filter((team) => toNumber(team.progressionDelta) > 0),
      compareProgressionLeaders,
      "progressionDelta"
    ),
    mostClasses: pickLeaders(teamFacts, compareMostClasses, "classCount"),
  };
}

function isPodiumPlacement(detail) {
  const place = toNumber(detail?.placeNum || detail?.rawPlaceNum);
  return place >= 1 && place <= 3;
}

function buildScoreProgression(scoreEntries) {
  const scores = (Array.isArray(scoreEntries) ? scoreEntries : [])
    .filter((entry) => toNumber(entry.score) > 0)
    .slice()
    .sort(compareScoreEntries);

  if (scores.length < 4) return null;

  const firstScoreAverage = averageNumbers(
    scores.slice(0, 2).map((entry) => entry.score)
  );
  const lastScoreAverage = averageNumbers(
    scores.slice(-2).map((entry) => entry.score)
  );
  const progressionDelta = lastScoreAverage - firstScoreAverage;

  if (progressionDelta <= 0) return null;

  return {
    firstScoreAverage,
    lastScoreAverage,
    progressionDelta,
    scoreCount: scores.length,
  };
}

function averageNumbers(values) {
  const numbers = values.map(toNumber).filter((value) => value > 0);
  if (!numbers.length) return 0;

  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function compareScoreEntries(a, b) {
  const importDiff = toNumber(a.sourceImportOrder) - toNumber(b.sourceImportOrder);
  if (Math.abs(importDiff) > 1e-9) return importDiff;

  const showDiff = String(a.showNum || "").localeCompare(
    String(b.showNum || ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );
  if (showDiff !== 0) return showDiff;

  const importedAtDiff = String(a.sourceImportedAt || "").localeCompare(
    String(b.sourceImportedAt || "")
  );
  if (importedAtDiff !== 0) return importedAtDiff;

  const rowDiff = toNumber(a.sourceRowNumber) - toNumber(b.sourceRowNumber);
  if (Math.abs(rowDiff) > 1e-9) return rowDiff;

  return toNumber(a.sequence) - toNumber(b.sequence);
}

function addPointAggregate(map, key, fact) {
  if (!key) return;

  const entry = map.get(key) || {
    rider: fact.rider || "",
    horse: fact.horse || "",
    totalPoints: 0,
    detailCount: 0,
    classNames: [],
    relatedNames: [],
  };

  entry.totalPoints += fact.points;
  entry.detailCount += 1;

  if (fact.className && !entry.classNames.includes(fact.className)) {
    entry.classNames.push(fact.className);
  }

  if (fact.relationName && !entry.relatedNames.includes(fact.relationName)) {
    entry.relatedNames.push(fact.relationName);
  }

  entry.classCount = entry.classNames.length;
  entry[`${fact.relationKey}Count`] = entry.relatedNames.length;
  entry.className = entry.classNames.join(", ");

  map.set(key, entry);
}

function isRanchRidingChampionshipClass(classEntry) {
  const id = String(classEntry?.id || "").trim().toLowerCase();
  const name = String(classEntry?.name || "").trim().toLowerCase();
  const events = Array.isArray(classEntry?.events) ? classEntry.events : [];

  return (
    id === "ranch-riding" ||
    name.includes("ranch riding") ||
    events.some((event) => normalizeClassCode(event?.classCode) === "399")
  );
}

function hasCompleteOccurrenceResults(dataset) {
  const events = (Array.isArray(dataset?.classes) ? dataset.classes : []).flatMap(
    (classEntry) => (Array.isArray(classEntry?.events) ? classEntry.events : [])
  );

  return (
    events.length > 0 &&
    events.every(
      (event) =>
        Array.isArray(event.results) &&
        event.results.length >= (event.resultCount || 0)
    )
  );
}

function normalizeIncludedShow(show, index) {
  const key = getChampionshipEventLabelKey(show);

  return {
    key,
    label: show.label || show.showName || show.showNum || "Show",
    showNum: show.showNum,
    showName: show.showName,
    order: show.order || index + 1,
    publicOrder: show.publicOrder,
    occurrenceCount: show.occurrenceCount || 0,
    resultCount: show.resultCount || 0,
  };
}

function pickLeaders(items, compare, valueKey) {
  const sorted = items.slice().sort(compare);
  const leader = sorted[0] || null;

  if (!leader) return [];

  return sorted.filter(
    (item) => Math.abs(toNumber(item[valueKey]) - toNumber(leader[valueKey])) < 1e-9
  );
}

function pickLeader(items, compare) {
  const leader = items.slice().sort(compare)[0] || null;
  return leader ? [leader] : [];
}

function compareHighestScores(a, b) {
  const scoreDiff = toNumber(b.score) - toNumber(a.score);
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

  return compareFunFactNames(a, b);
}

function comparePointLeaders(a, b) {
  const pointDiff = toNumber(b.totalPoints) - toNumber(a.totalPoints);
  if (Math.abs(pointDiff) > 1e-9) return pointDiff;

  return compareFunFactNames(a, b);
}

function comparePodiumLeaders(a, b) {
  const podiumDiff = toNumber(b.podiumCount) - toNumber(a.podiumCount);
  if (Math.abs(podiumDiff) > 1e-9) return podiumDiff;

  const pointDiff = toNumber(b.totalPoints) - toNumber(a.totalPoints);
  if (Math.abs(pointDiff) > 1e-9) return pointDiff;

  return compareFunFactNames(a, b);
}

function compareProgressionLeaders(a, b) {
  const progressionDiff =
    toNumber(b.progressionDelta) - toNumber(a.progressionDelta);
  if (Math.abs(progressionDiff) > 1e-9) return progressionDiff;

  const lastScoreDiff =
    toNumber(b.lastScoreAverage) - toNumber(a.lastScoreAverage);
  if (Math.abs(lastScoreDiff) > 1e-9) return lastScoreDiff;

  return compareFunFactNames(a, b);
}

function compareMostClasses(a, b) {
  const classDiff = toNumber(b.classCount) - toNumber(a.classCount);
  if (Math.abs(classDiff) > 1e-9) return classDiff;

  return compareFunFactNames(a, b);
}

function compareFunFactNames(a, b) {
  return `${a.rider} ${a.horse} ${a.className}`.localeCompare(
    `${b.rider} ${b.horse} ${b.className}`
  );
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
    const horseNrha = cell(row, index.HorseNrha);
    const memberNrha = cell(row, index.MemberNrha);
    const riderKey = buildChampionshipRiderKey({ rider, memberNrha });
    const horseKey = buildChampionshipHorseKey({ horse, horseNrha });
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
      rawEntryCount: cell(row, index.EntryCount),
      shownCount: toNumber(cell(row, index.ShownCount)),
      rawShownCount: cell(row, index.ShownCount),
      goType: cell(row, index.GoType),
      goNum: cell(row, index.GoNum),
      horse,
      horseNrha,
      rider,
      memberNrha,
      backNumber: cell(row, index.BackNum),
      placeNum: toNumber(cell(row, index.PlaceNum)),
      rawPlaceNum: cell(row, index.PlaceNum),
      totalScore: toNumber(cell(row, index.TotalScore)),
      rawTotalScore: cell(row, index.TotalScore),
      riderKey,
      horseKey,
      teamKey: buildChampionshipTeamKey({
        rider,
        horse,
        memberNrha,
        horseNrha,
      }),
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
        ? importBatch.rows.map((row) =>
            stripMoneyFields({
              ...row,
              sourceImportId: row.sourceImportId || importId,
              sourceFileName: row.sourceFileName || fileName,
            })
          )
        : [];

      return {
        id: importId,
        fileName,
        sourceType: importBatch?.sourceType || "",
        importedAt: importBatch?.importedAt || "",
        rowCount: importBatch?.rowCount ?? rows.length,
        ignoredRowCount: importBatch?.ignoredRowCount || 0,
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

function normalizeChampionshipDisqualification(disqualification) {
  if (!disqualification || typeof disqualification !== "object") return null;

  const reason = String(disqualification.reason || "").trim();
  if (!reason) return null;

  const championshipClassId = String(
    disqualification.championshipClassId || disqualification.classId || ""
  ).trim();
  const eventKey = String(disqualification.eventKey || "").trim();
  const teamKey = String(disqualification.teamKey || "").trim();
  const sourceImportId = String(disqualification.sourceImportId || "").trim();
  const sourceRowNumber = String(disqualification.sourceRowNumber || "").trim();
  const key =
    String(disqualification.key || "").trim() ||
    buildChampionshipDisqualificationKey({
      championshipClassId,
      eventKey,
      teamKey,
      sourceImportId,
      sourceRowNumber,
    });

  if (!key || disqualification.active === false) return null;

  return {
    ...disqualification,
    id: String(disqualification.id || key).trim(),
    key,
    championshipClassId,
    eventKey,
    teamKey,
    sourceImportId,
    sourceRowNumber,
    rider: String(disqualification.rider || "").trim(),
    horse: String(disqualification.horse || "").trim(),
    backNumber: String(disqualification.backNumber || "").trim(),
    reason,
    active: true,
    createdAt: disqualification.createdAt || "",
  };
}

function applyChampionshipDisqualifications(rows, disqualifications) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Array.isArray(disqualifications) || disqualifications.length === 0) {
    return rows;
  }

  const disqualificationsByKey = new Map(
    disqualifications.map((disqualification) => [
      disqualification.key,
      disqualification,
    ])
  );
  const rowsByEvent = new Map();
  const correctedRows = rows.map((row) => {
    const disqualification = findDisqualificationForRow(
      row,
      disqualificationsByKey,
      disqualifications
    );
    const nextRow = disqualification
      ? {
          ...row,
          disqualified: true,
          dqReason: disqualification.reason,
          disqualificationId: disqualification.id,
          disqualificationKey: disqualification.key,
          originalPlaceNum: row.placeNum,
          rawOriginalPlaceNum: row.rawPlaceNum,
          originalEntryCount: row.entryCount,
          rawOriginalEntryCount: row.rawEntryCount,
          originalShownCount: row.shownCount,
          rawOriginalShownCount: row.rawShownCount,
          placeNum: 0,
          rawPlaceNum: "DQ",
          points: 0,
          tieCount: 0,
        }
      : row;
    const eventKey = buildChampionshipEventKey(row);

    if (!rowsByEvent.has(eventKey)) {
      rowsByEvent.set(eventKey, []);
    }
    rowsByEvent.get(eventKey).push(nextRow);

    return nextRow;
  });

  rowsByEvent.forEach((eventRows, eventKey) => {
    if (!eventRows.some((row) => row.disqualified)) return;

    const disqualifiedPlacedCount = eventRows.filter(
      (row) => row.disqualified && toNumber(row.originalPlaceNum) > 0
    ).length;
    const adjustedEntryCount = Math.max(
      0,
      Math.max(...eventRows.map((row) => toNumber(row.originalEntryCount || row.entryCount))) -
        disqualifiedPlacedCount
    );
    const adjustedShownCount = Math.max(
      0,
      Math.max(...eventRows.map((row) => toNumber(row.originalShownCount || row.shownCount))) -
        disqualifiedPlacedCount
    );
    const validRows = eventRows
      .filter((row) => !row.disqualified)
      .slice()
      .sort(compareRowsForDisqualificationRecalculation);
    let nextPlace = 1;
    let index = 0;

    while (index < validRows.length) {
      const originalPlace = toNumber(validRows[index].placeNum);
      const tiedRows = [validRows[index]];
      let nextIndex = index + 1;

      while (
        nextIndex < validRows.length &&
        originalPlace > 0 &&
        toNumber(validRows[nextIndex].placeNum) === originalPlace
      ) {
        tiedRows.push(validRows[nextIndex]);
        nextIndex += 1;
      }

      tiedRows.forEach((row) => {
        if (originalPlace <= 0) return;

        row.originalPlaceNum = row.originalPlaceNum ?? row.placeNum;
        row.rawOriginalPlaceNum = row.rawOriginalPlaceNum ?? row.rawPlaceNum;
        row.originalEntryCount = row.originalEntryCount ?? row.entryCount;
        row.rawOriginalEntryCount = row.rawOriginalEntryCount ?? row.rawEntryCount;
        row.originalShownCount = row.originalShownCount ?? row.shownCount;
        row.rawOriginalShownCount = row.rawOriginalShownCount ?? row.rawShownCount;
        row.placeNum = nextPlace;
        row.rawPlaceNum = String(nextPlace);
        if (adjustedEntryCount > 0) {
          row.entryCount = adjustedEntryCount;
          row.rawEntryCount = String(adjustedEntryCount);
        }
        if (adjustedShownCount > 0) {
          row.shownCount = adjustedShownCount;
          row.rawShownCount = String(adjustedShownCount);
        }
        row.recalculatedAfterDisqualification = true;
      });

      if (originalPlace > 0) {
        nextPlace += tiedRows.length;
      }
      index = nextIndex;
    }
  });

  return correctedRows;
}

function findDisqualificationForRow(
  row,
  disqualificationsByKey,
  disqualifications
) {
  const directKey = buildChampionshipDisqualificationKey(row);
  if (directKey && disqualificationsByKey.has(directKey)) {
    return disqualificationsByKey.get(directKey);
  }

  const eventKey = buildChampionshipEventKey(row);
  return disqualifications.find((disqualification) => {
    if (disqualification.sourceImportId && disqualification.sourceRowNumber) {
      const sourceMatches =
        disqualification.sourceImportId === String(row.sourceImportId || "").trim() &&
        disqualification.sourceRowNumber === String(row.sourceRowNumber || "").trim();

      if (sourceMatches) return true;
    }

    return (
      disqualification.championshipClassId ===
        String(row.championshipClassId || "").trim() &&
      disqualification.eventKey === eventKey &&
      disqualification.teamKey === String(row.teamKey || "").trim()
    );
  });
}

function compareRowsForDisqualificationRecalculation(a, b) {
  const placeDiff = toNumber(a.placeNum) - toNumber(b.placeNum);
  if (Math.abs(placeDiff) > 1e-9) return placeDiff;

  const scoreDiff = toNumber(b.totalScore) - toNumber(a.totalScore);
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

  return toNumber(a.sourceRowNumber) - toNumber(b.sourceRowNumber);
}

function buildStandings(rows) {
  const rowsWithPoints = applyTiePoints(rows);
  const classesById = new Map();
  const eventsByKey = new Map();
  const showsByKey = new Map();
  const teamByClassAndKey = new Map();

  rowsWithPoints.forEach((row) => {
    const classEntry = getOrCreateClassEntry(classesById, row);
    const event = getOrCreateEventEntry(eventsByKey, classEntry, row);
    const show = getOrCreateIncludedShow(showsByKey, row);

    event.totalPoints += row.points;
    event.resultCount += 1;
    event.results.push(buildOccurrenceResult(row));
    show.resultCount += 1;
    if (!show.eventKeys.includes(event.eventKey)) {
      show.eventKeys.push(event.eventKey);
    }

    if (!row.teamKey) {
      return;
    }

    const teamEntry = getOrCreateTeamEntry(teamByClassAndKey, classEntry, row);
    teamEntry.totalPoints += row.points;
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
      rawEntryCount: row.rawEntryCount,
      shownCount: row.shownCount,
      rawShownCount: row.rawShownCount,
      placeNum: row.placeNum,
      rawPlaceNum: row.rawPlaceNum,
      totalScore: row.totalScore,
      rawTotalScore: row.rawTotalScore,
      points: row.points,
      tieCount: row.tieCount,
      disqualified: row.disqualified,
      dqReason: row.dqReason,
      disqualificationId: row.disqualificationId,
      disqualificationKey: row.disqualificationKey,
      originalPlaceNum: row.originalPlaceNum,
      rawOriginalPlaceNum: row.rawOriginalPlaceNum,
      originalEntryCount: row.originalEntryCount,
      rawOriginalEntryCount: row.rawOriginalEntryCount,
      originalShownCount: row.originalShownCount,
      rawOriginalShownCount: row.rawOriginalShownCount,
      recalculatedAfterDisqualification: row.recalculatedAfterDisqualification,
      backNumber: row.backNumber,
      horseNrha: row.horseNrha,
      memberNrha: row.memberNrha,
      sourceImportedAt: row.sourceImportedAt,
      sourceImportOrder: row.sourceImportOrder,
      sourceFileName: row.sourceFileName,
      sourceRowNumber: row.sourceRowNumber,
    });
  });

  const classes = Array.from(classesById.values())
    .map((classEntry) => {
      const teams = Array.from(teamByClassAndKey.values())
        .filter((team) => team.championshipClassId === classEntry.id)
        .filter((team) => team.totalPoints > 0)
        .sort(compareTeams);
      const rankedTeams = applyRanks(teams);

      return {
        ...classEntry,
        events: classEntry.events
          .map((event) => ({
            ...event,
            results: event.results.slice().sort(compareOccurrenceResults),
          }))
          .sort(compareChampionshipOccurrences),
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
  const shows = Array.from(showsByKey.values())
    .map(({ eventKeys, ...show }) => ({
      ...show,
      occurrenceCount: eventKeys.length,
    }))
    .sort(compareChampionshipOccurrences);

  return {
    classCount: classes.length,
    eventCount,
    showCount: shows.length,
    shows,
    teamCount,
    classes,
  };
}

function applyTiePoints(rows) {
  const tieCounts = new Map();

  rows.forEach((row) => {
    if (row.disqualified) return;

    const maxPoints = Math.min(Math.max(row.entryCount, 0), 10);
    if (row.placeNum <= 0 || row.placeNum > maxPoints) return;

    const tieKey = `${buildChampionshipEventKey(row)}|${row.placeNum}`;
    tieCounts.set(tieKey, (tieCounts.get(tieKey) || 0) + 1);
  });

  return rows.map((row) => {
    if (row.disqualified) {
      return {
        ...row,
        points: 0,
        tieCount: 0,
      };
    }

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
      resultCount: 0,
      results: [],
    };
    eventsByKey.set(eventKey, event);
    classEntry.events.push(event);
  }

  return eventsByKey.get(eventKey);
}

function getOrCreateIncludedShow(showsByKey, row) {
  const key = getChampionshipEventLabelKey(row);

  if (!showsByKey.has(key)) {
    showsByKey.set(key, {
      key,
      label: row.showName || row.showNum || "Show",
      showNum: row.showNum,
      showName: row.showName,
      order: showsByKey.size + 1,
      occurrenceCount: 0,
      resultCount: 0,
      eventKeys: [],
    });
  }

  return showsByKey.get(key);
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
      rank: null,
      details: [],
    });
  }

  return teamByClassAndKey.get(key);
}

function buildOccurrenceResult(row) {
  return {
    eventKey: buildChampionshipEventKey(row),
    teamKey: row.teamKey,
    rider: row.rider,
    horse: row.horse,
    backNumber: row.backNumber,
    horseNrha: row.horseNrha,
    memberNrha: row.memberNrha,
    placeNum: row.placeNum,
    rawPlaceNum: row.rawPlaceNum,
    totalScore: row.totalScore,
    rawTotalScore: row.rawTotalScore,
    points: row.points,
    tieCount: row.tieCount,
    disqualified: row.disqualified,
    dqReason: row.dqReason,
    disqualificationId: row.disqualificationId,
    disqualificationKey: row.disqualificationKey,
    originalPlaceNum: row.originalPlaceNum,
    rawOriginalPlaceNum: row.rawOriginalPlaceNum,
    originalEntryCount: row.originalEntryCount,
    rawOriginalEntryCount: row.rawOriginalEntryCount,
    originalShownCount: row.originalShownCount,
    rawOriginalShownCount: row.rawOriginalShownCount,
    recalculatedAfterDisqualification: row.recalculatedAfterDisqualification,
    entryCount: row.entryCount,
    rawEntryCount: row.rawEntryCount,
    shownCount: row.shownCount,
    rawShownCount: row.rawShownCount,
    showNum: row.showNum,
    showName: row.showName,
    classCode: row.classCode,
    className: row.className,
    championshipClassId: row.championshipClassId,
    championshipClassName: row.championshipClassName,
    goType: row.goType,
    goNum: row.goNum,
    patternNum: row.patternNum,
    sourceImportId: row.sourceImportId,
    sourceFileName: row.sourceFileName,
    sourceRowNumber: row.sourceRowNumber,
  };
}

function compareOccurrenceResults(a, b) {
  const aPlace = toNumber(a.placeNum);
  const bPlace = toNumber(b.placeNum);
  const aHasPlace = aPlace > 0;
  const bHasPlace = bPlace > 0;

  if (aHasPlace && bHasPlace && aPlace !== bPlace) return aPlace - bPlace;
  if (aHasPlace !== bHasPlace) return aHasPlace ? -1 : 1;

  const scoreDiff = toNumber(b.totalScore) - toNumber(a.totalScore);
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

  return (
    toNumber(a.sourceRowNumber) - toNumber(b.sourceRowNumber) ||
    `${a.rider} ${a.horse}`.localeCompare(`${b.rider} ${b.horse}`)
  );
}

function compareChampionshipOccurrences(a, b) {
  const aParts = getChampionshipOccurrenceSortParts(a);
  const bParts = getChampionshipOccurrenceSortParts(b);
  const aHasManualOrder = aParts.publicOrder > 0;
  const bHasManualOrder = bParts.publicOrder > 0;

  if (
    aHasManualOrder &&
    bHasManualOrder &&
    aParts.publicOrder !== bParts.publicOrder
  ) {
    return aParts.publicOrder - bParts.publicOrder;
  }

  if (aHasManualOrder !== bHasManualOrder) {
    return aHasManualOrder ? -1 : 1;
  }

  if (aParts.month && bParts.month && aParts.month !== bParts.month) {
    return aParts.month - bParts.month;
  }

  if (Boolean(aParts.month) !== Boolean(bParts.month)) {
    return aParts.month ? -1 : 1;
  }

  if (aParts.sequence !== bParts.sequence) {
    return aParts.sequence - bParts.sequence;
  }

  return (
    compareNumericText(aParts.showNum, bParts.showNum) ||
    compareNumericText(aParts.goType, bParts.goType) ||
    compareNumericText(aParts.goNum, bParts.goNum) ||
    compareNumericText(aParts.label, bParts.label) ||
    toNumber(a.order) - toNumber(b.order) ||
    compareNumericText(aParts.key, bParts.key)
  );
}

function getChampionshipOccurrenceSortParts(occurrence) {
  const label =
    occurrence?.label ||
    occurrence?.eventLabel ||
    occurrence?.showName ||
    occurrence?.showNum ||
    occurrence?.key ||
    occurrence?.eventKey ||
    "";
  const searchable = [
    occurrence?.label,
    occurrence?.eventLabel,
    occurrence?.showName,
    occurrence?.showNum,
    occurrence?.key,
    occurrence?.eventKey,
  ]
    .filter(Boolean)
    .join(" ");
  const tokens = normalizeSearchKey(searchable).split(" ").filter(Boolean);
  const monthIndex = tokens.findIndex((token) =>
    CHAMPIONSHIP_MONTH_ORDER.has(token)
  );
  const month =
    monthIndex >= 0 ? CHAMPIONSHIP_MONTH_ORDER.get(tokens[monthIndex]) : 0;
  const sequence =
    findNumberInTokens(tokens, monthIndex >= 0 ? monthIndex + 1 : 0) ??
    findNumberInTokens(tokens, 0) ??
    Number.MAX_SAFE_INTEGER;

  return {
    key: occurrence?.eventKey || occurrence?.key || "",
    label,
    publicOrder: toNumber(occurrence?.publicOrder),
    month,
    sequence,
    showNum: occurrence?.showNum || "",
    goType: occurrence?.goType || "",
    goNum: occurrence?.goNum || "",
  };
}

function findNumberInTokens(tokens, startIndex) {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const match = String(tokens[index] || "").match(/\d+/);
    if (match) return Number(match[0]);
  }

  return null;
}

function compareNumericText(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
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
      details: team.details.slice().sort(compareChampionshipOccurrences),
    };
  });
}

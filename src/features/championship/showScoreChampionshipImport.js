import { buildClassResultGroups } from "../results/classResults";
import {
  ASSOCIATION_CLASS_MATCH_STATUSES,
  resolveAssociationChampionshipClass,
} from "./associationClassDictionary";
import {
  buildChampionshipHorseKey,
  buildChampionshipRiderKey,
  buildChampionshipTeamKey,
} from "./championshipStandings";
import { toNumber } from "./championshipPoints";
import { createId } from "../../utils/createId";

const MANUAL_EXCLUSION_REASON = "manual_class_exclusion";

export function buildShowScoreChampionshipImportPreview({
  association,
  classDataItems = [],
  generatedAt = "",
} = {}) {
  const generatedOn = generatedAt || new Date().toISOString();
  const rows = [];
  const classes = [];
  let sourceRowNumber = 1;

  (Array.isArray(classDataItems) ? classDataItems : []).forEach((classData) => {
    if (!classData?.official?.isSecretariatValidated) return;

    const classItem = classData.classItem || {};
    const official = classData.official || {};
    const groups = buildClassResultGroups(classData);

    groups.forEach((group) => {
      const scoredEntries = group.entries.filter(hasChampionshipScore);
      const match = resolveAssociationChampionshipClass({
        association,
        code: group.classCode || group.code,
        name: group.className,
        entryCount: group.entries.length,
      });
      const sourceClassKey = buildSourceClassKey(classData, group);
      const canInclude =
        match?.status === ASSOCIATION_CLASS_MATCH_STATUSES.MATCHED &&
        Boolean(match.championshipClassCode) &&
        scoredEntries.length > 0;
      const ignoredReason = canInclude
        ? ""
        : getIgnoredReasonForClass(match, scoredEntries);
      const showMeta = getClassShowMeta(classData);

      classes.push({
        key: sourceClassKey,
        sourceClassId: classItem.id || group.sourceClassId || "",
        sourceClassName: classItem.name || group.parentClassName || "",
        showName: showMeta.showName,
        showNum: showMeta.showNum,
        eventDate: official.eventDate || classData.day?.date || "",
        importedClassCode: group.classCode || group.code || "",
        importedClassName: group.className || "",
        championshipClassId: match?.championshipClassId || "",
        championshipClassName: match?.championshipClassName || "",
        championshipClassCode: match?.championshipClassCode || "",
        matchStatus: match?.status || ASSOCIATION_CLASS_MATCH_STATUSES.UNKNOWN,
        matchType: match?.matchType || "",
        reason: match?.reason || ignoredReason,
        entryCount: group.entries.length,
        scoredCount: scoredEntries.length,
        rowCount: scoredEntries.length,
        canInclude,
      });

      scoredEntries.forEach((entry) => {
        const rider = String(entry.rider || "").trim();
        const horse = String(entry.horse || "").trim();
        const memberNrha = getEntryIdentityValue(entry, [
          "memberNrha",
          "member_nrha",
          "riderNrha",
          "rider_nrha",
          "memberNumber",
          "member_number",
        ]);
        const horseNrha = getEntryIdentityValue(entry, [
          "horseNrha",
          "horse_nrha",
          "horseNumber",
          "horse_number",
          "horseRegistrationNumber",
          "horse_registration_number",
          "registrationNumber",
          "registration_number",
        ]);
        const riderContactId = getEntryIdentityValue(entry, [
          "riderContactId",
          "rider_contact_id",
        ]);
        const horseId = getEntryIdentityValue(entry, ["horseId", "horse_id"]);
        const riderKey = buildChampionshipRiderKey({
          rider,
          memberNrha,
          riderContactId,
        });
        const horseKey = buildChampionshipHorseKey({
          horse,
          horseNrha,
          horseId,
        });
        const rowIgnored = !canInclude;
        const row = {
          sourceFileName: "",
          sourceImportId: "",
          sourceRowNumber,
          source: "showscore",
          sourceClassKey,
          sourceClassId: classItem.id || group.sourceClassId || "",
          showNum: showMeta.showNum,
          showName: showMeta.showName,
          className: match?.championshipClassName || group.className || "",
          classCode: match?.championshipClassCode || group.classCode || group.code || "",
          importedClassName: group.className || "",
          importedClassCode: group.classCode || group.code || "",
          patternNum: group.pattern || official.pattern || "",
          entryCount: group.entries.length,
          rawEntryCount: String(group.entries.length || ""),
          shownCount: scoredEntries.length,
          rawShownCount: String(scoredEntries.length || ""),
          goType: "ShowScore",
          goNum: classItem.id || group.id || "1",
          horse,
          horseNrha,
          rider,
          memberNrha,
          backNumber: String(entry.backNumber || ""),
          placeNum: toNumber(entry.rank),
          rawPlaceNum: String(entry.rank || ""),
          totalScore: toNumber(entry.scoreTotal),
          rawTotalScore: String(entry.scoreTotal || ""),
          riderKey,
          horseKey,
          teamKey: buildChampionshipTeamKey({
            rider,
            horse,
            memberNrha,
            horseNrha,
            riderContactId,
            horseId,
          }),
          ...(rowIgnored
            ? {
                ignoredForChampionship: true,
                ignoredReason,
              }
            : {}),
        };

        rows.push(row);
        sourceRowNumber += 1;
      });
    });
  });

  return {
    generatedAt: generatedOn,
    classes,
    rows,
    classCount: classes.length,
    rowCount: rows.length,
    includedClassCount: classes.filter((classEntry) => classEntry.canInclude)
      .length,
    includedRowCount: rows.filter((row) => !row.ignoredForChampionship).length,
    ignoredRowCount: rows.filter((row) => row.ignoredForChampionship).length,
    defaultExcludedClassKeys: classes
      .filter((classEntry) => !classEntry.canInclude)
      .map((classEntry) => classEntry.key),
  };
}

export function buildShowScoreChampionshipImportBatch({
  preview,
  excludedClassKeys = [],
  importedAt = "",
  id = "",
} = {}) {
  const importId = id || createId("showscore-championship-import");
  const importedOn = importedAt || new Date().toISOString();
  const excludedKeys = new Set(excludedClassKeys);
  const rows = (Array.isArray(preview?.rows) ? preview.rows : []).map((row) => {
    const manuallyExcluded = excludedKeys.has(row.sourceClassKey);
    const ignoredForChampionship =
      Boolean(row.ignoredForChampionship) || manuallyExcluded;
    const ignoredReason = manuallyExcluded
      ? MANUAL_EXCLUSION_REASON
      : row.ignoredReason || "";

    return {
      ...row,
      sourceFileName: getShowScoreImportFileName(importedOn),
      sourceImportId: importId,
      ...(ignoredForChampionship
        ? {
            ignoredForChampionship: true,
            ignoredReason,
          }
        : {
            ignoredForChampionship: false,
            ignoredReason: "",
          }),
    };
  });

  return {
    id: importId,
    fileName: getShowScoreImportFileName(importedOn),
    sourceType: "showscore",
    importedAt: importedOn,
    rowCount: rows.length,
    ignoredRowCount: rows.filter((row) => row.ignoredForChampionship).length,
    rows,
  };
}

export function getShowScoreChampionshipSelectionSummary(
  preview,
  excludedClassKeys = []
) {
  const excludedKeys = new Set(excludedClassKeys);
  const classes = Array.isArray(preview?.classes) ? preview.classes : [];
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];

  return {
    classCount: classes.length,
    selectableClassCount: classes.filter((classEntry) => classEntry.canInclude)
      .length,
    selectedClassCount: classes.filter(
      (classEntry) => classEntry.canInclude && !excludedKeys.has(classEntry.key)
    ).length,
    rowCount: rows.length,
    selectedRowCount: rows.filter(
      (row) => !row.ignoredForChampionship && !excludedKeys.has(row.sourceClassKey)
    ).length,
    ignoredRowCount: rows.filter(
      (row) => row.ignoredForChampionship || excludedKeys.has(row.sourceClassKey)
    ).length,
  };
}

function hasChampionshipScore(entry) {
  return toNumber(entry?.scoreTotal) > 0;
}

function getEntryIdentityValue(entry, keys) {
  for (const key of keys) {
    const value = String(entry?.[key] || "").trim();
    if (value) return value;
  }

  return "";
}

function getIgnoredReasonForClass(match, scoredEntries) {
  if (!scoredEntries.length) return "no_scored_results";
  if (match?.status === ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED) {
    return "dictionary_excluded_class";
  }
  if (match?.status === ASSOCIATION_CLASS_MATCH_STATUSES.MATCHED) {
    return "missing_championship_code";
  }
  return "dictionary_unmapped_class";
}

function buildSourceClassKey(classData, group) {
  const classItem = classData?.classItem || {};
  return [
    classItem.showId,
    classItem.dayId,
    classItem.id || group?.sourceClassId,
    group?.classCode || group?.code,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("|");
}

function getClassShowMeta(classData) {
  const classItem = classData?.classItem || {};
  const official = classData?.official || {};
  const show = classData?.show || official.show || {};
  const showName =
    official.eventName ||
    show.name ||
    classItem.showName ||
    classItem.show ||
    classItem.showId ||
    "ShowScore";
  const showNum =
    show.showNumber ||
    show.number ||
    show.id ||
    classItem.showId ||
    official.eventName ||
    showName;

  return {
    showName: String(showName || "").trim(),
    showNum: String(showNum || "").trim(),
  };
}

function getShowScoreImportFileName(importedAt) {
  const suffix = String(importedAt || "").slice(0, 16).replace("T", " ");
  return `ShowScore results${suffix ? ` - ${suffix}` : ""}`;
}

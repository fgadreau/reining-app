import { loadAssociationsRepository } from "../associations/associationRepository";
import { getAllClasses } from "../classes/classSelectors";
import { getAllDays } from "../days/daySelectors";
import { getAllShows } from "../shows/showSelectors";
import { loadPaidWarmups } from "../paidWarmups/paidWarmupStorage";
import { getSupabaseClient } from "../cloud/supabaseClient";

function uniqueIds(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function mapById(items) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );
}

function shortId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 12 ? `${text.slice(0, 8)}...` : text;
}

async function safeLoad(loader, fallback = []) {
  try {
    const result = await loader();
    return Array.isArray(result) ? result : fallback;
  } catch (error) {
    console.error("Erreur resolution libelles analytics:", error);
    return fallback;
  }
}

async function fetchRowsByIds(tableName, ids, columns = "*") {
  const supabase = getSupabaseClient();
  const unique = uniqueIds(ids);

  if (!supabase || unique.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .in("id", unique);

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Erreur chargement libelles ${tableName}:`, error);
    return [];
  }
}

function toAssociationFromRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    shortName: row.short_name || "",
  };
}

function toShowFromRow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    name: row.name || "",
  };
}

function toDayFromRow(row) {
  return {
    id: row.id,
    showId: row.show_id,
    label: row.label || "",
    date: row.date || "",
  };
}

function toClassFromRow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "",
    classCode: row.class_code || "",
  };
}

function toPaidWarmupFromRow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "Paid warm up",
    isPaidWarmup: true,
  };
}

function getFallbackNameFromMetadata(metadata, keys) {
  const safeMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};

  return keys
    .map((key) => safeMetadata[key])
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function formatAssociationLabel(association, associationId, metadata) {
  const metadataName = getFallbackNameFromMetadata(metadata, [
    "associationName",
    "name",
  ]);
  const label = association?.name || metadataName || association?.shortName || "";
  return label || associationId || "";
}

function formatShowLabel(show, showId, metadata) {
  const metadataName = getFallbackNameFromMetadata(metadata, ["showName", "name"]);
  const label = show?.name || metadataName || "";
  return label || showId || "";
}

function formatDayLabel(day, dayId, metadata) {
  const metadataLabel = getFallbackNameFromMetadata(metadata, ["dayLabel", "label"]);
  const label = day?.label || metadataLabel || "";
  const date = day?.date || getFallbackNameFromMetadata(metadata, ["date"]);

  if (label && date) return `${label} · ${date}`;
  return label || date || dayId || "";
}

function formatClassLabel(classItem, paidWarmup, classId, metadata) {
  const item = classItem || paidWarmup;
  const metadataName = getFallbackNameFromMetadata(metadata, [
    "className",
    "blockName",
    "paidWarmupName",
    "name",
  ]);
  const name = item?.name || metadataName;
  const classCode =
    classItem?.classCode ||
    getFallbackNameFromMetadata(metadata, ["classCode", "code"]);

  if (name && classCode) return `${name} (${classCode})`;
  return name || classCode || classId || "";
}

function buildNameMaps({ associations, shows, days, classes, paidWarmups }) {
  return {
    associationsById: mapById(associations),
    showsById: mapById(shows),
    daysById: mapById(days),
    classesById: mapById(classes),
    paidWarmupsById: mapById(paidWarmups),
  };
}

export async function buildAnalyticsEventLabelResolver(events) {
  const safeEvents = Array.isArray(events) ? events : [];
  const associationIds = uniqueIds(safeEvents.map((event) => event.associationId));
  const showIds = uniqueIds(safeEvents.map((event) => event.showId));
  const dayIds = uniqueIds(safeEvents.map((event) => event.dayId));
  const classIds = uniqueIds(safeEvents.map((event) => event.classId));

  const localAssociations = await safeLoad(loadAssociationsRepository);
  let associations = localAssociations;
  let shows = getAllShows();
  let days = getAllDays();
  let classes = getAllClasses();
  let paidWarmups = loadPaidWarmups();
  let maps = buildNameMaps({ associations, shows, days, classes, paidWarmups });

  const missingAssociationIds = associationIds.filter(
    (id) => !maps.associationsById.has(id)
  );
  const missingShowIds = showIds.filter((id) => !maps.showsById.has(id));
  const missingDayIds = dayIds.filter((id) => !maps.daysById.has(id));
  const missingClassIds = classIds.filter(
    (id) => !maps.classesById.has(id) && !maps.paidWarmupsById.has(id)
  );

  const [
    remoteAssociations,
    remoteShows,
    remoteDays,
    remoteClasses,
    remotePaidWarmups,
  ] = await Promise.all([
    fetchRowsByIds("associations", missingAssociationIds, "id,name,short_name"),
    fetchRowsByIds("shows", missingShowIds, "id,association_id,name"),
    fetchRowsByIds("days", missingDayIds, "id,show_id,label,date"),
    fetchRowsByIds(
      "classes",
      missingClassIds,
      "id,association_id,show_id,day_id,name,class_code"
    ),
    fetchRowsByIds(
      "paid_warmups",
      missingClassIds,
      "id,association_id,show_id,day_id,name"
    ),
  ]);

  associations = [
    ...associations,
    ...remoteAssociations.map(toAssociationFromRow),
  ];
  shows = [...shows, ...remoteShows.map(toShowFromRow)];
  days = [...days, ...remoteDays.map(toDayFromRow)];
  classes = [...classes, ...remoteClasses.map(toClassFromRow)];
  paidWarmups = [
    ...paidWarmups,
    ...remotePaidWarmups.map(toPaidWarmupFromRow),
  ];
  maps = buildNameMaps({ associations, shows, days, classes, paidWarmups });

  const inferredShowIds = uniqueIds(
    [...classes, ...paidWarmups].map((item) => item.showId)
  ).filter((id) => !maps.showsById.has(id));
  const inferredDayIds = uniqueIds(
    [...classes, ...paidWarmups].map((item) => item.dayId)
  ).filter((id) => !maps.daysById.has(id));

  if (inferredShowIds.length || inferredDayIds.length) {
    const [inferredShows, inferredDays] = await Promise.all([
      fetchRowsByIds("shows", inferredShowIds, "id,association_id,name"),
      fetchRowsByIds("days", inferredDayIds, "id,show_id,label,date"),
    ]);

    shows = [...shows, ...inferredShows.map(toShowFromRow)];
    days = [...days, ...inferredDays.map(toDayFromRow)];
  }

  return buildNameMaps({ associations, shows, days, classes, paidWarmups });
}

export function enrichAnalyticsEventLabels(event, resolver) {
  const safeEvent = event || {};
  const metadata = safeEvent.metadata || {};
  const classItem = resolver?.classesById?.get(safeEvent.classId);
  const paidWarmup = resolver?.paidWarmupsById?.get(safeEvent.classId);
  const resolvedShowId =
    safeEvent.showId || classItem?.showId || paidWarmup?.showId;
  const resolvedDayId =
    safeEvent.dayId || classItem?.dayId || paidWarmup?.dayId;
  const show = resolver?.showsById?.get(resolvedShowId);
  const day = resolver?.daysById?.get(resolvedDayId);
  const resolvedAssociationId =
    safeEvent.associationId ||
    show?.associationId ||
    classItem?.associationId ||
    paidWarmup?.associationId;
  const association = resolver?.associationsById?.get(resolvedAssociationId);

  return {
    ...safeEvent,
    resolvedLabels: {
      association: formatAssociationLabel(
        association,
        resolvedAssociationId,
        metadata
      ),
      show: formatShowLabel(show, resolvedShowId, metadata),
      day: formatDayLabel(day, resolvedDayId, metadata),
      class: formatClassLabel(classItem, paidWarmup, safeEvent.classId, metadata),
      associationFallback: safeEvent.associationId
        ? shortId(safeEvent.associationId)
        : "",
      showFallback: safeEvent.showId ? shortId(safeEvent.showId) : "",
      dayFallback: safeEvent.dayId ? shortId(safeEvent.dayId) : "",
      classFallback: safeEvent.classId ? shortId(safeEvent.classId) : "",
    },
  };
}

export function resolveAnalyticsLabel(kind, id, resolver, metadata = {}) {
  const safeId = String(id || "").trim();
  if (!safeId) return "";

  if (kind === "association") {
    return formatAssociationLabel(
      resolver?.associationsById?.get(safeId),
      safeId,
      metadata
    );
  }

  if (kind === "show") {
    return formatShowLabel(resolver?.showsById?.get(safeId), safeId, metadata);
  }

  if (kind === "day") {
    return formatDayLabel(resolver?.daysById?.get(safeId), safeId, metadata);
  }

  if (kind === "class") {
    return formatClassLabel(
      resolver?.classesById?.get(safeId),
      resolver?.paidWarmupsById?.get(safeId),
      safeId,
      metadata
    );
  }

  return safeId;
}

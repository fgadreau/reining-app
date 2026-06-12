import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getClassesByDayId } from "../classes/classSelectors";
import { getPaidWarmupsByDayId } from "../paidWarmups/paidWarmupStorage";
import { createId } from "../../utils/createId";
import { getAllDays, getDayById, getDaysByShowId } from "./daySelectors";
import { createDay, deleteDay, saveDays, updateDay } from "./dayStorage";
import {
  formatDayLabel,
  getShowDateRange,
  getSortOrderForShowDate,
  sortDaysByDate,
} from "./dayDateUtils";

function toDay(row) {
  return {
    id: row.id,
    associationId: row.association_id || row.organization_id,
    showId: row.show_id,
    label: row.label || row.day_name || "",
    date: row.date || row.day_date || "",
    sortOrder: row.sort_order || 1,
  };
}

function toSharedShowDayRow(day) {
  return {
    id: day.id,
    organization_id: day.associationId,
    show_id: day.showId,
    day_name: day.label || "",
    day_date: day.date || null,
    sort_order: Number(day.sortOrder) || 1,
  };
}

async function upsertDayRow(supabase, day) {
  const { error } = await supabase
    .from("show_days")
    .upsert(toSharedShowDayRow(day), { onConflict: "id" });

  if (error) throw error;
}

async function deleteDayRow(supabase, dayId) {
  const { error } = await supabase.from("show_days").delete().eq("id", dayId);

  if (error) throw error;
}

function saveDayLocally(day) {
  const exists = getAllDays().some((item) => item.id === day.id);

  if (exists) {
    updateDay(day.id, day);
  } else {
    createDay(day);
  }

  return day;
}

export async function getDaysByShowRepository(showId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return sortDaysByDate(getDaysByShowId(showId));
  }

  try {
    const { data, error } = await supabase
      .from("show_days")
      .select("*")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true })
      .order("day_date", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const days = sortDaysByDate(Array.isArray(data) ? data.map(toDay) : []);
    const otherLocalDays = getAllDays().filter((day) => day.showId !== showId);
    saveDays([...otherLocalDays, ...days]);
    return days;
  } catch (error) {
    console.error("Erreur chargement journées Supabase:", error);
    return sortDaysByDate(getDaysByShowId(showId));
  }
}

export async function getDayRepository(dayId) {
  const localDay = getDayById(dayId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localDay;
  }

  try {
    const { data, error } = await supabase
      .from("show_days")
      .select("*")
      .eq("id", dayId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localDay;

    const day = toDay(data);
    saveDayLocally(day);
    return day;
  } catch (error) {
    console.error("Erreur chargement journée Supabase:", error);
    return localDay;
  }
}

export async function saveDayRepository(day) {
  const supabase = getSupabaseClient();
  const isExistingDay = Boolean(getDayById(day.id));

  if (supabase) {
    try {
      await upsertDayRow(supabase, day);
    } catch (error) {
      console.error("Erreur sauvegarde journée Supabase:", error);
    }
  }

  const savedDay = saveDayLocally(day);

  trackEvent({
    eventName: isExistingDay ? "day_updated" : "day_created",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: savedDay.associationId,
    showId: savedDay.showId,
    dayId: savedDay.id,
    metadata: {
      label: savedDay.label,
      date: savedDay.date,
    },
  });

  return savedDay;
}

async function tableHasRowsForColumn(supabase, tableName, columnName, value) {
  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq(columnName, value)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export async function dayHasScheduleItemsRepository(dayId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return (
      getClassesByDayId(dayId).length > 0 ||
      getPaidWarmupsByDayId(dayId).length > 0
    );
  }

  try {
    const [hasClasses, hasPaidWarmups] = await Promise.all([
      tableHasRowsForColumn(supabase, "classes", "show_day_id", dayId),
      tableHasRowsForColumn(
        supabase,
        "show_score_paid_warmups",
        "show_day_id",
        dayId
      ),
    ]);

    return hasClasses || hasPaidWarmups;
  } catch (error) {
    console.error("Erreur verification contenu journée Supabase:", error);
    return (
      getClassesByDayId(dayId).length > 0 ||
      getPaidWarmupsByDayId(dayId).length > 0
    );
  }
}

export async function syncDaysForShowDateRangeRepository(show, options = {}) {
  if (!show?.id || !show?.associationId) {
    return [];
  }

  const currentDays = await getDaysByShowRepository(show.id);
  const dateRange = getShowDateRange(show);

  if (dateRange.length === 0) {
    return currentDays;
  }

  const language = options.language || "fr";
  const rangeDates = new Set(dateRange);
  const nextDaysById = new Map(currentDays.map((day) => [day.id, day]));
  const daysByDate = new Map();

  currentDays.forEach((day) => {
    if (day?.date && !daysByDate.has(day.date)) {
      daysByDate.set(day.date, day);
    }
  });

  for (const date of dateRange) {
    const existingDay = daysByDate.get(date);
    const nextDay = {
      ...(existingDay || {}),
      id: existingDay?.id || createId("day"),
      associationId: show.associationId,
      showId: show.id,
      date,
      label: formatDayLabel(date, language),
      sortOrder: getSortOrderForShowDate(date, show),
    };

    const hasChanged =
      !existingDay ||
      existingDay.associationId !== nextDay.associationId ||
      existingDay.showId !== nextDay.showId ||
      existingDay.label !== nextDay.label ||
      existingDay.sortOrder !== nextDay.sortOrder;

    if (hasChanged) {
      await saveDayRepository(nextDay);
    }

    nextDaysById.set(nextDay.id, nextDay);
  }

  for (const day of currentDays) {
    if (!day?.id || !day.date || rangeDates.has(day.date)) {
      continue;
    }

    const hasScheduleItems = await dayHasScheduleItemsRepository(day.id);

    if (!hasScheduleItems) {
      await deleteDayRepository(day.id);
      nextDaysById.delete(day.id);
      continue;
    }

    const nextLabel = formatDayLabel(day.date, language) || day.label;

    if (nextLabel && nextLabel !== day.label) {
      const protectedDay = { ...day, label: nextLabel };
      await saveDayRepository(protectedDay);
      nextDaysById.set(day.id, protectedDay);
    }
  }

  return sortDaysByDate(Array.from(nextDaysById.values()));
}

export async function deleteDayRepository(dayId) {
  const supabase = getSupabaseClient();
  const existingDay = getDayById(dayId);

  if (supabase) {
    try {
      await deleteDayRow(supabase, dayId);
    } catch (error) {
      console.error("Erreur suppression journée Supabase:", error);
    }
  }

  deleteDay(dayId);

  trackEvent({
    eventName: "day_deleted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: existingDay?.associationId,
    showId: existingDay?.showId,
    dayId,
    metadata: {
      label: existingDay?.label || "",
      date: existingDay?.date || "",
    },
  });
}

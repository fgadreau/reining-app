import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getAllDays, getDayById, getDaysByShowId } from "./daySelectors";
import { createDay, deleteDay, saveDays, updateDay } from "./dayStorage";

function toDay(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    label: row.label || "",
    date: row.date || "",
    sortOrder: row.sort_order || 1,
  };
}

function toDayRow(day) {
  return {
    id: day.id,
    association_id: day.associationId,
    show_id: day.showId,
    label: day.label || "",
    date: day.date || null,
    sort_order: Number(day.sortOrder) || 1,
  };
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
    return getDaysByShowId(showId);
  }

  try {
    const { data, error } = await supabase
      .from("days")
      .select("*")
      .eq("show_id", showId)
      .order("sort_order", { ascending: true })
      .order("date", { ascending: true, nullsFirst: false });

    if (error) throw error;

    const days = Array.isArray(data) ? data.map(toDay) : [];
    const otherLocalDays = getAllDays().filter((day) => day.showId !== showId);
    saveDays([...otherLocalDays, ...days]);
    return days;
  } catch (error) {
    console.error("Erreur chargement journées Supabase:", error);
    return getDaysByShowId(showId);
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
      .from("days")
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
      const { error } = await supabase.from("days").upsert(toDayRow(day));
      if (error) throw error;
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

export async function deleteDayRepository(dayId) {
  const supabase = getSupabaseClient();
  const existingDay = getDayById(dayId);

  if (supabase) {
    try {
      const { error } = await supabase.from("days").delete().eq("id", dayId);
      if (error) throw error;
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

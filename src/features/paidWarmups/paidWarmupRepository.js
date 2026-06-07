import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  LOCAL_FIRST_SYNC_STATUSES,
  withLocalFirstSyncState,
} from "../cloud/localFirstSync";
import {
  deletePaidWarmup,
  getPaidWarmupById,
  getPaidWarmupsByDayId,
  loadPaidWarmups,
  normalizePaidWarmup,
  savePaidWarmup,
  savePaidWarmups,
} from "./paidWarmupStorage";

function toPaidWarmup(row) {
  return normalizePaidWarmup({
    id: row.id,
    associationId: row.association_id,
    showId: row.show_id,
    dayId: row.day_id,
    name: row.name || "",
    durationMinutesPerRider: row.duration_minutes_per_rider,
    dragInterval: row.drag_interval,
    dragDurationMinutes: row.drag_duration_minutes,
    isPublicLive: Boolean(row.is_public_live),
    activeEntryId: row.active_entry_id || null,
    activeStartedAt: row.active_started_at || null,
    entries: Array.isArray(row.entries) ? row.entries : [],
    sortOrder: row.sort_order || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toPaidWarmupRow(item) {
  const warmup = normalizePaidWarmup(item);

  return {
    id: warmup.id,
    association_id: warmup.associationId,
    show_id: warmup.showId,
    day_id: warmup.dayId,
    name: warmup.name || "Paid warm up",
    duration_minutes_per_rider: warmup.durationMinutesPerRider,
    drag_interval: warmup.dragInterval,
    drag_duration_minutes: warmup.dragDurationMinutes,
    is_public_live: Boolean(warmup.isPublicLive),
    active_entry_id: warmup.activeEntryId || null,
    active_started_at: warmup.activeStartedAt || null,
    entries: warmup.entries,
    sort_order: warmup.sortOrder,
  };
}

export async function getPaidWarmupsForDayRepository(dayId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getPaidWarmupsByDayId(dayId);
  }

  try {
    const { data, error } = await supabase
      .from("paid_warmups")
      .select("*")
      .eq("day_id", dayId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const warmups = Array.isArray(data) ? data.map(toPaidWarmup) : [];
    const otherLocalWarmups = loadPaidWarmups().filter(
      (item) => item.dayId !== dayId
    );
    savePaidWarmups([...otherLocalWarmups, ...warmups]);

    return warmups;
  } catch (error) {
    console.error("Erreur chargement paid warmups Supabase:", error);
    return getPaidWarmupsByDayId(dayId);
  }
}

export async function getPaidWarmupRepository(id) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getPaidWarmupById(id);
  }

  try {
    const { data, error } = await supabase
      .from("paid_warmups")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return getPaidWarmupById(id);

    const warmup = toPaidWarmup(data);
    savePaidWarmup(warmup);
    return warmup;
  } catch (error) {
    console.error("Erreur chargement paid warmup Supabase:", error);
    return getPaidWarmupById(id);
  }
}

export async function savePaidWarmupRepository(item) {
  const savedLocal = savePaidWarmup(item);
  const supabase = getSupabaseClient();
  let syncStatus = supabase
    ? LOCAL_FIRST_SYNC_STATUSES.SYNCED
    : LOCAL_FIRST_SYNC_STATUSES.LOCAL;
  let syncError = null;

  if (supabase) {
    try {
      const row = toPaidWarmupRow(savedLocal);
      const { data, error } = await supabase
        .from("paid_warmups")
        .update(row)
        .eq("id", savedLocal.id)
        .select("id");
      if (error) throw error;

      if (!Array.isArray(data) || data.length === 0) {
        const { error: insertError } = await supabase
          .from("paid_warmups")
          .insert(row);
        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error("Erreur sauvegarde paid warmup Supabase:", error);
      syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
      syncError = error;
    }
  }

  return withLocalFirstSyncState(savedLocal, {
    status: syncStatus,
    error: syncError,
  });
}

export async function deletePaidWarmupRepository(id) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("paid_warmups").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression paid warmup Supabase:", error);
    }
  }

  deletePaidWarmup(id);
}

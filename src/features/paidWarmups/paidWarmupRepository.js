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
import {
  CLASS_START_MODE_FIXED,
  normalizeClassScheduleStart,
} from "../classes/classSchedule";

function mergeScheduleStart(row, localWarmup) {
  const remoteScheduleStart = normalizeClassScheduleStart({
    scheduleStartMode: row.schedule_start_mode,
    scheduleStartTime: row.schedule_start_time,
  });
  const localScheduleStart = normalizeClassScheduleStart(localWarmup);

  if (
    localScheduleStart.startMode === CLASS_START_MODE_FIXED &&
    remoteScheduleStart.startMode !== CLASS_START_MODE_FIXED
  ) {
    return localScheduleStart;
  }

  if (
    localScheduleStart.startMode === CLASS_START_MODE_FIXED &&
    remoteScheduleStart.startMode === CLASS_START_MODE_FIXED &&
    !remoteScheduleStart.startTime
  ) {
    return localScheduleStart;
  }

  return remoteScheduleStart;
}

function toPaidWarmup(row, localWarmup = null) {
  const scheduleStart = mergeScheduleStart(row, localWarmup);

  return normalizePaidWarmup({
    id: row.id,
    associationId: row.organization_id,
    showId: row.show_id,
    dayId: row.show_day_id,
    name: row.name || "",
    arena: row.arena || localWarmup?.arena || "",
    durationMinutesPerRider: row.duration_minutes_per_rider,
    dragInterval: row.drag_interval,
    dragDurationMinutes: row.drag_duration_minutes,
    scheduleStartMode: scheduleStart.startMode,
    scheduleStartTime: scheduleStart.startTime,
    isPublicLive: Boolean(row.is_public_live),
    activeEntryId: row.active_entry_id || null,
    activeStartedAt: row.active_started_at || null,
    entries: Array.isArray(row.entries) ? row.entries : [],
    sortOrder: row.sort_order || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function getTimestampValue(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldKeepLocalWarmup(localWarmup, remoteWarmup) {
  if (!localWarmup || !remoteWarmup) return false;

  const localUpdatedAt = getTimestampValue(localWarmup.updatedAt);
  const remoteUpdatedAt = getTimestampValue(remoteWarmup.updatedAt);

  return (
    localUpdatedAt > 0 &&
    remoteUpdatedAt > 0 &&
    localUpdatedAt > remoteUpdatedAt
  );
}

export function buildPaidWarmupMergeResult(row, localWarmup = null) {
  const remoteWarmup = toPaidWarmup(row, localWarmup);

  if (shouldKeepLocalWarmup(localWarmup, remoteWarmup)) {
    return {
      warmup: normalizePaidWarmup({
        ...remoteWarmup,
        ...localWarmup,
      }),
      shouldSyncLocal: true,
    };
  }

  return {
    warmup: remoteWarmup,
    shouldSyncLocal: false,
  };
}

function cachePaidWarmupSnapshot(warmup) {
  const normalized = normalizePaidWarmup(warmup);
  const otherWarmups = loadPaidWarmups().filter(
    (item) => item.id !== normalized.id
  );

  savePaidWarmups([...otherWarmups, normalized]);
  return normalized;
}

function toPaidWarmupRow(item, options = {}) {
  const warmup = normalizePaidWarmup(item);
  const includeActiveEntry = options.includeActiveEntry !== false;
  const row = {
    id: warmup.id,
    organization_id: warmup.associationId,
    show_id: warmup.showId,
    show_day_id: warmup.dayId,
    name: warmup.name || "Paid warm up",
    duration_minutes_per_rider: warmup.durationMinutesPerRider,
    drag_interval: warmup.dragInterval,
    drag_duration_minutes: warmup.dragDurationMinutes,
    is_public_live: Boolean(warmup.isPublicLive),
    active_started_at: warmup.activeStartedAt || null,
    entries: warmup.entries,
    sort_order: warmup.sortOrder,
    arena: warmup.arena || null,
    schedule_start_mode: warmup.scheduleStartMode,
    schedule_start_time: warmup.scheduleStartTime || null,
    updated_at: warmup.updatedAt || new Date().toISOString(),
  };

  if (includeActiveEntry) {
    row.active_entry_id = warmup.activeEntryId || null;
  }

  return row;
}

function isActiveEntryForeignKeyError(error) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");

  return (
    error?.code === "23503" &&
    (message.includes("show_score_paid_warmups_active_entry_id_fkey") ||
      details.includes("show_score_paid_warmups_active_entry_id_fkey"))
  );
}

export function mergePaidWarmupsForDay(localWarmups, remoteWarmups) {
  const remoteById = new Map(
    (Array.isArray(remoteWarmups) ? remoteWarmups : [])
      .filter((item) => item?.id)
      .map((item) => [item.id, normalizePaidWarmup(item)])
  );
  const localOnlyWarmups = (Array.isArray(localWarmups) ? localWarmups : [])
    .map(normalizePaidWarmup)
    .filter((item) => item.id && !remoteById.has(item.id));

  return [...remoteById.values(), ...localOnlyWarmups].sort((a, b) => {
    const sortOrder = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (sortOrder !== 0) return sortOrder;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export async function getPaidWarmupsForDayRepository(dayId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getPaidWarmupsByDayId(dayId);
  }

  try {
    const { data, error } = await supabase
      .from("show_score_paid_warmups")
      .select("*")
      .eq("show_day_id", dayId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const localWarmups = getPaidWarmupsByDayId(dayId);
    const localWarmupsById = new Map(localWarmups.map((item) => [item.id, item]));
    const remoteIds = new Set(
      (Array.isArray(data) ? data : []).map((row) => row.id).filter(Boolean)
    );
    const remoteMergeResults = Array.isArray(data)
      ? data.map((row) =>
          buildPaidWarmupMergeResult(row, localWarmupsById.get(row.id))
        )
      : [];
    const remoteWarmups = remoteMergeResults.map((result) => result.warmup);
    const warmups = mergePaidWarmupsForDay(localWarmups, remoteWarmups);
    const otherLocalWarmups = loadPaidWarmups().filter(
      (item) => item.dayId !== dayId
    );
    savePaidWarmups([...otherLocalWarmups, ...warmups]);
    await syncNewerLocalPaidWarmups(
      [
        ...remoteMergeResults
          .filter((result) => result.shouldSyncLocal)
          .map((result) => result.warmup),
        ...localWarmups.filter((warmup) => warmup.id && !remoteIds.has(warmup.id)),
      ]
    );

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
      .from("show_score_paid_warmups")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const localWarmup = getPaidWarmupById(id);
      return localWarmup ? await savePaidWarmupRepository(localWarmup) : localWarmup;
    }

    const mergeResult = buildPaidWarmupMergeResult(data, getPaidWarmupById(id));
    const warmup = mergeResult.shouldSyncLocal
      ? await syncNewerLocalPaidWarmup(mergeResult.warmup)
      : mergeResult.warmup;
    cachePaidWarmupSnapshot(warmup);
    return warmup;
  } catch (error) {
    console.error("Erreur chargement paid warmup Supabase:", error);
    return getPaidWarmupById(id);
  }
}

async function syncNewerLocalPaidWarmups(warmups) {
  const sourceWarmups = Array.isArray(warmups) ? warmups : [];
  await Promise.all(sourceWarmups.map((warmup) => syncNewerLocalPaidWarmup(warmup)));
}

async function syncNewerLocalPaidWarmup(warmup) {
  try {
    return await savePaidWarmupRepository(warmup);
  } catch (error) {
    console.error("Erreur resynchronisation paid warmup local:", error);
    return withLocalFirstSyncState(warmup, {
      status: LOCAL_FIRST_SYNC_STATUSES.ERROR,
      error,
    });
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
      const result = await upsertPaidWarmupWithActiveEntryFallback(
        supabase,
        savedLocal
      );

      if (result.usedFallback) {
        syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
        syncError =
          "Le paid warmup a été sauvegardé, mais l'entrée active n'existe pas dans les entrées HSP. Le live reste synchronisé sans active_entry_id.";
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

async function upsertPaidWarmupWithActiveEntryFallback(supabase, item) {
  const options = {
    includeActiveEntry: true,
  };
  let usedFallback = false;
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await upsertPaidWarmupRow(supabase, item.id, toPaidWarmupRow(item, options));
      return { usedFallback };
    } catch (error) {
      lastError = error;

      if (isActiveEntryForeignKeyError(error) && options.includeActiveEntry) {
        options.includeActiveEntry = false;
        usedFallback = true;
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

async function upsertPaidWarmupRow(supabase, id, row) {
  const { data, error } = await supabase
    .from("show_score_paid_warmups")
    .update(row)
    .eq("id", id)
    .select("id");

  if (error) throw error;

  if (!Array.isArray(data) || data.length === 0) {
    const { error: insertError } = await supabase.from("show_score_paid_warmups").insert(row);
    if (insertError) throw insertError;
  }
}

export async function deletePaidWarmupRepository(id) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase.from("show_score_paid_warmups").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression paid warmup Supabase:", error);
    }
  }

  deletePaidWarmup(id);
}

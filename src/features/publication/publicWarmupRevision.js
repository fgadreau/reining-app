import { getSupabaseClient } from "../cloud/supabaseClient";

// Only running public timers need reconciliation when a realtime stop is missed.
export function getPublicWarmupRevisionSnapshot(view) {
  const warmups = view?.livePaidWarmups || (view?.livePaidWarmup ? [view.livePaidWarmup] : []);
  return Array.from(new Map(warmups.filter(warmup => warmup.id && warmup.activeStartedAt)
    .map(warmup => [warmup.id, { id: warmup.id, updatedAt: warmup.updatedAt || null }])).values())
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function getPublicWarmupRevisions(ids) {
  const client = getSupabaseClient();
  if (!client) return null;
  if (!ids.length) return [];
  const { data, error } = await client.from("show_score_paid_warmups")
    .select("id,updated_at").in("id", ids);
  if (error) throw error;
  // A warmup becoming private may disappear under RLS: an empty result is a change.
  return (data || []).map(row => ({ id: row.id, updatedAt: row.updated_at || null }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

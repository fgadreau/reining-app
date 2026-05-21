import { isSupabaseConfigured } from "./supabaseClient";

export function getCloudSyncStatus(user = null) {
  const configured = isSupabaseConfigured();
  const authenticated = Boolean(user);

  return {
    provider: "supabase",
    configured,
    authenticated,
    mode: !configured
      ? "local-only"
      : authenticated
        ? "cloud-authenticated"
        : "cloud-login-required",
  };
}

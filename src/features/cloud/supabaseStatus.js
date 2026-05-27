import { isSupabaseConfigured } from "./supabaseClient";

export function getCloudSyncStatus(user = null) {
  const configured = isSupabaseConfigured();
  const isLocalTestUser = Boolean(user?.isLocalTestUser);
  const authenticated = Boolean(user);

  return {
    provider: "supabase",
    configured,
    authenticated,
    mode: isLocalTestUser
      ? "local-test"
      : !configured
      ? "local-only"
      : authenticated
        ? "cloud-authenticated"
        : "cloud-login-required",
  };
}

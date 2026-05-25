import { getSupabaseClient } from "../cloud/supabaseClient";

export const ACCESS_MEMBERSHIPS_CHANGED_EVENT =
  "reining:association-memberships-changed";

export function notifyAccessMembershipsChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACCESS_MEMBERSHIPS_CHANGED_EVENT));
}

export function subscribeAccessMembershipsChanged(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(ACCESS_MEMBERSHIPS_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener(ACCESS_MEMBERSHIPS_CHANGED_EVENT, callback);
  };
}

function toMembership(row) {
  return {
    id: row.id,
    userId: row.user_id,
    associationId: row.association_id,
    role: row.role,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function toUserProfile(row) {
  return {
    id: row.id,
    displayName: row.display_name || "",
    email: row.email || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function toMembershipRow(membership) {
  const row = {
    user_id: membership.userId,
    association_id: membership.associationId,
    role: membership.role,
  };

  if (membership.id) {
    row.id = membership.id;
  }

  return row;
}

export async function loadUserMembershipsRepository(userId) {
  const supabase = getSupabaseClient();

  if (!supabase || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("association_memberships")
      .select("*")
      .eq("user_id", userId)
      .order("association_id", { ascending: true })
      .order("role", { ascending: true });

    if (error) throw error;

    return Array.isArray(data) ? data.map(toMembership) : [];
  } catch (error) {
    console.error("Erreur chargement rôles Supabase:", error);
    return [];
  }
}

export async function saveAssociationMembershipRepository(
  membership,
  options = {}
) {
  const supabase = getSupabaseClient();
  const shouldThrow = Boolean(options.throwOnError);

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("association_memberships")
      .upsert(toMembershipRow(membership), {
        onConflict: "user_id,association_id,role",
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;

    notifyAccessMembershipsChanged();

    return data ? toMembership(data) : null;
  } catch (error) {
    console.error("Erreur sauvegarde rôle Supabase:", error);
    if (shouldThrow) {
      throw error;
    }
    return null;
  }
}

export async function loadIsPlatformAdminRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase.rpc(
      "current_user_is_platform_admin"
    );

    if (error) throw error;

    return Boolean(data);
  } catch (error) {
    console.error("Erreur chargement admin général Supabase:", error);
    return false;
  }
}

export async function findUserProfileByEmailRepository(email, associationId) {
  const supabase = getSupabaseClient();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!supabase || !normalizedEmail || !associationId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .rpc("find_user_profile_for_association", {
        target_association_id: associationId,
        target_email: normalizedEmail,
      })
      .maybeSingle();

    if (error) throw error;

    return data ? toUserProfile(data) : null;
  } catch (error) {
    console.error("Erreur recherche utilisateur Supabase:", error);
    return null;
  }
}

export async function loadUserProfilesByIdsRepository(userIds) {
  const supabase = getSupabaseClient();
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];

  if (!supabase || uniqueIds.length === 0) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .in("id", uniqueIds);

    if (error) throw error;

    return (data || []).reduce((profilesById, row) => {
      const profile = toUserProfile(row);
      profilesById[profile.id] = profile;
      return profilesById;
    }, {});
  } catch (error) {
    console.error("Erreur chargement profils Supabase:", error);
    return {};
  }
}

export async function loadAssociationMembershipsRepository(associationId) {
  const supabase = getSupabaseClient();

  if (!supabase || !associationId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("association_memberships")
      .select("*")
      .eq("association_id", associationId)
      .order("role", { ascending: true })
      .order("user_id", { ascending: true });

    if (error) throw error;

    return Array.isArray(data) ? data.map(toMembership) : [];
  } catch (error) {
    console.error("Erreur chargement accès association Supabase:", error);
    return [];
  }
}

export async function deleteAssociationMembershipRepository(membershipId) {
  const supabase = getSupabaseClient();

  if (!supabase || !membershipId) {
    return;
  }

  try {
    const { error } = await supabase
      .from("association_memberships")
      .delete()
      .eq("id", membershipId);

    if (error) throw error;

    notifyAccessMembershipsChanged();
  } catch (error) {
    console.error("Erreur suppression accès Supabase:", error);
  }
}

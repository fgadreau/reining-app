import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";

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
    id: row.user_id || row.id,
    displayName: row.display_name || "",
    email: row.email || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
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
      .rpc("grant_association_membership", {
        target_user_id: membership.userId,
        target_association_id: membership.associationId,
        target_role: membership.role,
      })
      .maybeSingle();

    if (error) throw error;

    notifyAccessMembershipsChanged();

    trackEvent({
      eventName: "membership_saved",
      eventType: APP_EVENT_TYPES.AUDIT,
      associationId: membership.associationId,
      metadata: {
        targetUserId: membership.userId,
        role: membership.role,
      },
    });

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
      .in("user_id", uniqueIds);

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

function cleanProfileSearchQuery(value) {
  return String(value || "")
    .trim()
    .replace(/[%_,]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function searchUserProfilesRepository(searchQuery, options = {}) {
  const supabase = getSupabaseClient();
  const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
  const query = cleanProfileSearchQuery(searchQuery);

  if (!supabase) {
    return [];
  }

  try {
    let request = supabase
      .from("user_profiles")
      .select("*")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (query) {
      const pattern = `%${query}%`;
      request = request.or(
        `email.ilike.${pattern},display_name.ilike.${pattern}`
      );
    }

    const { data, error } = await request;

    if (error) throw error;

    return Array.isArray(data) ? data.map(toUserProfile) : [];
  } catch (error) {
    console.error("Erreur recherche profils Supabase:", error);
    return [];
  }
}

export async function loadMembershipsByUserIdsRepository(userIds) {
  const supabase = getSupabaseClient();
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];

  if (!supabase || uniqueIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("association_memberships")
      .select("*")
      .in("user_id", uniqueIds)
      .order("association_id", { ascending: true })
      .order("role", { ascending: true });

    if (error) throw error;

    return Array.isArray(data) ? data.map(toMembership) : [];
  } catch (error) {
    console.error("Erreur chargement rôles utilisateurs Supabase:", error);
    return [];
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
    const { data: membershipData } = await supabase
      .from("association_memberships")
      .select("*")
      .eq("id", membershipId)
      .maybeSingle();

    const { error } = await supabase
      .from("association_memberships")
      .delete()
      .eq("id", membershipId);

    if (error) throw error;

    notifyAccessMembershipsChanged();

    if (membershipData) {
      const membership = toMembership(membershipData);
      trackEvent({
        eventName: "membership_deleted",
        eventType: APP_EVENT_TYPES.AUDIT,
        associationId: membership.associationId,
        metadata: {
          targetUserId: membership.userId,
          role: membership.role,
        },
      });
    }
  } catch (error) {
    console.error("Erreur suppression accès Supabase:", error);
  }
}

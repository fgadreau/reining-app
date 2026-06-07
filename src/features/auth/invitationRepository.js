import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import {
  notifyAccessMembershipsChanged,
  saveAssociationMembershipRepository,
} from "./accessRepository";

export const INVITATION_STATUSES = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  CANCELLED: "cancelled",
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createInvitationToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toInvitation(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    email: row.email || "",
    role: row.role,
    token: row.token,
    status: row.status,
    invitedBy: row.invited_by || null,
    acceptedBy: row.accepted_by || null,
    acceptedAt: row.accepted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function isMissingRpcError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("function public.accept_association_invitation") ||
    message.includes("function public.accept_pending_association_invitations")
  );
}

function toRedeemedInvitation(row, user) {
  const associationId = row.association_id || row.associationId || "";
  const role = row.invitation_role || row.role || "";

  return {
    invitation: {
      id: row.invitation_id || row.id || "",
      associationId,
      email: user?.email || "",
      role,
      token: "",
      status: row.invitation_status || INVITATION_STATUSES.ACCEPTED,
      invitedBy: null,
      acceptedBy: user?.id || null,
      acceptedAt: new Date().toISOString(),
      createdAt: null,
      updatedAt: null,
    },
    membership: {
      id: row.membership_id || "",
      userId: user?.id || "",
      associationId,
      role,
      createdAt: null,
      updatedAt: null,
    },
  };
}

function trackInvitationAccepted(result, user) {
  if (!result?.membership?.associationId) {
    return;
  }

  trackEvent({
    eventName: "invitation_accepted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: result.membership.associationId,
    metadata: {
      email: normalizeEmail(user?.email),
      role: result.membership.role,
      acceptedBy: user?.id,
    },
  });
}

async function acceptInvitationWithRpc({ token, user }) {
  const supabase = getSupabaseClient();

  if (!supabase || !token || !user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .rpc("accept_association_invitation", {
      target_token: token,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const result = toRedeemedInvitation(data, user);
  notifyAccessMembershipsChanged();
  trackInvitationAccepted(result, user);
  return result;
}

async function acceptPendingInvitationsWithRpc(user) {
  const supabase = getSupabaseClient();

  if (!supabase || !user?.id) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "accept_pending_association_invitations"
  );

  if (error) {
    throw error;
  }

  const results = Array.isArray(data)
    ? data.map((row) => toRedeemedInvitation(row, user))
    : [];

  if (results.length > 0) {
    notifyAccessMembershipsChanged();
    results.forEach((result) => trackInvitationAccepted(result, user));
  }

  return results;
}

export async function loadAssociationInvitationsRepository(associationId) {
  const supabase = getSupabaseClient();

  if (!supabase || !associationId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("association_invitations")
      .select("*")
      .eq("association_id", associationId)
      .eq("status", INVITATION_STATUSES.PENDING)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Array.isArray(data) ? data.map(toInvitation) : [];
  } catch (error) {
    console.error("Erreur chargement invitations Supabase:", error);
    return [];
  }
}

export async function createAssociationInvitationRepository({
  associationId,
  email,
  role,
  invitedBy,
}) {
  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(email);

  if (!supabase || !associationId || !normalizedEmail || !role) {
    return null;
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("association_invitations")
      .select("*")
      .eq("association_id", associationId)
      .eq("email", normalizedEmail)
      .eq("role", role)
      .eq("status", INVITATION_STATUSES.PENDING)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return toInvitation(existing);
    }

    const { data, error } = await supabase
      .from("association_invitations")
      .insert({
        association_id: associationId,
        email: normalizedEmail,
        role,
        token: createInvitationToken(),
        status: INVITATION_STATUSES.PENDING,
        invited_by: invitedBy || null,
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;

    const invitation = data ? toInvitation(data) : null;

    if (invitation) {
      trackEvent({
        eventName: "invitation_created",
        eventType: APP_EVENT_TYPES.AUDIT,
        associationId: invitation.associationId,
        metadata: {
          email: invitation.email,
          role: invitation.role,
        },
      });
    }

    return invitation;
  } catch (error) {
    console.error("Erreur creation invitation Supabase:", error);
    return null;
  }
}

export async function cancelAssociationInvitationRepository(invitationId) {
  const supabase = getSupabaseClient();

  if (!supabase || !invitationId) {
    return;
  }

  try {
    const { data: existing } = await supabase
      .from("association_invitations")
      .select("*")
      .eq("id", invitationId)
      .maybeSingle();

    const { error } = await supabase
      .from("association_invitations")
      .update({ status: INVITATION_STATUSES.CANCELLED })
      .eq("id", invitationId);

    if (error) throw error;

    if (existing) {
      const invitation = toInvitation(existing);
      trackEvent({
        eventName: "invitation_cancelled",
        eventType: APP_EVENT_TYPES.AUDIT,
        associationId: invitation.associationId,
        metadata: {
          email: invitation.email,
          role: invitation.role,
        },
      });
    }
  } catch (error) {
    console.error("Erreur annulation invitation Supabase:", error);
  }
}

async function acceptAssociationInvitation(invitation, user) {
  const supabase = getSupabaseClient();

  if (!supabase || !invitation?.id || !user?.id) {
    return null;
  }

  const membership = await saveAssociationMembershipRepository(
    {
      userId: user.id,
      associationId: invitation.associationId,
      role: invitation.role,
    },
    {
      throwOnError: true,
    }
  );

  if (!membership) {
    throw new Error("Impossible d'ajouter l'accès à l'association.");
  }

  const { data: updated, error: updateError } = await supabase
    .from("association_invitations")
    .update({
      status: INVITATION_STATUSES.ACCEPTED,
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  trackEvent({
    eventName: "invitation_accepted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: invitation.associationId,
    metadata: {
      email: invitation.email,
      role: invitation.role,
      acceptedBy: user.id,
    },
  });

  return {
    invitation: updated ? toInvitation(updated) : invitation,
    membership,
  };
}

export async function redeemAssociationInvitationRepository({ token, user }) {
  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(user?.email);

  if (!supabase || !token || !user?.id || !normalizedEmail) {
    return null;
  }

  try {
    return await acceptInvitationWithRpc({ token, user });
  } catch (error) {
    if (!isMissingRpcError(error)) {
      console.warn(
        "Acceptation invitation RPC indisponible, tentative du flux classique:",
        error?.message || error
      );
    }
  }

  const { data, error } = await supabase
    .from("association_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", INVITATION_STATUSES.PENDING)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Invitation introuvable ou déjà acceptée. Vérifie le lien d'invitation."
    );
  }

  const invitation = toInvitation(data);

  if (normalizeEmail(invitation.email) !== normalizedEmail) {
    throw new Error(
      "Cette invitation est liée à un autre courriel. Connecte-toi avec le courriel invité."
    );
  }

  return acceptAssociationInvitation(invitation, user);
}

export async function redeemPendingAssociationInvitationsRepository(user) {
  const supabase = getSupabaseClient();
  const normalizedEmail = normalizeEmail(user?.email);

  if (!supabase || !user?.id || !normalizedEmail) {
    return [];
  }

  try {
    try {
      return await acceptPendingInvitationsWithRpc(user);
    } catch (error) {
      if (!isMissingRpcError(error)) {
        console.warn(
          "Acceptation invitations RPC indisponible, tentative du flux classique:",
          error?.message || error
        );
      }
    }

    const { data, error } = await supabase
      .from("association_invitations")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("status", INVITATION_STATUSES.PENDING)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const invitations = Array.isArray(data) ? data.map(toInvitation) : [];
    const accepted = [];

    for (const invitation of invitations) {
      const result = await acceptAssociationInvitation(invitation, user);

      if (result) {
        accepted.push(result);
      }
    }

    return accepted;
  } catch (error) {
    console.error("Erreur acceptation invitations Supabase:", error);
    return [];
  }
}

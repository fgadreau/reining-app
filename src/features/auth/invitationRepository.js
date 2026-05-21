import { getSupabaseClient } from "../cloud/supabaseClient";
import { saveAssociationMembershipRepository } from "./accessRepository";

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

    return data ? toInvitation(data) : null;
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
    const { error } = await supabase
      .from("association_invitations")
      .update({ status: INVITATION_STATUSES.CANCELLED })
      .eq("id", invitationId);

    if (error) throw error;
  } catch (error) {
    console.error("Erreur annulation invitation Supabase:", error);
  }
}

async function acceptAssociationInvitation(invitation, user) {
  const supabase = getSupabaseClient();

  if (!supabase || !invitation?.id || !user?.id) {
    return null;
  }

  const membership = await saveAssociationMembershipRepository({
    userId: user.id,
    associationId: invitation.associationId,
    role: invitation.role,
  });

  if (!membership) {
    throw new Error("Impossible d'ajouter l'acces a l'association.");
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
      "Invitation introuvable ou deja acceptee. Verifie le lien d'invitation."
    );
  }

  const invitation = toInvitation(data);

  if (normalizeEmail(invitation.email) !== normalizedEmail) {
    throw new Error(
      "Cette invitation est liee a un autre courriel. Connecte-toi avec le courriel invite."
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

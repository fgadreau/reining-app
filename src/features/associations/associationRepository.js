import {
  createAssociationId,
  loadAssociations,
  saveAssociations,
} from "./associationsData";
import { normalizeSponsorLogos } from "./sponsorLogos";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";

function toAssociation(row) {
  return {
    id: row.id,
    name: row.name || "",
    shortName: row.short_name || "",
    timezone: row.timezone || "",
    logoDataUrl: row.logo_data_url || row.logo_url || null,
    websiteUrl: row.website_url || "",
    sponsorLogos: normalizeSponsorLogos(row.sponsor_logos),
  };
}

function toAssociationRow(association) {
  return {
    id: association.id,
    name: association.name || "",
    short_name: association.shortName || "",
    timezone: association.timezone || "",
    logo_data_url: association.logoDataUrl || null,
    website_url: association.websiteUrl || null,
    sponsor_logos: normalizeSponsorLogos(association.sponsorLogos),
  };
}

function toLegacyAssociationRow(association) {
  const row = toAssociationRow(association);
  delete row.sponsor_logos;
  return row;
}

function toSharedOrganizationRow(association) {
  return {
    id: association.id,
    name: association.name || "",
    short_name: association.shortName || "",
    timezone: association.timezone || "",
    logo_url: association.logoDataUrl || null,
    website_url: association.websiteUrl || null,
    sponsor_logos: normalizeSponsorLogos(association.sponsorLogos),
  };
}

function isSponsorSchemaMissing(error) {
  const message = String(error?.message || "");

  return /sponsor_logos/i.test(message);
}

function isMissingSharedOrganizationsSchema(error) {
  const message = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const text = `${message} ${details} ${hint}`;

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (text.includes("organizations") &&
      (text.includes("schema cache") || text.includes("does not exist"))) ||
    (text.includes("logo_url") && text.includes("column"))
  );
}

async function upsertAssociationRow(supabase, association) {
  const sharedResult = await supabase
    .from("organizations")
    .upsert(toSharedOrganizationRow(association), { onConflict: "id" });

  if (!sharedResult.error) {
    return;
  }

  if (!isMissingSharedOrganizationsSchema(sharedResult.error)) {
    throw sharedResult.error;
  }

  const standaloneResult = await supabase
    .from("associations")
    .upsert(toAssociationRow(association), { onConflict: "id" });

  if (!standaloneResult.error) {
    return;
  }

  if (!isSponsorSchemaMissing(standaloneResult.error)) {
    throw standaloneResult.error;
  }

  const legacyResult = await supabase
    .from("associations")
    .upsert(toLegacyAssociationRow(association), { onConflict: "id" });

  if (legacyResult.error) {
    throw legacyResult.error;
  }
}

async function deleteAssociationRow(supabase, associationId) {
  const sharedResult = await supabase
    .from("organizations")
    .delete()
    .eq("id", associationId);

  if (!sharedResult.error) {
    return;
  }

  if (!isMissingSharedOrganizationsSchema(sharedResult.error)) {
    throw sharedResult.error;
  }

  const standaloneResult = await supabase
    .from("associations")
    .delete()
    .eq("id", associationId);

  if (standaloneResult.error) {
    throw standaloneResult.error;
  }
}

function saveAssociationLocally(association) {
  const current = loadAssociations();
  const exists = current.some((item) => item.id === association.id);
  const next = exists
    ? current.map((item) => (item.id === association.id ? association : item))
    : [...current, association];

  saveAssociations(next);
  return association;
}

export async function loadAssociationsRepository() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return loadAssociations();
  }

  try {
    const { data, error } = await supabase
      .from("associations")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    const associations = Array.isArray(data) ? data.map(toAssociation) : [];
    saveAssociations(associations);
    return associations;
  } catch (error) {
    console.error("Erreur chargement associations Supabase:", error);
    return loadAssociations();
  }
}

export async function getAssociationRepository(associationId) {
  const associations = await loadAssociationsRepository();
  return associations.find((item) => item.id === associationId) || null;
}

export async function saveAssociationRepository(association) {
  const normalized = {
    ...association,
    id: association.id || createAssociationId(),
  };
  const isExistingAssociation = loadAssociations().some(
    (item) => item.id === normalized.id
  );

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      await upsertAssociationRow(supabase, normalized);
    } catch (error) {
      console.error("Erreur sauvegarde association Supabase:", error);
      throw error;
    }
  }

  const savedAssociation = saveAssociationLocally(normalized);

  trackEvent({
    eventName: isExistingAssociation
      ? "association_updated"
      : "association_created",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: savedAssociation.id,
    metadata: {
      name: savedAssociation.name,
      shortName: savedAssociation.shortName,
    },
  });

  return savedAssociation;
}

export async function createAssociationWithOwnerRepository(association) {
  const normalized = {
    ...association,
    id: association.id || createAssociationId(),
  };

  const supabase = getSupabaseClient();

  if (!supabase) {
    return saveAssociationLocally(normalized);
  }

  const { data, error } = await supabase
    .rpc("create_association_with_owner", {
      target_id: normalized.id,
      target_name: normalized.name || "",
      target_short_name: normalized.shortName || "",
      target_timezone: normalized.timezone || "",
      target_logo_data_url: normalized.logoDataUrl || null,
      target_website_url: normalized.websiteUrl || null,
    })
    .maybeSingle();

  if (error) {
    console.error("Erreur création association propriétaire Supabase:", error);
    throw error;
  }

  const created = data ? toAssociation(data) : normalized;
  saveAssociationLocally(created);

  trackEvent({
    eventName: "association_created",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: created.id,
    metadata: {
      name: created.name,
      shortName: created.shortName,
    },
  });

  return created;
}

export function isCreateAssociationWithOwnerMissing(error) {
  const message = String(error?.message || "");

  return (
    error?.code === "PGRST202" ||
    /create_association_with_owner/i.test(message)
  );
}

export async function deleteAssociationRepository(associationId) {
  const supabase = getSupabaseClient();
  const existingAssociation = loadAssociations().find(
    (item) => item.id === associationId
  );

  if (supabase) {
    try {
      await deleteAssociationRow(supabase, associationId);
    } catch (error) {
      console.error("Erreur suppression association Supabase:", error);
    }
  }

  const next = loadAssociations().filter((item) => item.id !== associationId);
  saveAssociations(next);

  trackEvent({
    eventName: "association_deleted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId,
    metadata: {
      name: existingAssociation?.name || "",
      shortName: existingAssociation?.shortName || "",
    },
  });
}

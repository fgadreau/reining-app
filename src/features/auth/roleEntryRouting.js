import { ASSOCIATION_ROLES } from "./accessRoles";

const ROLE_ENTRY_CONFIGS = {
  admin: {
    acceptedRoles: [ASSOCIATION_ROLES.ADMIN],
    associationPath: (associationId) => `/associations/${associationId}/shows`,
  },
  secretariat: {
    acceptedRoles: [ASSOCIATION_ROLES.ADMIN, ASSOCIATION_ROLES.SECRETARY],
    associationPath: (associationId) => `/associations/${associationId}/shows`,
    showPath: (associationId, showId) =>
      `/associations/${associationId}/shows/${showId}/secretariat`,
  },
  scribe: {
    acceptedRoles: [
      ASSOCIATION_ROLES.ADMIN,
      ASSOCIATION_ROLES.SECRETARY,
      ASSOCIATION_ROLES.SCRIBE,
    ],
    associationPath: (associationId) => `/associations/${associationId}/shows`,
    showPath: (associationId, showId) =>
      `/associations/${associationId}/shows/${showId}/scribe`,
  },
  announcer: {
    acceptedRoles: [
      ASSOCIATION_ROLES.ADMIN,
      ASSOCIATION_ROLES.SECRETARY,
      ASSOCIATION_ROLES.ANNOUNCER,
    ],
    associationPath: (associationId) => `/associations/${associationId}/shows`,
    showPath: (associationId, showId) =>
      `/associations/${associationId}/shows/${showId}/announcer`,
  },
};

const ROLE_ENTRY_ALIASES = {
  admin: "admin",
  administrator: "admin",
  administrateur: "admin",
  secretary: "secretariat",
  secretariat: "secretariat",
  secretaire: "secretariat",
  scribe: "scribe",
  announcer: "announcer",
  annonceur: "announcer",
};

export function normalizeRoleEntryKey(roleKey) {
  return (
    ROLE_ENTRY_ALIASES[
      String(roleKey || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    ] || ""
  );
}

export function getRoleEntryConfig(roleKey) {
  const normalizedRoleKey = normalizeRoleEntryKey(roleKey);
  return ROLE_ENTRY_CONFIGS[normalizedRoleKey] || null;
}

export function buildRoleEntryPath({ roleKey, associationId, showId }) {
  const config = getRoleEntryConfig(roleKey);

  if (!config || !associationId) {
    return "/associations";
  }

  if (showId && config.showPath) {
    return config.showPath(associationId, showId);
  }

  return config.associationPath(associationId);
}

export function getRoleEntryAssociationIds({ roleKey, memberships }) {
  const config = getRoleEntryConfig(roleKey);

  if (!config) {
    return [];
  }

  const acceptedRoles = new Set(config.acceptedRoles);
  const associationIds = (Array.isArray(memberships) ? memberships : [])
    .filter((membership) => acceptedRoles.has(membership.role))
    .map((membership) => membership.associationId)
    .filter(Boolean);

  return Array.from(new Set(associationIds));
}


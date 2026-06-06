export const ASSOCIATION_ROLES = {
  ADMIN: "admin",
  SECRETARY: "secretary",
  SCRIBE: "scribe",
  ANNOUNCER: "announcer",
};

export const SECRETARY_CAPABILITIES = [
  "create shows",
  "create days",
  "create blocks",
  "import draws",
  "review block readiness",
  "validate official results",
  "generate official PDFs",
  "publish results",
];

export const SCRIBE_CAPABILITIES = [
  "enter scores and penalties",
  "change active run/manoeuvre",
  "submit block for signature",
  "edit manual draws after scoring starts",
];

const ROLE_LABELS = {
  [ASSOCIATION_ROLES.ADMIN]: "Admin",
  [ASSOCIATION_ROLES.SECRETARY]: "Secretary",
  [ASSOCIATION_ROLES.SCRIBE]: "Scribe",
  [ASSOCIATION_ROLES.ANNOUNCER]: "Annonceur",
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Aucun rôle";
}

export function getRolesForAssociation(memberships, associationId) {
  return (memberships || [])
    .filter((membership) => membership.associationId === associationId)
    .map((membership) => membership.role)
    .filter(Boolean);
}

export function hasAssociationRole(memberships, associationId, acceptedRoles) {
  const accepted = Array.isArray(acceptedRoles) ? acceptedRoles : [acceptedRoles];
  const roles = getRolesForAssociation(memberships, associationId);
  return roles.some((role) => accepted.includes(role));
}

export function canManageAssociation(memberships, associationId) {
  return hasAssociationRole(memberships, associationId, [
    ASSOCIATION_ROLES.ADMIN,
    ASSOCIATION_ROLES.SECRETARY,
  ]);
}

export function canAdminAssociation(memberships, associationId) {
  return hasAssociationRole(
    memberships,
    associationId,
    ASSOCIATION_ROLES.ADMIN
  );
}

export function canManageUsersAssociation(memberships, associationId) {
  return canAdminAssociation(memberships, associationId);
}

export function canPublishAssociation(memberships, associationId) {
  return canManageAssociation(memberships, associationId);
}

export function canEditManualDrawAssociation(memberships, associationId) {
  return hasAssociationRole(memberships, associationId, [
    ASSOCIATION_ROLES.ADMIN,
    ASSOCIATION_ROLES.SECRETARY,
    ASSOCIATION_ROLES.SCRIBE,
  ]);
}

export function canEditImportedDrawAssociation(memberships, associationId) {
  return hasAssociationRole(memberships, associationId, [
    ASSOCIATION_ROLES.ADMIN,
    ASSOCIATION_ROLES.SECRETARY,
  ]);
}

export function canScoreAssociation(memberships, associationId) {
  return hasAssociationRole(memberships, associationId, [
    ASSOCIATION_ROLES.ADMIN,
    ASSOCIATION_ROLES.SECRETARY,
    ASSOCIATION_ROLES.SCRIBE,
  ]);
}

export function canAnnounceAssociation(memberships, associationId) {
  return hasAssociationRole(memberships, associationId, [
    ASSOCIATION_ROLES.ADMIN,
    ASSOCIATION_ROLES.SECRETARY,
    ASSOCIATION_ROLES.ANNOUNCER,
  ]);
}

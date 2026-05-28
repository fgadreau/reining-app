import { ASSOCIATION_ROLES } from "./accessRoles";

export function getDefaultShowRouteForRoles({
  associationId,
  showId,
  roles = [],
}) {
  const basePath = `/associations/${associationId}/shows/${showId}`;
  const uniqueRoles = Array.from(new Set(Array.isArray(roles) ? roles : []));

  if (uniqueRoles.length !== 1) {
    return basePath;
  }

  switch (uniqueRoles[0]) {
    case ASSOCIATION_ROLES.SCRIBE:
      return `${basePath}/scribe`;
    case ASSOCIATION_ROLES.ANNOUNCER:
      return `${basePath}/announcer`;
    case ASSOCIATION_ROLES.SECRETARY:
      return `${basePath}/secretariat`;
    case ASSOCIATION_ROLES.ADMIN:
    default:
      return basePath;
  }
}

import { useEffect, useMemo, useState } from "react";
import {
  loadIsPlatformAdminRepository,
  loadUserMembershipsRepository,
  subscribeAccessMembershipsChanged,
} from "./accessRepository";
import {
  canAnnounceAssociation,
  canAdminAssociation,
  canEditImportedDrawAssociation,
  canEditManualDrawAssociation,
  canManageAssociation,
  canManageUsersAssociation,
  canPublishAssociation,
  canScoreAssociation,
  getRoleLabel,
  getRolesForAssociation,
} from "./accessRoles";
import { useAuthUser } from "./useAuthUser";

export function useAssociationAccess(associationId) {
  const auth = useAuthUser();
  const [memberships, setMemberships] = useState([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMemberships() {
      if (!auth.isConfigured || auth.isLocalTestUser || !auth.user?.id) {
        setMemberships([]);
        setIsPlatformAdmin(false);
        setIsLoadingMemberships(false);
        return;
      }

      setIsLoadingMemberships(true);
      const [nextMemberships, nextIsPlatformAdmin] = await Promise.all([
        loadUserMembershipsRepository(auth.user.id),
        loadIsPlatformAdminRepository(),
      ]);

      if (!isMounted) return;
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsLoadingMemberships(false);
    }

    const unsubscribeAccessChanges =
      subscribeAccessMembershipsChanged(loadMemberships);

    loadMemberships();

    return () => {
      isMounted = false;
      unsubscribeAccessChanges();
    };
  }, [auth.isConfigured, auth.isLocalTestUser, auth.user?.id, associationId]);

  const associationRoles = useMemo(
    () => getRolesForAssociation(memberships, associationId),
    [memberships, associationId]
  );

  const isLocalMode = !auth.isConfigured || auth.isLocalTestUser;
  const hasPlatformAdminAccess = isPlatformAdmin || isLocalMode;
  const roleLabel = isLocalMode
    ? auth.isLocalTestUser
      ? "Test local sans restriction"
      : "Local sans restriction"
    : isPlatformAdmin
      ? "Admin général"
      : associationRoles.length > 0
      ? associationRoles.map(getRoleLabel).join(", ")
      : auth.isAuthenticated
        ? "Aucun rôle pour cette association"
        : "Connexion requise";

  return {
    ...auth,
    memberships,
    isPlatformAdmin,
    associationRoles,
    roleLabel,
    isLoadingAccess: auth.isLoading || isLoadingMemberships,
    canAdminAssociation:
      hasPlatformAdminAccess || canAdminAssociation(memberships, associationId),
    canManageAssociation:
      hasPlatformAdminAccess || canManageAssociation(memberships, associationId),
    canManageUsers:
      hasPlatformAdminAccess || canManageUsersAssociation(memberships, associationId),
    canPublishAssociation:
      hasPlatformAdminAccess || canPublishAssociation(memberships, associationId),
    canScoreAssociation:
      hasPlatformAdminAccess || canScoreAssociation(memberships, associationId),
    canAnnounceAssociation:
      hasPlatformAdminAccess || canAnnounceAssociation(memberships, associationId),
    canEditManualDraw:
      hasPlatformAdminAccess ||
      canEditManualDrawAssociation(memberships, associationId),
    canEditImportedDraw:
      hasPlatformAdminAccess ||
      canEditImportedDrawAssociation(memberships, associationId),
  };
}

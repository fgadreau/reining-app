import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import {
  loadIsPlatformAdminRepository,
  loadUserMembershipsRepository,
} from "../features/auth/accessRepository";
import {
  buildRoleEntryPath,
  getRoleEntryAssociationIds,
  getRoleEntryConfig,
  normalizeRoleEntryKey,
} from "../features/auth/roleEntryRouting";
import { useAuthUser } from "../features/auth/useAuthUser";
import { appStyles as styles } from "../styles/appStyles";

function RoleEntryPage() {
  const { roleKey } = useParams();
  const location = useLocation();
  const auth = useAuthUser();
  const normalizedRoleKey = normalizeRoleEntryKey(roleKey);
  const roleConfig = getRoleEntryConfig(normalizedRoleKey);
  const searchParams = new URLSearchParams(location.search);
  const associationId =
    searchParams.get("associationId") || searchParams.get("association") || "";
  const showId = searchParams.get("showId") || searchParams.get("show") || "";
  const [accessState, setAccessState] = useState({
    isLoading: true,
    memberships: [],
    isPlatformAdmin: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadAccess() {
      if (
        !auth.isConfigured ||
        auth.isLoading ||
        !auth.isAuthenticated ||
        auth.isLocalTestUser
      ) {
        setAccessState((current) => ({ ...current, isLoading: false }));
        return;
      }

      setAccessState((current) => ({ ...current, isLoading: true }));

      const [memberships, isPlatformAdmin] = await Promise.all([
        loadUserMembershipsRepository(auth.user?.id),
        loadIsPlatformAdminRepository(),
      ]);

      if (!isMounted) return;

      setAccessState({
        isLoading: false,
        memberships,
        isPlatformAdmin,
      });
    }

    loadAccess();

    return () => {
      isMounted = false;
    };
  }, [
    auth.isAuthenticated,
    auth.isConfigured,
    auth.isLoading,
    auth.isLocalTestUser,
    auth.user?.id,
  ]);

  if (!roleConfig) {
    return <Navigate to="/associations" replace />;
  }

  if (auth.isConfigured && auth.isLoading) {
    return <RoleEntryStatus message="Chargement de la session..." />;
  }

  if (auth.isConfigured && !auth.isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(nextPath)}`}
        replace
      />
    );
  }

  if (associationId) {
    return (
      <Navigate
        to={buildRoleEntryPath({
          roleKey: normalizedRoleKey,
          associationId,
          showId,
        })}
        replace
      />
    );
  }

  if (!auth.isConfigured || auth.isLocalTestUser || accessState.isPlatformAdmin) {
    return <Navigate to="/associations" replace />;
  }

  if (accessState.isLoading) {
    return <RoleEntryStatus message="Recherche de ton association..." />;
  }

  const associationIds = getRoleEntryAssociationIds({
    roleKey: normalizedRoleKey,
    memberships: accessState.memberships,
  });

  if (associationIds.length === 1) {
    return (
      <Navigate
        to={buildRoleEntryPath({
          roleKey: normalizedRoleKey,
          associationId: associationIds[0],
        })}
        replace
      />
    );
  }

  return <Navigate to="/associations" replace />;
}

function RoleEntryStatus({ message }) {
  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/associations">Associations</Link>
      </div>
      <div style={statusStyle}>{message}</div>
    </div>
  );
}

const statusStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 16,
  background: "#ffffff",
  color: "#374151",
  fontWeight: 700,
};

export default RoleEntryPage;


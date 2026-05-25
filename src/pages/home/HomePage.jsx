import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadAssociationsRepository } from "../../features/associations/associationRepository";
import {
  loadIsPlatformAdminRepository,
  loadUserMembershipsRepository,
} from "../../features/auth/accessRepository";
import {
  ASSOCIATION_ROLES,
  getRoleLabel,
  getRolesForAssociation,
  hasAssociationRole,
} from "../../features/auth/accessRoles";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { getPublicAssociationsRepository } from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

const BACK_OFFICE_ROLES = [
  ASSOCIATION_ROLES.ADMIN,
  ASSOCIATION_ROLES.SECRETARY,
  ASSOCIATION_ROLES.SCRIBE,
  ASSOCIATION_ROLES.ANNOUNCER,
];

function HomePage() {
  const auth = useAuthUser();
  const [associations, setAssociations] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cloudStatus = getCloudSyncStatus(auth.user);
  const isLocalMode = !auth.isConfigured;
  const isPublicVisitor = auth.isConfigured && !auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociations, nextMemberships, nextIsPlatformAdmin] =
        await Promise.all([
          isPublicVisitor
            ? getPublicAssociationsRepository()
            : loadAssociationsRepository(),
          auth.isConfigured && auth.user?.id
            ? loadUserMembershipsRepository(auth.user.id)
            : Promise.resolve([]),
          auth.isConfigured && auth.user?.id
            ? loadIsPlatformAdminRepository()
            : Promise.resolve(false),
        ]);

      if (!isMounted) return;
      setAssociations(nextAssociations);
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [auth.isConfigured, auth.user?.id, isPublicVisitor]);

  const visibleAssociations = useMemo(() => {
    const source = isPublicVisitor
      ? associations
      : isLocalMode || isPlatformAdmin
      ? associations
      : associations.filter((association) =>
          hasAssociationRole(memberships, association.id, BACK_OFFICE_ROLES)
        );

    return [...source].sort((a, b) => a.name.localeCompare(b.name));
  }, [associations, isLocalMode, isPlatformAdmin, isPublicVisitor, memberships]);

  return (
    <div style={styles.app}>
      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Reining App</div>
          <h1 style={titleStyle}>Accueil</h1>
          <div style={subtitleStyle}>
            {cloudStatus.configured
              ? cloudStatus.authenticated
                ? "Cloud connecté"
                : "Connexion requise"
              : "Mode local"}
          </div>
        </div>

        <div style={actionRowStyle}>
          <Link
            to={isPublicVisitor ? "/public" : "/associations"}
            style={primaryLinkStyle}
          >
            Associations
          </Link>
          {auth.isConfigured && !auth.isAuthenticated && (
            <Link to="/login" style={secondaryLinkStyle}>
              Connexion
            </Link>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>
            {isPublicVisitor ? "Associations publiques" : "Mes associations"}
          </h2>
        </div>

        {isLoading ? (
          <div style={emptyStateStyle}>Chargement…</div>
        ) : visibleAssociations.length === 0 ? (
          <div style={emptyStateStyle}>
            {isPublicVisitor
              ? "Aucun contenu public disponible pour l’instant. Le live public doit être autorisé dans le setup d’une classe, ou des résultats officiels doivent être publiés."
              : "Aucune association disponible."}
          </div>
        ) : (
          <div style={associationGridStyle}>
            {visibleAssociations.map((association) => {
              const roles = isPublicVisitor
                ? ["Résultats publics"]
                : isLocalMode
                  ? ["Local"]
                  : isPlatformAdmin
                    ? ["Admin général"]
                    : getRolesForAssociation(memberships, association.id).map(
                        getRoleLabel
                      );

              return (
                <article key={association.id} style={associationCardStyle}>
                  <div>
                    <h3 style={associationNameStyle}>{association.name}</h3>
                    <div style={mutedTextStyle}>
                      {association.shortName || "Association"} ·{" "}
                      {roles.join(", ") || "Aucun rôle"}
                    </div>
                  </div>
                  <Link
                    to={
                      isPublicVisitor
                        ? `/public/associations/${association.id}`
                        : `/associations/${association.id}/shows`
                    }
                    style={secondaryLinkStyle}
                  >
                    {isPublicVisitor ? "Voir les shows" : "Ouvrir"}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const headerStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30,
};

const subtitleStyle = {
  color: "#64748b",
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const sectionHeaderStyle = {
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const associationGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const associationCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 12,
  alignContent: "space-between",
};

const associationNameStyle = {
  margin: 0,
  fontSize: 18,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
};

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
};

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
};

const emptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

export default HomePage;

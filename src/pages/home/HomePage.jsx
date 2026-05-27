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

const ASSOCIATION_WORKFLOW = [
  {
    title: "Préparer l’événement",
    text: "Créez vos shows, journées, classes et patterns au même endroit.",
  },
  {
    title: "Importer les draws",
    text: "Ajoutez les ordres de passage par CSV, PDF ou saisie manuelle.",
  },
  {
    title: "Enregistrer les pointages",
    text: "Entrez les scores en direct avec une protection prévue pour les connexions instables en concours.",
  },
  {
    title: "Publier les pointages",
    text: "Suivez le live, validez les feuilles de pointage et partagez la vitrine publique.",
  },
];

const SUPPORTED_DISCIPLINES = [
  "Reining",
  "Ranch Riding",
  "Small Fry Ranch Riding",
  "Western Riding",
  "Trail / Obstacle Western",
  "Western Horsemanship",
  "Hunt Seat Equitation",
  "Showmanship",
];

const LEGAL_LINKS = [
  { to: "/terms", label: "Conditions d'utilisation" },
  { to: "/privacy", label: "Confidentialité" },
  { to: "/results-notice", label: "Avis sur les résultats" },
];

function HomePage() {
  const auth = useAuthUser();
  const [publicAssociations, setPublicAssociations] = useState([]);
  const [managementAssociations, setManagementAssociations] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cloudStatus = getCloudSyncStatus(auth.user);
  const isLocalMode = !auth.isConfigured;
  const canLoadManagement = isLocalMode || auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [
        nextPublicAssociations,
        nextManagementAssociations,
        nextMemberships,
        nextIsPlatformAdmin,
      ] = await Promise.all([
        getPublicAssociationsRepository(),
        canLoadManagement ? loadAssociationsRepository() : Promise.resolve([]),
        auth.isConfigured && auth.user?.id
          ? loadUserMembershipsRepository(auth.user.id)
          : Promise.resolve([]),
        auth.isConfigured && auth.user?.id
          ? loadIsPlatformAdminRepository()
          : Promise.resolve(false),
      ]);

      if (!isMounted) return;
      setPublicAssociations(nextPublicAssociations);
      setManagementAssociations(nextManagementAssociations);
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [auth.isConfigured, auth.user?.id, canLoadManagement]);

  const visibleManagementAssociations = useMemo(() => {
    const source =
      isLocalMode || isPlatformAdmin
        ? managementAssociations
        : managementAssociations.filter((association) =>
            hasAssociationRole(memberships, association.id, BACK_OFFICE_ROLES)
          );

    return [...source].sort((a, b) => a.name.localeCompare(b.name));
  }, [isLocalMode, isPlatformAdmin, managementAssociations, memberships]);

  return (
    <div style={styles.app}>
      <section style={heroStyle}>
        <div style={heroContentStyle}>
          <div style={eyebrowStyle}>ShowScore</div>
          <h1 style={titleStyle}>
            Pointage en direct pour compétitions équestres jugées
          </h1>
          <div style={subtitleStyle}>
            ShowScore aide les associations de compétitions équestres jugées à
            préparer les classes, enregistrer les pointages, suivre le
            déroulement d’une journée et publier les feuilles de pointage au
            public.
          </div>
          <div style={actionRowStyle}>
            <Link to="/public" style={primaryLinkStyle}>
              Voir la vitrine publique
            </Link>
            {canLoadManagement ? (
              <Link to="/associations" style={secondaryLinkStyle}>
                Continuer la gestion
              </Link>
            ) : (
              <Link to="/login" style={secondaryLinkStyle}>
                Connexion gestionnaire
              </Link>
            )}
          </div>
        </div>
        <div style={statusPanelStyle}>
          <div style={statusLabelStyle}>Plateforme</div>
          <div style={statusValueStyle}>
            {cloudStatus.configured
              ? cloudStatus.authenticated
                ? "Connectée"
                : "Publique"
              : "Mode local"}
          </div>
          <div style={statusTextStyle}>
            Feuilles de pointage publiques, live et outils de gestion du temps
            pour les associations.
          </div>
          <div style={developmentNoticeStyle}>
            Utilisation gratuite garantie pour 2026, année de développement.
          </div>
          <div>
            <div style={statusLabelStyle}>Disciplines supportées</div>
            <div style={disciplineListStyle}>
              {SUPPORTED_DISCIPLINES.map((discipline) => (
                <span key={discipline} style={disciplinePillStyle}>
                  {discipline}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={workflowGridStyle}>
        {ASSOCIATION_WORKFLOW.map((item, index) => (
          <article key={item.title} style={workflowCardStyle}>
            <div style={stepNumberStyle}>{index + 1}</div>
            <h2 style={workflowTitleStyle}>{item.title}</h2>
            <p style={workflowTextStyle}>{item.text}</p>
          </article>
        ))}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Vitrine publique disponible</h2>
            <div style={mutedTextStyle}>
              Associations avec un live autorisé ou des feuilles de pointage
              publiées.
            </div>
          </div>
          <Link to="/public" style={smallLinkStyle}>
            Ouvrir la vitrine
          </Link>
        </div>

        {isLoading ? (
          <div style={emptyStateStyle}>Chargement…</div>
        ) : publicAssociations.length === 0 ? (
          <div style={emptyStateStyle}>
            Aucun contenu public disponible pour l’instant.
          </div>
        ) : (
          <div style={associationGridStyle}>
            {publicAssociations.map((association) => (
              <AssociationCard
                key={association.id}
                association={association}
                label="Vitrine publique"
                to={`/public/associations/${association.id}`}
                action="Voir les shows"
              />
            ))}
          </div>
        )}
      </section>

      {canLoadManagement && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Espace gestion</h2>
              <div style={mutedTextStyle}>
                Associations accessibles avec votre rôle actuel.
              </div>
            </div>
            <Link to="/associations" style={smallLinkStyle}>
              Mes associations
            </Link>
          </div>

          {isLoading ? (
            <div style={emptyStateStyle}>Chargement…</div>
          ) : visibleManagementAssociations.length === 0 ? (
            <div style={emptyStateStyle}>
              Aucune association disponible pour ce compte.
            </div>
          ) : (
            <div style={associationGridStyle}>
              {visibleManagementAssociations.map((association) => {
                const roles = isLocalMode
                  ? ["Local"]
                  : isPlatformAdmin
                    ? ["Admin général"]
                    : getRolesForAssociation(memberships, association.id).map(
                        getRoleLabel
                      );

                return (
                  <AssociationCard
                    key={association.id}
                    association={association}
                    label={roles.join(", ") || "Aucun rôle"}
                    to={`/associations/${association.id}/shows`}
                    action="Ouvrir"
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      <section style={legalPanelStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Cadre d'utilisation</h2>
          <div style={mutedTextStyle}>
            Conditions, confidentialité et avis sur les résultats publics.
          </div>
        </div>
        <div style={legalLinkRowStyle}>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} style={smallLinkStyle}>
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssociationCard({ association, label, to, action }) {
  return (
    <article style={associationCardStyle}>
      <div>
        <h3 style={associationNameStyle}>{association.name}</h3>
        <div style={mutedTextStyle}>
          {association.shortName || "Association"} · {label}
        </div>
      </div>
      <Link to={to} style={secondaryLinkStyle}>
        {action}
      </Link>
    </article>
  );
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 22,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 18,
  alignItems: "stretch",
};

const heroContentStyle = {
  display: "grid",
  gap: 12,
  alignContent: "start",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.12,
  maxWidth: 760,
};

const subtitleStyle = {
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.45,
  maxWidth: 720,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const statusPanelStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  background: "#f8fafc",
  display: "grid",
  gap: 8,
  alignContent: "start",
};

const statusLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const statusValueStyle = {
  fontSize: 22,
  fontWeight: 800,
};

const statusTextStyle = {
  color: "#475569",
  lineHeight: 1.4,
};

const developmentNoticeStyle = {
  border: "1px solid #bae6fd",
  borderRadius: 8,
  background: "#f0f9ff",
  color: "#075985",
  padding: "8px 10px",
  fontWeight: 700,
  lineHeight: 1.35,
};

const disciplineListStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 8,
};

const disciplinePillStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: 12,
  fontWeight: 700,
};

const workflowGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const workflowCardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: 8,
};

const stepNumberStyle = {
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "#111827",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
};

const workflowTitleStyle = {
  margin: 0,
  fontSize: 18,
};

const workflowTextStyle = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.4,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
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

const smallLinkStyle = {
  ...secondaryLinkStyle,
  padding: "8px 12px",
};

const emptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

const legalPanelStyle = {
  ...cardStyle,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const legalLinkRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export default HomePage;

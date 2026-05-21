import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import {
  deleteAssociationMembershipRepository,
  findUserProfileByEmailRepository,
  loadAssociationMembershipsRepository,
  loadUserProfilesByIdsRepository,
  saveAssociationMembershipRepository,
} from "../../features/auth/accessRepository";
import { ASSOCIATION_ROLES, getRoleLabel } from "../../features/auth/accessRoles";
import {
  buildAssociationInvitationMailto,
  buildAssociationInvitationUrl,
} from "../../features/auth/invitationLinks";
import {
  cancelAssociationInvitationRepository,
  createAssociationInvitationRepository,
  loadAssociationInvitationsRepository,
} from "../../features/auth/invitationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { appStyles as styles } from "../../styles/appStyles";

const roleOptions = [
  ASSOCIATION_ROLES.ADMIN,
  ASSOCIATION_ROLES.SECRETARY,
  ASSOCIATION_ROLES.SCRIBE,
  ASSOCIATION_ROLES.ANNOUNCER,
];

function AssociationAccessPage() {
  const { associationId } = useParams();
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);
  const [association, setAssociation] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [profilesByUserId, setProfilesByUserId] = useState({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ASSOCIATION_ROLES.SECRETARY);
  const [notice, setNotice] = useState("");
  const [lastInvitation, setLastInvitation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociation, nextMemberships, nextInvitations] =
        await Promise.all([
          getAssociationRepository(associationId),
          loadAssociationMembershipsRepository(associationId),
          loadAssociationInvitationsRepository(associationId),
        ]);
      const nextProfilesByUserId = await loadUserProfilesByIdsRepository(
        nextMemberships.map((membership) => membership.userId)
      );

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setMemberships(nextMemberships);
      setInvitations(nextInvitations);
      setProfilesByUserId(nextProfilesByUserId);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  async function handleSubmit(event) {
    event.preventDefault();

    const nextEmail = email.trim().toLowerCase();
    setNotice("");
    setLastInvitation(null);

    if (!nextEmail) {
      setNotice("Le courriel est requis.");
      return;
    }

    setIsSaving(true);
    const profile = await findUserProfileByEmailRepository(
      nextEmail,
      associationId
    );

    if (!profile) {
      const invitation = await createAssociationInvitationRepository({
        associationId,
        email: nextEmail,
        role,
        invitedBy: access.user?.id,
      });
      const nextInvitations = await loadAssociationInvitationsRepository(
        associationId
      );
      setInvitations(nextInvitations);
      setIsSaving(false);
      if (!invitation) {
        setNotice("Impossible de creer l'invitation pour ce courriel.");
        return;
      }

      setLastInvitation(invitation);
      setNotice(
        "Utilisateur introuvable pour l'instant. Une invitation a ete creee."
      );
      setEmail("");
      setRole(ASSOCIATION_ROLES.SECRETARY);
      return;
    }

    const saved = await saveAssociationMembershipRepository({
      userId: profile.id,
      associationId,
      role,
    });

    const nextMemberships = await loadAssociationMembershipsRepository(
      associationId
    );
    const nextProfilesByUserId = await loadUserProfilesByIdsRepository(
      nextMemberships.map((membership) => membership.userId)
    );
    setMemberships(nextMemberships);
    setProfilesByUserId(nextProfilesByUserId);
    setIsSaving(false);

    if (saved) {
      setEmail("");
      setRole(ASSOCIATION_ROLES.SECRETARY);
      setNotice("Acces ajoute.");
    }
  }

  async function handleDelete(membershipId) {
    const confirmed = window.confirm("Retirer cet accès ?");
    if (!confirmed) return;

    setIsSaving(true);
    await deleteAssociationMembershipRepository(membershipId);
    setMemberships((current) =>
      current.filter((membership) => membership.id !== membershipId)
    );
    setIsSaving(false);
  }

  async function handleCancelInvitation(invitationId) {
    const confirmed = window.confirm("Annuler cette invitation ?");
    if (!confirmed) return;

    setIsSaving(true);
    await cancelAssociationInvitationRepository(invitationId);
    setInvitations((current) =>
      current.filter((invitation) => invitation.id !== invitationId)
    );
    setIsSaving(false);
  }

  function getInvitationUrl(invitation) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return buildAssociationInvitationUrl(origin, invitation);
  }

  function getInvitationMailto(invitation) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;

    return buildAssociationInvitationMailto({
      invitation,
      origin,
      associationName: association?.name,
    });
  }

  async function copyInvitationLink(invitation) {
    const invitationUrl = getInvitationUrl(invitation);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(invitationUrl);
      setNotice("Lien d'invitation copie.");
      return;
    }

    window.prompt("Copie ce lien d'invitation:", invitationUrl);
  }

  if (!access.isConfigured) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>
          Les accès utilisateurs sont gérés avec Supabase.
        </div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canAdminAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>
          Seul un admin peut gérer les accès de cette association.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
      </div>

      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Admin</div>
          <h1 style={titleStyle}>Accès utilisateurs</h1>
          <div style={subtitleStyle}>
            {association?.name || "Association"}
          </div>
        </div>
        <Link to={`/associations/${associationId}/shows`} style={linkButtonStyle}>
          Shows
        </Link>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Ajouter un accès</h2>
        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            <span>Courriel utilisateur</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="secretariat@example.com"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Rôle</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              style={inputStyle}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {getRoleLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={primaryButtonStyle} disabled={isSaving}>
            Ajouter / inviter
          </button>
        </form>

        {notice && <div style={noticeStyle}>{notice}</div>}

        {lastInvitation && (
          <div style={invitationBoxStyle}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              Lien d'invitation
            </div>
            <input
              readOnly
              value={getInvitationUrl(lastInvitation)}
              style={inputStyle}
              onFocus={(event) => event.target.select()}
            />
            <div style={compactActionRowStyle}>
              <button
                type="button"
                onClick={() => copyInvitationLink(lastInvitation)}
                style={secondaryButtonStyle}
              >
                Copier le lien
              </button>
              <a
                href={getInvitationMailto(lastInvitation)}
                style={linkButtonStyle}
              >
                Préparer le courriel
              </a>
            </div>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Accès actifs</h2>

        {isLoading ? (
          <div style={softEmptyStyle}>Chargement…</div>
        ) : memberships.length === 0 ? (
          <div style={softEmptyStyle}>Aucun accès pour cette association.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>User ID</th>
                  <th style={thStyle}>Courriel</th>
                  <th style={thStyle}>Rôle</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td style={tdStyle}>{membership.userId}</td>
                    <td style={tdStyle}>
                      {profilesByUserId[membership.userId]?.email || "—"}
                    </td>
                    <td style={tdStyle}>{getRoleLabel(membership.role)}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleDelete(membership.id)}
                        style={dangerButtonStyle}
                        disabled={isSaving}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Invitations en attente</h2>

        {isLoading ? (
          <div style={softEmptyStyle}>Chargement…</div>
        ) : invitations.length === 0 ? (
          <div style={softEmptyStyle}>Aucune invitation en attente.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Courriel</th>
                  <th style={thStyle}>Rôle</th>
                  <th style={thStyle}>Lien</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td style={tdStyle}>{invitation.email}</td>
                    <td style={tdStyle}>{getRoleLabel(invitation.role)}</td>
                    <td style={tdStyle}>
                      <div style={compactActionRowStyle}>
                        <button
                          type="button"
                          onClick={() => copyInvitationLink(invitation)}
                          style={secondaryButtonStyle}
                        >
                          Copier
                        </button>
                        <a
                          href={getInvitationMailto(invitation)}
                          style={linkButtonStyle}
                        >
                          Courriel
                        </a>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        style={dangerButtonStyle}
                        disabled={isSaving}
                      >
                        Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const headerStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
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
  fontSize: 28,
};

const subtitleStyle = {
  color: "#64748b",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 20,
};

const formStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  alignItems: "end",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const noticeStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  padding: 10,
  marginTop: 12,
};

const invitationBoxStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
  background: "#f8fafc",
};

const compactActionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 8,
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

const linkButtonStyle = {
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

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
  marginTop: 16,
};

const softEmptyStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

export default AssociationAccessPage;

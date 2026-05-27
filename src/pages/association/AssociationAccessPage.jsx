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
import { ASSOCIATION_ROLES } from "../../features/auth/accessRoles";
import {
  buildAssociationInvitationEmail,
  buildAssociationInvitationMailto,
  buildAssociationInvitationUrl,
} from "../../features/auth/invitationLinks";
import {
  cancelAssociationInvitationRepository,
  createAssociationInvitationRepository,
  loadAssociationInvitationsRepository,
} from "../../features/auth/invitationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
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
  const { t } = useTranslation();
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
      setNotice(t("management.access.emailRequired"));
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
        setNotice(t("management.access.invitationCreateFailed"));
        return;
      }

      setLastInvitation(invitation);
      setNotice(t("management.access.invitationCreated"));
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
      setNotice(t("management.access.accessAdded"));
    }
  }

  async function handleDelete(membershipId) {
    const confirmed = window.confirm(t("management.access.removeConfirm"));
    if (!confirmed) return;

    setIsSaving(true);
    await deleteAssociationMembershipRepository(membershipId);
    setMemberships((current) =>
      current.filter((membership) => membership.id !== membershipId)
    );
    setIsSaving(false);
  }

  async function handleCancelInvitation(invitationId) {
    const confirmed = window.confirm(
      t("management.access.cancelInvitationConfirm")
    );
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
      copy: getInvitationEmailCopy(t, association),
    });
  }

  function getInvitationEmail(invitation) {
    const origin = typeof window === "undefined" ? "" : window.location.origin;

    return buildAssociationInvitationEmail({
      invitation,
      origin,
      associationName: association?.name,
      copy: getInvitationEmailCopy(t, association),
    });
  }

  function getInvitationMessage(invitation) {
    const invitationEmail = getInvitationEmail(invitation);

    return [
      `${t("management.access.emailTo")}: ${invitationEmail.to}`,
      `${t("management.access.emailSubjectLabel")}: ${invitationEmail.subject}`,
      "",
      invitationEmail.body,
    ].join("\n");
  }

  async function copyInvitationLink(invitation) {
    const invitationUrl = getInvitationUrl(invitation);

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(invitationUrl);
      setNotice(t("management.access.invitationLinkCopied"));
      return;
    }

    window.prompt(t("management.access.invitationLinkPrompt"), invitationUrl);
  }

  async function copyInvitationMessage(invitation) {
    const message = getInvitationMessage(invitation);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setNotice(t("management.access.invitationMessageCopied"));
        return;
      }
    } catch (error) {
      console.error("Erreur copie invitation:", error);
    }

    window.prompt(t("management.access.invitationMessagePrompt"), message);
  }

  function openInvitationEmail(invitation) {
    try {
      window.open(
        getInvitationMailto(invitation),
        "_blank",
        "noopener,noreferrer"
      );
      setNotice(t("management.access.emailOpenedNotice"));
      return;
    } catch (error) {
      console.error("Erreur ouverture invitation:", error);
    }

    setNotice(t("management.access.emailBlockedNotice"));
  }

  if (!access.isConfigured) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>
          {t("management.access.supabaseOnly")}
        </div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canAdminAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>
          {t("management.access.adminOnly")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Admin</div>
          <h1 style={titleStyle}>{t("management.access.title")}</h1>
          <div style={subtitleStyle}>
            {association?.name || t("common.association")}
          </div>
        </div>
        <Link to={`/associations/${associationId}/shows`} style={linkButtonStyle}>
          {t("common.shows")}
        </Link>
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("management.access.addAccess")}</h2>
        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            <span>{t("management.access.userEmail")}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="secretariat@example.com"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>{t("management.access.role")}</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              style={inputStyle}
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {getAssociationRoleLabel(option, t)}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" style={primaryButtonStyle} disabled={isSaving}>
            {t("management.access.submitInvite")}
          </button>
        </form>

        {notice && <div style={noticeStyle}>{notice}</div>}

        {lastInvitation && (
          <div style={invitationBoxStyle}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {t("management.access.invitationLink")}
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
                {t("management.access.copyLink")}
              </button>
              <button
                type="button"
                onClick={() => copyInvitationMessage(lastInvitation)}
                style={secondaryButtonStyle}
              >
                {t("management.access.copyMessage")}
              </button>
              <button
                type="button"
                onClick={() => openInvitationEmail(lastInvitation)}
                style={secondaryButtonStyle}
              >
                {t("management.access.openEmail")}
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("management.access.activeAccess")}</h2>

        {isLoading ? (
          <div style={softEmptyStyle}>{t("common.loading")}</div>
        ) : memberships.length === 0 ? (
          <div style={softEmptyStyle}>
            {t("management.access.noActiveAccess")}
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("management.access.userId")}</th>
                  <th style={thStyle}>{t("management.access.email")}</th>
                  <th style={thStyle}>{t("management.access.role")}</th>
                  <th style={thStyle}>{t("management.access.action")}</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td style={tdStyle}>{membership.userId}</td>
                    <td style={tdStyle}>
                      {profilesByUserId[membership.userId]?.email || "—"}
                    </td>
                    <td style={tdStyle}>
                      {getAssociationRoleLabel(membership.role, t)}
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleDelete(membership.id)}
                        style={dangerButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.access.remove")}
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
        <h2 style={sectionTitleStyle}>
          {t("management.access.pendingInvitations")}
        </h2>

        {isLoading ? (
          <div style={softEmptyStyle}>{t("common.loading")}</div>
        ) : invitations.length === 0 ? (
          <div style={softEmptyStyle}>
            {t("management.access.noPendingInvitations")}
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>{t("management.access.email")}</th>
                  <th style={thStyle}>{t("management.access.role")}</th>
                  <th style={thStyle}>{t("management.access.link")}</th>
                  <th style={thStyle}>{t("management.access.action")}</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td style={tdStyle}>{invitation.email}</td>
                    <td style={tdStyle}>
                      {getAssociationRoleLabel(invitation.role, t)}
                    </td>
                    <td style={tdStyle}>
                      <div style={compactActionRowStyle}>
                        <button
                          type="button"
                          onClick={() => copyInvitationLink(invitation)}
                          style={secondaryButtonStyle}
                        >
                          {t("management.access.copy")}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyInvitationMessage(invitation)}
                          style={secondaryButtonStyle}
                        >
                          {t("management.access.message")}
                        </button>
                        <button
                          type="button"
                          onClick={() => openInvitationEmail(invitation)}
                          style={secondaryButtonStyle}
                        >
                          {t("management.access.email")}
                        </button>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleCancelInvitation(invitation.id)}
                        style={dangerButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.access.cancel")}
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

function getAssociationRoleLabel(role, t) {
  switch (role) {
    case ASSOCIATION_ROLES.ADMIN:
      return t("management.access.roleAdmin");
    case ASSOCIATION_ROLES.SECRETARY:
      return t("management.access.roleSecretary");
    case ASSOCIATION_ROLES.SCRIBE:
      return t("management.access.roleScribe");
    case ASSOCIATION_ROLES.ANNOUNCER:
      return t("management.access.roleAnnouncer");
    default:
      return role || t("management.access.roleFallback");
  }
}

function getInvitationEmailCopy(t, association) {
  const associationName = association?.name || t("common.association");

  return {
    associationFallback: t("common.association"),
    subject: t("management.access.invitationEmailSubject"),
    bodyIntro: t("management.access.invitationEmailIntro", {
      associationName,
    }),
    bodyAction: t("management.access.invitationEmailAction"),
  };
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

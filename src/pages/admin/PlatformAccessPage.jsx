import React, { useEffect, useMemo, useState } from "react";
import { loadAssociationsRepository } from "../../features/associations/associationRepository";
import {
  deleteAssociationMembershipRepository,
  loadMembershipsByUserIdsRepository,
  saveAssociationMembershipRepository,
  searchUserProfilesRepository,
} from "../../features/auth/accessRepository";
import { ASSOCIATION_ROLES } from "../../features/auth/accessRoles";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const ROLE_OPTIONS = [
  ASSOCIATION_ROLES.ADMIN,
  ASSOCIATION_ROLES.SECRETARY,
  ASSOCIATION_ROLES.SCRIBE,
  ASSOCIATION_ROLES.ANNOUNCER,
];

function PlatformAccessPage() {
  const { t } = useTranslation();
  const access = useAssociationAccess(null);
  const [associations, setAssociations] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");
  const [searchTick, setSearchTick] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAssociationId, setSelectedAssociationId] = useState("");
  const [selectedRole, setSelectedRole] = useState(ASSOCIATION_ROLES.SECRETARY);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const canManagePlatformAccess =
    access.isConfigured && (access.isPlatformAdmin || access.isLocalTestUser);

  useEffect(() => {
    let isMounted = true;

    async function loadAccessData() {
      if (access.isLoadingAccess || !canManagePlatformAccess) {
        return;
      }

      setIsLoading(true);
      const [nextAssociations, nextProfiles] = await Promise.all([
        loadAssociationsRepository(),
        searchUserProfilesRepository(submittedSearchQuery, { limit: 50 }),
      ]);
      const nextMemberships = await loadMembershipsByUserIdsRepository(
        nextProfiles.map((profile) => profile.id)
      );

      if (!isMounted) return;
      setAssociations(nextAssociations);
      setProfiles(nextProfiles);
      setMemberships(nextMemberships);
      setSelectedUserId((current) =>
        nextProfiles.some((profile) => profile.id === current)
          ? current
          : nextProfiles[0]?.id || ""
      );
      setSelectedAssociationId((current) =>
        nextAssociations.some((association) => association.id === current)
          ? current
          : nextAssociations[0]?.id || ""
      );
      setIsLoading(false);
    }

    loadAccessData();

    return () => {
      isMounted = false;
    };
  }, [
    access.isLoadingAccess,
    canManagePlatformAccess,
    submittedSearchQuery,
    searchTick,
  ]);

  const associationsById = useMemo(
    () => new Map(associations.map((association) => [association.id, association])),
    [associations]
  );
  const membershipsByUserId = useMemo(
    () =>
      memberships.reduce((grouped, membership) => {
        if (!grouped.has(membership.userId)) {
          grouped.set(membership.userId, []);
        }
        grouped.get(membership.userId).push(membership);
        return grouped;
      }, new Map()),
    [memberships]
  );
  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedUserId
  );

  async function refreshMemberships(nextProfiles = profiles) {
    const nextMemberships = await loadMembershipsByUserIdsRepository(
      nextProfiles.map((profile) => profile.id)
    );
    setMemberships(nextMemberships);
  }

  function refreshSearch() {
    setNotice("");
    setSubmittedSearchQuery(searchQuery);
    setSearchTick((value) => value + 1);
  }

  function handleSearch(event) {
    event.preventDefault();
    refreshSearch();
  }

  async function handleAddRole(event) {
    event.preventDefault();
    setNotice("");

    if (!selectedUserId || !selectedAssociationId || !selectedRole) {
      setNotice(t("adminAccess.missingSelection"));
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveAssociationMembershipRepository(
        {
          userId: selectedUserId,
          associationId: selectedAssociationId,
          role: selectedRole,
        },
        { throwOnError: true }
      );

      await refreshMemberships();
      setNotice(
        saved
          ? t("adminAccess.roleAdded")
          : t("adminAccess.roleAddFailed")
      );
    } catch (error) {
      console.error("Erreur ajout accès plateforme:", error);
      setNotice(t("adminAccess.roleAddFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveRole(membership) {
    const associationName =
      associationsById.get(membership.associationId)?.name ||
      membership.associationId;
    const confirmed = window.confirm(
      t("adminAccess.removeConfirm", {
        role: getRoleLabel(membership.role, t),
        association: associationName,
      })
    );
    if (!confirmed) return;

    setNotice("");
    setIsSaving(true);
    await deleteAssociationMembershipRepository(membership.id);
    await refreshMemberships();
    setIsSaving(false);
    setNotice(t("adminAccess.roleRemoved"));
  }

  if (access.isLoadingAccess) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("adminAccess.loading")}</div>
      </div>
    );
  }

  if (!access.isConfigured) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("adminAccess.supabaseOnly")}</div>
      </div>
    );
  }

  if (!canManagePlatformAccess) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("adminAccess.accessDenied")}</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{t("adminAccess.eyebrow")}</div>
          <h1 style={titleStyle}>{t("adminAccess.title")}</h1>
          <div style={subtitleStyle}>
            {t("adminAccess.subtitle", {
              profiles: profiles.length,
              roles: memberships.length,
            })}
          </div>
        </div>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={refreshSearch}
          disabled={isLoading}
        >
          {t("adminAccess.refresh")}
        </button>
      </section>

      <section style={panelStyle}>
        <form onSubmit={handleSearch} style={searchFormStyle}>
          <label style={labelStyle}>
            <span>{t("adminAccess.searchLabel")}</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("adminAccess.searchPlaceholder")}
              style={inputStyle}
            />
          </label>
          <button type="submit" style={styles.primaryButton} disabled={isLoading}>
            {t("adminAccess.search")}
          </button>
        </form>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>{t("adminAccess.addRole")}</h2>
        <form onSubmit={handleAddRole} style={addFormStyle}>
          <label style={labelStyle}>
            <span>{t("adminAccess.user")}</span>
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              style={inputStyle}
              disabled={profiles.length === 0}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {formatProfileLabel(profile)}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>{t("adminAccess.association")}</span>
            <select
              value={selectedAssociationId}
              onChange={(event) => setSelectedAssociationId(event.target.value)}
              style={inputStyle}
              disabled={associations.length === 0}
            >
              {associations.map((association) => (
                <option key={association.id} value={association.id}>
                  {association.name || association.shortName || association.id}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>{t("adminAccess.role")}</span>
            <select
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
              style={inputStyle}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role, t)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            style={styles.primaryButton}
            disabled={
              isSaving ||
              !selectedProfile ||
              !selectedAssociationId ||
              profiles.length === 0 ||
              associations.length === 0
            }
          >
            {t("adminAccess.add")}
          </button>
        </form>
        {notice && <div style={noticeStyle}>{notice}</div>}
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>{t("adminAccess.users")}</h2>

        {isLoading ? (
          <div style={emptyStateStyle}>{t("adminAccess.loading")}</div>
        ) : profiles.length === 0 ? (
          <div style={emptyStateStyle}>{t("adminAccess.noProfiles")}</div>
        ) : (
          <div style={userGridStyle}>
            {profiles.map((profile) => {
              const profileMemberships =
                membershipsByUserId.get(profile.id) || [];
              return (
                <article key={profile.id} style={userCardStyle}>
                  <div style={userHeaderStyle}>
                    <div>
                      <h3 style={userNameStyle}>
                        {profile.displayName || profile.email || profile.id}
                      </h3>
                      <div style={mutedTextStyle}>
                        {profile.email || profile.id}
                      </div>
                    </div>
                    <span style={countBadgeStyle}>
                      {t("adminAccess.roleCount", {
                        count: profileMemberships.length,
                      })}
                    </span>
                  </div>

                  {profileMemberships.length === 0 ? (
                    <div style={softEmptyStyle}>
                      {t("adminAccess.noRoles")}
                    </div>
                  ) : (
                    <div style={roleListStyle}>
                      {profileMemberships.map((membership) => (
                        <div key={membership.id} style={roleRowStyle}>
                          <div>
                            <div style={roleNameStyle}>
                              {getRoleLabel(membership.role, t)}
                            </div>
                            <div style={mutedTextStyle}>
                              {associationsById.get(membership.associationId)
                                ?.name || membership.associationId}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={dangerButtonStyle}
                            onClick={() => handleRemoveRole(membership)}
                            disabled={isSaving}
                          >
                            {t("adminAccess.remove")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function formatProfileLabel(profile) {
  const name = profile.displayName || profile.email || profile.id;
  return profile.email && profile.displayName
    ? `${profile.displayName} · ${profile.email}`
    : name;
}

function getRoleLabel(role, t) {
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
      return t("management.access.roleFallback");
  }
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};

const eyebrowStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "4px 0",
  color: "#0f172a",
  fontSize: 30,
  lineHeight: 1.1,
};

const subtitleStyle = {
  color: "#475569",
  fontSize: 14,
};

const panelStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};

const searchFormStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  alignItems: "end",
};

const addFormStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  alignItems: "end",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  minHeight: 40,
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#0f172a",
  fontSize: 14,
  background: "#fff",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  color: "#0f172a",
  fontSize: 18,
};

const noticeStyle = {
  marginTop: 12,
  padding: 10,
  borderRadius: 8,
  background: "#ecfeff",
  color: "#155e75",
  fontWeight: 800,
};

const userGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 12,
};

const userCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 14,
  background: "#f8fafc",
};

const userHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 12,
};

const userNameStyle = {
  margin: "0 0 4px",
  color: "#0f172a",
  fontSize: 16,
};

const countBadgeStyle = {
  flex: "0 0 auto",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "4px 8px",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
  background: "#fff",
};

const roleListStyle = {
  display: "grid",
  gap: 8,
};

const roleRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  padding: 10,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
};

const roleNameStyle = {
  color: "#0f172a",
  fontWeight: 900,
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
  wordBreak: "break-word",
};

const emptyStateStyle = {
  padding: 18,
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  color: "#64748b",
  background: "#f8fafc",
};

const softEmptyStyle = {
  padding: 10,
  borderRadius: 8,
  color: "#64748b",
  background: "#fff",
};

const dangerButtonStyle = {
  border: "1px solid #fecaca",
  borderRadius: 8,
  background: "#fff1f2",
  color: "#be123c",
  cursor: "pointer",
  fontWeight: 800,
  minHeight: 34,
  padding: "6px 10px",
};

export default PlatformAccessPage;

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import {
  createAssociationWithOwnerRepository,
  deleteAssociationRepository,
  isCreateAssociationWithOwnerMissing,
  loadAssociationsRepository,
  saveAssociationRepository,
} from "../../features/associations/associationRepository";
import { filterAssociationsBySearch } from "../../features/associations/associationSearch";
import { createAssociationId } from "../../features/associations/associationsData";
import {
  loadIsPlatformAdminRepository,
  loadUserMembershipsRepository,
  saveAssociationMembershipRepository,
} from "../../features/auth/accessRepository";
import {
  ASSOCIATION_ROLES,
  canManageAssociation,
  hasAssociationRole,
} from "../../features/auth/accessRoles";
import { redeemPendingAssociationInvitationsRepository } from "../../features/auth/invitationRepository";
import { normalizeAssociationWebsiteUrl } from "../../features/associations/associationProfile";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const emptyForm = {
  name: "",
  shortName: "",
  timezone: "America/Montreal",
  logoDataUrl: "",
  websiteUrl: "",
};

function AssociationsPage() {
  const [associations, setAssociations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAssociationFormOpen, setIsAssociationFormOpen] = useState(false);
  const auth = useAuthUser();
  const { t } = useTranslation();
  const authUserId = auth.user?.id;
  const authUserEmail = auth.user?.email;

  const cloudStatus = getCloudSyncStatus(auth.user);
  const isLocalMode = !auth.isConfigured || auth.isLocalTestUser;
  const canCreateAssociation = isLocalMode || auth.isAuthenticated;
  const canShowAssociationForm = canCreateAssociation || Boolean(editingId);
  const shouldShowLoginPrompt =
    auth.isConfigured &&
    !auth.isLocalTestUser &&
    !auth.isLoading &&
    !auth.isAuthenticated;
  const shouldHideAssociationList =
    auth.isConfigured && !auth.isLocalTestUser && !auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      if (auth.isConfigured && !auth.isLocalTestUser && auth.isLoading) {
        return;
      }

      if (auth.isConfigured && !auth.isLocalTestUser && !authUserId) {
        if (!isMounted) return;
        setAssociations([]);
        setMemberships([]);
        setIsPlatformAdmin(false);
        setIsLoading(false);
        return;
      }

      if (auth.isConfigured && !auth.isLocalTestUser && authUserId) {
        await redeemPendingAssociationInvitationsRepository({
          id: authUserId,
          email: authUserEmail,
        });
      }

      const [data, nextMemberships, nextIsPlatformAdmin] = await Promise.all([
        loadAssociationsRepository(),
        auth.isConfigured && !auth.isLocalTestUser && authUserId
          ? loadUserMembershipsRepository(authUserId)
          : Promise.resolve([]),
        auth.isConfigured && !auth.isLocalTestUser && authUserId
          ? loadIsPlatformAdminRepository()
          : Promise.resolve(false),
      ]);

      if (!isMounted) return;
      setAssociations(data);
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [
    auth.isConfigured,
    auth.isLoading,
    auth.isLocalTestUser,
    authUserEmail,
    authUserId,
  ]);

  const sortedAssociations = useMemo(() => {
    const visibleAssociations = isLocalMode || isPlatformAdmin
      ? associations
      : associations.filter((association) =>
          hasAssociationRole(memberships, association.id, [
            "admin",
            "secretary",
            "scribe",
            "announcer",
          ])
        );

    return [...visibleAssociations].sort((a, b) => a.name.localeCompare(b.name));
  }, [associations, isLocalMode, isPlatformAdmin, memberships]);

  const filteredAssociations = useMemo(
    () => filterAssociationsBySearch(sortedAssociations, searchQuery),
    [sortedAssociations, searchQuery]
  );

  function handleChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setIsAssociationFormOpen(false);
  }

  function handleLogoFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleChange("logoDataUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice("");

    const name = form.name.trim();
    const shortName = form.shortName.trim();
    const timezone = form.timezone.trim();
    const logoDataUrl = form.logoDataUrl.trim();
    const websiteUrl = normalizeAssociationWebsiteUrl(form.websiteUrl);

    if (!name) {
      alert(t("management.associations.nameRequired"));
      return;
    }

    if (!shortName) {
      alert(t("management.associations.shortNameRequired"));
      return;
    }

    if (!timezone) {
      alert(t("management.associations.timezoneRequired"));
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        const nextAssociation = {
          id: editingId,
          name,
          shortName,
          timezone,
          logoDataUrl,
          websiteUrl,
        };

        await saveAssociationRepository(nextAssociation);

        setAssociations((current) =>
          current.map((association) =>
            association.id === editingId ? nextAssociation : association
          )
        );
        setNotice(t("management.associations.savedNotice"));
      } else {
        const nextAssociation = {
          id: createAssociationId(),
          name,
          shortName,
          timezone,
          logoDataUrl,
          websiteUrl,
        };

        let savedAssociation = null;

        if (auth.isConfigured && !auth.isLocalTestUser && auth.user?.id) {
          try {
            savedAssociation =
              await createAssociationWithOwnerRepository(nextAssociation);
          } catch (error) {
            if (!isCreateAssociationWithOwnerMissing(error)) {
              throw error;
            }

            savedAssociation = await saveAssociationRepository(nextAssociation);
            await saveAssociationMembershipRepository(
              {
                userId: auth.user.id,
                associationId: savedAssociation.id,
                role: ASSOCIATION_ROLES.ADMIN,
              },
              {
                throwOnError: true,
              }
            );
          }

          const nextMemberships = await loadUserMembershipsRepository(
            auth.user.id
          );
          setMemberships(nextMemberships);
        } else {
          savedAssociation = await saveAssociationRepository(nextAssociation);
        }

        setAssociations((current) => [...current, savedAssociation]);
        setNotice(t("management.associations.createdNotice"));
      }

      resetForm();
    } catch (error) {
      const message = error?.message || t("management.associations.createFailed");
      setNotice(t("management.associations.saveFailed", { message }));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(association) {
    setIsAssociationFormOpen(true);
    setEditingId(association.id);
    setForm({
      name: association.name || "",
      shortName: association.shortName || "",
      timezone: association.timezone || "America/Montreal",
      logoDataUrl: association.logoDataUrl || "",
      websiteUrl: association.websiteUrl || "",
    });
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm(
      t("management.associations.deleteConfirm")
    );

    if (!confirmDelete) {
      return;
    }

    setIsSaving(true);
    await deleteAssociationRepository(id);
    setAssociations((current) =>
      current.filter((association) => association.id !== id)
    );
    setIsSaving(false);

    if (editingId === id) {
      resetForm();
    }
  }

  return (
    <div style={styles.app}>
      <div style={headerWrapStyle}>
        <h1>{t("management.associations.title")}</h1>
        <span style={syncBadgeStyle(cloudStatus.configured)}>
          {t("management.sync.label")}: {getSyncLabel(cloudStatus, t)}
        </span>
      </div>

      {shouldShowLoginPrompt && (
        <div style={emptyStateStyle}>
          <h2 style={{ marginTop: 0, color: "#111827" }}>
            {t("management.associations.loginRequiredTitle")}
          </h2>
          <p style={{ marginTop: 0 }}>
            {t("management.associations.loginRequiredText")}
          </p>
          <div style={actionRowStyle}>
            <Link to="/login" style={linkButtonStyle}>
              {t("home.managerLogin")}
            </Link>
            <Link to="/public" style={linkButtonStyle}>
              {t("nav.publicShowcase")}
            </Link>
          </div>
        </div>
      )}

      {canShowAssociationForm && !auth.isLoading && (
        <div style={cardStyle}>
          <div style={formHeaderStyle}>
            <div>
              <h2 style={{ margin: 0 }}>
                {editingId
                  ? t("management.associations.editTitle")
                  : t("management.associations.addTitle")}
              </h2>
              {!isAssociationFormOpen && !editingId && (
                <div style={helperTextStyle}>
                  {t("management.associations.collapsedHelp")}
                </div>
              )}
            </div>

            {!isAssociationFormOpen && !editingId && (
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setEditingId(null);
                  setIsAssociationFormOpen(true);
                }}
                disabled={isSaving}
              >
                {t("management.associations.addAssociation")}
              </button>
            )}
          </div>

          {(isAssociationFormOpen || editingId) && (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("management.associations.nameLabel")}</span>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Association Québécoise de Reining"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("management.associations.shortNameLabel")}</span>
                <input
                  value={form.shortName}
                  onChange={(e) => handleChange("shortName", e.target.value)}
                  placeholder="AQR"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("management.associations.timezoneLabel")}</span>
                <input
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  placeholder="America/Montreal"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("management.associations.websiteLabel")}</span>
                <input
                  value={form.websiteUrl}
                  onChange={(e) => handleChange("websiteUrl", e.target.value)}
                  placeholder="https://association.ca"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>{t("management.associations.logoLabel")}</span>
                <input
                  value={form.logoDataUrl}
                  onChange={(e) => handleChange("logoDataUrl", e.target.value)}
                  placeholder={t("management.associations.logoPlaceholder")}
                  style={inputStyle}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  style={fileInputStyle}
                />
              </label>

              {form.logoDataUrl ? (
                <div style={logoPreviewRowStyle}>
                  <AssociationLogo
                    association={{
                      name: form.name,
                      shortName: form.shortName,
                      logoDataUrl: form.logoDataUrl,
                    }}
                    size={52}
                  />
                  <button
                    type="button"
                    onClick={() => handleChange("logoDataUrl", "")}
                    disabled={isSaving}
                  >
                    {t("management.associations.removeLogo")}
                  </button>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="submit" disabled={isSaving}>
                  {editingId
                    ? t("management.associations.save")
                    : t("management.associations.add")}
                </button>

                <button type="button" onClick={resetForm} disabled={isSaving}>
                  {t("management.associations.cancel")}
                </button>
              </div>
            </form>
          )}

          {notice && <div style={noticeStyle}>{notice}</div>}
        </div>
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>
          {t("management.associations.loading")}
        </div>
      ) : shouldHideAssociationList ? null : sortedAssociations.length === 0 ? (
        <div style={emptyStateStyle}>
          {t("management.associations.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <label style={searchWrapStyle}>
            <span style={searchLabelStyle}>
              {t("management.associations.searchLabel")}
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("management.associations.searchPlaceholder")}
              style={inputStyle}
            />
          </label>

          {filteredAssociations.length === 0 ? (
            <div style={emptyStateStyle}>
              {t("management.associations.noSearchResults")}
            </div>
          ) : null}

          {filteredAssociations.map((association) => {
            const canManage = isLocalMode
              ? true
              : isPlatformAdmin ||
                canManageAssociation(memberships, association.id);

            return (
              <div key={association.id} style={cardStyle}>
                <div style={associationHeaderStyle}>
                  <AssociationLogo association={association} size={52} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>
                      {association.name}
                    </div>

                    <div style={{ color: "#64748b", marginTop: 4 }}>
                      {association.shortName} • {association.timezone}
                    </div>
                    {association.websiteUrl && (
                      <a
                        href={normalizeAssociationWebsiteUrl(association.websiteUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={websiteLinkStyle}
                      >
                        {t("common.website")}
                      </a>
                    )}
                  </div>
                </div>

                <div style={actionRowStyle}>
                  <Link to={`/associations/${association.id}/shows`}>
                    {t("management.associations.openShows")}
                  </Link>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(association)}
                        disabled={isSaving}
                      >
                        {t("management.associations.edit")}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(association.id)}
                        disabled={isSaving}
                      >
                        {t("management.associations.delete")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerWrapStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const formHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 6,
};

const searchWrapStyle = {
  display: "grid",
  gap: 6,
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const searchLabelStyle = {
  color: "#334155",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const fileInputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 10,
  border: "1px dashed #cbd5e1",
  boxSizing: "border-box",
  background: "#f8fafc",
};

const logoPreviewRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const associationHeaderStyle = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  minWidth: 0,
};

const websiteLinkStyle = {
  display: "inline-flex",
  marginTop: 6,
  color: "#1d4ed8",
  fontWeight: 700,
};

const actionRowStyle = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const noticeStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  padding: 10,
  marginTop: 12,
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

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

const syncBadgeStyle = (isCloudReady) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${isCloudReady ? "#86efac" : "#cbd5e1"}`,
  background: isCloudReady ? "#ecfdf5" : "#f8fafc",
  color: isCloudReady ? "#166534" : "#475569",
  fontWeight: 700,
  fontSize: 13,
});

function getSyncLabel(cloudStatus, t) {
  if (cloudStatus.mode === "local-test") return t("management.sync.localTest");
  if (!cloudStatus.configured) return t("management.sync.local");
  if (cloudStatus.authenticated) return t("management.sync.connected");
  return t("management.sync.disconnected");
}

export default AssociationsPage;

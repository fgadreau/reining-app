import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createAssociationWithOwnerRepository,
  deleteAssociationRepository,
  isCreateAssociationWithOwnerMissing,
  loadAssociationsRepository,
  saveAssociationRepository,
} from "../../features/associations/associationRepository";
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
import { useAuthUser } from "../../features/auth/useAuthUser";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { appStyles as styles } from "../../styles/appStyles";

const emptyForm = {
  name: "",
  shortName: "",
  timezone: "America/Montreal",
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
  const auth = useAuthUser();
  const authUserId = auth.user?.id;
  const authUserEmail = auth.user?.email;

  const cloudStatus = getCloudSyncStatus(auth.user);
  const isLocalMode = !auth.isConfigured;
  const canCreateAssociation = isLocalMode || auth.isAuthenticated;
  const canShowAssociationForm = canCreateAssociation || Boolean(editingId);
  const shouldShowLoginPrompt =
    auth.isConfigured && !auth.isLoading && !auth.isAuthenticated;
  const shouldHideAssociationList =
    auth.isConfigured && !auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      if (auth.isConfigured && auth.isLoading) {
        return;
      }

      if (auth.isConfigured && !authUserId) {
        if (!isMounted) return;
        setAssociations([]);
        setMemberships([]);
        setIsPlatformAdmin(false);
        setIsLoading(false);
        return;
      }

      if (auth.isConfigured && authUserId) {
        await redeemPendingAssociationInvitationsRepository({
          id: authUserId,
          email: authUserEmail,
        });
      }

      const [data, nextMemberships, nextIsPlatformAdmin] = await Promise.all([
        loadAssociationsRepository(),
        auth.isConfigured && authUserId
          ? loadUserMembershipsRepository(authUserId)
          : Promise.resolve([]),
        auth.isConfigured && authUserId
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
  }, [auth.isConfigured, auth.isLoading, authUserEmail, authUserId]);

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

  function handleChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setNotice("");

    const name = form.name.trim();
    const shortName = form.shortName.trim();
    const timezone = form.timezone.trim();

    if (!name) {
      alert("Le nom est requis");
      return;
    }

    if (!shortName) {
      alert("Le nom court est requis");
      return;
    }

    if (!timezone) {
      alert("Le fuseau horaire est requis");
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
        };

        await saveAssociationRepository(nextAssociation);

        setAssociations((current) =>
          current.map((association) =>
            association.id === editingId ? nextAssociation : association
          )
        );
        setNotice("Association enregistrée.");
      } else {
        const nextAssociation = {
          id: createAssociationId(),
          name,
          shortName,
          timezone,
        };

        let savedAssociation = null;

        if (auth.isConfigured && auth.user?.id) {
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
        setNotice("Association créée. Tu es admin de cette association.");
      }

      resetForm();
    } catch (error) {
      const message = error?.message || "Création impossible.";
      setNotice(
        `Impossible d'enregistrer l'association. ${message} Si Supabase refuse l'accès, exécute la migration docs/supabase-onboarding-access-migration.sql.`
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(association) {
    setEditingId(association.id);
    setForm({
      name: association.name || "",
      shortName: association.shortName || "",
      timezone: association.timezone || "America/Montreal",
    });
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm("Supprimer cette association ?");

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
        <h1>Associations</h1>
        <span style={syncBadgeStyle(cloudStatus.configured)}>
          Sync : {getSyncLabel(cloudStatus)}
        </span>
      </div>

      {shouldShowLoginPrompt && (
        <div style={emptyStateStyle}>
          <h2 style={{ marginTop: 0, color: "#111827" }}>
            Connexion gestionnaire requise
          </h2>
          <p style={{ marginTop: 0 }}>
            Connecte-toi pour créer une association, gérer tes événements et
            accepter tes invitations d'accès.
          </p>
          <div style={actionRowStyle}>
            <Link to="/login" style={linkButtonStyle}>
              Connexion gestionnaire
            </Link>
            <Link to="/public" style={linkButtonStyle}>
              Résultats publics
            </Link>
          </div>
        </div>
      )}

      {canShowAssociationForm && !auth.isLoading && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>
            {editingId ? "Modifier une association" : "Ajouter une association"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Nom</span>
              <input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Association Québécoise de Reining"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Nom court</span>
              <input
                value={form.shortName}
                onChange={(e) => handleChange("shortName", e.target.value)}
                placeholder="AQR"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Fuseau horaire</span>
              <input
                value={form.timezone}
                onChange={(e) => handleChange("timezone", e.target.value)}
                placeholder="America/Montreal"
                style={inputStyle}
              />
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" disabled={isSaving}>
                {editingId ? "Enregistrer" : "Ajouter"}
              </button>

              {editingId ? (
                <button type="button" onClick={resetForm} disabled={isSaving}>
                  Annuler
                </button>
              ) : null}
            </div>
          </form>

          {notice && <div style={noticeStyle}>{notice}</div>}
        </div>
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des associations…</div>
      ) : shouldHideAssociationList ? null : sortedAssociations.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucune association de gestion pour ce compte. Crée ta première
          association pour commencer.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sortedAssociations.map((association) => {
            const canManage = isLocalMode
              ? true
              : isPlatformAdmin ||
                canManageAssociation(memberships, association.id);

            return (
              <div key={association.id} style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {association.name}
                </div>

                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {association.shortName} • {association.timezone}
                </div>

                <div style={actionRowStyle}>
                  <Link to={`/associations/${association.id}/shows`}>
                    Ouvrir les shows
                  </Link>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(association)}
                        disabled={isSaving}
                      >
                        Modifier
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(association.id)}
                        disabled={isSaving}
                      >
                        Supprimer
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

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
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

function getSyncLabel(cloudStatus) {
  if (!cloudStatus.configured) return "Local";
  if (cloudStatus.authenticated) return "Supabase connecté";
  return "Supabase non connecté";
}

export default AssociationsPage;

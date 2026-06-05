import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import {
  getAssociationRepository,
  saveAssociationRepository,
} from "../../features/associations/associationRepository";
import { normalizeAssociationWebsiteUrl } from "../../features/associations/associationProfile";
import {
  getAssociationTimezoneOptions,
  getDetectedTimezone,
  normalizeAssociationTimezone,
} from "../../features/associations/timezones";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";

function AssociationSettingsPage() {
  const { associationId } = useParams();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const detectedTimezone = useMemo(() => getDetectedTimezone(), []);
  const timezoneOptions = useMemo(() => getAssociationTimezoneOptions(), []);
  const [association, setAssociation] = useState(null);
  const [form, setForm] = useState(() => createForm(detectedTimezone));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const cloudStatus = getCloudSyncStatus(access.user);

  const formTimezoneOptions = useMemo(() => {
    if (!form.timezone || timezoneOptions.includes(form.timezone)) {
      return timezoneOptions;
    }

    return [form.timezone, ...timezoneOptions];
  }, [form.timezone, timezoneOptions]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssociation() {
      setIsLoading(true);
      const nextAssociation = await getAssociationRepository(associationId);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setForm(createForm(detectedTimezone, nextAssociation));
      setIsLoading(false);
    }

    loadAssociation();

    return () => {
      isMounted = false;
    };
  }, [associationId, detectedTimezone]);

  function handleChange(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleLogoFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      handleChange("logoDataUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  function handleSponsorLogoFilesChange(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const logoDataUrl = String(reader.result || "");

        if (!logoDataUrl) return;

        setForm((current) => ({
          ...current,
          sponsorLogos: [
            ...current.sponsorLogos,
            {
              id: createId("sponsor"),
              name: file.name.replace(/\.[^.]+$/, ""),
              logoDataUrl,
            },
          ],
        }));
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  }

  function updateSponsorLogo(sponsorId, updates) {
    setForm((current) => ({
      ...current,
      sponsorLogos: current.sponsorLogos.map((sponsor) =>
        sponsor.id === sponsorId ? { ...sponsor, ...updates } : sponsor
      ),
    }));
  }

  function removeSponsorLogo(sponsorId) {
    setForm((current) => ({
      ...current,
      sponsorLogos: current.sponsorLogos.filter(
        (sponsor) => sponsor.id !== sponsorId
      ),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!association) return;

    const name = form.name.trim();
    const shortName = form.shortName.trim();
    const timezone = normalizeAssociationTimezone(form.timezone);
    const logoDataUrl = form.logoDataUrl.trim();
    const websiteUrl = normalizeAssociationWebsiteUrl(form.websiteUrl);
    const sponsorLogos = form.sponsorLogos
      .map((sponsor) => ({
        id: sponsor.id,
        name: sponsor.name.trim(),
        logoDataUrl: sponsor.logoDataUrl.trim(),
      }))
      .filter((sponsor) => sponsor.logoDataUrl);

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
    setNotice("");

    try {
      const savedAssociation = await saveAssociationRepository({
        ...association,
        name,
        shortName,
        timezone,
        logoDataUrl,
        websiteUrl,
        sponsorLogos,
      });

      setAssociation(savedAssociation);
      setForm(createForm(detectedTimezone, savedAssociation));
      setNotice(t("management.associationSettings.savedNotice"));
    } catch (error) {
      const message =
        error?.message || t("management.associations.createFailed");
      setNotice(t("management.associations.saveFailed", { message }));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || access.isLoadingAccess) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>
          {t("management.associationSettings.loading")}
        </div>
      </div>
    );
  }

  if (!association) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>
          {t("management.associationSettings.notFound")}
        </div>
      </div>
    );
  }

  if (!access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>
          {t("management.associationSettings.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={headerWrapStyle}>
        <div style={titleRowStyle}>
          <AssociationLogo association={association} size={56} />
          <div>
            <h1 style={titleStyle}>
              {t("management.associationSettings.title")}
            </h1>
            <div style={mutedTextStyle}>
              {association.name} · {t("management.associationSettings.subtitle")}
            </div>
          </div>
        </div>

        <span style={syncBadgeStyle(cloudStatus.configured)}>
          {t("management.sync.label")}: {getSyncLabel(cloudStatus, t)}
        </span>
      </div>

      <form onSubmit={handleSubmit} style={cardStyle}>
        <div style={formGridStyle}>
          <label style={fieldStyle}>
            <span>{t("management.associations.nameLabel")}</span>
            <input
              value={form.name}
              onChange={(event) => handleChange("name", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>{t("management.associations.shortNameLabel")}</span>
            <input
              value={form.shortName}
              onChange={(event) => handleChange("shortName", event.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>{t("management.associations.timezoneLabel")}</span>
            <div style={timezoneRowStyle}>
              <select
                value={form.timezone}
                onChange={(event) => handleChange("timezone", event.target.value)}
                style={{ ...inputStyle, flex: "1 1 260px" }}
              >
                {formTimezoneOptions.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleChange("timezone", detectedTimezone)}
                disabled={isSaving}
                style={secondaryButtonStyle}
              >
                {t("management.associations.timezoneAuto")}
              </button>
            </div>
            <span style={helperTextStyle}>
              {t("management.associations.timezoneDetected", {
                timezone: detectedTimezone,
              })}
            </span>
          </label>

          <label style={fieldStyle}>
            <span>{t("management.associations.websiteLabel")}</span>
            <input
              value={form.websiteUrl}
              onChange={(event) =>
                handleChange("websiteUrl", event.target.value)
              }
              placeholder="https://association.ca"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>{t("management.associations.logoLabel")}</span>
            <input
              value={form.logoDataUrl}
              onChange={(event) =>
                handleChange("logoDataUrl", event.target.value)
              }
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
        </div>

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
              style={secondaryButtonStyle}
            >
              {t("management.associations.removeLogo")}
            </button>
          </div>
        ) : null}

        <section style={sponsorSectionStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.associationSettings.sponsorLogosTitle")}
            </h2>
            <div style={helperTextStyle}>
              {t("management.associationSettings.sponsorLogosHelp")}
            </div>
          </div>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleSponsorLogoFilesChange}
            style={fileInputStyle}
          />

          {form.sponsorLogos.length ? (
            <div style={sponsorGridStyle}>
              {form.sponsorLogos.map((sponsor) => (
                <div key={sponsor.id} style={sponsorCardStyle}>
                  <div style={sponsorPreviewStyle}>
                    <img
                      src={sponsor.logoDataUrl}
                      alt={
                        sponsor.name ||
                        t("management.associationSettings.sponsorLogo")
                      }
                      style={sponsorImageStyle}
                    />
                  </div>
                  <input
                    value={sponsor.name}
                    onChange={(event) =>
                      updateSponsorLogo(sponsor.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder={t("management.associationSettings.sponsorName")}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeSponsorLogo(sponsor.id)}
                    disabled={isSaving}
                    style={secondaryButtonStyle}
                  >
                    {t("management.associationSettings.removeSponsorLogo")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={softEmptyStyle}>
              {t("management.associationSettings.noSponsorLogos")}
            </div>
          )}
        </section>

        <div style={actionRowStyle}>
          <button type="submit" disabled={isSaving} style={primaryButtonStyle}>
            {isSaving
              ? t("management.associationSettings.saving")
              : t("management.associationSettings.save")}
          </button>

          <Link to={`/associations/${associationId}/shows`} style={linkButtonStyle}>
            {t("nav.competitions")}
          </Link>
        </div>

        {notice ? <div style={noticeStyle}>{notice}</div> : null}
      </form>
    </div>
  );
}

function createForm(detectedTimezone, association = null) {
  return {
    name: association?.name || "",
    shortName: association?.shortName || "",
    timezone: association?.timezone || detectedTimezone,
    logoDataUrl: association?.logoDataUrl || "",
    websiteUrl: association?.websiteUrl || "",
    sponsorLogos: Array.isArray(association?.sponsorLogos)
      ? association.sponsorLogos
      : [],
  };
}

const headerWrapStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};

const titleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
};

const titleStyle = {
  margin: "0 0 4px",
};

const mutedTextStyle = {
  color: "#64748b",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const fieldStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 400,
};

const sectionTitleStyle = {
  margin: "0 0 4px",
  fontSize: 18,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  fontWeight: 400,
};

const timezoneRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const fileInputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px dashed #cbd5e1",
  boxSizing: "border-box",
  background: "#f8fafc",
  fontWeight: 400,
};

const logoPreviewRowStyle = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sponsorSectionStyle = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 16,
};

const sponsorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const sponsorCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  display: "grid",
  gap: 10,
};

const sponsorPreviewStyle = {
  minHeight: 74,
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 8,
};

const sponsorImageStyle = {
  maxWidth: "100%",
  maxHeight: 60,
  objectFit: "contain",
};

const softEmptyStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 12,
  color: "#64748b",
  background: "#f8fafc",
};

const actionRowStyle = {
  marginTop: 16,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
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
  fontWeight: 700,
};

const noticeStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  padding: 10,
  marginTop: 14,
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
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

export default AssociationSettingsPage;

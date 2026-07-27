import React from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const PILLAR_KEYS = ["live", "scribe", "showground"];
const WORKFLOW_KEYS = ["prepare", "score", "publish"];
const DISCIPLINE_KEYS = [
  "reining",
  "ranchRiding",
  "ranchTrail",
  "trail",
  "westernRiding",
  "westernHorsemanship",
  "huntSeatEquitation",
  "showmanship",
  "workingTrack",
];

function AppPresentationPage() {
  const auth = useAuthUser();
  const { t } = useTranslation();
  const canOpenManagement = !auth.isConfigured || auth.isAuthenticated;

  return (
    <div style={styles.app}>
      <section style={introBandStyle}>
        <div style={introTextStyle}>
          <div style={eyebrowStyle}>{t("presentation.eyebrow")}</div>
          <h1 style={titleStyle}>{t("presentation.title")}</h1>
          <p style={subtitleStyle}>{t("presentation.subtitle")}</p>
          <div style={actionRowStyle}>
            <Link to="/public" style={primaryLinkStyle}>
              {t("presentation.publicCta")}
            </Link>
            {canOpenManagement ? (
              <Link to="/associations" style={secondaryLinkStyle}>
                {t("presentation.managementCta")}
              </Link>
            ) : (
              <Link to="/login" style={secondaryLinkStyle}>
                {t("presentation.loginCta")}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section style={pillarGridStyle}>
        {PILLAR_KEYS.map((key) => (
          <article key={key} style={pillarCardStyle}>
            <h2 style={cardTitleStyle}>{t(`presentation.pillars.${key}.title`)}</h2>
            <p style={cardTextStyle}>{t(`presentation.pillars.${key}.text`)}</p>
          </article>
        ))}
      </section>

      <section style={plainSectionStyle}>
        <div style={sectionIntroStyle}>
          <div style={eyebrowMutedStyle}>{t("presentation.workflowEyebrow")}</div>
          <h2 style={sectionTitleStyle}>{t("presentation.workflowTitle")}</h2>
          <p style={sectionTextStyle}>{t("presentation.workflowText")}</p>
        </div>
        <div style={workflowListStyle}>
          {WORKFLOW_KEYS.map((key, index) => (
            <article key={key} style={workflowItemStyle}>
              <span style={workflowNumberStyle}>{index + 1}</span>
              <div>
                <h3 style={workflowTitleStyle}>
                  {t(`presentation.workflow.${key}.title`)}
                </h3>
                <p style={workflowTextItemStyle}>
                  {t(`presentation.workflow.${key}.text`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={plainSectionStyle}>
        <div style={sectionIntroStyle}>
          <div style={eyebrowMutedStyle}>
            {t("presentation.disciplinesEyebrow")}
          </div>
          <h2 style={sectionTitleStyle}>{t("presentation.disciplinesTitle")}</h2>
          <p style={sectionTextStyle}>{t("presentation.disciplinesText")}</p>
        </div>
        <div style={disciplineListStyle}>
          {DISCIPLINE_KEYS.map((key) => (
            <span key={key} style={disciplinePillStyle}>
              {t(`presentation.disciplines.${key}`)}
            </span>
          ))}
        </div>
      </section>

      <section style={closingBandStyle}>
        <div>
          <h2 style={closingTitleStyle}>{t("presentation.closingTitle")}</h2>
          <p style={closingTextStyle}>{t("presentation.closingText")}</p>
        </div>
        <div style={actionRowStyle}>
          <Link to="/public" style={primaryLinkStyle}>
            {t("presentation.publicCta")}
          </Link>
          <Link to="/" style={secondaryLinkStyle}>
            {t("presentation.homeCta")}
          </Link>
        </div>
      </section>

      <section style={designerSectionStyle}>
        <div style={designerPortraitFrameStyle}>
          <img
            src="/designer-felix-gadreau-girard.jpg"
            alt={t("presentation.designer.photoAlt")}
            style={designerPortraitStyle}
          />
        </div>
        <div style={designerContentStyle}>
          <div style={designerEyebrowStyle}>
            {t("presentation.designer.eyebrow")}
          </div>
          <div>
            <h2 style={designerNameStyle}>
              {t("presentation.designer.name")}
            </h2>
            <div style={designerRoleStyle}>
              {t("presentation.designer.role")}
            </div>
          </div>
          <p style={designerTextStyle}>
            {t("presentation.designer.introduction")}
          </p>
          <p style={designerTextStyle}>
            {t("presentation.designer.motivation")}
          </p>
          <p style={designerTextStyle}>
            {t("presentation.designer.background")}
          </p>
          <a
            href="https://reiningquebec.com"
            target="_blank"
            rel="noreferrer"
            style={designerWebsiteStyle}
          >
            {t("presentation.designer.website")}
            <span aria-hidden="true"> ↗</span>
          </a>
        </div>
      </section>
    </div>
  );
}

const introBandStyle = {
  background: "#ffffff",
  borderRadius: 8,
  border: "1px solid #d8dee8",
  padding: 20,
  marginBottom: 14,
  display: "block",
  boxShadow: "0 10px 28px rgba(16, 24, 39, 0.08)",
};

const introTextStyle = {
  display: "grid",
  gap: 12,
  alignContent: "center",
};

const eyebrowStyle = {
  color: "#166534",
  fontWeight: 850,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const eyebrowMutedStyle = {
  ...eyebrowStyle,
  color: "#64748b",
};

const titleStyle = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.12,
  color: "#111827",
};

const subtitleStyle = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.45,
  fontSize: 17,
  maxWidth: 760,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const pillarGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const pillarCardStyle = {
  background: "#ffffff",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  padding: 16,
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 18,
  color: "#111827",
};

const cardTextStyle = {
  margin: "8px 0 0",
  color: "#475569",
  lineHeight: 1.42,
};

const plainSectionStyle = {
  background: "#ffffff",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  padding: 16,
  marginBottom: 14,
  display: "grid",
  gap: 14,
};

const sectionIntroStyle = {
  display: "grid",
  gap: 6,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 22,
  color: "#111827",
};

const sectionTextStyle = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.42,
  maxWidth: 820,
};

const workflowListStyle = {
  display: "grid",
  gap: 10,
};

const workflowItemStyle = {
  display: "grid",
  gridTemplateColumns: "34px 1fr",
  gap: 10,
  alignItems: "start",
};

const workflowNumberStyle = {
  width: 30,
  height: 30,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 850,
};

const workflowTitleStyle = {
  margin: 0,
  fontSize: 16,
  color: "#111827",
};

const workflowTextItemStyle = {
  margin: "4px 0 0",
  color: "#475569",
  lineHeight: 1.38,
};

const disciplineListStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const disciplinePillStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #d8dee8",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 800,
};

const designerSectionStyle = {
  display: "flex",
  alignItems: "stretch",
  flexWrap: "wrap",
  gap: 0,
  overflow: "hidden",
  background:
    "linear-gradient(135deg, #101820 0%, #1f2f35 58%, #172321 100%)",
  borderRadius: 10,
  border: "1px solid #334b4d",
  boxShadow: "0 14px 34px rgba(16, 24, 39, 0.13)",
};

const designerPortraitFrameStyle = {
  flex: "0 1 420px",
  width: "min(100%, 420px)",
  minHeight: 440,
  background: "#0f172a",
  overflow: "hidden",
};

const designerPortraitStyle = {
  display: "block",
  width: "100%",
  height: "100%",
  minHeight: 440,
  objectFit: "cover",
  objectPosition: "center 18%",
};

const designerContentStyle = {
  flex: "1 1 480px",
  display: "grid",
  alignContent: "center",
  gap: 14,
  padding: "clamp(24px, 4vw, 48px)",
};

const designerEyebrowStyle = {
  color: "#f4d98c",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const designerNameStyle = {
  margin: 0,
  color: "#ffffff",
  fontSize: "clamp(26px, 3vw, 38px)",
  lineHeight: 1.08,
};

const designerRoleStyle = {
  marginTop: 7,
  color: "#99f6e4",
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.35,
};

const designerTextStyle = {
  margin: 0,
  maxWidth: 720,
  color: "#e2e8f0",
  fontSize: 16,
  lineHeight: 1.58,
};

const designerWebsiteStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  justifySelf: "start",
  minHeight: 42,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid rgba(244, 217, 140, 0.7)",
  background: "rgba(244, 217, 140, 0.08)",
  color: "#f4d98c",
  textDecoration: "none",
  fontWeight: 850,
};

const closingBandStyle = {
  ...plainSectionStyle,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
};

const closingTitleStyle = {
  ...sectionTitleStyle,
  marginBottom: 4,
};

const closingTextStyle = {
  ...sectionTextStyle,
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
  fontWeight: 850,
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
  fontWeight: 800,
};

export default AppPresentationPage;

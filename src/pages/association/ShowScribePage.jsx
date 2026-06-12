import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
} from "../../features/classes/classRepository";
import { compareScheduleItemsByStart } from "../../features/classes/classSchedule";
import { normalizeClassJudges } from "../../features/classes/classJudges";
import { getDaysByShowRepository } from "../../features/days/dayRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import {
  getPatternDisplayName,
  isNoPatternValue,
} from "../../features/patterns/patternDefinitions";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { getShowRepository } from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";

function ShowScribePage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [show, setShow] = useState(null);
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadScribeView() {
      setIsLoading(true);
      const [nextShow, days] = await Promise.all([
        getShowRepository(showId),
        getDaysByShowRepository(showId),
      ]);

      const nextSections = await Promise.all(
        days.map(async (day) => {
          const classItems = await getClassesForDayRepository(day.id);
          const classRows = await Promise.all(
            classItems.map((classItem) =>
              getClassFullDataRepository(classItem.id)
            )
          );

          return {
            day,
            classes: classRows
              .filter((classData) => canOpenClassForScribe(classData))
              .sort(compareScheduleItemsByStart),
          };
        })
      );

      if (!isMounted) return;
      setShow(nextShow);
      setSections(nextSections);
      setIsLoading(false);
    }

    loadScribeView();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  if (!access.isLoadingAccess && !access.canScoreAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("management.scribe.accessDenied")}</div>
      </div>
    );
  }

  const readyClassCount = sections.reduce(
    (total, section) => total + section.classes.length,
    0
  );

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("nav.scribe")}</div>
          <h1 style={titleStyle}>{show?.name || t("common.show")}</h1>
          <div style={subtitleStyle}>
            {show?.venue || show?.location || t("public.results.venueTbd")}
          </div>
        </div>
        <div style={countBadgeStyle}>
          {t("management.scribe.readyClassCount", { count: readyClassCount })}
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.scribe.loading")}</div>
      ) : readyClassCount === 0 ? (
        <div style={emptyStateStyle}>{t("management.scribe.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {sections
            .filter((section) => section.classes.length > 0)
            .map((section) => (
              <section key={section.day.id} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <h2 style={sectionTitleStyle}>
                      {section.day.label || t("management.days.dayFallback")}
                    </h2>
                    <div style={mutedTextStyle}>
                      {section.day.date || t("public.results.dateTbd")}
                    </div>
                  </div>
                </div>

                <div style={classGridStyle}>
                  {section.classes.map((classData) => (
                    <ScribeClassCard
                      key={classData.classItem.id}
                      associationId={associationId}
                      classData={classData}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function ScribeClassCard({ associationId, classData }) {
  const { t } = useTranslation();
  const classItem = classData.classItem;
  const setup = classData.setup || {};
  const status = classData.status;
  const judges = normalizeClassJudges({
    judges: setup.judges,
    judgeName: setup.judgeName || classItem.judgeName,
  });
  const runCount = Array.isArray(setup.runs) ? setup.runs.length : 0;
  const pattern = setup.pattern || classItem.pattern || "";
  const customPattern = setup.customPattern || classItem.customPattern || null;

  return (
    <article style={classCardStyle}>
      <div style={classCardHeaderStyle}>
        <div>
          <div style={classNameStyle}>
            {classItem.name || t("management.classes.newClassName")}
            {classItem.classCode ? ` (${classItem.classCode})` : ""}
          </div>
          <div style={mutedTextStyle}>
            {classItem.arena
              ? `${t("public.results.arena")} ${classItem.arena} · `
              : ""}
            {t("public.results.pattern")}{" "}
            {getPatternDisplayName(pattern, customPattern) || pattern || "—"}
          </div>
        </div>
        <span style={statusBadgeStyle(status)}>
          {getScribeClassStatusLabel(status, t)}
        </span>
      </div>

      <div style={metaGridStyle}>
        <Metric label={t("management.scribe.runs")} value={runCount} />
        <Metric label={t("management.scribe.judges")} value={judges.length} />
      </div>

      <div style={actionRowStyle}>
        <Link
          to={`/associations/${associationId}/scribe/classes/${classItem.id}`}
          style={primaryLinkStyle}
        >
          {status === "completed"
            ? t("management.scribe.viewScoring")
            : t("management.scribe.openScoring")}
        </Link>
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  );
}

function canOpenClassForScribe(classData) {
  if (classData?.publication?.status === PUBLICATION_STATUSES.PUBLISHED) {
    return false;
  }

  if (
    isNoPatternValue(
      classData?.setup?.pattern || classData?.classItem?.pattern || ""
    )
  ) {
    return false;
  }

  return ["ready", "in_progress", "completed"].includes(classData?.status);
}

function getScribeClassStatusLabel(status, t) {
  switch (status) {
    case "ready":
      return t("management.classes.statusReady");
    case "in_progress":
      return t("management.classes.statusInProgress");
    case "completed":
      return t("management.classes.statusCompleted");
    default:
      return t("management.classes.statusDraft");
  }
}

const heroStyle = {
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

const countBadgeStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  padding: "8px 10px",
  fontWeight: 800,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const classGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const classCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const classCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const classNameStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
};

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
};

const metricStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const metricLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: 0,
};

const metricValueStyle = {
  marginTop: 4,
  color: "#111827",
  fontWeight: 900,
  fontSize: 18,
};

const actionRowStyle = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};

const secondaryButtonStyle = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

function statusBadgeStyle(status) {
  if (status === "completed") {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#ecfdf5",
      border: "1px solid #86efac",
      color: "#166534",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  if (status === "in_progress") {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1d4ed8",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  return {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

export default ShowScribePage;

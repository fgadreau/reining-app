import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
} from "../../features/classes/classRepository";
import { getClassStatusLabel } from "../../features/classes/classStatusSelectors";
import {
  downloadOfficialScorePdf,
  getOfficialPdfFileName,
} from "../../features/classes/officialPdfService";
import { validateOfficialResultRepository } from "../../features/classes/officialResultRepository";
import { getDaysByShowId } from "../../features/days/daySelectors";
import {
  publishClassRepository,
  unpublishClassRepository,
} from "../../features/publication/publicationCloudRepository";
import { getShowById } from "../../features/shows/showSelectors";
import { appStyles as styles } from "../../styles/appStyles";

function SecretariatDashboardPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [daySections, setDaySections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const access = useAssociationAccess(associationId);

  const association = useMemo(() => {
    return (
      loadAssociations().find((item) => item.id === associationId) || null
    );
  }, [associationId]);

  const show = getShowById(showId);

  useEffect(() => {
    let isMounted = true;

    async function loadDaySections() {
      setIsLoading(true);
      const days = getDaysByShowId(showId);
      const nextSections = await Promise.all(
        days.map(async (day) => {
          const classes = await getClassesForDayRepository(day.id);
          const classRows = await Promise.all(
            classes.map((classItem) => getClassFullDataRepository(classItem.id))
          );

          return {
            day,
            classRows,
          };
        })
      );

      if (!isMounted) return;
      setDaySections(nextSections);
      setIsLoading(false);
    }

    loadDaySections();

    return () => {
      isMounted = false;
    };
  }, [showId, version]);

  const allClassRows = daySections.flatMap((section) => section.classRows);
  const summary = buildSummary(allClassRows);

  const refresh = () => setVersion((value) => value + 1);

  const handlePublish = async (classId) => {
    await publishClassRepository(classId, "secretariat");
    refresh();
  };

  const handleUnpublish = async (classId) => {
    await unpublishClassRepository(classId);
    refresh();
  };

  const handleDownloadOfficialPdf = async (classData, options = {}) => {
    try {
      await downloadOfficialScorePdf({
        association,
        classData,
        regenerateFileName: Boolean(options.regenerateFileName),
      });
      refresh();
    } catch (error) {
      alert(error.message || "Impossible de générer le PDF officiel.");
    }
  };

  const handleValidateOfficial = async (classData) => {
    try {
      await validateOfficialResultRepository({ classData });
      refresh();
    } catch (error) {
      alert(error.message || "Impossible de valider cette classe.");
    }
  };

  if (!show) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>Show introuvable.</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>
          Ce rôle n’a pas accès au tableau secrétariat.
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

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Secrétariat</div>
          <h1 style={titleStyle}>{show.name || "Show"}</h1>
          <div style={subtitleStyle}>
            {association?.shortName || association?.name || "Association"} ·{" "}
            {show.venue || show.location || "Lieu à confirmer"}
          </div>
        </div>
        <div style={heroActionsStyle}>
          <Link
            to={`/associations/${associationId}/shows/${showId}/time`}
            style={linkButtonStyle}
          >
            Gestion du temps
          </Link>
          <Link
            to={`/associations/${associationId}/shows/${showId}`}
            style={linkButtonStyle}
          >
            Gérer les journées
          </Link>
        </div>
      </section>

      <section style={summaryGridStyle}>
        <SummaryTile label="Classes" value={summary.total} />
        <SummaryTile label="Draft" value={summary.draft} tone="muted" />
        <SummaryTile label="Prêtes" value={summary.ready} tone="info" />
        <SummaryTile label="En cours" value={summary.inProgress} tone="warn" />
        <SummaryTile label="Signées" value={summary.signed} tone="warn" />
        <SummaryTile label="Validées" value={summary.validated} tone="success" />
        <SummaryTile label="PDF" value={summary.pdfReady} tone="success" />
        <SummaryTile label="Publiées" value={summary.published} tone="success" />
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement du tableau secrétariat…</div>
      ) : daySections.length === 0 ? (
        <div style={emptyStateStyle}>Aucune journée pour ce show.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {daySections.map(({ day, classRows }) => (
            <section key={day.id} style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{day.label || "Journée"}</h2>
                  <div style={metaStyle}>
                    {day.date || "Date non définie"} · {classRows.length} classe(s)
                  </div>
                </div>
                <Link
                  to={`/associations/${associationId}/shows/${showId}/days/${day.id}`}
                  style={linkButtonStyle}
                >
                  Ouvrir classes
                </Link>
              </div>

              {classRows.length === 0 ? (
                <div style={softEmptyStyle}>Aucune classe pour cette journée.</div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Classe</th>
                        <th style={thStyle}>Setup</th>
                        <th style={thStyle}>Scoring</th>
                        <th style={thStyle}>Officiel</th>
                        <th style={thStyle}>PDF officiel</th>
                        <th style={thStyle}>Publication</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classRows.map((classData) => (
                        <ClassRow
                          key={classData.classItem?.id}
                          associationId={associationId}
                          classData={classData}
                          onDownloadOfficialPdf={handleDownloadOfficialPdf}
                          onValidateOfficial={handleValidateOfficial}
                          onPublish={handlePublish}
                          onUnpublish={handleUnpublish}
                          canManage={access.canManageAssociation}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassRow({
  associationId,
  classData,
  onDownloadOfficialPdf,
  onValidateOfficial,
  onPublish,
  onUnpublish,
  canManage,
}) {
  const classItem = classData.classItem;
  const setup = classData.setup;
  const official = classData.official;
  const publication = classData.publication;
  const scoringRuns = classData.scoringRuns || [];
  const classId = classItem?.id;
  const finalPdfFileName = getOfficialPdfFileName(classData);
  const hasOfficialPdf = Boolean(finalPdfFileName);
  const isSigned = Boolean(official?.isFinalized);
  const isValidated = Boolean(official?.isSecretariatValidated);
  const officialPdfReady = isValidated && hasOfficialPdf;

  const setupReady = Boolean((setup?.pattern || classItem?.pattern) && setup?.runs?.length);
  const scoringStarted = scoringRuns.some((run) => {
    const scores = Array.isArray(run?.scores) ? run.scores : [];
    const penalties = Array.isArray(run?.penalties) ? run.penalties : [];
    return (
      run?.isActive ||
      scores.some((value) => String(value || "").trim()) ||
      penalties.some((value) => String(value || "").trim())
    );
  });

  return (
    <tr>
      <td style={tdStyle}>
        <div style={classNameStyle}>
          {classItem?.name || "Classe sans nom"}
          {classItem?.classCode ? ` (${classItem.classCode})` : ""}
        </div>
        <div style={metaStyle}>Pattern {setup?.pattern || classItem?.pattern || "—"}</div>
      </td>
      <td style={tdStyle}>
        <Badge tone={setupReady ? "success" : "muted"}>
          {setupReady ? `${setup.runs.length} run(s)` : "À compléter"}
        </Badge>
      </td>
      <td style={tdStyle}>
        <Badge tone={scoringStarted ? "warn" : "muted"}>
          {scoringStarted ? "En cours" : "Pas commencé"}
        </Badge>
      </td>
      <td style={tdStyle}>
        <Badge tone={isValidated ? "success" : isSigned ? "warn" : "muted"}>
          {isValidated
            ? "Validée"
            : isSigned
              ? "Signée, à valider"
              : getClassStatusLabel(classData.status)}
        </Badge>
        {official?.secretariatValidatedAt && (
          <div style={metaStyle}>
            Validée {formatDateTime(official.secretariatValidatedAt)}
          </div>
        )}
      </td>
      <td style={tdStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <Badge tone={officialPdfReady ? "success" : isSigned ? "warn" : "muted"}>
            {officialPdfReady
              ? "Généré"
              : isSigned && !isValidated
                ? "Validation requise"
                : "À générer"}
          </Badge>
          {officialPdfReady && finalPdfFileName && (
            <div style={fileNameStyle} title={finalPdfFileName}>
              {finalPdfFileName}
            </div>
          )}
        </div>
      </td>
      <td style={tdStyle}>
        <Badge tone={publication?.status === "published" ? "success" : "muted"}>
          {publication?.status || "hidden"}
        </Badge>
      </td>
      <td style={tdStyle}>
        <div style={actionRowStyle}>
          <Link
            to={`/associations/${associationId}/classes/${classId}/setup`}
            style={smallLinkButtonStyle}
          >
            Setup
          </Link>
          <Link
            to={`/associations/${associationId}/scribe/classes/${classId}`}
            style={smallLinkButtonStyle}
          >
            Scoring
          </Link>
          {canManage && (
            <>
              {isSigned && !isValidated && (
                <button
                  type="button"
                  onClick={() => onValidateOfficial(classData)}
                  style={smallPrimaryButtonStyle}
                >
                  Valider officiel
                </button>
              )}
              <button
                type="button"
                onClick={() => onDownloadOfficialPdf(classData)}
                style={smallButtonStyle}
                disabled={!isValidated}
              >
                {officialPdfReady ? "Télécharger PDF" : "Générer PDF"}
              </button>
              {officialPdfReady && (
                <button
                  type="button"
                  onClick={() =>
                    onDownloadOfficialPdf(classData, { regenerateFileName: true })
                  }
                  style={smallButtonStyle}
                >
                  Régénérer
                </button>
              )}
              {publication?.status === "published" ? (
                <button
                  type="button"
                  onClick={() => onUnpublish(classId)}
                  style={smallButtonStyle}
                >
                  Masquer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPublish(classId)}
                  style={smallButtonStyle}
                  disabled={!isValidated || !officialPdfReady}
                >
                  Publier
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function SummaryTile({ label, value, tone = "default" }) {
  return (
    <div style={summaryTileStyle(tone)}>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summaryLabelStyle}>{label}</div>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

function buildSummary(classRows) {
  return classRows.reduce(
    (summary, classData) => {
      const status = classData.status;
      const publicationStatus = classData.publication?.status;
      const isSigned = Boolean(classData.official?.isFinalized);
      const isValidated = Boolean(classData.official?.isSecretariatValidated);

      summary.total += 1;
      if (status === "draft") summary.draft += 1;
      if (status === "ready") summary.ready += 1;
      if (status === "in_progress") summary.inProgress += 1;
      if (isSigned && !isValidated) summary.signed += 1;
      if (isValidated) summary.validated += 1;
      if (isValidated && getOfficialPdfFileName(classData)) summary.pdfReady += 1;
      if (publicationStatus === "published") summary.published += 1;
      return summary;
    },
    {
      total: 0,
      draft: 0,
      ready: 0,
      inProgress: 0,
      signed: 0,
      validated: 0,
      pdfReady: 0,
      published: 0,
    }
  );
}

function formatDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

const heroActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryTileStyle = (tone) => ({
  background: tone === "success" ? "#ecfdf5" : tone === "warn" ? "#fff7ed" : "#fff",
  border: `1px solid ${
    tone === "success" ? "#86efac" : tone === "warn" ? "#fdba74" : "#e2e8f0"
  }`,
  borderRadius: 8,
  padding: 14,
});

const summaryValueStyle = {
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const summaryLabelStyle = {
  color: "#64748b",
  marginTop: 4,
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

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 1080,
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  color: "#334155",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const classNameStyle = {
  fontWeight: 700,
};

const metaStyle = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 13,
};

const fileNameStyle = {
  color: "#64748b",
  fontSize: 12,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${
    tone === "success" ? "#86efac" : tone === "warn" ? "#fdba74" : "#cbd5e1"
  }`,
  background: tone === "success" ? "#ecfdf5" : tone === "warn" ? "#fff7ed" : "#f8fafc",
  color: tone === "success" ? "#166534" : tone === "warn" ? "#9a3412" : "#475569",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

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

const smallLinkButtonStyle = {
  ...linkButtonStyle,
  padding: "7px 10px",
};

const smallButtonStyle = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const smallPrimaryButtonStyle = {
  ...smallButtonStyle,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
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

export default SecretariatDashboardPage;

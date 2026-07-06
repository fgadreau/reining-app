import React, { useEffect, useState } from "react";
import {
  formatChampionshipPoints,
  toNumber,
} from "../features/championship/championshipPoints";

function ChampionshipOccurrenceModal({ occurrence, onClose, t }) {
  const isCompactLayout = useCompactModalViewport(Boolean(occurrence));

  useEffect(() => {
    if (!occurrence) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [occurrence, onClose]);

  if (!occurrence) return null;

  const { classEntry, event, teamKey } = occurrence;
  const results = getOccurrenceResults(classEntry, event);
  const sourceClass = formatClassLabel(event?.classCode, event?.className);
  const sourceFiles = formatSourceFiles(results, t);
  const goLabel = formatGoLabel(event, t);
  const entriesLabel = formatEntriesLabel(event, results, t);
  const layoutStyles = isCompactLayout ? compactLayoutStyles : regularLayoutStyles;

  return (
    <div
      style={layoutStyles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="championship-occurrence-title"
      onClick={onClose}
    >
      <div
        style={layoutStyles.modal}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <div style={layoutStyles.header}>
          <div style={headerTextStyle}>
            <div style={layoutStyles.eyebrow}>
              {t("championship.occurrence.title")}
            </div>
            <h2 id="championship-occurrence-title" style={layoutStyles.title}>
              {event?.label || event?.showName || event?.showNum || "-"}
            </h2>
            <div style={layoutStyles.subtitle}>{classEntry?.name || "-"}</div>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            {t("championship.occurrence.close")}
          </button>
        </div>

        <div style={layoutStyles.metaGrid}>
          <MetaItem label={t("championship.occurrence.show")} value={event?.showName || event?.showNum || "-"} />
          <MetaItem label={t("championship.occurrence.sourceClass")} value={sourceClass} />
          <MetaItem label={t("championship.occurrence.go")} value={goLabel} />
          <MetaItem label={t("championship.occurrence.entries")} value={entriesLabel} />
          <MetaItem label={t("championship.occurrence.source")} value={sourceFiles} />
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>{t("championship.occurrence.rank")}</th>
                <th style={thStyle}>{t("championship.occurrence.backNumber")}</th>
                <th style={leftThStyle}>{t("championship.occurrence.rider")}</th>
                <th style={leftThStyle}>{t("championship.occurrence.horse")}</th>
                <th style={thStyle}>{t("championship.occurrence.score")}</th>
                <th style={thStyle}>{t("championship.occurrence.points")}</th>
                <th style={leftThStyle}>{t("championship.occurrence.csvClass")}</th>
                <th style={leftThStyle}>{t("championship.occurrence.sourceRow")}</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? (
                results.map((result, index) => (
                  <tr
                    key={buildResultKey(result, index)}
                    style={result.teamKey && result.teamKey === teamKey ? selectedRowStyle : null}
                  >
                    <td style={tdStyle}>{formatValue(result.rawPlaceNum, result.placeNum)}</td>
                    <td style={tdStyle}>{result.backNumber || "-"}</td>
                    <td style={nameTdStyle}>{result.rider || "-"}</td>
                    <td style={nameTdStyle}>{result.horse || "-"}</td>
                    <td style={tdStyle}>
                      {formatValue(result.rawTotalScore, result.totalScore)}
                    </td>
                    <td style={strongTdStyle}>
                      {formatChampionshipPoints(result.points)}
                    </td>
                    <td style={sourceClassTdStyle}>
                      {formatClassLabel(result.classCode, result.className)}
                    </td>
                    <td style={sourceTdStyle}>{formatSourceRow(result, t)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={emptyTdStyle} colSpan={8}>
                    {t("championship.occurrence.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function useCompactModalViewport(isOpen) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      setIsCompact(false);
      return undefined;
    }

    const update = () => {
      setIsCompact(window.innerHeight <= 520 && window.innerWidth > window.innerHeight);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [isOpen]);

  return isCompact;
}

function MetaItem({ label, value }) {
  return (
    <div style={metaItemStyle}>
      <div style={metaLabelStyle}>{label}</div>
      <div style={metaValueStyle}>{value || "-"}</div>
    </div>
  );
}

function getOccurrenceResults(classEntry, event) {
  const eventResults = Array.isArray(event?.results) ? event.results : [];

  if (eventResults.length > 0) {
    return eventResults.slice().sort(compareOccurrenceResults);
  }

  const teams = Array.isArray(classEntry?.teams) ? classEntry.teams : [];
  return teams
    .flatMap((team) =>
      (Array.isArray(team.details) ? team.details : [])
        .filter((detail) => detail.eventKey === event?.eventKey)
        .map((detail) => ({
          ...detail,
          teamKey: team.teamKey,
          rider: team.rider,
          horse: team.horse,
          championshipClassName: classEntry?.name || "",
        }))
    )
    .sort(compareOccurrenceResults);
}

function compareOccurrenceResults(a, b) {
  const aPlace = toNumber(a.placeNum);
  const bPlace = toNumber(b.placeNum);
  const aHasPlace = aPlace > 0;
  const bHasPlace = bPlace > 0;

  if (aHasPlace && bHasPlace && aPlace !== bPlace) return aPlace - bPlace;
  if (aHasPlace !== bHasPlace) return aHasPlace ? -1 : 1;

  const scoreDiff = toNumber(b.totalScore) - toNumber(a.totalScore);
  if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

  return (
    toNumber(a.sourceRowNumber) - toNumber(b.sourceRowNumber) ||
    `${a.rider} ${a.horse}`.localeCompare(`${b.rider} ${b.horse}`)
  );
}

function formatClassLabel(code, name) {
  return [code, name].filter(Boolean).join(" · ") || "-";
}

function formatValue(rawValue, numericValue) {
  const rawText = String(rawValue ?? "").trim();
  if (rawText) return rawText;

  if (numericValue === 0 || numericValue) {
    return String(numericValue);
  }

  return "-";
}

function formatGoLabel(event, t) {
  const type = String(event?.goType || "").trim();
  const number = String(event?.goNum || "").trim();

  if (type && number) {
    return t("championship.occurrence.goLabel", { type, number });
  }

  if (type) return t("championship.occurrence.goTypeLabel", { type });
  if (number) return t("championship.occurrence.goNumberLabel", { number });

  return "-";
}

function formatEntriesLabel(event, results, t) {
  const sample = results[0] || {};
  const shown = formatValue(sample.rawShownCount, sample.shownCount);
  const entries = formatValue(sample.rawEntryCount, sample.entryCount);

  if (shown !== "-" || entries !== "-") {
    return t("championship.occurrence.entriesSummary", {
      shown,
      entries,
    });
  }

  return t("championship.occurrence.resultCount", {
    count: event?.resultCount || results.length || 0,
  });
}

function formatSourceFiles(results, t) {
  const uniqueFiles = Array.from(
    new Set(results.map((result) => result.sourceFileName).filter(Boolean))
  );

  if (uniqueFiles.length === 0) return "-";
  if (uniqueFiles.length <= 2) return uniqueFiles.join(", ");

  return t("championship.occurrence.sourceFilesSummary", {
    first: uniqueFiles[0],
    count: uniqueFiles.length - 1,
  });
}

function formatSourceRow(result, t) {
  const file = result.sourceFileName || "";
  const row = result.sourceRowNumber || "";

  if (file && row) {
    return t("championship.occurrence.rowSource", { file, row });
  }

  if (file) return file;
  if (row) return t("championship.occurrence.rowSourceNumber", { row });

  return "-";
}

function buildResultKey(result, index) {
  return [
    result.sourceImportId,
    result.sourceFileName,
    result.sourceRowNumber,
    result.teamKey,
    index,
  ]
    .filter(Boolean)
    .join("-");
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const compactBackdropStyle = {
  ...backdropStyle,
  padding: 6,
};

const modalStyle = {
  width: "min(1120px, 100%)",
  maxHeight: "calc(100dvh - 32px)",
  background: "#fff",
  borderRadius: 8,
  border: "1px solid #dbe3ef",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.24)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const compactModalStyle = {
  ...modalStyle,
  width: "calc(100vw - 12px)",
  height: "calc(100dvh - 12px)",
  maxHeight: "calc(100dvh - 12px)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  padding: "18px 18px 12px",
  borderBottom: "1px solid #e2e8f0",
};

const compactHeaderStyle = {
  ...headerStyle,
  gap: 8,
  padding: "7px 10px",
  alignItems: "center",
};

const headerTextStyle = {
  minWidth: 0,
};

const eyebrowStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const compactEyebrowStyle = {
  ...eyebrowStyle,
  display: "none",
};

const titleStyle = {
  margin: "3px 0",
  color: "#0f172a",
  fontSize: 24,
  lineHeight: 1.16,
};

const compactTitleStyle = {
  ...titleStyle,
  margin: 0,
  fontSize: 16,
  lineHeight: 1.12,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subtitleStyle = {
  color: "#475569",
  fontSize: 14,
  fontWeight: 800,
};

const compactSubtitleStyle = {
  ...subtitleStyle,
  marginTop: 2,
  fontSize: 11,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const closeButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  padding: "8px 11px",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
};

const metaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
  padding: "12px 18px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const compactMetaGridStyle = {
  ...metaGridStyle,
  display: "flex",
  gap: 8,
  padding: "6px 10px",
  overflowX: "auto",
  flex: "0 0 auto",
};

const metaItemStyle = {
  minWidth: 0,
  flex: "0 0 min(190px, 62vw)",
};

const metaLabelStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const metaValueStyle = {
  marginTop: 2,
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.25,
  wordBreak: "break-word",
};

const tableWrapStyle = {
  overflow: "auto",
  flex: "1 1 auto",
  minHeight: 0,
  WebkitOverflowScrolling: "touch",
};

const tableStyle = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const thStyle = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderBottom: "1px solid #cbd5e1",
  borderRight: "1px solid #e2e8f0",
  background: "#f1f5f9",
  color: "#0f172a",
  padding: "9px 8px",
  textAlign: "center",
  fontSize: 12,
  fontWeight: 900,
};

const leftThStyle = {
  ...thStyle,
  textAlign: "left",
};

const tdStyle = {
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  padding: "9px 8px",
  color: "#0f172a",
  textAlign: "center",
  verticalAlign: "top",
  fontSize: 13,
};

const nameTdStyle = {
  ...tdStyle,
  textAlign: "left",
  fontWeight: 850,
  minWidth: 140,
};

const strongTdStyle = {
  ...tdStyle,
  fontWeight: 950,
};

const sourceClassTdStyle = {
  ...tdStyle,
  textAlign: "left",
  minWidth: 180,
  color: "#334155",
};

const sourceTdStyle = {
  ...tdStyle,
  textAlign: "left",
  minWidth: 150,
  color: "#475569",
  fontSize: 12,
};

const selectedRowStyle = {
  background: "#ecfeff",
};

const emptyTdStyle = {
  ...tdStyle,
  padding: 18,
  color: "#64748b",
  fontWeight: 800,
};

const regularLayoutStyles = {
  backdrop: backdropStyle,
  modal: modalStyle,
  header: headerStyle,
  eyebrow: eyebrowStyle,
  title: titleStyle,
  subtitle: subtitleStyle,
  metaGrid: metaGridStyle,
};

const compactLayoutStyles = {
  backdrop: compactBackdropStyle,
  modal: compactModalStyle,
  header: compactHeaderStyle,
  eyebrow: compactEyebrowStyle,
  title: compactTitleStyle,
  subtitle: compactSubtitleStyle,
  metaGrid: compactMetaGridStyle,
};

export default ChampionshipOccurrenceModal;

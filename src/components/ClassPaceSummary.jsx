import React from "react";
import { formatDuration } from "../features/classes/classTiming";
import { useTranslation } from "../features/i18n/I18nProvider";

export default function ClassPaceSummary({ pace }) {
  const { t, language } = useTranslation();
  const ridersPerHour = Number(pace?.ridersPerHour);
  const averageSecondsPerRiderWithDrags = Number(
    pace?.averageSecondsPerRiderWithDrags
  );
  const completedRuns = Number.parseInt(pace?.completedRuns, 10);
  const runCount = Number.parseInt(pace?.runCount, 10);
  const remainingDragBreaks = Number.parseInt(pace?.remainingDragBreaks, 10);
  const hasPace = Number.isFinite(ridersPerHour) && ridersPerHour > 0;
  const hasAverage =
    Number.isFinite(averageSecondsPerRiderWithDrags) &&
    averageSecondsPerRiderWithDrags > 0;
  const hasProgress = Number.isFinite(runCount) && runCount > 0;

  if (!pace && !hasPace && !hasProgress) return null;

  return (
    <div style={paceGridStyle}>
      <PaceMetric
        label={t("management.livePace.ridersPerHourLabel")}
        value={
          hasPace
            ? t("management.livePace.ridersPerHour", {
                value: formatPaceNumber(ridersPerHour, language),
              })
            : t("management.livePace.paceUnavailable")
        }
        strong={hasPace}
      />
      <PaceMetric
        label={t("management.livePace.progressLabel")}
        value={
          hasProgress
            ? t("management.livePace.progress", {
                completed: Number.isFinite(completedRuns) ? completedRuns : 0,
                total: runCount,
              })
            : "—"
        }
      />
      <PaceMetric
        label={t("management.livePace.averageWithDragsLabel")}
        value={
          hasAverage
            ? t("management.livePace.averageWithDrags", {
                duration: formatDuration(averageSecondsPerRiderWithDrags),
              })
            : "—"
        }
      />
      <PaceMetric
        label={t("management.livePace.remainingDragsLabel")}
        value={Number.isFinite(remainingDragBreaks) ? remainingDragBreaks : "—"}
      />
    </div>
  );
}

function PaceMetric({ label, value, strong = false }) {
  return (
    <div style={paceMetricStyle}>
      <div style={paceMetricLabelStyle}>{label}</div>
      <div style={strong ? paceMetricStrongValueStyle : paceMetricValueStyle}>
        {value}
      </div>
    </div>
  );
}

function formatPaceNumber(value, language) {
  return new Intl.NumberFormat(language === "en" ? "en-CA" : "fr-CA", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  }).format(value);
}

const paceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
  marginTop: 12,
};

const paceMetricStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#f8fafc",
  minWidth: 0,
};

const paceMetricLabelStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const paceMetricValueStyle = {
  color: "#334155",
  fontSize: 15,
  fontWeight: 800,
  marginTop: 3,
};

const paceMetricStrongValueStyle = {
  ...paceMetricValueStyle,
  color: "#0f766e",
  fontSize: 18,
  fontWeight: 900,
};

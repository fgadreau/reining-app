import React, { useEffect, useMemo, useState } from "react";
import {
  APP_EVENT_TYPES,
  buildAnalyticsSummary,
  loadAppEventsRepository,
} from "../../features/analytics/analyticsRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function PlatformAnalyticsPage() {
  const { t } = useTranslation();
  const access = useAssociationAccess(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const canViewAnalytics =
    !access.isConfigured || access.isLocalTestUser || access.isPlatformAdmin;

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      if (access.isLoadingAccess || !canViewAnalytics) {
        return;
      }

      setIsLoading(true);
      const nextEvents = await loadAppEventsRepository({ limit: 1000 });

      if (!isMounted) return;
      setEvents(nextEvents);
      setIsLoading(false);
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [access.isLoadingAccess, canViewAnalytics]);

  const summary = useMemo(() => buildAnalyticsSummary(events), [events]);
  const recentEvents = events.slice(0, 25);

  if (access.isLoadingAccess) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("analytics.loading")}</div>
      </div>
    );
  }

  if (!canViewAnalytics) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("analytics.accessDenied")}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("analytics.loading")}</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{t("analytics.eyebrow")}</div>
          <h1 style={titleStyle}>{t("analytics.title")}</h1>
        </div>
      </div>

      <div style={metricGridStyle}>
        <Metric label={t("analytics.pageViews")} value={summary.pageViewCount} />
        <Metric
          label={t("analytics.uniqueVisitors")}
          value={summary.uniqueVisitorCount}
        />
        <Metric
          label={t("analytics.publicViews")}
          value={summary.publicPageViewCount}
        />
        <Metric
          label={t("analytics.auditEvents")}
          value={summary.auditEventCount}
        />
        <Metric
          label={t("analytics.accountEvents")}
          value={summary.accountEventCount}
        />
      </div>

      <div style={twoColumnStyle}>
        <TopList title={t("analytics.topPages")} items={summary.topPages} />
        <TopList title={t("analytics.topEvents")} items={summary.topEvents} />
      </div>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>{t("analytics.recentEvents")}</h2>
        {recentEvents.length === 0 ? (
          <div style={mutedTextStyle}>{t("analytics.empty")}</div>
        ) : (
          <EventTable events={recentEvents} />
        )}
      </section>
    </div>
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

function TopList({ title, items }) {
  const { t } = useTranslation();

  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {items.length === 0 ? (
        <div style={mutedTextStyle}>{t("analytics.empty")}</div>
      ) : (
        <div style={listStyle}>
          {items.map((item) => (
            <div key={item.label} style={listRowStyle}>
              <span style={truncateStyle}>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EventTable({ events }) {
  const { t } = useTranslation();

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>{t("analytics.when")}</th>
            <th style={thStyle}>{t("analytics.type")}</th>
            <th style={thStyle}>{t("analytics.event")}</th>
            <th style={thStyle}>{t("analytics.actor")}</th>
            <th style={thStyle}>{t("analytics.path")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id || `${event.eventName}-${event.createdAt}`}>
              <td style={tdStyle}>{formatDate(event.createdAt)}</td>
              <td style={tdStyle}>
                {event.eventType === APP_EVENT_TYPES.AUDIT
                  ? t("analytics.audit")
                  : t("analytics.analytics")}
              </td>
              <td style={tdStyle}>{humanizeEventName(event.eventName)}</td>
              <td style={tdStyle}>{event.actorEmail || "-"}</td>
              <td style={tdStyle}>{event.path || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function humanizeEventName(eventName) {
  return String(eventName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("fr-CA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0 0",
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const metricStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const metricLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: 0,
};

const metricValueStyle = {
  marginTop: 6,
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 30,
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const mutedTextStyle = {
  color: "#64748b",
};

const listStyle = {
  display: "grid",
  gap: 8,
};

const listRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: 8,
};

const truncateStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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
  borderBottom: "1px solid #cbd5e1",
  padding: "8px 10px",
  color: "#475569",
  whiteSpace: "nowrap",
};

const tdStyle = {
  borderBottom: "1px solid #e2e8f0",
  padding: "8px 10px",
  verticalAlign: "top",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

export default PlatformAnalyticsPage;

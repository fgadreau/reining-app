import React, { useEffect, useMemo, useState } from "react";
import {
  APP_EVENT_TYPES,
  buildAnalyticsSummary,
  loadAppEventsRepository,
} from "../../features/analytics/analyticsRepository";
import {
  buildAnalyticsEventLabelResolver,
  enrichAnalyticsEventLabels,
  resolveAnalyticsLabel,
} from "../../features/analytics/analyticsEventLabels";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const RANGE_OPTIONS = ["7", "30", "90", "all"];
const EVENT_FILTERS = ["all", APP_EVENT_TYPES.ANALYTICS, APP_EVENT_TYPES.AUDIT];
const AUDIENCE_FILTERS = ["all", "public", "management", "scribe"];

function PlatformAnalyticsPage() {
  const { t } = useTranslation();
  const access = useAssociationAccess(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState("30");
  const [eventFilter, setEventFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [labelResolver, setLabelResolver] = useState(null);
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
      const nextLabelResolver =
        await buildAnalyticsEventLabelResolver(nextEvents);

      if (!isMounted) return;
      setLabelResolver(nextLabelResolver);
      setEvents(
        nextEvents.map((event) =>
          enrichAnalyticsEventLabels(event, nextLabelResolver)
        )
      );
      setIsLoading(false);
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [access.isLoadingAccess, canViewAnalytics, refreshTick]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) =>
        eventMatchesFilters(event, {
          audienceFilter,
          eventFilter,
          rangeDays,
          searchQuery,
        })
      ),
    [audienceFilter, eventFilter, events, rangeDays, searchQuery]
  );
  const summary = useMemo(
    () => buildAnalyticsSummary(filteredEvents),
    [filteredEvents]
  );
  const recentEvents = filteredEvents.slice(0, 75);
  const maxDailyActivity = Math.max(
    ...summary.dailyActivity.map((day) => day.total),
    1
  );

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
          <div style={subtitleStyle}>
            {t("analytics.subtitle", {
              count: filteredEvents.length,
              total: events.length,
            })}
          </div>
        </div>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => setRefreshTick((value) => value + 1)}
        >
          {t("analytics.refresh")}
        </button>
      </div>

      <section style={filterPanelStyle}>
        <FilterSelect
          label={t("analytics.period")}
          value={rangeDays}
          onChange={setRangeDays}
          options={RANGE_OPTIONS.map((value) => ({
            value,
            label: t(`analytics.periodOptions.${value}`),
          }))}
        />
        <FilterSelect
          label={t("analytics.eventType")}
          value={eventFilter}
          onChange={setEventFilter}
          options={EVENT_FILTERS.map((value) => ({
            value,
            label: t(`analytics.eventTypeOptions.${value}`),
          }))}
        />
        <FilterSelect
          label={t("analytics.audience")}
          value={audienceFilter}
          onChange={setAudienceFilter}
          options={AUDIENCE_FILTERS.map((value) => ({
            value,
            label: t(`analytics.audienceOptions.${value}`),
          }))}
        />
        <label style={searchLabelStyle}>
          <span>{t("analytics.search")}</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("analytics.searchPlaceholder")}
            style={searchInputStyle}
          />
        </label>
      </section>

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
          label={t("analytics.managementViews")}
          value={summary.managementPageViewCount}
        />
        <Metric
          label={t("analytics.scribeViews")}
          value={summary.scribePageViewCount}
        />
        <Metric
          label={t("analytics.auditEvents")}
          value={summary.auditEventCount}
        />
        <Metric
          label={t("analytics.accountEvents")}
          value={summary.accountEventCount}
        />
        <Metric
          label={t("analytics.latestEvent")}
          value={formatDate(summary.latestEventAt)}
          compact
        />
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t("analytics.activityTrend")}</h2>
          <span style={mutedTextStyle}>{t("analytics.last14Days")}</span>
        </div>
        <div style={trendGridStyle}>
          {summary.dailyActivity.map((day) => (
            <TrendBar
              key={day.date}
              day={day}
              maxValue={maxDailyActivity}
            />
          ))}
        </div>
      </section>

      <div style={twoColumnStyle}>
        <TopList
          title={t("analytics.pageCategories")}
          items={summary.pageCategories}
          getLabel={(label) => translatePageCategory(label, t)}
          total={summary.pageViewCount}
        />
        <TopList
          title={t("analytics.topEvents")}
          items={summary.topEvents}
          getLabel={humanizeEventName}
          total={summary.totalEvents}
        />
      </div>

      <div style={threeColumnStyle}>
        <TopList
          title={t("analytics.topAssociations")}
          items={summary.topAssociations}
          getLabel={(label) =>
            resolveAnalyticsLabel("association", label, labelResolver)
          }
          total={summary.totalEvents}
        />
        <TopList
          title={t("analytics.topShows")}
          items={summary.topShows}
          getLabel={(label) =>
            resolveAnalyticsLabel("show", label, labelResolver)
          }
          total={summary.totalEvents}
        />
        <TopList
          title={t("analytics.topClasses")}
          items={summary.topClasses}
          getLabel={(label) =>
            resolveAnalyticsLabel("class", label, labelResolver)
          }
          total={summary.totalEvents}
        />
      </div>

      <div style={twoColumnStyle}>
        <TopList
          title={t("analytics.topPages")}
          items={summary.topPages}
          total={summary.pageViewCount}
        />
        <TopList
          title={t("analytics.deviceUsage")}
          items={summary.deviceTypes}
          getLabel={(label) => t(`analytics.deviceTypes.${label}`)}
          total={summary.pageViewCount}
        />
        <TopList
          title={t("analytics.technicalContext")}
          items={[...summary.topLocales, ...summary.topTimezones]}
          total={summary.totalEvents}
        />
      </div>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t("analytics.recentEvents")}</h2>
          <span style={mutedTextStyle}>
            {t("analytics.showingEvents", { count: recentEvents.length })}
          </span>
        </div>
        {recentEvents.length === 0 ? (
          <div style={mutedTextStyle}>{t("analytics.empty")}</div>
        ) : (
          <EventTable events={recentEvents} />
        )}
      </section>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={filterLabelStyle}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={selectStyle}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, compact = false }) {
  return (
    <div style={metricStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={compact ? metricCompactValueStyle : metricValueStyle}>
        {value || "-"}
      </div>
    </div>
  );
}

function TopList({ title, items, getLabel = (label) => label, total = 0 }) {
  const { t } = useTranslation();
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <section style={cardStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {items.length === 0 ? (
        <div style={mutedTextStyle}>{t("analytics.empty")}</div>
      ) : (
        <div style={listStyle}>
          {items.map((item) => (
            <div key={item.label} style={listRowWrapStyle}>
              <div style={listRowStyle}>
                <span style={truncateStyle}>{getLabel(item.label)}</span>
                <strong>{item.count}</strong>
              </div>
              <div style={barTrackStyle}>
                <div
                  style={{
                    ...barFillStyle,
                    width: `${Math.max((item.count / maxCount) * 100, 4)}%`,
                  }}
                />
              </div>
              {total > 0 && (
                <div style={smallMutedTextStyle}>
                  {Math.round((item.count / total) * 100)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TrendBar({ day, maxValue }) {
  const { t } = useTranslation();
  const height = Math.max((day.total / maxValue) * 100, day.total > 0 ? 8 : 0);

  return (
    <div style={trendItemStyle} title={`${day.date}: ${day.total}`}>
      <div style={trendBarWrapStyle}>
        <div
          style={{
            ...trendBarStyle,
            height: `${height}%`,
          }}
        />
      </div>
      <div style={trendLabelStyle}>{formatShortDate(day.date)}</div>
      <div style={trendCountStyle}>{day.total}</div>
      <div style={trendMetaStyle}>
        {t("analytics.trendMeta", {
          views: day.pageViews,
          actions: day.auditEvents,
        })}
      </div>
    </div>
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
            <th style={thStyle}>{t("analytics.audience")}</th>
            <th style={thStyle}>{t("analytics.event")}</th>
            <th style={thStyle}>{t("analytics.actor")}</th>
            <th style={thStyle}>{t("analytics.context")}</th>
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
              <td style={tdStyle}>
                {t(`analytics.audienceOptions.${getEventAudience(event)}`)}
              </td>
              <td style={tdStyle}>{humanizeEventName(event.eventName)}</td>
              <td style={tdStyle}>{event.actorEmail || "-"}</td>
              <td style={tdStyle}>{formatEventContext(event, t)}</td>
              <td style={tdStyle}>{event.path || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function eventMatchesFilters(event, filters) {
  if (!isEventInRange(event, filters.rangeDays)) {
    return false;
  }

  if (
    filters.eventFilter !== "all" &&
    event.eventType !== filters.eventFilter
  ) {
    return false;
  }

  if (
    filters.audienceFilter !== "all" &&
    getEventAudience(event) !== filters.audienceFilter
  ) {
    return false;
  }

  return eventMatchesSearch(event, filters.searchQuery);
}

function isEventInRange(event, rangeDays) {
  if (rangeDays === "all") return true;
  if (!event.createdAt) return false;

  const eventDate = new Date(event.createdAt);
  if (Number.isNaN(eventDate.getTime())) return false;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - Number(rangeDays));
  return eventDate >= threshold;
}

function eventMatchesSearch(event, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    event.eventName,
    event.actorEmail,
    event.path,
    event.associationId,
    event.showId,
    event.dayId,
    event.classId,
    event.resolvedLabels?.association,
    event.resolvedLabels?.show,
    event.resolvedLabels?.day,
    event.resolvedLabels?.class,
    event.locale,
    event.timezone,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function getEventAudience(event) {
  if (event.metadata?.isPublicPath === true || event.path.startsWith("/public")) {
    return "public";
  }

  if (
    event.metadata?.pageCategory === "scribe_class" ||
    event.path.includes("/scribe/")
  ) {
    return "scribe";
  }

  return "management";
}

function formatEventContext(event, t) {
  const labels = event.resolvedLabels || {};
  const parts = [
    (event.associationId || labels.association) &&
      `${t("analytics.association")}: ${
        labels.association || event.associationId
      }`,
    (event.showId || labels.show) &&
      `${t("analytics.show")}: ${labels.show || event.showId}`,
    (event.dayId || labels.day) &&
      `${t("analytics.day")}: ${labels.day || event.dayId}`,
    (event.classId || labels.class) &&
      `${t("analytics.class")}: ${labels.class || event.classId}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "-";
}

function translatePageCategory(label, t) {
  const translationKey = `analytics.pageCategoriesMap.${label}`;
  const translated = t(translationKey);
  return translated === translationKey ? humanizeEventName(label) : translated;
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

function formatShortDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("fr-CA", {
      month: "short",
      day: "numeric",
    }).format(new Date(`${value}T00:00:00`));
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

const subtitleStyle = {
  color: "#475569",
  marginTop: 6,
};

const filterPanelStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const filterLabelStyle = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};

const searchLabelStyle = {
  ...filterLabelStyle,
  minWidth: 220,
};

const selectStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
};

const searchInputStyle = {
  ...selectStyle,
  width: "100%",
};

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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

const metricCompactValueStyle = {
  marginTop: 8,
  color: "#0f172a",
  fontWeight: 850,
  fontSize: 16,
  lineHeight: 1.25,
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const threeColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const mutedTextStyle = {
  color: "#64748b",
};

const smallMutedTextStyle = {
  color: "#64748b",
  fontSize: 12,
};

const listStyle = {
  display: "grid",
  gap: 10,
};

const listRowWrapStyle = {
  display: "grid",
  gap: 5,
};

const listRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const truncateStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barTrackStyle = {
  height: 5,
  background: "#e2e8f0",
  borderRadius: 999,
  overflow: "hidden",
};

const barFillStyle = {
  height: "100%",
  background: "#2563eb",
  borderRadius: 999,
};

const trendGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(14, minmax(44px, 1fr))",
  gap: 10,
  overflowX: "auto",
  paddingBottom: 2,
};

const trendItemStyle = {
  display: "grid",
  gridTemplateRows: "96px auto auto auto",
  gap: 4,
  minWidth: 44,
  color: "#334155",
  textAlign: "center",
};

const trendBarWrapStyle = {
  height: 96,
  background: "#f1f5f9",
  borderRadius: 8,
  display: "flex",
  alignItems: "flex-end",
  overflow: "hidden",
};

const trendBarStyle = {
  width: "100%",
  background: "#0f766e",
};

const trendLabelStyle = {
  fontSize: 11,
  color: "#64748b",
};

const trendCountStyle = {
  fontSize: 16,
  color: "#0f172a",
  fontWeight: 900,
};

const trendMetaStyle = {
  fontSize: 10,
  color: "#64748b",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 980,
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

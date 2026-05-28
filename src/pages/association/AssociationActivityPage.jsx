import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  APP_EVENT_TYPES,
  loadAppEventsRepository,
} from "../../features/analytics/analyticsRepository";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function AssociationActivityPage() {
  const { associationId } = useParams();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [association, setAssociation] = useState(null);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadActivity() {
      if (access.isLoadingAccess || !access.canManageAssociation) {
        return;
      }

      setIsLoading(true);
      const [nextAssociation, nextEvents] = await Promise.all([
        getAssociationRepository(associationId),
        loadAppEventsRepository({
          associationId,
          eventType: APP_EVENT_TYPES.AUDIT,
          limit: 300,
        }),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setEvents(nextEvents);
      setIsLoading(false);
    }

    loadActivity();

    return () => {
      isMounted = false;
    };
  }, [access.canManageAssociation, access.isLoadingAccess, associationId]);

  if (access.isLoadingAccess) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("activity.loading")}</div>
      </div>
    );
  }

  if (!access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("activity.accessDenied")}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>{t("activity.loading")}</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{t("activity.eyebrow")}</div>
          <h1 style={titleStyle}>{t("activity.title")}</h1>
          <div style={mutedTextStyle}>
            {association?.name || t("common.association")}
          </div>
        </div>
      </div>

      <section style={cardStyle}>
        {events.length === 0 ? (
          <div style={mutedTextStyle}>{t("activity.empty")}</div>
        ) : (
          <div style={timelineStyle}>
            {events.map((event) => (
              <article
                key={event.id || `${event.eventName}-${event.createdAt}`}
                style={timelineItemStyle}
              >
                <div style={timelineHeaderStyle}>
                  <strong>{humanizeEventName(event.eventName)}</strong>
                  <span style={mutedTextStyle}>{formatDate(event.createdAt)}</span>
                </div>
                <div style={detailGridStyle}>
                  <Detail label={t("activity.actor")} value={event.actorEmail} />
                  <Detail label={t("activity.show")} value={event.showId} />
                  <Detail label={t("activity.class")} value={event.classId} />
                  <Detail
                    label={t("activity.details")}
                    value={formatMetadata(event.metadata)}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={detailLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value || "-"}</div>
    </div>
  );
}

function humanizeEventName(eventName) {
  return String(eventName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadata(metadata) {
  const entries = Object.entries(metadata || {}).filter(
    ([key, value]) => key !== "viewport" && value != null && value !== ""
  );

  if (entries.length === 0) {
    return "";
  }

  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
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
  margin: "4px 0",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const mutedTextStyle = {
  color: "#64748b",
};

const timelineStyle = {
  display: "grid",
  gap: 12,
};

const timelineItemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const timelineHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const detailGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const detailLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: 0,
};

const detailValueStyle = {
  marginTop: 4,
  color: "#111827",
  overflowWrap: "anywhere",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

export default AssociationActivityPage;

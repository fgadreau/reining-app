import { getSupabaseClient } from "../cloud/supabaseClient";

const STORAGE_KEY = "showscore_app_events_v1";
const SESSION_KEY = "showscore_analytics_session_id";
const MAX_LOCAL_EVENTS = 500;

export const APP_EVENT_TYPES = {
  ANALYTICS: "analytics",
  AUDIT: "audit",
};

function createEventId(prefix = "event") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getAnalyticsSessionId() {
  if (typeof localStorage === "undefined") {
    return createEventId("session");
  }

  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const nextSessionId = createEventId("session");
  localStorage.setItem(SESSION_KEY, nextSessionId);
  return nextSessionId;
}

function getBrowserMetadata() {
  if (typeof window === "undefined") {
    return {
      path: "",
      userAgent: "",
      timezone: "",
      viewport: null,
      deviceType: "unknown",
    };
  }

  const userAgent = window.navigator?.userAgent || "";
  const viewport = {
    width: window.innerWidth || null,
    height: window.innerHeight || null,
  };

  return {
    path: `${window.location.pathname}${window.location.search}`,
    userAgent,
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "",
    viewport,
    deviceType: getAnalyticsDeviceType({ userAgent, viewport }),
  };
}

function normalizeEvent(row) {
  return {
    id: row.id,
    eventType: row.event_type || row.eventType || APP_EVENT_TYPES.ANALYTICS,
    eventName: row.event_name || row.eventName || "",
    associationId: row.association_id || row.associationId || "",
    showId: row.show_id || row.showId || "",
    dayId: row.day_id || row.dayId || "",
    classId: row.class_id || row.classId || "",
    sessionId: row.session_id || row.sessionId || "",
    actorUserId: row.actor_user_id || row.actorUserId || "",
    actorEmail: row.actor_email || row.actorEmail || "",
    path: row.path || "",
    userAgent: row.user_agent || row.userAgent || "",
    locale: row.locale || "",
    timezone: row.timezone || "",
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt: row.created_at || row.createdAt || "",
  };
}

function readLocalEvents() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeEvent) : [];
  } catch (error) {
    console.error("Erreur lecture analytics locaux:", error);
    return [];
  }
}

function saveLocalEvents(events) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(0, MAX_LOCAL_EVENTS))
    );
  } catch (error) {
    console.error("Erreur sauvegarde analytics locaux:", error);
  }
}

function saveLocalEvent(event) {
  const localEvent = normalizeEvent({
    ...event,
    id: event.id || createEventId(),
    createdAt: event.createdAt || new Date().toISOString(),
  });
  saveLocalEvents([localEvent, ...readLocalEvents()]);
  return localEvent;
}

export async function trackEvent({
  eventName,
  eventType = APP_EVENT_TYPES.ANALYTICS,
  associationId = "",
  showId = "",
  dayId = "",
  classId = "",
  path = "",
  locale = "",
  metadata = {},
} = {}) {
  const normalizedEventName = String(eventName || "").trim().toLowerCase();

  if (!normalizedEventName) {
    return null;
  }

  const browserMetadata = getBrowserMetadata();
  const sessionId = getAnalyticsSessionId();
  const safeMetadata =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata
      : {};
  const payload = {
    eventType,
    eventName: normalizedEventName,
    associationId,
    showId,
    dayId,
    classId,
    sessionId,
    path: path || browserMetadata.path,
    userAgent: browserMetadata.userAgent,
    locale:
      locale ||
      (typeof document !== "undefined" ? document.documentElement.lang : ""),
    timezone: browserMetadata.timezone,
    metadata: {
      ...safeMetadata,
      viewport: browserMetadata.viewport,
      deviceType: browserMetadata.deviceType,
    },
  };
  const supabase = getSupabaseClient();

  if (!supabase) {
    return saveLocalEvent(payload);
  }

  try {
    const { data, error } = await supabase.rpc("record_app_event", {
      target_event_type: payload.eventType,
      target_event_name: payload.eventName,
      target_association_id: payload.associationId || null,
      target_show_id: payload.showId || null,
      target_day_id: payload.dayId || null,
      target_class_id: payload.classId || null,
      target_session_id: payload.sessionId || null,
      target_path: payload.path || null,
      target_user_agent: payload.userAgent || null,
      target_locale: payload.locale || null,
      target_timezone: payload.timezone || null,
      target_metadata: payload.metadata,
    });

    if (error) throw error;

    return {
      ...payload,
      id: data || "",
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Analytics non enregistré dans Supabase:", error?.message || error);
    return saveLocalEvent(payload);
  }
}

export async function loadAppEventsRepository({
  associationId = "",
  eventType = "",
  limit = 200,
} = {}) {
  const supabase = getSupabaseClient();
  const normalizedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

  if (!supabase) {
    return readLocalEvents()
      .filter((event) => !associationId || event.associationId === associationId)
      .filter((event) => !eventType || event.eventType === eventType)
      .slice(0, normalizedLimit);
  }

  try {
    let query = supabase
      .from("app_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(normalizedLimit);

    if (associationId) {
      query = query.eq("association_id", associationId);
    }

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return Array.isArray(data) ? data.map(normalizeEvent) : [];
  } catch (error) {
    console.error("Erreur chargement analytics:", error);
    return readLocalEvents()
      .filter((event) => !associationId || event.associationId === associationId)
      .filter((event) => !eventType || event.eventType === eventType)
      .slice(0, normalizedLimit);
  }
}

function countBy(items, getKey) {
  const counts = new Map();

  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function getAnalyticsDeviceType(eventOrMetadata = {}) {
  const metadata = eventOrMetadata.metadata || eventOrMetadata || {};
  const explicitType = String(metadata.deviceType || "")
    .trim()
    .toLowerCase();

  if (["desktop", "mobile", "tablet"].includes(explicitType)) {
    return explicitType;
  }

  const userAgent = String(
    eventOrMetadata.userAgent || metadata.userAgent || ""
  ).toLowerCase();
  const viewport = metadata.viewport || eventOrMetadata.viewport || null;
  const width = Number(viewport?.width);

  if (/ipad|tablet|playbook|silk/.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|blackberry|phone/.test(userAgent)) {
    return "mobile";
  }
  if (/android/.test(userAgent)) return "tablet";
  if (width > 0) return width < 768 ? "mobile" : "desktop";
  if (userAgent) return "desktop";

  return "unknown";
}

function getEventDate(event) {
  if (!event.createdAt) return null;
  const date = new Date(event.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyActivity(events, dayCount = 14) {
  const safeDayCount = Math.min(Math.max(Number(dayCount) || 14, 1), 60);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];

  for (let index = safeDayCount - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    buckets.push({
      date: formatDateKey(date),
      total: 0,
      pageViews: 0,
      publicViews: 0,
      auditEvents: 0,
    });
  }

  const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));

  events.forEach((event) => {
    const date = getEventDate(event);
    if (!date) return;

    const key = formatDateKey(date);
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    bucket.total += 1;

    if (
      event.eventType === APP_EVENT_TYPES.ANALYTICS &&
      event.eventName === "page_view"
    ) {
      bucket.pageViews += 1;
      if (event.metadata?.isPublicPath === true || event.path.startsWith("/public")) {
        bucket.publicViews += 1;
      }
    }

    if (event.eventType === APP_EVENT_TYPES.AUDIT) {
      bucket.auditEvents += 1;
    }
  });

  return buckets;
}

export function buildAnalyticsSummary(events) {
  const safeEvents = Array.isArray(events) ? events.map(normalizeEvent) : [];
  const pageViews = safeEvents.filter(
    (event) =>
      event.eventType === APP_EVENT_TYPES.ANALYTICS &&
      event.eventName === "page_view"
  );
  const auditEvents = safeEvents.filter(
    (event) => event.eventType === APP_EVENT_TYPES.AUDIT
  );
  const uniqueVisitors = new Set(
    pageViews.map((event) => event.sessionId).filter(Boolean)
  );
  const publicPageViews = pageViews.filter(
    (event) => event.metadata?.isPublicPath === true || event.path.startsWith("/public")
  );
  const scribePageViews = pageViews.filter(
    (event) =>
      event.metadata?.pageCategory === "scribe_class" ||
      event.path.includes("/scribe/")
  );
  const managementPageViews = pageViews.filter(
    (event) =>
      !publicPageViews.includes(event) &&
      !scribePageViews.includes(event)
  );
  const authenticatedPageViews = pageViews.filter(
    (event) => event.metadata?.isAuthenticated === true
  );
  const publicVisitors = new Set(
    publicPageViews.map((event) => event.sessionId).filter(Boolean)
  );
  const authenticatedVisitors = new Set(
    authenticatedPageViews.map((event) => event.sessionId).filter(Boolean)
  );
  const accountEvents = auditEvents.filter((event) =>
    event.eventName.startsWith("auth_")
  );
  const latestEventDate = safeEvents
    .map(getEventDate)
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    totalEvents: safeEvents.length,
    pageViewCount: pageViews.length,
    publicPageViewCount: publicPageViews.length,
    managementPageViewCount: managementPageViews.length,
    scribePageViewCount: scribePageViews.length,
    uniqueVisitorCount: uniqueVisitors.size,
    publicVisitorCount: publicVisitors.size,
    authenticatedVisitorCount: authenticatedVisitors.size,
    auditEventCount: auditEvents.length,
    accountEventCount: accountEvents.length,
    latestEventAt: latestEventDate ? latestEventDate.toISOString() : "",
    topPages: countBy(pageViews, (event) => event.path).slice(0, 8),
    topEvents: countBy(safeEvents, (event) => event.eventName).slice(0, 8),
    topAssociations: countBy(safeEvents, (event) => event.associationId).slice(0, 8),
    topShows: countBy(safeEvents, (event) => event.showId).slice(0, 8),
    topClasses: countBy(safeEvents, (event) => event.classId).slice(0, 8),
    pageCategories: countBy(
      pageViews,
      (event) => event.metadata?.pageCategory || "unknown"
    ),
    deviceTypes: countBy(pageViews, getAnalyticsDeviceType),
    eventTypes: countBy(safeEvents, (event) => event.eventType),
    topLocales: countBy(safeEvents, (event) => event.locale).slice(0, 6),
    topTimezones: countBy(safeEvents, (event) => event.timezone).slice(0, 6),
    dailyActivity: buildDailyActivity(safeEvents),
  };
}

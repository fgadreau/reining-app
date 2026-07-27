import { getSupabaseClient } from "../cloud/supabaseClient";

export const CHAMPIONSHIP_UPDATE_SUBSCRIPTION_FUNCTION =
  "championship-update-subscription";
export const CHAMPIONSHIP_UPDATE_CAMPAIGN_FUNCTION =
  "send-championship-update-campaign";

const SUBSCRIBERS_TABLE = "show_score_championship_update_subscribers";

export function normalizeChampionshipUpdateSubscribers(value) {
  return (Array.isArray(value) ? value : [])
    .map((row) => ({
      id: String(row?.id || "").trim(),
      name: String(row?.name || "").trim(),
      email: String(row?.email || "").trim().toLowerCase(),
      language: String(row?.language || "fr").trim().toLowerCase(),
      status:
        String(row?.status || "").trim().toLowerCase() === "subscribed"
          ? "subscribed"
          : "unsubscribed",
      subscribedAt: row?.subscribed_at || row?.subscribedAt || null,
      unsubscribedAt: row?.unsubscribed_at || row?.unsubscribedAt || null,
    }))
    .filter((subscriber) => subscriber.id && isValidEmail(subscriber.email))
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "subscribed" ? -1 : 1;
      }

      return (
        Date.parse(right.subscribedAt || "") -
        Date.parse(left.subscribedAt || "")
      );
    });
}

export function buildChampionshipUpdateSubscribersCsv(value) {
  const subscribers = normalizeChampionshipUpdateSubscribers(value);
  const header = [
    "name",
    "email",
    "language",
    "status",
    "subscribed_at",
    "unsubscribed_at",
  ];
  const rows = subscribers.map((subscriber) => [
    subscriber.name,
    subscriber.email,
    subscriber.language,
    subscriber.status,
    subscriber.subscribedAt || "",
    subscriber.unsubscribedAt || "",
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

export function validateChampionshipUpdateSubscriptionForm(form = {}) {
  const errors = {};

  if (!isValidEmail(form.email)) {
    errors.email = "email";
  }

  if (!form.consentAccepted) {
    errors.consentAccepted = "required";
  }

  return errors;
}

export function validateChampionshipUpdateCampaignForm(form = {}) {
  const errors = {};

  if (!String(form.subject || "").trim()) {
    errors.subject = "required";
  }

  if (!String(form.message || "").trim()) {
    errors.message = "required";
  }

  if (form.mode === "test" && !isValidEmail(form.testEmail)) {
    errors.testEmail = "email";
  }

  return errors;
}

export async function subscribeChampionshipUpdatesRepository({
  associationId = "",
  association = null,
  season = null,
  form = {},
  language = "fr",
  sourceUrl = "",
} = {}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  try {
    const response = await supabase.functions.invoke(
      CHAMPIONSHIP_UPDATE_SUBSCRIPTION_FUNCTION,
      {
        body: {
          action: "subscribe",
          organizationId: String(associationId || association?.id || "").trim(),
          organizationName: association?.shortName || association?.name || "",
          seasonId: season?.id || "",
          seasonTitle: season?.title || "",
          seasonYear: season?.year || "",
          name: String(form.name || "").trim(),
          email: String(form.email || "").trim().toLowerCase(),
          language,
          consentAccepted: Boolean(form.consentAccepted),
          consentSource: "public_championship_page",
          sourceUrl: String(sourceUrl || "").trim(),
          website: String(form.website || "").trim(),
        },
      }
    );

    if (response.error) throw response.error;

    return {
      ok: true,
      data: response.data || null,
    };
  } catch (error) {
    console.error("Erreur inscription updates championnat:", error);
    return {
      ok: false,
      reason: "send_failed",
      error,
    };
  }
}

export async function unsubscribeChampionshipUpdatesRepository({
  associationId = "",
  token = "",
} = {}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  try {
    const response = await supabase.functions.invoke(
      CHAMPIONSHIP_UPDATE_SUBSCRIPTION_FUNCTION,
      {
        body: {
          action: "unsubscribe",
          organizationId: String(associationId || "").trim(),
          token: String(token || "").trim(),
        },
      }
    );

    if (response.error) throw response.error;

    return {
      ok: true,
      data: response.data || null,
    };
  } catch (error) {
    console.error("Erreur desinscription updates championnat:", error);
    return {
      ok: false,
      reason: "send_failed",
      error,
    };
  }
}

export async function getChampionshipUpdateSubscriberSummaryRepository(
  associationId
) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      ok: false,
      reason: "supabase_unavailable",
      activeCount: 0,
      totalCount: 0,
      subscribers: [],
    };
  }

  try {
    const { data, error } = await supabase
      .from(SUBSCRIBERS_TABLE)
      .select(
        "id, name, email, language, status, subscribed_at, unsubscribed_at"
      )
      .eq("organization_id", associationId);

    if (error) throw error;

    const subscribers = normalizeChampionshipUpdateSubscribers(data);

    return {
      ok: true,
      activeCount: subscribers.filter(
        (subscriber) => subscriber.status === "subscribed"
      ).length,
      totalCount: subscribers.length,
      subscribers,
    };
  } catch (error) {
    console.error("Erreur chargement abonnes championnat:", error);
    return {
      ok: false,
      reason: "load_failed",
      error,
      activeCount: 0,
      totalCount: 0,
      subscribers: [],
    };
  }
}

export async function sendChampionshipUpdateCampaignRepository({
  associationId = "",
  association = null,
  season = null,
  publicUrl = "",
  form = {},
  mode = "campaign",
} = {}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, reason: "supabase_unavailable" };
  }

  try {
    const response = await supabase.functions.invoke(
      CHAMPIONSHIP_UPDATE_CAMPAIGN_FUNCTION,
      {
        body: {
          mode,
          organizationId: String(associationId || association?.id || "").trim(),
          organizationName: association?.shortName || association?.name || "",
          season: {
            id: season?.id || "",
            title: season?.title || "",
            year: season?.year || "",
            status: season?.status || "",
            updatedAt: season?.updatedAt || season?.importedAt || "",
          },
          publicUrl: String(publicUrl || "").trim(),
          subject: String(form.subject || "").trim(),
          message: String(form.message || "").trim(),
          testEmail: String(form.testEmail || "").trim().toLowerCase(),
        },
      }
    );

    if (response.error) throw response.error;

    return {
      ok: true,
      data: response.data || null,
    };
  } catch (error) {
    console.error("Erreur envoi update championnat:", error);
    return {
      ok: false,
      reason: "send_failed",
      error,
    };
  }
}

export function buildDefaultChampionshipUpdateCampaignForm({
  seasonTitle = "",
  seasonYear = "",
  t,
  language = "fr",
  date = new Date(),
} = {}) {
  const month = formatCampaignMonth(date, language);
  const title = String(seasonTitle || "").trim();
  const year = String(seasonYear || "").trim();

  return {
    subject: t("championship.updates.defaultSubject", { month }),
    message: t("championship.updates.defaultMessage", {
      month,
      season: [title, year].filter(Boolean).join(" "),
    }),
    testEmail: "",
  };
}

function formatCampaignMonth(date, language = "fr") {
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-CA" : "fr-CA", {
      month: "long",
    }).format(date);
  } catch (error) {
    return "";
  }
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  const spreadsheetSafeText = /^[=+\-@]/.test(text) ? `'${text}` : text;

  return `"${spreadsheetSafeText.replace(/"/g, '""')}"`;
}

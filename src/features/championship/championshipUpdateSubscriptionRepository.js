import { getSupabaseClient } from "../cloud/supabaseClient";

export const CHAMPIONSHIP_UPDATE_SUBSCRIPTION_FUNCTION =
  "championship-update-subscription";
export const CHAMPIONSHIP_UPDATE_CAMPAIGN_FUNCTION =
  "send-championship-update-campaign";

const SUBSCRIBERS_TABLE = "show_score_championship_update_subscribers";

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
    };
  }

  try {
    const { data, error } = await supabase
      .from(SUBSCRIBERS_TABLE)
      .select("id, status")
      .eq("organization_id", associationId);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    return {
      ok: true,
      activeCount: rows.filter((row) => row.status === "subscribed").length,
      totalCount: rows.length,
    };
  } catch (error) {
    console.error("Erreur chargement abonnes championnat:", error);
    return {
      ok: false,
      reason: "load_failed",
      error,
      activeCount: 0,
      totalCount: 0,
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

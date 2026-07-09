import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN_SECRET =
  Deno.env.get("CHAMPIONSHIP_UPDATES_TOKEN_SECRET") ||
  SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL =
  Deno.env.get("CHAMPIONSHIP_UPDATES_FROM_EMAIL") || "updates@showscore.app";

const SUBSCRIBERS_TABLE = "show_score_championship_update_subscribers";
const CAMPAIGNS_TABLE = "show_score_championship_update_campaigns";
const DELIVERIES_TABLE = "show_score_championship_update_deliveries";
const STAFF_ROLES = ["admin", "secretary"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json();
    const validationError = validatePayload(payload);

    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const supabase = createServiceClient();
    const user = await resolveAuthorizedUser(supabase, request);
    await assertCanSendCampaign(supabase, user.id, payload.organizationId);

    const association = await resolveAssociation(supabase, payload.organizationId);
    const mode = payload.mode === "test" ? "test" : "campaign";
    const recipients =
      mode === "test"
        ? [buildTestRecipient(payload.testEmail)]
        : await loadActiveSubscribers(supabase, payload.organizationId);

    if (!recipients.length) {
      return jsonResponse({ error: "Aucun abonne actif." }, 400);
    }

    const campaign = await createCampaign(supabase, {
      payload,
      mode,
      userId: user.id,
      recipientCount: recipients.length,
    });
    const deliveryRows = [];
    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      try {
        const unsubscribeUrl =
          mode === "campaign"
            ? await buildAndStoreUnsubscribeUrl(
                supabase,
                recipient,
                payload.publicUrl
              )
            : "";
        const email = buildCampaignEmail({
          payload,
          association,
          recipient,
          unsubscribeUrl,
          mode,
        });
        const resendResult = await sendResendEmail(email);

        successCount += 1;
        deliveryRows.push({
          campaign_id: campaign.id,
          subscriber_id: recipient.id || null,
          email: recipient.email,
          status: "sent",
          resend_id: resendResult.id ?? null,
          sent_at: new Date().toISOString(),
        });
      } catch (error) {
        failureCount += 1;
        const message =
          error instanceof Error ? error.message : "Erreur envoi email";
        console.error("Unable to send championship update:", {
          email: recipient.email,
          message,
        });
        deliveryRows.push({
          campaign_id: campaign.id,
          subscriber_id: recipient.id || null,
          email: recipient.email,
          status: "failed",
          error_message: sanitizeText(message),
          sent_at: new Date().toISOString(),
        });
      }
    }

    if (deliveryRows.length) {
      const { error: deliveryError } = await supabase
        .from(DELIVERIES_TABLE)
        .insert(deliveryRows);

      if (deliveryError) throw deliveryError;
    }

    await updateCampaignResult(supabase, campaign.id, {
      successCount,
      failureCount,
    });

    return jsonResponse(
      {
        ok: true,
        mode,
        recipientCount: recipients.length,
        successCount,
        failureCount,
      },
      200
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erreur envoi update championnat";
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      Number.isFinite(Number(error.status))
        ? Number(error.status)
        : 500;

    console.error("send-championship-update-campaign error:", error);
    return jsonResponse(
      { error: message },
      status
    );
  }
});

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TOKEN_SECRET) {
    throw new Error("Configuration Supabase manquante.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveAuthorizedUser(supabase, request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!jwt) {
    throw httpError("Authentification requise.", 401);
  }

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.id) {
    throw httpError("Authentification invalide.", 401);
  }

  return data.user;
}

async function assertCanSendCampaign(
  supabase,
  userId: string,
  organizationId: string
) {
  const membershipChecks = [
    {
      table: "organization_members",
      organizationColumn: "organization_id",
    },
    {
      table: "association_memberships",
      organizationColumn: "association_id",
    },
  ];

  for (const check of membershipChecks) {
    const { data, error } = await supabase
      .from(check.table)
      .select("role")
      .eq(check.organizationColumn, organizationId)
      .eq("user_id", userId)
      .in("role", STAFF_ROLES)
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      return;
    }
  }

  throw httpError("Acces refuse pour cette association.", 403);
}

async function resolveAssociation(supabase, organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, short_name")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw error;
  return data || { id: organizationId, name: "", short_name: "" };
}

async function loadActiveSubscribers(supabase, organizationId: string) {
  const { data, error } = await supabase
    .from(SUBSCRIBERS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "subscribed")
    .order("subscribed_at", { ascending: true });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((subscriber) => ({
      ...subscriber,
      email: normalizeEmail(subscriber.email),
      name: sanitizeText(subscriber.name),
      language: normalizeLanguage(subscriber.language),
    }))
    .filter((subscriber) => isValidEmail(subscriber.email));
}

async function createCampaign(
  supabase,
  { payload, mode, userId, recipientCount }
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .insert({
      organization_id: payload.organizationId,
      season_id: payload.season?.id || "",
      mode,
      subject: sanitizeText(payload.subject),
      message: sanitizeMultiline(payload.message),
      public_url: sanitizeText(payload.publicUrl),
      sent_by: userId,
      sent_at: now,
      recipient_count: recipientCount,
      success_count: 0,
      failure_count: 0,
      status: "sending",
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Impossible de creer la campagne.");

  return data;
}

async function updateCampaignResult(
  supabase,
  campaignId: string,
  { successCount, failureCount }
) {
  const status =
    failureCount === 0 ? "sent" : successCount > 0 ? "partial_failed" : "failed";
  const { error } = await supabase
    .from(CAMPAIGNS_TABLE)
    .update({
      status,
      success_count: successCount,
      failure_count: failureCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) throw error;
}

async function buildAndStoreUnsubscribeUrl(supabase, subscriber, publicUrl: string) {
  const token = await buildUnsubscribeToken(subscriber);
  const tokenHash = await hashToken(token);

  if (subscriber.unsubscribe_token_hash !== tokenHash) {
    const { error } = await supabase
      .from(SUBSCRIBERS_TABLE)
      .update({
        unsubscribe_token_hash: tokenHash,
        unsubscribe_token_issued_at: new Date().toISOString(),
      })
      .eq("id", subscriber.id);

    if (error) throw error;
  }

  return buildUnsubscribeUrl(publicUrl, token);
}

function buildTestRecipient(email: string) {
  return {
    id: "",
    email: normalizeEmail(email),
    name: "",
    language: "fr",
  };
}

async function sendResendEmail(email) {
  if (!RESEND_API_KEY) {
    throw new Error("Configuration Resend manquante.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(email),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Resend error:", data);
    throw new Error(data?.message || "Erreur envoi email");
  }

  return data;
}

function buildCampaignEmail({
  payload,
  association,
  recipient,
  unsubscribeUrl,
  mode,
}) {
  const associationName =
    sanitizeText(association?.short_name) ||
    sanitizeText(association?.name) ||
    sanitizeText(payload.organizationName) ||
    "Association";
  const subject = sanitizeText(payload.subject);
  const message = sanitizeMultiline(payload.message);
  const publicUrl = sanitizeText(payload.publicUrl);
  const greeting = recipient.name ? `Bonjour ${recipient.name},` : "Bonjour,";
  const seasonLabel = [
    sanitizeText(payload.season?.title),
    sanitizeText(payload.season?.year),
  ]
    .filter(Boolean)
    .join(" ");
  const testPrefix = mode === "test" ? "[TEST] " : "";
  const textLines = [
    `${greeting}`,
    "",
    message,
    "",
    seasonLabel ? `Championnat: ${seasonLabel}` : "",
    publicUrl ? `Voir le championnat: ${publicUrl}` : "",
    "",
    mode === "test"
      ? "Ceci est un courriel test envoye depuis ShowScore."
      : unsubscribeUrl
        ? `Desabonnement: ${unsubscribeUrl}`
        : "",
  ].filter((line) => line !== "");
  const htmlMessage = escapeHtml(message).replace(/\n/g, "<br />");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px 22px;color:#111827;">
      <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
      <div style="font-size:16px;line-height:1.55;margin-bottom:22px;">${htmlMessage}</div>
      ${
        seasonLabel
          ? `<p style="margin:0 0 14px;color:#4b5563;">${escapeHtml(seasonLabel)} - ${escapeHtml(associationName)}</p>`
          : `<p style="margin:0 0 14px;color:#4b5563;">${escapeHtml(associationName)}</p>`
      }
      ${
        publicUrl
          ? `<p style="margin:22px 0;"><a href="${escapeAttribute(publicUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 14px;border-radius:8px;font-weight:700;">Voir le championnat</a></p>`
          : ""
      }
      ${
        mode === "test"
          ? `<p style="margin-top:22px;color:#92400e;font-size:13px;">Courriel test envoye depuis ShowScore.</p>`
          : unsubscribeUrl
            ? `<p style="margin-top:28px;color:#6b7280;font-size:12px;line-height:1.45;">Vous recevez ce courriel parce que vous etes abonne aux mises a jour du championnat. <a href="${escapeAttribute(unsubscribeUrl)}" style="color:#6b7280;">Se desabonner</a></p>`
            : ""
      }
    </div>`;

  return {
    from: FROM_EMAIL,
    to: [recipient.email],
    subject: `${testPrefix}${subject}`,
    text: textLines.join("\n"),
    html,
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Payload invalide.";
  }

  const mode = payload.mode === "test" ? "test" : "campaign";
  const organizationId = String(payload.organizationId || "").trim();
  const subject = String(payload.subject || "").trim();
  const message = String(payload.message || "").trim();

  if (!organizationId) return "organizationId est requis.";
  if (!subject) return "subject est requis.";
  if (!message) return "message est requis.";
  if (mode === "test" && !isValidEmail(payload.testEmail)) {
    return "testEmail est invalide.";
  }

  return "";
}

async function buildUnsubscribeToken(subscriber) {
  const payload = JSON.stringify({
    v: 1,
    sid: subscriber.id,
    org: subscriber.organization_id,
  });
  const body = base64UrlEncodeText(payload);
  const signature = await signTokenBody(body);

  return `${body}.${signature}`;
}

async function signTokenBody(body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );

  return base64UrlEncodeBytes(new Uint8Array(digest));
}

function buildUnsubscribeUrl(publicUrl: string, token: string) {
  try {
    const url = new URL(publicUrl);
    url.searchParams.set("unsubscribe", token);
    return url.toString();
  } catch (error) {
    const separator = publicUrl.includes("?") ? "&" : "?";
    return `${publicUrl}${separator}unsubscribe=${encodeURIComponent(token)}`;
  }
}

function base64UrlEncodeText(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function httpError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLanguage(value: unknown) {
  const language = String(value || "").trim().toLowerCase().split("-")[0];
  return language === "en" ? "en" : "fr";
}

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function sanitizeMultiline(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

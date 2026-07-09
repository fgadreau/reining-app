import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN_SECRET =
  Deno.env.get("CHAMPIONSHIP_UPDATES_TOKEN_SECRET") ||
  SUPABASE_SERVICE_ROLE_KEY;
const SUBSCRIBERS_TABLE = "show_score_championship_update_subscribers";

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
    const action = String(payload?.action || "").trim();

    if (action === "subscribe") {
      return await subscribe(payload);
    }

    if (action === "unsubscribe") {
      return await unsubscribe(payload);
    }

    return jsonResponse({ error: "Action invalide." }, 400);
  } catch (error) {
    console.error("championship-update-subscription error:", error);
    return jsonResponse({ error: "Erreur abonnement championnat" }, 500);
  }
});

async function subscribe(payload) {
  const organizationId = String(payload.organizationId || "").trim();
  const email = normalizeEmail(payload.email);
  const name = sanitizeText(payload.name);
  const language = normalizeLanguage(payload.language);
  const consentAccepted = Boolean(payload.consentAccepted);
  const website = String(payload.website || "").trim();

  if (website) {
    return jsonResponse({ ok: true, ignored: true }, 200);
  }

  if (!organizationId) {
    return jsonResponse({ error: "organizationId est requis." }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ error: "email est invalide." }, 400);
  }

  if (!consentAccepted) {
    return jsonResponse({ error: "consentement requis." }, 400);
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const existing = await findSubscriber(supabase, organizationId, email);
  const consentText =
    "Abonnement aux mises a jour manuelles du championnat de l'association.";
  const rowPayload = {
    organization_id: organizationId,
    email,
    name,
    language,
    status: "subscribed",
    consent_source: sanitizeText(payload.consentSource) || "public_championship_page",
    consent_text: consentText,
    subscribed_at: now,
    unsubscribed_at: null,
    source_url: sanitizeText(payload.sourceUrl),
    updated_at: now,
  };

  const { data: subscriber, error } = existing
    ? await supabase
        .from(SUBSCRIBERS_TABLE)
        .update(rowPayload)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle()
    : await supabase
        .from(SUBSCRIBERS_TABLE)
        .insert({
          ...rowPayload,
          created_at: now,
        })
        .select("*")
        .maybeSingle();

  if (error) throw error;
  if (!subscriber) {
    return jsonResponse({ error: "Impossible d'enregistrer l'abonnement." }, 500);
  }

  const token = await buildUnsubscribeToken(subscriber);
  const tokenHash = await hashToken(token);
  const { error: tokenError } = await supabase
    .from(SUBSCRIBERS_TABLE)
    .update({
      unsubscribe_token_hash: tokenHash,
      unsubscribe_token_issued_at: now,
    })
    .eq("id", subscriber.id);

  if (tokenError) throw tokenError;

  return jsonResponse({ ok: true, status: "subscribed" }, 200);
}

async function unsubscribe(payload) {
  const token = String(payload.token || "").trim();
  const organizationId = String(payload.organizationId || "").trim();

  if (!token) {
    return jsonResponse({ error: "token est requis." }, 400);
  }

  const parsedToken = await parseVerifiedToken(token);
  if (!parsedToken?.sid || !parsedToken?.org) {
    return jsonResponse({ error: "Lien de desabonnement invalide." }, 400);
  }

  if (organizationId && organizationId !== parsedToken.org) {
    return jsonResponse({ error: "Lien de desabonnement invalide." }, 400);
  }

  const supabase = createServiceClient();
  const { data: subscriber, error } = await supabase
    .from(SUBSCRIBERS_TABLE)
    .select("*")
    .eq("id", parsedToken.sid)
    .eq("organization_id", parsedToken.org)
    .maybeSingle();

  if (error) throw error;
  if (!subscriber) {
    return jsonResponse({ error: "Abonnement introuvable." }, 404);
  }

  const tokenHash = await hashToken(token);
  if (
    subscriber.unsubscribe_token_hash &&
    subscriber.unsubscribe_token_hash !== tokenHash
  ) {
    return jsonResponse({ error: "Lien de desabonnement invalide." }, 400);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from(SUBSCRIBERS_TABLE)
    .update({
      status: "unsubscribed",
      unsubscribed_at: now,
      updated_at: now,
    })
    .eq("id", subscriber.id);

  if (updateError) throw updateError;

  return jsonResponse({ ok: true, status: "unsubscribed" }, 200);
}

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

async function findSubscriber(supabase, organizationId: string, email: string) {
  const { data, error } = await supabase
    .from(SUBSCRIBERS_TABLE)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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

async function parseVerifiedToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = await signTokenBody(body);
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecodeText(body));
    return parsed && parsed.v === 1 ? parsed : null;
  } catch (error) {
    return null;
  }
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

function base64UrlEncodeText(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeText(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return atob(padded);
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
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

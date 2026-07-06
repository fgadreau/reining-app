import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FALLBACK_RECIPIENTS = parseRecipientList(
  Deno.env.get("CHAMPIONSHIP_VERIFICATION_RECIPIENTS") ?? ""
);
const FROM_EMAIL = "noreply@showscore.app";

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
    const { association, recipients } = await resolveAssociationRecipients(
      supabase,
      payload.association.id
    );

    if (!recipients.length) {
      return jsonResponse(
        { error: "Aucun destinataire administratif trouve pour cette association." },
        400
      );
    }

    const email = buildVerificationEmail(payload, association, recipients);
    const resendResult = await sendResendEmail(email);

    return jsonResponse(
      { ok: true, id: resendResult.id ?? null, recipientCount: recipients.length },
      200
    );
  } catch (error) {
    console.error("send-championship-verification-request error:", error);
    return jsonResponse({ error: "Erreur envoi email" }, 500);
  }
});

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuration Supabase manquante.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveAssociationRecipients(supabase, associationId: string) {
  const { data: association, error: associationError } = await supabase
    .from("organizations")
    .select("id, name, short_name, primary_contact_email")
    .eq("id", associationId)
    .maybeSingle();

  if (associationError) throw associationError;
  if (!association) {
    throw new Error(`Association introuvable: ${associationId}`);
  }

  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select(
      "role, user_profiles!inner(user_id, display_name, first_name, last_name)"
    )
    .eq("organization_id", associationId)
    .in("role", STAFF_ROLES);

  if (membersError) throw membersError;

  const memberEmails: string[] = [];

  for (const member of members ?? []) {
    const profile = Array.isArray(member.user_profiles)
      ? member.user_profiles[0]
      : member.user_profiles;
    const authUserId = profile?.user_id;

    if (!authUserId) continue;

    const { data, error } = await supabase.auth.admin.getUserById(authUserId);
    if (error) {
      console.error("Unable to resolve admin email:", {
        authUserId,
        role: member.role,
        message: error.message,
      });
      continue;
    }

    const email = normalizeEmail(data?.user?.email);
    if (email) memberEmails.push(email);
  }

  const primaryContactEmail = normalizeEmail(association.primary_contact_email);
  const organizationRecipients = primaryContactEmail
    ? [...memberEmails, primaryContactEmail]
    : memberEmails;
  const recipients = dedupeEmails(
    organizationRecipients.length ? organizationRecipients : FALLBACK_RECIPIENTS
  );

  return {
    association,
    recipients,
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

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Payload invalide.";
  }

  const associationId = String(payload.association?.id || "").trim();
  const requesterName = String(payload.requester?.name || "").trim();
  const requesterEmail = normalizeEmail(payload.requester?.email);
  const request = payload.request || {};
  const className = String(request.className || request.classId || "").trim();
  const rider = String(request.rider || "").trim();
  const horse = String(request.horse || "").trim();
  const explanation = String(request.explanation || "").trim();
  const scope = String(request.scope || "").trim();

  if (!associationId) return "association.id est requis.";
  if (!requesterName) return "requester.name est requis.";
  if (!isValidEmail(requesterEmail)) return "requester.email est invalide.";
  if (!className) return "request.className est requis.";
  if (!rider) return "request.rider est requis.";
  if (!horse) return "request.horse est requis.";
  if (!explanation) return "request.explanation est requis.";
  if (scope && !["selected_shows", "season"].includes(scope)) {
    return "request.scope est invalide.";
  }

  return "";
}

function buildVerificationEmail(payload, association, recipients: string[]) {
  const associationName =
    sanitizeText(association?.short_name) ||
    sanitizeText(association?.name) ||
    sanitizeText(payload.association?.shortName) ||
    sanitizeText(payload.association?.name) ||
    "Association";
  const seasonLabel = [
    sanitizeText(payload.season?.title),
    sanitizeText(payload.season?.year),
  ]
    .filter(Boolean)
    .join(" - ");
  const request = payload.request || {};
  const requester = payload.requester || {};
  const scope =
    request.scope === "season" ? "Saison complete" : "Shows selectionnes";
  const selectedShows = Array.isArray(request.shows) ? request.shows : [];
  const standing = payload.currentStanding || null;
  const subjectParts = [
    "Demande de verification des points",
    associationName,
    seasonLabel,
  ].filter(Boolean);

  const text = [
    "Nouvelle demande de verification des points",
    "",
    `Association: ${associationName}`,
    seasonLabel ? `Championnat: ${seasonLabel}` : "",
    `Demandeur: ${sanitizeText(requester.name)}`,
    `Courriel: ${normalizeEmail(requester.email)}`,
    `Classe: ${sanitizeText(request.className || request.classId)}`,
    `Portee: ${scope}`,
    `Cavalier: ${sanitizeText(request.rider)}`,
    `Cheval: ${sanitizeText(request.horse)}`,
    "",
    "Shows concernes:",
    formatShowsText(selectedShows),
    "",
    "Explication:",
    sanitizeText(request.explanation),
    "",
    formatStandingText(standing),
    payload.championshipUrl
      ? `Lien championnat: ${sanitizeText(payload.championshipUrl)}`
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:28px 22px;color:#111827;">
      <h2 style="margin:0 0 8px;">Nouvelle demande de verification des points</h2>
      <p style="margin:0 0 18px;color:#4b5563;">${escapeHtml(associationName)}${seasonLabel ? ` - ${escapeHtml(seasonLabel)}` : ""}</p>
      ${htmlSection("Demandeur", [
        ["Nom", requester.name],
        ["Courriel", normalizeEmail(requester.email)],
      ])}
      ${htmlSection("Demande", [
        ["Classe", request.className || request.classId],
        ["Portee", scope],
        ["Cavalier", request.rider],
        ["Cheval", request.horse],
      ])}
      ${htmlShowsSection(selectedShows)}
      ${htmlTextBlock("Explication", request.explanation)}
      ${htmlStandingSection(standing)}
      ${
        payload.championshipUrl
          ? `<p style="margin-top:22px;"><a href="${escapeAttribute(payload.championshipUrl)}" style="color:#2563eb;">Ouvrir le championnat public</a></p>`
          : ""
      }
    </div>`;

  return {
    from: FROM_EMAIL,
    to: recipients,
    reply_to: normalizeEmail(requester.email),
    subject: subjectParts.join(" - "),
    text,
    html,
  };
}

function htmlSection(title: string, rows: [string, unknown][]) {
  const renderedRows = rows
    .map(([label, value]) => {
      const text = sanitizeText(value);
      return `
        <tr>
          <td style="padding:6px 10px;color:#6b7280;width:140px;">${escapeHtml(label)}</td>
          <td style="padding:6px 10px;font-weight:600;">${escapeHtml(text || "-")}</td>
        </tr>`;
    })
    .join("");

  return `
    <h3 style="margin:20px 0 8px;font-size:16px;">${escapeHtml(title)}</h3>
    <table style="border-collapse:collapse;width:100%;background:#f9fafb;border:1px solid #e5e7eb;">
      <tbody>${renderedRows}</tbody>
    </table>`;
}

function htmlShowsSection(shows) {
  if (!Array.isArray(shows) || !shows.length) {
    return htmlTextBlock("Shows concernes", "Saison complete ou aucun show specifique.");
  }

  const items = shows
    .map((show) => {
      const label =
        sanitizeText(show.label) ||
        sanitizeText(show.showName) ||
        sanitizeText(show.showNum) ||
        "Show";
      const detail = [
        sanitizeText(show.classCode),
        sanitizeText(show.goType) ? `Go ${sanitizeText(show.goType)}` : "",
        sanitizeText(show.goNum) ? `#${sanitizeText(show.goNum)}` : "",
      ]
        .filter(Boolean)
        .join(" - ");

      return `<li>${escapeHtml(label)}${detail ? ` <span style="color:#6b7280;">(${escapeHtml(detail)})</span>` : ""}</li>`;
    })
    .join("");

  return `
    <h3 style="margin:20px 0 8px;font-size:16px;">Shows concernes</h3>
    <ul style="margin:0;padding-left:22px;">${items}</ul>`;
}

function htmlTextBlock(title: string, value: unknown) {
  return `
    <h3 style="margin:20px 0 8px;font-size:16px;">${escapeHtml(title)}</h3>
    <p style="white-space:pre-wrap;margin:0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;">${escapeHtml(sanitizeText(value) || "-")}</p>`;
}

function htmlStandingSection(standing) {
  if (!standing) return "";

  const details = Array.isArray(standing.details) ? standing.details : [];
  const detailRows = details
    .map((detail) => {
      const eventLabel =
        sanitizeText(detail.eventLabel) ||
        sanitizeText(detail.showName) ||
        sanitizeText(detail.showNum) ||
        "-";
      return `
        <tr>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(eventLabel)}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(sanitizeText(detail.placeNum) || "-")}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(sanitizeText(detail.totalScore) || "-")}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;">${escapeHtml(sanitizeText(detail.points) || "-")}</td>
        </tr>`;
    })
    .join("");

  return `
    <h3 style="margin:20px 0 8px;font-size:16px;">Classement actuel</h3>
    <p style="margin:0 0 10px;">
      Rang ${escapeHtml(sanitizeText(standing.rank) || "-")} - ${escapeHtml(sanitizeText(standing.totalPoints) || "0")} pts - ${escapeHtml(sanitizeText(standing.totalMoney) || "$0.00")}
    </p>
    ${
      detailRows
        ? `<table style="border-collapse:collapse;width:100%;font-size:14px;">
            <thead>
              <tr>
                <th align="left" style="padding:6px 8px;">Show</th>
                <th align="left" style="padding:6px 8px;">Place</th>
                <th align="left" style="padding:6px 8px;">Score</th>
                <th align="left" style="padding:6px 8px;">Points</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>`
        : ""
    }`;
}

function formatShowsText(shows) {
  if (!Array.isArray(shows) || !shows.length) {
    return "- Saison complete ou aucun show specifique.";
  }

  return shows
    .map((show) => {
      const label =
        sanitizeText(show.label) ||
        sanitizeText(show.showName) ||
        sanitizeText(show.showNum) ||
        "Show";
      const classCode = sanitizeText(show.classCode);
      return `- ${label}${classCode ? ` (${classCode})` : ""}`;
    })
    .join("\n");
}

function formatStandingText(standing) {
  if (!standing) return "";

  const lines = [
    "Classement actuel:",
    `Rang: ${sanitizeText(standing.rank) || "-"}`,
    `Points: ${sanitizeText(standing.totalPoints) || "0"}`,
    `Gains: ${sanitizeText(standing.totalMoney) || "$0.00"}`,
  ];

  const details = Array.isArray(standing.details) ? standing.details : [];
  if (details.length) {
    lines.push(
      "Details:",
      ...details.map((detail) => {
        const label =
          sanitizeText(detail.eventLabel) ||
          sanitizeText(detail.showName) ||
          sanitizeText(detail.showNum) ||
          "Show";
        return `- ${label}: place ${sanitizeText(detail.placeNum) || "-"}, score ${sanitizeText(detail.totalScore) || "-"}, points ${sanitizeText(detail.points) || "-"}`;
      })
    );
  }

  return lines.join("\n");
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

function parseRecipientList(value: string) {
  return dedupeEmails(
    value
      .split(/[,\s;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function dedupeEmails(emails: string[]) {
  return Array.from(new Set(emails.map(normalizeEmail).filter(isValidEmail)));
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function escapeHtml(value: unknown) {
  return sanitizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

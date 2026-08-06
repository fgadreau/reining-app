import React, { useEffect, useMemo, useState } from "react";
import {
  configureLocalRelay,
  getLocalRelayState,
  startConfiguredLocalRelay,
  subscribeLocalRelay,
} from "../features/localRelay/localRelayClient";
import { getQueuedAnnouncerLiveMutations } from "../features/live/announcerLiveSyncQueue";

function LocalNetworkStatusPanel({ supabaseStatus, t }) {
  const [relay, setRelay] = useState(() => getLocalRelayState());
  const [relayUrl, setRelayUrl] = useState(relay.relayUrl);
  const [pairingCode, setPairingCode] = useState(relay.pairingCode);
  const [isExpanded, setIsExpanded] = useState(relay.enabled);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => getQueuedAnnouncerLiveMutations().length);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeLocalRelay(setRelay);
    startConfiguredLocalRelay();
    return unsubscribe;
  }, []);

  useEffect(() => {
    const refreshNetworkState = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", refreshNetworkState);
    window.addEventListener("offline", refreshNetworkState);
    return () => {
      window.removeEventListener("online", refreshNetworkState);
      window.removeEventListener("offline", refreshNetworkState);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPendingCount(getQueuedAnnouncerLiveMutations().length);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const overlayUrl = useMemo(
    () => relay.overlayUrls.find((url) => !url.includes("127.0.0.1")) || relay.overlayUrls[0] || "",
    [relay.overlayUrls]
  );
  const preferredTvUrls = useMemo(() => {
    if (!relay.tvUrls.length) return [];
    let preferredOrigin = "";
    try {
      preferredOrigin = new URL(overlayUrl).origin;
    } catch (error) {
      preferredOrigin = "";
    }
    const matching = preferredOrigin
      ? relay.tvUrls.filter((item) => {
          try {
            return new URL(item.url).origin === preferredOrigin;
          } catch (error) {
            return false;
          }
        })
      : [];
    return matching.length ? matching : relay.tvUrls;
  }, [overlayUrl, relay.tvUrls]);

  function enableRelay() {
    configureLocalRelay({ relayUrl, pairingCode, enabled: true });
    setIsExpanded(true);
  }

  function disableRelay() {
    configureLocalRelay({ relayUrl, pairingCode, enabled: false });
  }

  async function copyUrl(url, key) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(key);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!isExpanded && !relay.enabled) {
    return (
      <section style={collapsedStyle}>
        <div>
          <strong style={sectionTitleStyle}>{t("management.announcer.localRelayTitle")}</strong>
          <div style={helperStyle}>{t("management.announcer.localRelayIntro")}</div>
        </div>
        <button type="button" style={primaryButtonStyle} onClick={() => setIsExpanded(true)}>
          {t("management.announcer.localRelayEnable")}
        </button>
      </section>
    );
  }

  return (
    <section style={panelStyle} data-local-relay-status={relay.status}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{t("management.announcer.localRelayEyebrow")}</div>
          <h2 style={sectionTitleStyle}>{t("management.announcer.localRelayTitle")}</h2>
        </div>
        <StatusPill
          tone={relay.status === "connected" ? "success" : relay.status === "connecting" ? "warn" : "danger"}
          label={t(`management.announcer.localRelayStatus_${relay.status}`)}
        />
      </div>

      <div style={formGridStyle}>
        <label style={labelStyle}>
          {t("management.announcer.localRelayAddress")}
          <input
            value={relayUrl}
            onChange={(event) => setRelayUrl(event.target.value)}
            placeholder="ws://127.0.0.1:3000/ws/producer"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          {t("management.announcer.localRelayPairingCode")}
          <input
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={statusGridStyle}>
        <StatusCard label={t("management.announcer.localRelayConnection")} value={relay.status === "connected" ? t("management.announcer.connected") : t("management.announcer.disconnected")} />
        <StatusCard label={t("management.announcer.localRelayObs")} value={String(relay.overlayViewerCount)} />
        <StatusCard label={t("management.announcer.localRelayTv")} value={String(relay.tvViewerCount)} />
        <StatusCard label="Internet / Supabase" value={cloudStatusLabel({ isOnline, supabaseStatus, t })} />
        <StatusCard label={t("management.announcer.localRelayPending")} value={String(pendingCount)} />
      </div>

      {overlayUrl ? (
        <div style={urlRowStyle}>
          <code style={urlStyle}>{overlayUrl}</code>
          <button type="button" style={secondaryButtonStyle} onClick={() => void copyUrl(overlayUrl, "overlay")}>
            {copied === "overlay" ? t("management.announcer.localRelayCopied") : t("management.announcer.localRelayCopy")}
          </button>
        </div>
      ) : null}

      {preferredTvUrls.length ? (
        <div style={tvLinksStyle}>
          <strong style={tvLinksTitleStyle}>{t("management.announcer.localRelayTvLinks")}</strong>
          {preferredTvUrls.map((item) => {
            const key = `${item.kind}:${item.arena || "general"}`;
            return (
              <div key={key} style={urlRowStyle}>
                <span style={tvLinkLabelStyle}>{getTvLinkLabel(item, t)}</span>
                <code style={urlStyle}>{item.url}</code>
                <button type="button" style={secondaryButtonStyle} onClick={() => void copyUrl(item.url, key)}>
                  {copied === key ? t("management.announcer.localRelayCopied") : t("management.announcer.localRelayCopyGeneric")}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {relay.error ? <div style={errorStyle}>{relay.error}</div> : null}

      <div style={actionsStyle}>
        {relay.enabled ? (
          <>
            <button type="button" style={primaryButtonStyle} onClick={() => {
              configureLocalRelay({ relayUrl, pairingCode, enabled: true });
            }}>
              {t("management.announcer.localRelayReconnect")}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={disableRelay}>
              {t("management.announcer.localRelayDisable")}
            </button>
          </>
        ) : (
          <button type="button" style={primaryButtonStyle} disabled={pairingCode.length !== 6} onClick={enableRelay}>
            {t("management.announcer.localRelayEnable")}
          </button>
        )}
      </div>
      <div style={helperStyle}>{t("management.announcer.localRelayHelp")}</div>
    </section>
  );
}

function getTvLinkLabel(item, t) {
  if (item.kind === "competition") {
    return t("management.announcer.localRelayTvCompetition", { arena: item.arena });
  }
  if (item.kind === "arena") {
    return t("management.announcer.localRelayTvArena", { arena: item.arena });
  }
  if (item.kind === "standings") {
    return item.arena
      ? t("management.announcer.localRelayTvStandingsArena", { arena: item.arena })
      : t("management.announcer.localRelayTvStandings");
  }
  return t("management.announcer.localRelayTvGeneral");
}

function cloudStatusLabel({ isOnline, supabaseStatus, t }) {
  if (!isOnline) return t("management.announcer.offline");
  if (supabaseStatus === "SUBSCRIBED") return t("management.announcer.connected");
  if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED", "LOCAL"].includes(supabaseStatus)) {
    return t("management.announcer.disconnected");
  }
  return t("management.announcer.connecting");
}

function StatusPill({ label, tone }) {
  return <span style={{ ...pillStyle, ...pillTones[tone] }}>{label}</span>;
}

function StatusCard({ label, value }) {
  return <div style={statusCardStyle}><span style={statusLabelStyle}>{label}</span><strong style={statusValueStyle}>{value}</strong></div>;
}

const panelStyle = { margin: "18px 0 26px", padding: 20, border: "1px solid #99f6e4", borderRadius: 16, background: "linear-gradient(135deg, #f0fdfa, #f8fafc)" };
const collapsedStyle = { ...panelStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 };
const headerStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 18 };
const eyebrowStyle = { color: "#0f766e", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" };
const sectionTitleStyle = { display: "block", margin: "3px 0", color: "#0f172a", fontSize: 22, fontWeight: 900 };
const formGridStyle = { display: "grid", gridTemplateColumns: "minmax(280px, 2fr) minmax(160px, 1fr)", gap: 14 };
const labelStyle = { display: "grid", gap: 7, color: "#334155", fontSize: 13, fontWeight: 800 };
const inputStyle = { width: "100%", padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", color: "#0f172a", fontSize: 15 };
const statusGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, margin: "16px 0" };
const statusCardStyle = { padding: 12, border: "1px solid #ccfbf1", borderRadius: 10, background: "rgba(255,255,255,.86)" };
const statusLabelStyle = { display: "block", marginBottom: 5, color: "#64748b", fontSize: 11, fontWeight: 800, textTransform: "uppercase" };
const statusValueStyle = { color: "#0f172a", fontSize: 18 };
const urlRowStyle = { display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, background: "#0f172a" };
const urlStyle = { minWidth: 0, flex: 1, overflow: "hidden", color: "#5eead4", fontSize: 13, textOverflow: "ellipsis", whiteSpace: "nowrap" };
const tvLinksStyle = { display: "grid", gap: 8, marginTop: 14 };
const tvLinksTitleStyle = { color: "#0f172a", fontSize: 14 };
const tvLinkLabelStyle = { width: 180, flex: "0 0 auto", color: "#e2e8f0", fontSize: 12, fontWeight: 800 };
const actionsStyle = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 };
const primaryButtonStyle = { padding: "10px 15px", border: 0, borderRadius: 9, background: "#0f766e", color: "#fff", fontWeight: 850, cursor: "pointer" };
const secondaryButtonStyle = { padding: "9px 13px", border: "1px solid #94a3b8", borderRadius: 9, background: "#fff", color: "#0f172a", fontWeight: 800, cursor: "pointer" };
const helperStyle = { marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.45 };
const errorStyle = { marginTop: 12, color: "#b91c1c", fontSize: 13, fontWeight: 750 };
const pillStyle = { display: "inline-flex", padding: "7px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900 };
const pillTones = { success: { background: "#dcfce7", color: "#166534" }, warn: { background: "#fef3c7", color: "#92400e" }, danger: { background: "#fee2e2", color: "#991b1b" } };

export default LocalNetworkStatusPanel;

const STORAGE_KEY = "showscore_local_relay_v1";
const DEFAULT_RELAY_URL = "ws://127.0.0.1:3000/ws/producer";
const MAX_RECONNECT_DELAY_MS = 15_000;

const listeners = new Set();
let socket = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let latestSnapshot = null;
let connectionGeneration = 0;

let state = {
  enabled: false,
  status: "disabled",
  relayUrl: DEFAULT_RELAY_URL,
  pairingCode: "",
  producerId: "",
  lastVersion: "0",
  viewerCount: 0,
  overlayViewerCount: 0,
  tvViewerCount: 0,
  overlayUrls: [],
  tvUrls: [],
  lastAcknowledgedVersion: "0",
  error: "",
};

function hasWindow() {
  return typeof window !== "undefined";
}

function createProducerId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `producer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeRelayUrl(value) {
  const raw = String(value || DEFAULT_RELAY_URL).trim();

  try {
    const url = new URL(raw);
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";
    if (!new Set(["ws:", "wss:"]).has(url.protocol)) {
      return DEFAULT_RELAY_URL;
    }
    url.pathname = "/ws/producer";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch (error) {
    return DEFAULT_RELAY_URL;
  }
}

function loadSettings() {
  if (!hasWindow()) return state;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    state = {
      ...state,
      enabled: Boolean(parsed.enabled),
      relayUrl: normalizeRelayUrl(parsed.relayUrl),
      pairingCode: String(parsed.pairingCode || "").trim(),
      producerId: String(parsed.producerId || "") || createProducerId(),
      lastVersion: String(parsed.lastVersion || "0"),
      status: parsed.enabled ? "disconnected" : "disabled",
    };
  } catch (error) {
    state = { ...state, producerId: createProducerId() };
  }

  return state;
}

function saveSettings() {
  if (!hasWindow()) return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      enabled: state.enabled,
      relayUrl: state.relayUrl,
      pairingCode: state.pairingCode,
      producerId: state.producerId,
      lastVersion: state.lastVersion,
    })
  );
}

function emit(patch = {}) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener({ ...state }));
}

function clearReconnectTimer() {
  if (!reconnectTimer) return;
  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function closeSocket() {
  connectionGeneration += 1;
  clearReconnectTimer();
  const activeSocket = socket;
  socket = null;
  if (activeSocket) {
    activeSocket.onclose = null;
    activeSocket.close();
  }
}

function nextVersion() {
  let previous = 0n;
  try {
    previous = BigInt(String(state.lastVersion || "0"));
  } catch (error) {
    previous = 0n;
  }
  const now = BigInt(Date.now());
  const version = String(now > previous ? now : previous + 1n);
  emit({ lastVersion: version });
  saveSettings();
  return version;
}

function newerVersion(left, right) {
  try {
    return BigInt(String(left || "0")) > BigInt(String(right || "0"));
  } catch (error) {
    return false;
  }
}

function sendLatestSnapshot() {
  if (!latestSnapshot || !socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const version = nextVersion();
  socket.send(
    JSON.stringify({
      type: "snapshot.publish",
      producerId: state.producerId,
      version,
      snapshot: latestSnapshot,
    })
  );
}

function scheduleReconnect(generation) {
  if (!state.enabled || !hasWindow() || generation !== connectionGeneration) {
    return;
  }

  const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
  reconnectAttempt += 1;
  clearReconnectTimer();
  reconnectTimer = window.setTimeout(() => connect(), delay);
}

function handleMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch (error) {
    return;
  }

  if (message.type === "producer.ready") {
    reconnectAttempt = 0;
    const relayVersion = String(message.lastVersion || "0");
    const lastVersion = newerVersion(relayVersion, state.lastVersion)
      ? relayVersion
      : state.lastVersion;
    emit({
      status: "connected",
      error: "",
      viewerCount: Number(message.viewerCount) || 0,
      overlayViewerCount: Number(message.overlayViewerCount) || 0,
      tvViewerCount: Number(message.tvViewerCount) || 0,
      overlayUrls: Array.isArray(message.overlayUrls) ? message.overlayUrls : [],
      tvUrls: Array.isArray(message.tvUrls) ? message.tvUrls : [],
      lastVersion,
      lastAcknowledgedVersion: relayVersion,
    });
    saveSettings();
    sendLatestSnapshot();
    return;
  }

  if (message.type === "relay.status") {
    emit({
      viewerCount: Number(message.viewerCount) || 0,
      overlayViewerCount: Number(message.overlayViewerCount) || 0,
      tvViewerCount: Number(message.tvViewerCount) || 0,
      overlayUrls: Array.isArray(message.overlayUrls)
        ? message.overlayUrls
        : state.overlayUrls,
      tvUrls: Array.isArray(message.tvUrls) ? message.tvUrls : state.tvUrls,
    });
    return;
  }

  if (message.type === "snapshot.ack") {
    const currentVersion = String(message.currentVersion || "0");
    if (message.accepted === false && newerVersion(currentVersion, state.lastVersion)) {
      emit({
        lastVersion: currentVersion,
        lastAcknowledgedVersion: currentVersion,
      });
      saveSettings();
      sendLatestSnapshot();
      return;
    }
    emit({ lastAcknowledgedVersion: String(message.version || "0") });
    return;
  }

  if (message.type === "producer.rejected" || message.type === "error") {
    connectionGeneration += 1;
    clearReconnectTimer();
    const rejectedSocket = socket;
    socket = null;
    if (rejectedSocket) {
      rejectedSocket.onclose = null;
      rejectedSocket.close();
    }
    emit({ status: "error", error: String(message.message || "Relay rejected connection") });
  }
}

function connect() {
  if (!hasWindow() || !state.enabled || typeof WebSocket === "undefined") {
    return;
  }

  closeSocket();
  const generation = connectionGeneration;
  emit({ status: "connecting", error: "" });

  try {
    const nextSocket = new WebSocket(state.relayUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (generation !== connectionGeneration) return;
      nextSocket.send(
        JSON.stringify({
          type: "producer.hello",
          pairingCode: state.pairingCode,
          producerId: state.producerId,
        })
      );
    };
    nextSocket.onmessage = handleMessage;
    nextSocket.onerror = () => {
      if (generation === connectionGeneration) {
        emit({ status: "error", error: "Impossible de joindre le relais local." });
      }
    };
    nextSocket.onclose = (event) => {
      if (generation !== connectionGeneration) return;
      socket = null;
      if (event.code === 4002) {
        clearReconnectTimer();
        emit({
          status: "error",
          error: "Un autre tableau annonceur a remplacé cette connexion locale.",
        });
        return;
      }
      if (state.enabled) emit({ status: "disconnected" });
      scheduleReconnect(generation);
    };
  } catch (error) {
    emit({ status: "error", error: error?.message || "Invalid relay address" });
    scheduleReconnect(generation);
  }
}

loadSettings();

export function getLocalRelayState() {
  return { ...state };
}

export function subscribeLocalRelay(listener) {
  listeners.add(listener);
  listener(getLocalRelayState());
  return () => listeners.delete(listener);
}

export function configureLocalRelay({ relayUrl, pairingCode, enabled }) {
  emit({
    relayUrl: normalizeRelayUrl(relayUrl),
    pairingCode: String(pairingCode || "").trim(),
    enabled: Boolean(enabled),
    status: enabled ? "disconnected" : "disabled",
    error: "",
  });
  saveSettings();

  if (state.enabled) connect();
  else closeSocket();
}

export function reconnectLocalRelay() {
  if (state.enabled) connect();
}

export function publishLocalRelaySnapshot(snapshot) {
  latestSnapshot = snapshot && typeof snapshot === "object" ? snapshot : null;
  if (state.enabled && state.status === "connected") sendLatestSnapshot();
}

export function startConfiguredLocalRelay() {
  if (state.enabled) connect();
}

export { DEFAULT_RELAY_URL, STORAGE_KEY as LOCAL_RELAY_STORAGE_KEY, normalizeRelayUrl };

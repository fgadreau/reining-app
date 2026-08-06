export const RELAY_PROTOCOL_VERSION = 1;
export const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

export function parseRelayMessage(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch (error) {
    return null;
  }
}

export function validateSnapshotEnvelope(message) {
  if (message?.type !== "snapshot.publish") {
    return { ok: false, error: "Unsupported relay message" };
  }

  const version = String(message.version || "");
  if (!/^\d{1,20}$/.test(version) || BigInt(version) <= 0n) {
    return { ok: false, error: "Invalid snapshot version" };
  }

  if (!message.snapshot || typeof message.snapshot !== "object") {
    return { ok: false, error: "Snapshot is required" };
  }

  if (Number(message.snapshot.schemaVersion) !== RELAY_PROTOCOL_VERSION) {
    return { ok: false, error: "Unsupported snapshot schema" };
  }

  if (!String(message.snapshot.show?.id || "").trim()) {
    return { ok: false, error: "Snapshot show id is required" };
  }

  return {
    ok: true,
    envelope: {
      type: "snapshot",
      protocolVersion: RELAY_PROTOCOL_VERSION,
      producerId: String(message.producerId || "").trim(),
      version,
      receivedAt: new Date().toISOString(),
      snapshot: message.snapshot,
    },
  };
}

export function isNewerVersion(candidate, current) {
  try {
    return BigInt(String(candidate || "0")) > BigInt(String(current || "0"));
  } catch (error) {
    return false;
  }
}

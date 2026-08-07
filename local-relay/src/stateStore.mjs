import fs from "node:fs";
import path from "node:path";
import { isNewerVersion } from "./protocol.mjs";

export function createStateStore({ dataDirectory }) {
  const directory = path.resolve(dataDirectory);
  const statePath = path.join(directory, "last-state.json");
  const pairingPath = path.join(directory, "relay-config.json");
  let currentEnvelope = readJson(statePath);
  const pairingCode = loadOrCreatePairingCode(pairingPath);

  return {
    getPairingCode() {
      return pairingCode;
    },
    getEnvelope() {
      return currentEnvelope;
    },
    acceptEnvelope(envelope) {
      if (!isNewerVersion(envelope?.version, currentEnvelope?.version)) {
        return false;
      }

      writeJsonAtomically(statePath, envelope);
      currentEnvelope = envelope;
      return true;
    },
  };
}

function loadOrCreatePairingCode(filePath) {
  const configured = String(process.env.SHOWSCORE_RELAY_CODE || "").trim();
  if (/^\d{6}$/.test(configured)) return configured;

  const existing = readJson(filePath);
  if (/^\d{6}$/.test(String(existing?.pairingCode || ""))) {
    return String(existing.pairingCode);
  }

  const pairingCode = String(Math.floor(100000 + Math.random() * 900000));
  writeJsonAtomically(filePath, { pairingCode });
  return pairingCode;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeJsonAtomically(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, filePath);
}

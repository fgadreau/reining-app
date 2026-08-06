import assert from "node:assert/strict";
import test from "node:test";
import {
  isNewerVersion,
  parseRelayMessage,
  validateSnapshotEnvelope,
} from "../src/protocol.mjs";

test("validates and normalizes a current snapshot", () => {
  const result = validateSnapshotEnvelope({
    type: "snapshot.publish",
    producerId: "announcer-1",
    version: "1720000000001",
    snapshot: { schemaVersion: 1, show: { id: "show-1" } },
  });

  assert.equal(result.ok, true);
  assert.equal(result.envelope.type, "snapshot");
  assert.equal(result.envelope.version, "1720000000001");
  assert.equal(result.envelope.snapshot.show.id, "show-1");
});

test("rejects malformed, obsolete-schema, and incomplete snapshots", () => {
  assert.equal(parseRelayMessage("not-json"), null);
  assert.equal(validateSnapshotEnvelope({ type: "other" }).ok, false);
  assert.equal(
    validateSnapshotEnvelope({
      type: "snapshot.publish",
      version: "2",
      snapshot: { schemaVersion: 99, show: { id: "show-1" } },
    }).ok,
    false
  );
  assert.equal(
    validateSnapshotEnvelope({
      type: "snapshot.publish",
      version: "2",
      snapshot: { schemaVersion: 1, show: {} },
    }).ok,
    false
  );
});

test("compares large monotonic versions without losing precision", () => {
  assert.equal(isNewerVersion("99999999999999999999", "99999999999999999998"), true);
  assert.equal(isNewerVersion("99", "100"), false);
  assert.equal(isNewerVersion("invalid", "100"), false);
});

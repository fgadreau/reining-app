import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createStateStore } from "../src/stateStore.mjs";

test("persists the latest state and never lets an older update replace it", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "showscore-relay-store-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const store = createStateStore({ dataDirectory: directory });
  const first = { type: "snapshot", version: "100", snapshot: { show: { id: "show-1" } } };
  const stale = { type: "snapshot", version: "99", snapshot: { show: { id: "stale" } } };
  const corrected = { type: "snapshot", version: "101", snapshot: { show: { id: "show-1", name: "Corrected" } } };

  assert.match(store.getPairingCode(), /^\d{6}$/);
  assert.equal(store.acceptEnvelope(first), true);
  assert.equal(store.acceptEnvelope(stale), false);
  assert.equal(store.acceptEnvelope(corrected), true);

  const restartedStore = createStateStore({ dataDirectory: directory });
  assert.equal(restartedStore.getPairingCode(), store.getPairingCode());
  assert.deepEqual(restartedStore.getEnvelope(), corrected);
});

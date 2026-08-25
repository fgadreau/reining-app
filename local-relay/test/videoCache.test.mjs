import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { once } from "node:events";
import test from "node:test";
import { createCompetitionVideoCache, parseRange } from "../src/videoCache.mjs";

test("parses browser byte ranges", () => {
  assert.deepEqual(parseRange("bytes=2-5", 10), { start: 2, end: 5 });
  assert.deepEqual(parseRange("bytes=6-", 10), { start: 6, end: 9 });
  assert.deepEqual(parseRange("bytes=-3", 10), { start: 7, end: 9 });
  assert.equal(parseRange("bytes=20-30", 10), null);
});

test("downloads a competition video once and serves it with range support", async (context) => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "showscore-video-cache-"));
  const sourceUrl = "https://example.test/competition.mp4";
  const snapshot = { show: { tvDisplayVideoUrl: sourceUrl } };
  let downloadCount = 0;
  const videoCache = createCompetitionVideoCache({
    dataDirectory,
    fetchImpl: async () => {
      downloadCount += 1;
      return new Response(Buffer.from("0123456789"), {
        headers: { "content-length": "10", "content-type": "video/mp4" },
      });
    },
  });

  context.after(() => fs.rmSync(dataDirectory, { recursive: true, force: true }));
  assert.equal(await videoCache.ensureSnapshot(snapshot), true);
  assert.equal(await videoCache.ensureSnapshot(snapshot), true);
  assert.equal(downloadCount, 1);
  assert.equal(videoCache.getStatus().status, "ready");

  const response = new MockResponse();
  videoCache.serve(
    { method: "GET", headers: { range: "bytes=2-5" } },
    response,
    snapshot
  );
  await once(response, "finish");

  assert.equal(response.statusCode, 206);
  assert.equal(response.headers["Content-Range"], "bytes 2-5/10");
  assert.equal(Buffer.concat(response.chunks).toString(), "2345");
});

class MockResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 0;
    this.headers = {};
    this.chunks = [];
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
    return this;
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }
}

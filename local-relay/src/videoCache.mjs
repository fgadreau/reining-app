import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export function createCompetitionVideoCache({ dataDirectory, fetchImpl = fetch }) {
  const mediaDirectory = path.resolve(dataDirectory, "media");
  const videoPath = path.join(mediaDirectory, "competition-video.mp4");
  const metadataPath = path.join(mediaDirectory, "competition-video.json");
  let metadata = readJson(metadataPath);
  let activeDownload = null;
  let status = hasUsableCache(metadata, videoPath) ? "ready" : "empty";
  let lastError = "";

  function ensureSnapshot(snapshot) {
    const sourceUrl = normalizeVideoUrl(snapshot?.show?.tvDisplayVideoUrl);
    if (!sourceUrl) return Promise.resolve(false);

    if (hasUsableCache(metadata, videoPath) && metadata.sourceUrl === sourceUrl) {
      status = "ready";
      return Promise.resolve(true);
    }

    if (activeDownload?.sourceUrl === sourceUrl) return activeDownload.promise;

    const promise = download(sourceUrl).finally(() => {
      if (activeDownload?.promise === promise) activeDownload = null;
    });
    activeDownload = { sourceUrl, promise };
    return promise;
  }

  async function download(sourceUrl) {
    status = "downloading";
    lastError = "";
    fs.mkdirSync(mediaDirectory, { recursive: true });
    const temporaryPath = `${videoPath}.${process.pid}.${Date.now()}.download`;

    try {
      const response = await fetchImpl(sourceUrl, { redirect: "follow" });
      if (!response.ok || !response.body) {
        throw new Error(`Téléchargement vidéo refusé (${response.status}).`);
      }

      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_VIDEO_BYTES) {
        throw new Error("La vidéo dépasse la limite de 2 Go.");
      }

      let receivedBytes = 0;
      const source = Readable.fromWeb(response.body);
      source.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_VIDEO_BYTES) {
          source.destroy(new Error("La vidéo dépasse la limite de 2 Go."));
        }
      });

      await pipeline(source, fs.createWriteStream(temporaryPath, { mode: 0o600 }));
      fs.renameSync(temporaryPath, videoPath);
      metadata = {
        sourceUrl,
        size: receivedBytes,
        cachedAt: new Date().toISOString(),
      };
      writeJsonAtomically(metadataPath, metadata);
      status = "ready";
      return true;
    } catch (error) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch (unlinkError) {
        // No incomplete file to remove.
      }
      status = hasUsableCache(metadata, videoPath) ? "ready" : "error";
      lastError = error?.message || "Erreur de mise en cache vidéo";
      console.error("Erreur cache vidéo compétition:", lastError);
      return false;
    }
  }

  function serve(request, response, snapshot) {
    const sourceUrl = normalizeVideoUrl(snapshot?.show?.tvDisplayVideoUrl);
    if (!sourceUrl) {
      sendText(response, 404, "Aucune vidéo de compétition configurée.");
      return;
    }

    if (hasUsableCache(metadata, videoPath) && metadata.sourceUrl === sourceUrl) {
      serveVideoFile(request, response, videoPath);
      return;
    }

    void ensureSnapshot(snapshot);
    response.writeHead(307, {
      Location: sourceUrl,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end();
  }

  return {
    ensureSnapshot,
    serve,
    getStatus() {
      return {
        status,
        sourceUrl: metadata?.sourceUrl || "",
        size: Number(metadata?.size || 0),
        cachedAt: metadata?.cachedAt || null,
        error: lastError,
      };
    },
  };
}

function normalizeVideoUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function hasUsableCache(metadata, videoPath) {
  if (!metadata?.sourceUrl) return false;
  try {
    return fs.statSync(videoPath).size > 0;
  } catch (error) {
    return false;
  }
}

function serveVideoFile(request, response, filePath) {
  const size = fs.statSync(filePath).size;
  const range = parseRange(request.headers.range, size);
  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  };

  if (request.headers.range && !range) {
    response.writeHead(416, {
      ...headers,
      "Content-Range": `bytes */${size}`,
    });
    response.end();
    return;
  }

  if (range) {
    const { start, end } = range;
    response.writeHead(206, {
      ...headers,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`,
    });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { ...headers, "Content-Length": size });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath).pipe(response);
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value || "").trim());
  if (!match) return null;

  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;

  if (start == null && end != null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    start = start ?? 0;
    end = end == null ? size - 1 : Math.min(end, size - 1);
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
    return null;
  }

  return { start, end };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, filePath);
}

function sendText(response, statusCode, value) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(value);
}

export { MAX_VIDEO_BYTES, normalizeVideoUrl, parseRange };

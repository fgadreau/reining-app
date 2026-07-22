import { getSupabaseClient } from "../cloud/supabaseClient";

export const TV_DISPLAY_VIDEO_BUCKET = "tv-display-media";
export const TV_DISPLAY_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function validateTvDisplayVideoFile(file) {
  if (!file) {
    throw new Error("Aucun fichier vidéo sélectionné.");
  }

  const fileName = String(file.name || "").trim();
  const mimeType = String(file.type || "").toLowerCase();
  const isMp4 = mimeType === "video/mp4" || /\.mp4$/i.test(fileName);

  if (!isMp4) {
    throw new Error("Le fichier doit être une vidéo MP4.");
  }

  if (Number(file.size || 0) > TV_DISPLAY_VIDEO_MAX_BYTES) {
    throw new Error("La vidéo doit faire 2 Go ou moins.");
  }

  return file;
}

export async function uploadTvDisplayVideo({
  associationId,
  showId,
  file,
  onProgress,
}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase doit être connecté pour téléverser une vidéo.");
  }

  validateTvDisplayVideoFile(file);

  const path = buildTvDisplayVideoPath({ associationId, showId, file });
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (sessionError) throw sessionError;
  if (!accessToken) {
    throw new Error("La session doit être reconnectée avant l’envoi vidéo.");
  }

  const publicUrl = getTvDisplayVideoPublicUrl(path);
  const projectRef = new URL(publicUrl).hostname.split(".")[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  const { Upload } = await import("tus-js-client");

  await new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": "true",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: TV_DISPLAY_VIDEO_BUCKET,
        objectName: path,
        contentType: "video/mp4",
        cacheControl: "3600",
      },
      fingerprint: async (source) =>
        [
          "showscore-tv",
          associationId,
          showId,
          source?.name || "video.mp4",
          source?.size || 0,
          source?.lastModified || 0,
        ].join("-"),
      onProgress: (bytesSent, bytesTotal) => {
        const percent = bytesTotal > 0 ? (bytesSent / bytesTotal) * 100 : 0;
        onProgress?.(percent);
      },
      onError: reject,
      onSuccess: resolve,
    });

    upload
      .findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      })
      .catch(reject);
  });

  return {
    path,
    name: String(file.name || "video.mp4"),
    size: Number(file.size || 0),
  };
}

export async function deleteTvDisplayVideo(path) {
  const normalizedPath = String(path || "").trim();
  const supabase = getSupabaseClient();

  if (!normalizedPath || !supabase) return;

  const { error } = await supabase.storage
    .from(TV_DISPLAY_VIDEO_BUCKET)
    .remove([normalizedPath]);

  if (error) throw error;
}

export function getTvDisplayVideoPublicUrl(path) {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) return "";
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  const supabase = getSupabaseClient();
  if (!supabase) return "";

  const { data } = supabase.storage
    .from(TV_DISPLAY_VIDEO_BUCKET)
    .getPublicUrl(normalizedPath);

  return data?.publicUrl || "";
}

export function formatTvDisplayVideoSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";

  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} Go`;
  }

  const precision = size >= 10 * 1024 * 1024 ? 0 : 1;
  return `${(size / (1024 * 1024)).toFixed(precision)} Mo`;
}

export function buildTvDisplayVideoPath({ associationId, showId, file }) {
  const fingerprint = [
    file?.name || "video.mp4",
    file?.size || 0,
    file?.lastModified || 0,
  ].join("-");
  let hash = 2166136261;

  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${associationId}/${showId}/arena-display-${(
    hash >>> 0
  ).toString(16)}.mp4`;
}

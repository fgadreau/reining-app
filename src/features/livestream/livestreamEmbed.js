function getIframeSrc(value) {
  const match = String(value || "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || "";
}

function normalizeLivestreamUrl(value) {
  const rawValue = String(value || "").trim();
  const iframeSrc = getIframeSrc(rawValue);
  const candidate = iframeSrc || rawValue;

  if (!candidate) {
    return "";
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (/^[\w.-]+\.[a-z]{2,}/i.test(candidate)) {
    return `https://${candidate}`;
  }

  return "";
}

function getYouTubeId(url) {
  if (url.hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/").filter(Boolean)[1] || "";
  }

  if (url.pathname.startsWith("/live/")) {
    return url.pathname.split("/").filter(Boolean)[1] || "";
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/").filter(Boolean)[1] || "";
  }

  return url.searchParams.get("v") || "";
}

function getVimeoId(url) {
  if (url.hostname === "player.vimeo.com") {
    return url.pathname.split("/").filter(Boolean).pop() || "";
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const numericPart = parts.find((part) => /^\d+$/.test(part));

  return numericPart || "";
}

export function buildLivestreamEmbed(value) {
  const sourceUrl = normalizeLivestreamUrl(value);

  if (!sourceUrl) {
    return {
      canEmbed: false,
      embedUrl: "",
      externalUrl: "",
      provider: "unknown",
      providerLabel: "",
    };
  }

  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isYouTubeHost = [
      "youtube.com",
      "youtube-nocookie.com",
      "m.youtube.com",
      "youtu.be",
    ].includes(host);

    if (isYouTubeHost) {
      const videoId = getYouTubeId(url);

      if (videoId) {
        return {
          canEmbed: true,
          embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
            videoId
          )}?rel=0&modestbranding=1`,
          externalUrl: sourceUrl,
          provider: "youtube",
          providerLabel: "YouTube",
        };
      }
    }

    const isVimeoHost = host === "vimeo.com" || host === "player.vimeo.com";

    if (isVimeoHost) {
      const videoId = getVimeoId(url);

      if (videoId) {
        return {
          canEmbed: true,
          embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`,
          externalUrl: sourceUrl,
          provider: "vimeo",
          providerLabel: "Vimeo",
        };
      }
    }

    if (getIframeSrc(value)) {
      return {
        canEmbed: true,
        embedUrl: sourceUrl,
        externalUrl: sourceUrl,
        provider: "custom",
        providerLabel: "Embed",
      };
    }

    return {
      canEmbed: false,
      embedUrl: "",
      externalUrl: sourceUrl,
      provider: "external",
      providerLabel: host || "Livestream",
    };
  } catch (error) {
    return {
      canEmbed: false,
      embedUrl: "",
      externalUrl: sourceUrl,
      provider: "external",
      providerLabel: "Livestream",
    };
  }
}

export function hasPublicLivestream(show) {
  return Boolean(show?.isLivestreamPublic && hasConfiguredLivestream(show));
}
import { hasConfiguredLivestream } from "./livestreamSchedule";

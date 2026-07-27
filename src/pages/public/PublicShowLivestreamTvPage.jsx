import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import { formatDayLabel } from "../../features/days/dayDateUtils";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { buildLivestreamEmbed } from "../../features/livestream/livestreamEmbed";
import {
  getCurrentPublicLivestream,
  getNextPublicLivestream,
} from "../../features/livestream/livestreamSchedule";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
} from "../../features/publication/publicViewRepository";
import { getShowById } from "../../features/shows/showSelectors";

const LIVESTREAM_TV_REFRESH_MS = 15000;
const LIVESTREAM_TV_DELAY_SECONDS = 5 * 60;
const LIVESTREAM_TV_DELAY_TOLERANCE_SECONDS = 20;
let youtubeIframeApiPromise = null;

function PublicShowLivestreamTvPage() {
  const { associationId, showId } = useParams();
  const { language } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(() => getShowById(showId));
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useLivestreamTvWakeLock(Boolean(showId));

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const [nextAssociation, nextShow] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowRepository(showId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setNow(new Date());
      setIsLoading(false);
    };

    load();
    const refreshTimer = window.setInterval(load, LIVESTREAM_TV_REFRESH_MS);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [associationId, showId]);

  const livestream = getCurrentPublicLivestream(show, {
    timezone: association?.timezone,
    now,
  });
  const nextLivestream = getNextPublicLivestream(show, {
    timezone: association?.timezone,
    now,
  });
  const embed = useMemo(
    () => buildLivestreamEmbed(livestream.url),
    [livestream.url]
  );
  const youtubeVideoId = getLivestreamTvYoutubeVideoId(embed);
  const [delayStatus, setDelayStatus] = useState({
    state: "waiting",
    remainingSeconds: LIVESTREAM_TV_DELAY_SECONDS,
      actualDelaySeconds: 0,
    });
  const hasYoutubeVideo = Boolean(
    livestream.url && embed.provider === "youtube" && youtubeVideoId
  );
  const isDelayedPlaybackReady =
    hasYoutubeVideo && delayStatus.state === "delayed";

  useEffect(() => {
    setDelayStatus({
      state: "waiting",
      remainingSeconds: LIVESTREAM_TV_DELAY_SECONDS,
      actualDelaySeconds: 0,
    });
  }, [youtubeVideoId]);

  return (
    <main style={pageStyle} data-livestream-tv-page>
      <div style={videoAreaStyle}>
        {hasYoutubeVideo ? (
          <DelayedYoutubeLivestreamPlayer
            key={youtubeVideoId}
            videoId={youtubeVideoId}
            onStatusChange={setDelayStatus}
          />
        ) : null}

        {!isDelayedPlaybackReady ? (
          <LivestreamTvWaitingPanel
            association={association}
            show={show}
            livestream={livestream}
            nextLivestream={nextLivestream}
            delayStatus={delayStatus}
            hasYoutubeVideo={hasYoutubeVideo}
            hasUnsupportedVideo={Boolean(
              livestream.url && embed.provider !== "youtube"
            )}
            isLoading={isLoading}
            language={language}
          />
        ) : null}
      </div>
    </main>
  );
}

function LivestreamTvWaitingPanel({
  association,
  show,
  livestream,
  nextLivestream,
  delayStatus,
  hasYoutubeVideo,
  hasUnsupportedVideo,
  isLoading,
  language,
}) {
  const nextDate = livestream.showDate || nextLivestream?.date || "";
  const remainingLabel = formatDelayRemaining(
    delayStatus.remainingSeconds
  );

  return (
    <section style={waitingStyle} data-livestream-tv-waiting>
      <AssociationLogo association={association} size={110} />
      <div style={waitingEyebrowStyle}>
        Livestream ShowScore · Diffusion automatique
      </div>
      <h1 style={waitingTitleStyle}>
        {show?.name || (isLoading ? "Chargement…" : "ShowScore")}
      </h1>
      {hasYoutubeVideo && delayStatus.state !== "unavailable" ? (
        <>
          <div style={countdownStyle}>{remainingLabel}</div>
          <div style={waitingTextStyle}>
            Le différé de cinq minutes se prépare. La vidéo démarrera
            automatiquement dès que cinq minutes de direct seront disponibles.
          </div>
        </>
      ) : hasUnsupportedVideo ? (
        <div style={waitingTextStyle}>
          Le différé automatique de cinq minutes nécessite un livestream
          YouTube avec le DVR activé.
        </div>
      ) : delayStatus.state === "unavailable" ? (
        <div style={waitingTextStyle}>
          Impossible d’établir le différé. Vérifiez que le direct YouTube est
          commencé et que le DVR est activé.
        </div>
      ) : nextDate ? (
        <div style={waitingTextStyle}>
          Prochaine diffusion · {formatDayLabel(nextDate, language)}
        </div>
      ) : (
        <div style={waitingTextStyle}>
          Aucune diffusion n’est programmée pour le moment.
        </div>
      )}
      {association?.name ? (
        <div style={associationNameStyle}>{association.name}</div>
      ) : null}
    </section>
  );
}

function DelayedYoutubeLivestreamPlayer({ videoId, onStatusChange }) {
  const playerHostRef = useRef(null);

  useEffect(() => {
    let isDisposed = false;
    let player = null;
    let monitorTimer = null;
    let retryTimer = null;
    let failedSeekChecks = 0;
    let lastReloadAt = 0;

    const publishStatus = (nextStatus) => {
      if (!isDisposed) onStatusChange(nextStatus);
    };

    const monitorDelay = () => {
      if (!player || typeof player.getDuration !== "function") return;

      const duration = Number(player.getDuration()) || 0;
      const currentTime = Number(player.getCurrentTime()) || 0;
      const delayState = getLivestreamTvDelayState({
        durationSeconds: duration,
        currentTimeSeconds: currentTime,
      });

      if (duration <= 0) {
        publishStatus(delayState);
        const currentTimestamp = Date.now();
        if (
          currentTimestamp - lastReloadAt >= 30000 &&
          typeof player.loadVideoById === "function"
        ) {
          lastReloadAt = currentTimestamp;
          player.loadVideoById(videoId);
          player.mute?.();
        }
        return;
      }

      player.mute?.();
      if (!delayState.hasEnoughBuffer) {
        failedSeekChecks = 0;
        player.playVideo?.();
        publishStatus(delayState);
        return;
      }

      if (delayState.shouldSeek) {
        player.seekTo?.(delayState.targetTimeSeconds, true);
        player.playVideo?.();
        failedSeekChecks += 1;
        publishStatus({
          ...delayState,
          state: "seeking",
        });

        if (failedSeekChecks >= 8) {
          publishStatus({
            ...delayState,
            state: "unavailable",
          });
        }
        return;
      }

      failedSeekChecks = 0;
      player.playVideo?.();
      publishStatus(delayState);
    };

    loadYoutubeIframeApi()
      .then((YT) => {
        if (isDisposed || !playerHostRef.current) return;

        player = new YT.Player(playerHostRef.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
              retryTimer = window.setTimeout(monitorDelay, 800);
              monitorTimer = window.setInterval(monitorDelay, 3000);
            },
            onError: () => {
              publishStatus({
                state: "waiting",
                remainingSeconds: LIVESTREAM_TV_DELAY_SECONDS,
                actualDelaySeconds: 0,
              });
            },
          },
        });
      })
      .catch(() => {
        publishStatus({
          state: "unavailable",
          remainingSeconds: LIVESTREAM_TV_DELAY_SECONDS,
          actualDelaySeconds: 0,
        });
      });

    return () => {
      isDisposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(monitorTimer);
      player?.destroy?.();
    };
  }, [onStatusChange, videoId]);

  return (
    <div
      ref={playerHostRef}
      style={videoFrameStyle}
      data-livestream-tv-video
    />
  );
}

function useLivestreamTvWakeLock(enabled) {
  const wakeLockRef = useRef(null);

  useEffect(() => {
    let isDisposed = false;

    const requestWakeLock = async () => {
      if (
        !enabled ||
        !navigator.wakeLock?.request ||
        document.visibilityState === "hidden" ||
        (wakeLockRef.current && !wakeLockRef.current.released)
      ) {
        return;
      }

      try {
        const wakeLock = await navigator.wakeLock.request("screen");
        if (isDisposed) {
          await wakeLock.release();
          return;
        }
        wakeLockRef.current = wakeLock;
      } catch (error) {
        // Wake Lock remains optional on browsers that do not support it.
      }
    };

    requestWakeLock();
    document.addEventListener("visibilitychange", requestWakeLock);
    window.addEventListener("focus", requestWakeLock);

    return () => {
      isDisposed = true;
      document.removeEventListener("visibilitychange", requestWakeLock);
      window.removeEventListener("focus", requestWakeLock);
      const wakeLock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (wakeLock && !wakeLock.released) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [enabled]);
}

function getLivestreamTvYoutubeVideoId(embed) {
  if (embed?.provider !== "youtube" || !embed?.embedUrl) return "";
  try {
    const url = new URL(embed.embedUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] === "embed" ? parts[1] || "" : "";
  } catch (error) {
    return "";
  }
}

export function getLivestreamTvDelayState({
  durationSeconds,
  currentTimeSeconds,
  delaySeconds = LIVESTREAM_TV_DELAY_SECONDS,
} = {}) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const currentTime = Math.max(0, Number(currentTimeSeconds) || 0);
  const targetDelay = Math.max(0, Number(delaySeconds) || 0);
  const hasEnoughBuffer = duration >= targetDelay;
  const targetTimeSeconds = Math.max(0, duration - targetDelay);
  const actualDelaySeconds = Math.max(0, duration - currentTime);
  const delayDifference = Math.abs(actualDelaySeconds - targetDelay);
  const shouldSeek =
    hasEnoughBuffer &&
    delayDifference > LIVESTREAM_TV_DELAY_TOLERANCE_SECONDS;

  return {
    state: hasEnoughBuffer && !shouldSeek ? "delayed" : "waiting",
    hasEnoughBuffer,
    shouldSeek,
    targetTimeSeconds,
    remainingSeconds: Math.max(0, targetDelay - duration),
    actualDelaySeconds,
  };
}

function formatDelayRemaining(value) {
  const totalSeconds = Math.max(0, Math.ceil(Number(value) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function loadYoutubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube IFrame API unavailable"));
      }
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () =>
      reject(new Error("Unable to load YouTube IFrame API"));
    document.head.appendChild(script);
  });

  return youtubeIframeApiPromise;
}

const pageStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  width: "100vw",
  height: "100dvh",
  boxSizing: "border-box",
  display: "grid",
  gridTemplateRows: "minmax(0, 1fr)",
  overflow: "hidden",
  background: "#000",
  color: "#fff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
};

const videoFrameStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
  background: "#000",
};

const videoAreaStyle = {
  position: "relative",
  minHeight: 0,
  overflow: "hidden",
  background: "#000",
};

const waitingStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  minHeight: 0,
  display: "grid",
  placeContent: "center",
  justifyItems: "center",
  gap: 20,
  padding: "clamp(28px, 5vw, 90px)",
  boxSizing: "border-box",
  textAlign: "center",
  background:
    "radial-gradient(circle at 50% 35%, rgba(13, 148, 136, 0.28), transparent 36%), linear-gradient(145deg, #020617, #17252a)",
};

const waitingEyebrowStyle = {
  color: "#f4d98c",
  fontSize: "clamp(15px, 1.5vw, 26px)",
  fontWeight: 900,
  textTransform: "uppercase",
};

const waitingTitleStyle = {
  margin: 0,
  fontSize: "clamp(38px, 5.5vw, 100px)",
  lineHeight: 1,
};

const countdownStyle = {
  color: "#5eead4",
  fontSize: "clamp(52px, 8vw, 150px)",
  fontWeight: 950,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.04em",
};

const waitingTextStyle = {
  maxWidth: 1000,
  color: "#dbeafe",
  fontSize: "clamp(18px, 2vw, 34px)",
  fontWeight: 750,
  lineHeight: 1.35,
};

const associationNameStyle = {
  color: "#94a3b8",
  fontSize: "clamp(15px, 1.3vw, 24px)",
  fontWeight: 800,
};

export default PublicShowLivestreamTvPage;

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  applyPublicShowViewRealtimeChange,
  getPublicShowAnnouncerRevisionRepository,
  getPublicShowAnnouncerRevisionSnapshot,
  hasActivePublicAnnouncerSession,
  isPublicShowViewRealtimeReady,
  shouldRefreshForAnnouncerRevisions,
  shouldPublishPublicShowViewSnapshot,
  subscribePublicShowViewRepository,
} from "./publicViewRepository";

const DEFAULT_FALLBACK_REFRESH_MS = 10 * 60_000;
const ACTIVE_REVISION_CHECK_MS = 20_000;
const LOCAL_FALLBACK_REFRESH_MS = 5_000;
const DISCONNECTED_FALLBACK_REFRESH_MS = 5_000;
const MAX_DISCONNECTED_FALLBACK_REFRESH_MS = 60_000;
const FALLBACK_JITTER_RATIO = 0.2;
const REALTIME_REFRESH_DEBOUNCE_MS = 300;

export function getFallbackRefreshDelay({
  fallbackRefreshMs = DEFAULT_FALLBACK_REFRESH_MS,
  hasRealtime = true,
  isRealtimeSubscribed = false,
  reconnectAttempt = 0,
  random = Math.random,
}) {
  if (!hasRealtime) return LOCAL_FALLBACK_REFRESH_MS;

  const baseDelay = isRealtimeSubscribed
    ? fallbackRefreshMs
    : Math.min(
        DISCONNECTED_FALLBACK_REFRESH_MS * 2 ** Math.max(reconnectAttempt - 1, 0),
        MAX_DISCONNECTED_FALLBACK_REFRESH_MS
      );
  const boundedRandom = Math.min(Math.max(Number(random()) || 0, 0), 1);
  const jitterMultiplier =
    1 - FALLBACK_JITTER_RATIO + boundedRandom * FALLBACK_JITTER_RATIO * 2;

  return Math.round(baseDelay * jitterMultiplier);
}

export function getActiveRevisionCheckDelay(random = Math.random) {
  const boundedRandom = Math.min(Math.max(Number(random()) || 0, 0), 1);
  return Math.round(
    ACTIVE_REVISION_CHECK_MS *
      (1 - FALLBACK_JITTER_RATIO + boundedRandom * FALLBACK_JITTER_RATIO * 2)
  );
}

export function createRefreshCoordinator({
  load,
  onData,
  onError,
  getCurrentData = () => undefined,
  shouldPublish = () => true,
}) {
  let activePromise = null;
  let isQueued = false;
  let isStopped = false;

  const run = () => {
    if (isStopped) {
      return Promise.resolve(null);
    }

    if (activePromise) {
      isQueued = true;
      return activePromise;
    }

    const requestStartData = getCurrentData();
    activePromise = Promise.resolve()
      .then(load)
      .then((data) => {
        if (!isStopped && shouldPublish(data, requestStartData)) {
          onData(data);
        }
        return data;
      })
      .catch((error) => {
        if (!isStopped) {
          onError(error);
        }
        return null;
      })
      .finally(() => {
        activePromise = null;

        if (!isStopped && isQueued) {
          isQueued = false;
          void run();
        }
      });

    return activePromise;
  };

  return {
    run,
    stop() {
      isStopped = true;
      isQueued = false;
    },
  };
}

export function usePublicShowViewUpdates({
  showId,
  classIds,
  data,
  load,
  onData,
  onDisplayRefreshStateChange,
  enabled = true,
  fallbackRefreshMs = DEFAULT_FALLBACK_REFRESH_MS,
}) {
  const loadRef = useRef(load);
  const dataRef = useRef(data);
  const onDataRef = useRef(onData);
  const onDisplayRefreshStateChangeRef = useRef(onDisplayRefreshStateChange);
  const hasRealtime = Boolean(getSupabaseClient());
  const isRealtimeReady =
    !hasRealtime || isPublicShowViewRealtimeReady(data);
  const classIdsKey = Array.from(
    new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))
  ).join("|");

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onDisplayRefreshStateChangeRef.current = onDisplayRefreshStateChange;
  }, [onDisplayRefreshStateChange]);

  useEffect(() => {
    if (!enabled || !showId || isRealtimeReady) {
      return undefined;
    }

    let isHydrationActive = true;
    let retryTimer = null;

    const retryInitialHydration = () => {
      retryTimer = window.setTimeout(async () => {
        let nextData = null;

        try {
          nextData = await loadRef.current();
          if (!isHydrationActive) return;
          dataRef.current = nextData;
          onDataRef.current(nextData);
        } catch (error) {
          if (isHydrationActive) {
            console.error("Erreur actualisation vue publique:", error);
          }
        }

        if (
          isHydrationActive &&
          !isPublicShowViewRealtimeReady(nextData)
        ) {
          retryInitialHydration();
        }
      }, DISCONNECTED_FALLBACK_REFRESH_MS);
    };

    retryInitialHydration();

    return () => {
      isHydrationActive = false;
      window.clearTimeout(retryTimer);
    };
  }, [enabled, isRealtimeReady, showId]);

  useEffect(() => {
    if (!enabled || !showId || !isRealtimeReady) {
      return undefined;
    }

    let realtimeRefreshTimer = null;
    let fallbackRefreshTimer = null;
    let revisionCheckTimer = null;
    let displayReturnRefreshTimer = null;
    let isEffectActive = true;
    let isRealtimeSubscribed = false;
    let reconnectAttempt = 0;
    let realtimeGeneration = 0;
    const coordinator = createRefreshCoordinator({
      load: () => loadRef.current(),
      getCurrentData: () => ({
        data: dataRef.current,
        realtimeGeneration,
      }),
      shouldPublish: (nextData, requestStart) => {
        if (realtimeGeneration !== requestStart.realtimeGeneration) {
          void coordinator.run();
          return false;
        }
        return shouldPublishPublicShowViewSnapshot(
          dataRef.current,
          nextData,
          requestStart.data
        );
      },
      onData: (nextData) => {
        dataRef.current = nextData;
        onDataRef.current(nextData);
        scheduleRevisionCheck();
        scheduleFallbackRefresh();
      },
      onError: (error) => {
        console.error("Erreur actualisation vue publique:", error);
      },
    });
    const revisionCoordinator = createRefreshCoordinator({
      load: () =>
        getPublicShowAnnouncerRevisionRepository(
          classIdsKey ? classIdsKey.split("|") : []
        ),
      onData: (remoteSnapshot) => {
        const currentSnapshot = getPublicShowAnnouncerRevisionSnapshot(
          dataRef.current
        );
        if (shouldRefreshForAnnouncerRevisions(currentSnapshot, remoteSnapshot)) {
          void coordinator.run();
        }
      },
      onError: (error) => {
        console.error("Erreur vérification légère vue publique:", error);
        void coordinator.run();
      },
    });

    const requestRealtimeRefresh = (payload) => {
      if (payload) {
        const currentData = dataRef.current;
        const nextData = applyPublicShowViewRealtimeChange(
          currentData,
          payload
        );

        if (nextData && nextData !== currentData) {
          realtimeGeneration += 1;
          dataRef.current = nextData;
          onDataRef.current(nextData);
          scheduleRevisionCheck();
          scheduleFallbackRefresh();
          return;
        }
        if (nextData === currentData) return;
        realtimeGeneration += 1;
      }

      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = window.setTimeout(() => {
        void coordinator.run();
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const scheduleFallbackRefresh = () => {
      window.clearTimeout(fallbackRefreshTimer);
      fallbackRefreshTimer = window.setTimeout(async () => {
        if (document.visibilityState !== "hidden") {
          await coordinator.run();
        }
        if (isEffectActive) scheduleFallbackRefresh();
      }, getFallbackRefreshDelay({
        fallbackRefreshMs,
        hasRealtime,
        isRealtimeSubscribed,
        reconnectAttempt,
      }));
    };
    const scheduleRevisionCheck = () => {
      window.clearTimeout(revisionCheckTimer);
      if (
        !hasRealtime ||
        !isRealtimeSubscribed ||
        !hasActivePublicAnnouncerSession(dataRef.current)
      ) {
        return;
      }
      revisionCheckTimer = window.setTimeout(async () => {
        if (document.visibilityState !== "hidden") {
          await revisionCoordinator.run();
        }
        if (isEffectActive) scheduleRevisionCheck();
      }, getActiveRevisionCheckDelay());
    };
    const handleRealtimeStatus = (status) => {
      if (status === "SUBSCRIBED") {
        isRealtimeSubscribed = true;
        reconnectAttempt = 0;
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        isRealtimeSubscribed = false;
        reconnectAttempt += 1;
      }
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
        requestRealtimeRefresh();
      }
      scheduleRevisionCheck();
      scheduleFallbackRefresh();
    };
    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      classIdsKey ? classIdsKey.split("|") : [],
      requestRealtimeRefresh,
      handleRealtimeStatus
    );
    scheduleFallbackRefresh();
    scheduleRevisionCheck();
    const refreshWhenDisplayReturns = () => {
      if (document.visibilityState === "hidden") return;

      window.clearTimeout(displayReturnRefreshTimer);
      onDisplayRefreshStateChangeRef.current?.(true);
      displayReturnRefreshTimer = window.setTimeout(() => {
        void coordinator.run().finally(() => {
          if (isEffectActive) onDisplayRefreshStateChangeRef.current?.(false);
        });
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    window.addEventListener("focus", refreshWhenDisplayReturns);
    window.addEventListener("online", refreshWhenDisplayReturns);
    document.addEventListener("visibilitychange", refreshWhenDisplayReturns);

    return () => {
      isEffectActive = false;
      window.clearTimeout(realtimeRefreshTimer);
      window.clearTimeout(fallbackRefreshTimer);
      window.clearTimeout(revisionCheckTimer);
      window.clearTimeout(displayReturnRefreshTimer);
      window.removeEventListener("focus", refreshWhenDisplayReturns);
      window.removeEventListener("online", refreshWhenDisplayReturns);
      document.removeEventListener("visibilitychange", refreshWhenDisplayReturns);
      coordinator.stop();
      revisionCoordinator.stop();
      unsubscribe();
    };
  }, [
    classIdsKey,
    enabled,
    fallbackRefreshMs,
    hasRealtime,
    isRealtimeReady,
    showId,
  ]);
}

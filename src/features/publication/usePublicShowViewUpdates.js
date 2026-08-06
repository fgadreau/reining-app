import { useEffect, useRef } from "react";
import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  applyPublicShowViewRealtimeChange,
  subscribePublicShowViewRepository,
} from "./publicViewRepository";

const DEFAULT_FALLBACK_REFRESH_MS = 10 * 60_000;
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

export function createRefreshCoordinator({ load, onData, onError }) {
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

    activePromise = Promise.resolve()
      .then(load)
      .then((data) => {
        if (!isStopped) {
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
    if (!enabled || !showId) {
      return undefined;
    }

    let realtimeRefreshTimer = null;
    let fallbackRefreshTimer = null;
    let displayReturnRefreshTimer = null;
    let isEffectActive = true;
    let isRealtimeSubscribed = false;
    let reconnectAttempt = 0;
    const hasRealtime = Boolean(getSupabaseClient());
    const coordinator = createRefreshCoordinator({
      load: () => loadRef.current(),
      onData: (nextData) => {
        dataRef.current = nextData;
        onDataRef.current(nextData);
      },
      onError: (error) => {
        console.error("Erreur actualisation vue publique:", error);
      },
    });

    const requestRealtimeRefresh = (payload) => {
      if (payload) {
        const nextData = applyPublicShowViewRealtimeChange(
          dataRef.current,
          payload
        );

        if (nextData) {
          dataRef.current = nextData;
          onDataRef.current(nextData);
          return;
        }
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
    const handleRealtimeStatus = (status) => {
      if (status === "SUBSCRIBED") {
        isRealtimeSubscribed = true;
        reconnectAttempt = 0;
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        isRealtimeSubscribed = false;
        reconnectAttempt += 1;
      }
      scheduleFallbackRefresh();
    };
    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      classIdsKey ? classIdsKey.split("|") : [],
      requestRealtimeRefresh,
      handleRealtimeStatus
    );
    scheduleFallbackRefresh();
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
      window.clearTimeout(displayReturnRefreshTimer);
      window.removeEventListener("focus", refreshWhenDisplayReturns);
      window.removeEventListener("online", refreshWhenDisplayReturns);
      document.removeEventListener("visibilitychange", refreshWhenDisplayReturns);
      coordinator.stop();
      unsubscribe();
    };
  }, [classIdsKey, enabled, fallbackRefreshMs, showId]);
}

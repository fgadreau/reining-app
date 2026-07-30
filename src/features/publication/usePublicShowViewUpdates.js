import { useEffect, useRef } from "react";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { subscribePublicShowViewRepository } from "./publicViewRepository";

const DEFAULT_FALLBACK_REFRESH_MS = 30_000;
const LOCAL_FALLBACK_REFRESH_MS = 5_000;
const REALTIME_REFRESH_DEBOUNCE_MS = 300;

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
  load,
  onData,
  enabled = true,
  fallbackRefreshMs = DEFAULT_FALLBACK_REFRESH_MS,
}) {
  const loadRef = useRef(load);
  const onDataRef = useRef(onData);
  const classIdsKey = Array.from(
    new Set((Array.isArray(classIds) ? classIds : []).filter(Boolean))
  ).join("|");

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    if (!enabled || !showId) {
      return undefined;
    }

    let realtimeRefreshTimer = null;
    const coordinator = createRefreshCoordinator({
      load: () => loadRef.current(),
      onData: (data) => onDataRef.current(data),
      onError: (error) => {
        console.error("Erreur actualisation vue publique:", error);
      },
    });

    const requestRealtimeRefresh = () => {
      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = window.setTimeout(() => {
        void coordinator.run();
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      classIdsKey ? classIdsKey.split("|") : [],
      requestRealtimeRefresh
    );
    const effectiveFallbackRefreshMs = getSupabaseClient()
      ? fallbackRefreshMs
      : LOCAL_FALLBACK_REFRESH_MS;
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void coordinator.run();
    }, effectiveFallbackRefreshMs);

    return () => {
      window.clearTimeout(realtimeRefreshTimer);
      window.clearInterval(refreshTimer);
      coordinator.stop();
      unsubscribe();
    };
  }, [classIdsKey, enabled, fallbackRefreshMs, showId]);
}

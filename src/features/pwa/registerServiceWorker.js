import {
  APP_ROUTE_CHANGED_EVENT,
  canReloadForAppUpdate,
} from "./appUpdateSafety";

function getPublicAssetPath(path) {
  const publicUrl = process.env.PUBLIC_URL || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicUrl}${normalizedPath}`;
}

function activateWaitingWorker(registration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

export function registerServiceWorker() {
  if (
    process.env.NODE_ENV !== "production" ||
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  window.addEventListener("load", () => {
    let shouldReloadOnControllerChange = false;
    let isReloadingForUpdate = false;
    let hasPendingReload = false;
    let pendingRegistration = null;

    function reloadWhenSafe() {
      if (isReloadingForUpdate) {
        return;
      }

      if (!canReloadForAppUpdate()) {
        hasPendingReload = true;
        return;
      }

      isReloadingForUpdate = true;
      window.location.reload();
    }

    function activateUpdateWhenSafe(registration) {
      if (!registration) {
        return;
      }

      pendingRegistration = registration;
      shouldReloadOnControllerChange = true;

      if (!canReloadForAppUpdate()) {
        return;
      }

      activateWaitingWorker(registration);
      pendingRegistration = null;
    }

    function retryPendingUpdate() {
      if (pendingRegistration && canReloadForAppUpdate()) {
        activateUpdateWhenSafe(pendingRegistration);
      }

      if (hasPendingReload && canReloadForAppUpdate()) {
        hasPendingReload = false;
        reloadWhenSafe();
      }
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!shouldReloadOnControllerChange) {
        return;
      }

      reloadWhenSafe();
    });

    window.addEventListener(APP_ROUTE_CHANGED_EVENT, retryPendingUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        retryPendingUpdate();
      }
    });

    navigator.serviceWorker
      .register(getPublicAssetPath("/service-worker.js"))
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          activateUpdateWhenSafe(registration);
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;

          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              activateUpdateWhenSafe(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error("Erreur enregistrement service worker:", error);
      });
  });
}

function getPublicAssetPath(path) {
  const publicUrl = process.env.PUBLIC_URL || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicUrl}${normalizedPath}`;
}

function notifyUpdateAvailable() {
  window.dispatchEvent(new Event("showscore:update-available"));
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
    navigator.serviceWorker
      .register(getPublicAssetPath("/service-worker.js"))
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;

          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
            }
          });
        });
      })
      .catch((error) => {
        console.error("Erreur enregistrement service worker:", error);
      });
  });
}

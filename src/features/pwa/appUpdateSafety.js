export const APP_ROUTE_CHANGED_EVENT = "showscore:route-changed";

const SCRIBE_SCORING_PATH_PATTERN =
  /^\/associations\/[^/]+\/scribe\/classes\/[^/]+/;

export function isScribeScoringPath(pathname = "") {
  return SCRIBE_SCORING_PATH_PATTERN.test(String(pathname || ""));
}

export function canReloadForAppUpdate(pathname = getCurrentPathname()) {
  return !isScribeScoringPath(pathname);
}

export function dispatchAppRouteChanged(pathname) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(APP_ROUTE_CHANGED_EVENT, {
      detail: { pathname },
    })
  );
}

function getCurrentPathname() {
  if (typeof window === "undefined") return "";
  return window.location?.pathname || "";
}

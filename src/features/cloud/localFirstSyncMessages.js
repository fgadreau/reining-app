import {
  LOCAL_FIRST_SYNC_STATUSES,
  getLocalFirstSyncState,
} from "./localFirstSync";

export function formatLocalFirstSyncNotice(value, t) {
  const state = getLocalFirstSyncState(value);

  if (state.status === LOCAL_FIRST_SYNC_STATUSES.ERROR) {
    const translatedError =
      state.errorCode === "SHOWSCORE_AUTH_SESSION_EXPIRED"
        ? t("common.authSessionExpired")
        : state.errorCode === "SHOWSCORE_WRITE_ACCESS_DENIED"
          ? t("common.associationWriteAccessDenied")
          : state.errorMessage || "";

    return t("common.localFirstSyncError", {
      message: translatedError,
    });
  }

  if (state.status === LOCAL_FIRST_SYNC_STATUSES.LOCAL) {
    return t("common.localFirstSyncLocal");
  }

  return t("common.cloudSynced");
}

export function getLocalFirstSyncNoticeTone(value) {
  const state = getLocalFirstSyncState(value);

  if (state.status === LOCAL_FIRST_SYNC_STATUSES.ERROR) return "warn";
  if (state.status === LOCAL_FIRST_SYNC_STATUSES.LOCAL) return "local";
  return "synced";
}

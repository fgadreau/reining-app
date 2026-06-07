import {
  LOCAL_FIRST_SYNC_STATUSES,
  getLocalFirstSyncState,
} from "./localFirstSync";

export function formatLocalFirstSyncNotice(value, t) {
  const state = getLocalFirstSyncState(value);

  if (state.status === LOCAL_FIRST_SYNC_STATUSES.ERROR) {
    return t("common.localFirstSyncError", {
      message: state.errorMessage || "",
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

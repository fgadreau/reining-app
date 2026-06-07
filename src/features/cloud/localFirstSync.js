export const LOCAL_FIRST_SYNC_STATUSES = {
  LOCAL: "local",
  SYNCED: "synced",
  ERROR: "error",
};

const SYNC_STATE_KEY = "_localFirstSync";

export function buildLocalFirstSyncState({ status, error = null } = {}) {
  const normalizedStatus = Object.values(LOCAL_FIRST_SYNC_STATUSES).includes(status)
    ? status
    : LOCAL_FIRST_SYNC_STATUSES.LOCAL;

  return {
    status: normalizedStatus,
    errorMessage: getErrorMessage(error),
  };
}

export function withLocalFirstSyncState(value, state) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return {
    ...value,
    [SYNC_STATE_KEY]: buildLocalFirstSyncState(state),
  };
}

export function getLocalFirstSyncState(value) {
  return buildLocalFirstSyncState(value?.[SYNC_STATE_KEY]);
}

export function isLocalFirstSyncError(value) {
  return (
    getLocalFirstSyncState(value).status === LOCAL_FIRST_SYNC_STATUSES.ERROR
  );
}

export function getLocalFirstSyncErrorMessage(value) {
  return getLocalFirstSyncState(value).errorMessage;
}

function getErrorMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  return String(error?.message || error || "");
}

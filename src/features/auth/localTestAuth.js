export const LOCAL_TEST_AUTH_CHANGED_EVENT = "showscore:local-test-auth-changed";
export const LOCAL_TEST_AUTH_STORAGE_KEY = "showscore_local_test_auth_v1";
export const LOCAL_TEST_EMAIL = "test@showscore.local";
export const LOCAL_TEST_PASSWORD = "test1234";

export function isLocalTestAuthAvailable() {
  if (process.env.REACT_APP_ENABLE_LOCAL_TEST_LOGIN === "true") {
    return true;
  }

  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "development";
  }

  const hostname = window.location.hostname;
  return (
    process.env.NODE_ENV === "development" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}

export function createLocalTestUser() {
  return {
    id: "local-test-user",
    email: LOCAL_TEST_EMAIL,
    isLocalTestUser: true,
    app_metadata: {
      provider: "local-test",
    },
    user_metadata: {
      display_name: "Test local",
      name: "Test local",
    },
  };
}

export function isLocalTestUser(user) {
  return Boolean(
    user?.isLocalTestUser || user?.app_metadata?.provider === "local-test"
  );
}

export function loadLocalTestSession() {
  if (!isLocalTestAuthAvailable() || typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(LOCAL_TEST_AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed?.user && isLocalTestUser(parsed.user) ? parsed : null;
  } catch (error) {
    console.error("Erreur session test local:", error);
    return null;
  }
}

export function hasLocalTestSession() {
  return Boolean(loadLocalTestSession()?.user);
}

export function saveLocalTestSession() {
  if (!isLocalTestAuthAvailable() || typeof localStorage === "undefined") {
    return null;
  }

  const session = {
    access_token: "local-test-token",
    token_type: "bearer",
    user: createLocalTestUser(),
    expires_at: null,
  };

  localStorage.setItem(LOCAL_TEST_AUTH_STORAGE_KEY, JSON.stringify(session));
  notifyLocalTestAuthChanged();
  return session;
}

export function clearLocalTestSession() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(LOCAL_TEST_AUTH_STORAGE_KEY);
  }

  notifyLocalTestAuthChanged();
}

export function notifyLocalTestAuthChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(LOCAL_TEST_AUTH_CHANGED_EVENT));
}

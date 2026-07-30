import { getSupabaseClient, isSupabaseConfigured } from "../cloud/supabaseClient";
import {
  LOCAL_TEST_AUTH_CHANGED_EVENT,
  LOCAL_TEST_EMAIL,
  LOCAL_TEST_PASSWORD,
  clearLocalTestSession,
  isLocalTestAuthAvailable,
  loadLocalTestSession,
  saveLocalTestSession,
} from "./localTestAuth";

const userProfileSyncStates = new Map();

export function isAuthAvailable() {
  return isSupabaseConfigured();
}

function getUserProfileIdentity(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.name ||
    email.split("@")[0] ||
    "";

  return { email, displayName };
}

function toSharedUserProfileRow(user) {
  const { email, displayName } = getUserProfileIdentity(user);

  return {
    user_id: user.id,
    email,
    display_name: displayName,
  };
}

function getUserProfileFingerprint(row) {
  return JSON.stringify([
    row.user_id || "",
    row.email || "",
    row.display_name || "",
  ]);
}

function clearUserProfileSyncCache() {
  userProfileSyncStates.clear();
}

async function persistUserProfile(supabase, row) {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error("Erreur sauvegarde profil Supabase:", error);
    return null;
  }
}

export function saveUserProfile(user) {
  const supabase = getSupabaseClient();

  if (!supabase || !user?.id) {
    return Promise.resolve(null);
  }

  const row = toSharedUserProfileRow(user);
  const fingerprint = getUserProfileFingerprint(row);
  const state = userProfileSyncStates.get(user.id) || {
    savedFingerprint: null,
    savedProfile: null,
    pendingFingerprint: null,
    pendingPromise: null,
  };
  userProfileSyncStates.set(user.id, state);

  if (state.savedFingerprint === fingerprint) {
    return Promise.resolve(state.savedProfile);
  }

  if (state.pendingPromise) {
    if (state.pendingFingerprint === fingerprint) {
      return state.pendingPromise;
    }

    return state.pendingPromise.then(() => saveUserProfile(user));
  }

  const pendingPromise = persistUserProfile(supabase, row)
    .then((profile) => {
      if (profile) {
        state.savedFingerprint = fingerprint;
        state.savedProfile = profile;
      }

      return profile;
    })
    .finally(() => {
      if (state.pendingPromise === pendingPromise) {
        state.pendingFingerprint = null;
        state.pendingPromise = null;
      }
    });

  state.pendingFingerprint = fingerprint;
  state.pendingPromise = pendingPromise;
  return pendingPromise;
}

export async function getAuthSession() {
  const localSession = loadLocalTestSession();

  if (localSession) {
    return localSession;
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Erreur session Supabase:", error);
    return null;
  }

  if (data?.session?.user) {
    await saveUserProfile(data.session.user);
  }

  return data?.session || null;
}

export async function getAuthUser() {
  const session = await getAuthSession();
  return session?.user || null;
}

export async function signInWithEmail({ email, password }) {
  if (
    isLocalTestAuthAvailable() &&
    String(email || "").trim().toLowerCase() === LOCAL_TEST_EMAIL &&
    password === LOCAL_TEST_PASSWORD
  ) {
    return signInWithLocalTestUser();
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (data?.user) {
    await saveUserProfile(data.user);
  }

  return data;
}

export async function signInWithLocalTestUser() {
  const session = saveLocalTestSession();

  if (!session) {
    throw new Error("Le login de test local n'est pas disponible ici.");
  }

  return {
    session,
    user: session.user,
  };
}

export async function signUpWithEmail({
  email,
  password,
  emailRedirectTo,
  metadata = {},
}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const signUpPayload = {
    email,
    password,
  };

  const options = {};

  if (emailRedirectTo) {
    options.emailRedirectTo = emailRedirectTo;
  }

  if (metadata && Object.keys(metadata).length > 0) {
    options.data = metadata;
  }

  if (Object.keys(options).length > 0) {
    signUpPayload.options = options;
  }

  const { data, error } = await supabase.auth.signUp(signUpPayload);

  if (error) {
    throw error;
  }

  if (data?.user) {
    await saveUserProfile(data.user);
  }

  return data;
}

export async function requestPasswordReset({ email, redirectTo }) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, options);

  if (error) {
    throw error;
  }
}

export async function updatePassword(password) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  clearLocalTestSession();
  clearUserProfileSyncCache();

  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function onAuthStateChange(callback) {
  const handleLocalTestAuthChange = () => {
    const user = loadLocalTestSession()?.user || null;
    if (!user) {
      clearUserProfileSyncCache();
    }
    callback(user);
  };

  if (typeof window !== "undefined") {
    window.addEventListener(
      LOCAL_TEST_AUTH_CHANGED_EVENT,
      handleLocalTestAuthChange
    );
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          LOCAL_TEST_AUTH_CHANGED_EVENT,
          handleLocalTestAuthChange
        );
      }
    };
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const localSession = loadLocalTestSession();

    if (localSession?.user) {
      callback(localSession.user);
      return;
    }

    if (session?.user) {
      saveUserProfile(session.user);
    } else if (event === "SIGNED_OUT") {
      clearUserProfileSyncCache();
    }

    callback(session?.user || null, event);
  });

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        LOCAL_TEST_AUTH_CHANGED_EVENT,
        handleLocalTestAuthChange
      );
    }

    data?.subscription?.unsubscribe();
  };
}

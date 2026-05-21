import { getSupabaseClient, isSupabaseConfigured } from "../cloud/supabaseClient";

export function isAuthAvailable() {
  return isSupabaseConfigured();
}

function toUserProfileRow(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.name ||
    email.split("@")[0] ||
    "";

  return {
    id: user.id,
    email,
    display_name: displayName,
  };
}

export async function saveUserProfile(user) {
  const supabase = getSupabaseClient();

  if (!supabase || !user?.id) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(toUserProfileRow(user))
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.error("Erreur sauvegarde profil Supabase:", error);
    return null;
  }
}

export async function getAuthSession() {
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

export async function signUpWithEmail({ email, password }) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { data, error } = await supabase.auth.signUp({
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

export async function signOut() {
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
  const supabase = getSupabaseClient();

  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      saveUserProfile(session.user);
    }

    callback(session?.user || null);
  });

  return () => {
    data?.subscription?.unsubscribe();
  };
}

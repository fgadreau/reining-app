import { createClient } from "@supabase/supabase-js";
import { hasLocalTestSession } from "../auth/localTestAuth";

const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || "").trim();
const supabaseKey =
  (
    process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY ||
    ""
  ).trim();

let client = null;

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (error) {
    return false;
  }
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey && isValidSupabaseUrl(supabaseUrl));
}

export function getSupabaseClient() {
  if (hasLocalTestSession()) {
    return null;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!client) {
    try {
      client = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      console.error("Configuration Supabase invalide:", error);
      return null;
    }
  }

  return client;
}

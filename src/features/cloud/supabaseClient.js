import { createClient } from "@supabase/supabase-js";
import { hasLocalTestSession } from "../auth/localTestAuth";
import { getSupabaseConfigurationError } from "./deployEnvironment";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();
const supabaseConfigurationError = getSupabaseConfigurationError();

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
  return Boolean(
    supabaseUrl &&
      supabaseKey &&
      isValidSupabaseUrl(supabaseUrl) &&
      !supabaseConfigurationError
  );
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

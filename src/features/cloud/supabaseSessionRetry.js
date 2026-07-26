export const SUPABASE_AUTH_SESSION_EXPIRED_CODE =
  "SHOWSCORE_AUTH_SESSION_EXPIRED";
export const SUPABASE_WRITE_ACCESS_DENIED_CODE =
  "SHOWSCORE_WRITE_ACCESS_DENIED";

export function isRowLevelSecurityError(error) {
  const message = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ");

  return (
    error?.code === "42501" ||
    /row-level security|violates row level security|violates .* policy/i.test(
      message
    )
  );
}

function createSupabaseWriteError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  error.cause = cause;
  return error;
}

export async function retrySupabaseWriteAfterSessionRefresh(
  supabase,
  writeOperation
) {
  try {
    return await writeOperation();
  } catch (error) {
    if (
      !isRowLevelSecurityError(error) ||
      typeof supabase?.auth?.refreshSession !== "function"
    ) {
      throw error;
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !data?.session?.access_token) {
      throw createSupabaseWriteError(
        SUPABASE_AUTH_SESSION_EXPIRED_CODE,
        "Votre session Supabase a expiré. Reconnectez-vous à ShowScore, puis réessayez.",
        refreshError || error
      );
    }

    try {
      return await writeOperation();
    } catch (retryError) {
      if (!isRowLevelSecurityError(retryError)) {
        throw retryError;
      }

      throw createSupabaseWriteError(
        SUPABASE_WRITE_ACCESS_DENIED_CODE,
        "Votre session est active, mais Supabase refuse cette modification. Vérifiez votre rôle administrateur, puis réessayez.",
        retryError
      );
    }
  }
}

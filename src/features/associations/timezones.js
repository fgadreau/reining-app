const DEFAULT_TIMEZONE = "America/Montreal";

const FALLBACK_TIMEZONES = [
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Montreal",
  "America/New_York",
  "America/Chicago",
  "America/Winnipeg",
  "America/Regina",
  "America/Denver",
  "America/Edmonton",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Helsinki",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
];

export function getDetectedTimezone() {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      DEFAULT_TIMEZONE
    );
  } catch (error) {
    return DEFAULT_TIMEZONE;
  }
}

export function getAssociationTimezoneOptions() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const timezones = Intl.supportedValuesOf("timeZone");
      if (Array.isArray(timezones) && timezones.length > 0) {
        return timezones;
      }
    }
  } catch (error) {
    // Older browsers fall back to the curated list below.
  }

  return FALLBACK_TIMEZONES;
}

export function normalizeAssociationTimezone(value) {
  const timezone = String(value || "").trim();
  return timezone || getDetectedTimezone();
}

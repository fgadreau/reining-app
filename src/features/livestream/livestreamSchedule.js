import {
  getShowDateRange,
  isValidDateValue,
} from "../days/dayDateUtils";

export function normalizeLivestreamUrlsByDate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([date, url]) => [String(date || "").trim(), String(url || "").trim()])
      .filter(([date, url]) => isValidDateValue(date) && url)
      .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
  );
}

export function getDateValueInTimeZone(date = new Date(), timezone = "") {
  const safeDate = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(safeDate.getTime())) return "";

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: String(timezone || "").trim() || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(safeDate);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    return `${values.year}-${values.month}-${values.day}`;
  } catch (error) {
    if (String(timezone || "").trim()) {
      return getDateValueInTimeZone(safeDate, "");
    }

    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export function getCurrentShowDate(show, { timezone = "", now = new Date() } = {}) {
  const currentDate = getDateValueInTimeZone(now, timezone);
  return getShowDateRange(show).includes(currentDate) ? currentDate : "";
}

export function getLivestreamUrlsForShow(
  show,
  { timezone = "", now = new Date(), includeLegacy = true } = {}
) {
  const configuredUrls = normalizeLivestreamUrlsByDate(
    show?.livestreamUrlsByDate
  );

  if (Object.keys(configuredUrls).length > 0 || !includeLegacy) {
    return configuredUrls;
  }

  const legacyUrl = String(show?.livestreamUrl || "").trim();
  const showDates = getShowDateRange(show);

  if (!legacyUrl || showDates.length === 0) return {};

  const fallbackDate =
    getCurrentShowDate(show, { timezone, now }) || showDates[0];

  return { [fallbackDate]: legacyUrl };
}

export function getCurrentPublicLivestream(
  show,
  { timezone = "", now = new Date() } = {}
) {
  const currentDate = getDateValueInTimeZone(now, timezone);
  const showDate = getCurrentShowDate(show, { timezone, now });
  const urlsByDate = getLivestreamUrlsForShow(show, { timezone, now });

  return {
    currentDate,
    showDate,
    url:
      show?.isLivestreamPublic && showDate
        ? String(urlsByDate[showDate] || "").trim()
        : "",
  };
}

export function hasConfiguredLivestream(show) {
  return Boolean(
    Object.keys(normalizeLivestreamUrlsByDate(show?.livestreamUrlsByDate)).length ||
      String(show?.livestreamUrl || "").trim()
  );
}

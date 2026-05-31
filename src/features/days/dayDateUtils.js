const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SHOW_DAY_COUNT = 370;

export function parseDateValue(value) {
  if (!DATE_VALUE_PATTERN.test(String(value || ""))) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isValidDateValue(value) {
  return Boolean(parseDateValue(value));
}

export function compareDateValues(a, b) {
  const first = isValidDateValue(a) ? a : "";
  const second = isValidDateValue(b) ? b : "";

  if (first && second) return first.localeCompare(second);
  if (first) return -1;
  if (second) return 1;
  return 0;
}

export function enumerateDateRange(startDate, endDate = startDate) {
  const start = parseDateValue(startDate);
  const end = parseDateValue(endDate || startDate);

  if (!start || !end || start > end) {
    return [];
  }

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < MAX_SHOW_DAY_COUNT) {
    dates.push(formatDateValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getShowDateRange(show) {
  if (!show?.startDate) return [];
  return enumerateDateRange(show.startDate, show.endDate || show.startDate);
}

export function isDateInShowRange(dateValue, show) {
  if (!isValidDateValue(dateValue)) return false;

  const range = getShowDateRange(show);
  return range.includes(dateValue);
}

export function getSortOrderForShowDate(dateValue, show) {
  const index = getShowDateRange(show).indexOf(dateValue);
  return index >= 0 ? index + 1 : 1;
}

export function formatDayLabel(dateValue, language = "fr") {
  const date = parseDateValue(dateValue);

  if (!date) return "";

  const locale = language === "en" ? "en-CA" : "fr-CA";

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function sortDaysByDate(days) {
  return [...(Array.isArray(days) ? days : [])].sort((a, b) => {
    const dateOrder = compareDateValues(a?.date, b?.date);
    if (dateOrder !== 0) return dateOrder;

    const sortOrder = (a?.sortOrder || 0) - (b?.sortOrder || 0);
    if (sortOrder !== 0) return sortOrder;

    return String(a?.label || "").localeCompare(String(b?.label || ""));
  });
}

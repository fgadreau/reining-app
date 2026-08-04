import { formatDateValue, sortDaysByDate } from "./dayDateUtils";

export const SHOW_DAY_QUERY_PARAM = "day";

export function resolveActiveShowDayId(
  days,
  requestedDayId = "",
  today = formatDateValue(new Date())
) {
  const sortedDays = sortDaysByDate(days);
  if (sortedDays.length === 0) return "";

  if (sortedDays.some((day) => day.id === requestedDayId)) {
    return requestedDayId;
  }

  const todayDay = sortedDays.find((day) => day.date === today);
  if (todayDay) return todayDay.id;

  const nextDay = sortedDays.find((day) => day.date && day.date > today);
  if (nextDay) return nextDay.id;

  return sortedDays.at(-1)?.id || sortedDays[0]?.id || "";
}

export function getShowDayQueryPath(path, dayId) {
  if (!dayId) return path;

  const separator = String(path).includes("?") ? "&" : "?";
  return `${path}${separator}${SHOW_DAY_QUERY_PARAM}=${encodeURIComponent(dayId)}`;
}

export function filterShowDaySections(sections, dayId) {
  const source = Array.isArray(sections) ? sections : [];
  if (!dayId) return source;
  return source.filter((section) => section?.day?.id === dayId);
}

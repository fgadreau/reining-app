import React, { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDayLabel, sortDaysByDate } from "../features/days/dayDateUtils";
import {
  SHOW_DAY_QUERY_PARAM,
  resolveActiveShowDayId,
} from "../features/days/showDayNavigation";
import { useTranslation } from "../features/i18n/I18nProvider";

export function useShowDaySelection(days) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortedDays = useMemo(() => sortDaysByDate(days), [days]);
  const requestedDayId = searchParams.get(SHOW_DAY_QUERY_PARAM) || "";
  const activeDayId = resolveActiveShowDayId(sortedDays, requestedDayId);

  const selectDay = useCallback(
    (dayId) => {
      if (!sortedDays.some((day) => day.id === dayId)) return;

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set(SHOW_DAY_QUERY_PARAM, dayId);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams, sortedDays]
  );

  return {
    activeDayId,
    days: sortedDays,
    selectDay,
  };
}

function ShowDayTabs({
  days,
  activeDayId,
  onChange,
  countsByDayId = {},
}) {
  const { t, language } = useTranslation();
  const sortedDays = useMemo(() => sortDaysByDate(days), [days]);

  if (sortedDays.length === 0) return null;

  return (
    <nav
      aria-label={t("management.days.tabsLabel")}
      style={tabsShellStyle}
    >
      <div role="tablist" style={tabListStyle}>
        {sortedDays.map((day, index) => {
          const isActive = day.id === activeDayId;
          const count = countsByDayId?.[day.id];
          const label =
            day.label ||
            formatDayLabel(day.date, language) ||
            t("management.days.newDayLabel", { order: index + 1 });

          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-show-day-tab={day.id}
              onClick={() => onChange?.(day.id)}
              style={tabStyle(isActive)}
            >
              <span style={tabLabelStyle}>{label}</span>
              <span style={tabMetaStyle(isActive)}>
                {day.date || t("public.results.dateTbd")}
                {Number.isFinite(count) ? ` · ${count}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const tabsShellStyle = {
  background: "#fff",
  border: "1px solid #dbe4ee",
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
  marginBottom: 16,
  overflowX: "auto",
  padding: 6,
};

const tabListStyle = {
  display: "flex",
  gap: 6,
  minWidth: "max-content",
};

const tabStyle = (isActive) => ({
  appearance: "none",
  background: isActive ? "#0f766e" : "transparent",
  border: isActive ? "1px solid #0f766e" : "1px solid transparent",
  borderRadius: 9,
  color: isActive ? "#fff" : "#0f172a",
  cursor: "pointer",
  display: "grid",
  gap: 2,
  minHeight: 52,
  padding: "8px 14px",
  textAlign: "left",
});

const tabLabelStyle = {
  fontSize: 14,
  fontWeight: 800,
};

const tabMetaStyle = (isActive) => ({
  color: isActive ? "#ccfbf1" : "#64748b",
  fontSize: 12,
  fontWeight: 600,
});

export default ShowDayTabs;

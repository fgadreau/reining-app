const FRESH_SECONDS = 180;
const DANGER_SECONDS = 900;

export function formatLiveDataFreshness(updatedAt, now = new Date(), t) {
  const updatedTime = Date.parse(updatedAt);

  if (!Number.isFinite(updatedTime)) {
    return {
      label: translateFreshness(t, "freshness.unknown", "Mise à jour inconnue"),
      tone: "muted",
      ageSeconds: null,
    };
  }

  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const ageSeconds = Math.max(
    Math.round(((Number.isFinite(nowTime) ? nowTime : Date.now()) - updatedTime) / 1000),
    0
  );
  const ageLabel = formatAge(ageSeconds, t);

  if (ageSeconds <= FRESH_SECONDS) {
    return {
      label: translateFreshness(t, "freshness.current", `À jour · ${ageLabel}`, {
        age: ageLabel,
      }),
      tone: "success",
      ageSeconds,
    };
  }

  return {
    label: translateFreshness(
      t,
      "freshness.pending",
      `En attente de mise à jour depuis ${ageLabel}`,
      { age: ageLabel }
    ),
    tone: ageSeconds >= DANGER_SECONDS ? "danger" : "warn",
    ageSeconds,
  };
}

function formatAge(seconds, t) {
  if (seconds < 60) {
    return translateFreshness(t, "freshness.underMinute", "moins d’une minute");
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

function translateFreshness(t, key, fallback, params) {
  return typeof t === "function" ? t(key, params) : fallback;
}

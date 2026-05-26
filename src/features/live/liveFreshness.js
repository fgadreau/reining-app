const FRESH_SECONDS = 180;
const DANGER_SECONDS = 900;

export function formatLiveDataFreshness(updatedAt, now = new Date()) {
  const updatedTime = Date.parse(updatedAt);

  if (!Number.isFinite(updatedTime)) {
    return {
      label: "Mise à jour inconnue",
      tone: "muted",
      ageSeconds: null,
    };
  }

  const nowTime = now instanceof Date ? now.getTime() : Date.parse(now);
  const ageSeconds = Math.max(
    Math.round(((Number.isFinite(nowTime) ? nowTime : Date.now()) - updatedTime) / 1000),
    0
  );
  const ageLabel = formatAge(ageSeconds);

  if (ageSeconds <= FRESH_SECONDS) {
    return {
      label: `À jour · ${ageLabel}`,
      tone: "success",
      ageSeconds,
    };
  }

  return {
    label: `En attente de mise à jour depuis ${ageLabel}`,
    tone: ageSeconds >= DANGER_SECONDS ? "danger" : "warn",
    ageSeconds,
  };
}

function formatAge(seconds) {
  if (seconds < 60) {
    return "moins d’une minute";
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

export function calculateChampionshipPoints(entryCount, placeNum, tieCount = 1) {
  const maxPoints = Math.min(Math.max(toNumber(entryCount), 0), 10);
  const place = toNumber(placeNum);
  const count = Math.max(1, toNumber(tieCount) || 1);

  if (place <= 0 || maxPoints === 0) {
    return 0;
  }

  let sum = 0;
  for (let rank = place; rank <= place + count - 1; rank += 1) {
    sum += Math.max(maxPoints - rank + 1, 0);
  }

  return sum / count;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  const normalized = String(value)
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatChampionshipPoints(value, digits = 2) {
  const number = toNumber(value);

  if (Math.abs(number - Math.round(number)) < 1e-9) {
    return String(Math.round(number));
  }

  return number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatChampionshipMoney(value) {
  const number = toNumber(value);

  return `${number.toFixed(2)} $`;
}

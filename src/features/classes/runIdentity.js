import { getRunIntegrationMetadata } from "./classSetupStorage";

function cleanIdentityPart(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanBackNumber(value) {
  return cleanIdentityPart(value).replace(/^#/, "");
}

function getRunDraw(run) {
  const value = run?.draw ?? run?.order;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function getRunRider(run) {
  return cleanIdentityPart(run?.rider ?? run?.riderName ?? run?.rider_name);
}

function getRunHorse(run) {
  return cleanIdentityPart(run?.horse ?? run?.horseName ?? run?.horse_name);
}

function getRunClassCodes(run) {
  return Array.from(
    new Set(
      (Array.isArray(run?.classCodes) ? run.classCodes : [])
        .map(cleanIdentityPart)
        .filter(Boolean)
    )
  ).sort();
}

function addKey(keys, parts) {
  if (parts.every(Boolean)) {
    keys.push(parts.join("|"));
  }
}

export function getRunIdentityKeys(run, options = {}) {
  const backNumber = cleanBackNumber(run?.backNumber ?? run?.back_number);
  const rider = getRunRider(run);
  const horse = getRunHorse(run);
  const draw = getRunDraw(run);
  const classCodeKey = getRunClassCodes(run).join(",");
  const keys = [];

  addKey(keys, ["back-rider-horse-codes", backNumber, rider, horse, classCodeKey]);
  addKey(keys, ["back-rider-horse", backNumber, rider, horse]);
  addKey(keys, ["rider-horse-codes", rider, horse, classCodeKey]);
  addKey(keys, ["rider-horse", rider, horse]);
  addKey(keys, ["back-rider", backNumber, rider]);
  addKey(keys, ["back-horse", backNumber, horse]);

  if (options.includeDraw) {
    addKey(keys, ["draw-rider-horse", draw, rider, horse]);
    addKey(keys, ["draw-back-rider", draw, backNumber, rider]);
    addKey(keys, ["draw-back-horse", draw, backNumber, horse]);
  }

  return Array.from(new Set(keys));
}

export function getRunUsageKey(run, index = 0) {
  return run?.id ? `id:${run.id}` : `index:${index}`;
}

export function buildUniqueRunIdentityIndex(runs, options = {}) {
  const index = new Map();

  (Array.isArray(runs) ? runs : []).forEach((run, runIndex) => {
    getRunIdentityKeys(run, options).forEach((key) => {
      const existing = index.get(key);

      if (existing) {
        index.set(key, { duplicate: true, run: null, runIndex: -1 });
        return;
      }

      index.set(key, { duplicate: false, run, runIndex });
    });
  });

  return index;
}

export function findRunIdentityMatch(run, index, usedKeys = new Set(), options = {}) {
  for (const key of getRunIdentityKeys(run, options)) {
    const candidate = index.get(key);

    if (!candidate || candidate.duplicate || !candidate.run) continue;

    const usageKey = getRunUsageKey(candidate.run, candidate.runIndex);
    if (usedKeys.has(usageKey)) continue;

    return candidate;
  }

  return null;
}

export function mergeImportedRunsWithExistingIds(importedRuns, existingRuns) {
  const existingIndex = buildUniqueRunIdentityIndex(existingRuns, {
    includeDraw: false,
  });
  const usedExistingKeys = new Set();

  return (Array.isArray(importedRuns) ? importedRuns : []).map((importedRun) => {
    const match = findRunIdentityMatch(importedRun, existingIndex, usedExistingKeys, {
      includeDraw: false,
    });

    if (!match?.run?.id) {
      return importedRun;
    }

    usedExistingKeys.add(getRunUsageKey(match.run, match.runIndex));

    return {
      ...getRunIntegrationMetadata(match.run),
      ...importedRun,
      id: match.run.id,
    };
  });
}

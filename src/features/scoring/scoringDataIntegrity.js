function hasNonEmptyValue(value) {
  return String(value ?? "").trim() !== "";
}

export function runHasScoringData(run, options = {}) {
  const scores = Array.isArray(run?.scores) ? run.scores : [];
  const penalties = Array.isArray(run?.penalties) ? run.penalties : [];
  const isActive = Boolean(run?.isActive);
  const includeActive = options.includeActive !== false;

  return (
    scores.some(hasNonEmptyValue) ||
    penalties.some(hasNonEmptyValue) ||
    (includeActive && isActive)
  );
}

export function countRunsWithScoringData(runs, options = {}) {
  return (Array.isArray(runs) ? runs : []).filter((run) =>
    runHasScoringData(run, options)
  ).length;
}

export function buildScoringDataLossWarning(previousRuns, nextRuns) {
  const previousCount = countRunsWithScoringData(previousRuns, {
    includeActive: false,
  });
  const nextCount = countRunsWithScoringData(nextRuns, {
    includeActive: false,
  });

  if (previousCount > 0 && nextCount === 0) {
    return {
      previousCount,
      nextCount,
      severity: "blocked",
    };
  }

  if (previousCount > 0 && nextCount < previousCount) {
    return {
      previousCount,
      nextCount,
      severity: "warning",
    };
  }

  return null;
}

function textHasScratch(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "scr" || text.includes("scratch");
}

export function isSetupRunScratched(run) {
  return (
    run?.scratched === true ||
    textHasScratch(run?.status) ||
    textHasScratch(run?.scoreTotal) ||
    textHasScratch(run?.score) ||
    textHasScratch(run?.owner)
  );
}

export function applySetupRunScratchPenalty(run, penalties = []) {
  const nextPenalties = Array.isArray(penalties) ? [...penalties] : [];

  if (
    !isSetupRunScratched(run) ||
    nextPenalties.some((penalty) => textHasScratch(penalty))
  ) {
    return nextPenalties;
  }

  if (!nextPenalties.length) {
    nextPenalties.push("");
  }

  const emptyIndex = nextPenalties.findIndex(
    (penalty) => !String(penalty || "").trim()
  );
  const targetIndex = emptyIndex >= 0 ? emptyIndex : 0;
  nextPenalties[targetIndex] = [nextPenalties[targetIndex], "Scratch"]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  return nextPenalties;
}

export function buildSetupRunScoringPenalties(run, targetLength = 0) {
  const parsedLength = Number.parseInt(targetLength, 10);
  const length = Math.max(
    Number.isFinite(parsedLength) ? parsedLength : 0,
    isSetupRunScratched(run) ? 1 : 0
  );
  const penalties = Array.from({ length }, () => "");

  return applySetupRunScratchPenalty(run, penalties);
}

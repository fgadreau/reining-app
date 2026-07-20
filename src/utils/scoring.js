function readLeadingScoreNumber(value) {
  if (!value) return null;

  const text = String(value).trim().replace(",", ".");
  if (!text) return null;

  const match = text.match(
    /^([+-])?\s*(?:(\d+)\s*½|(\d+)\s+1\/2|(½|1\/2)|(\d+(?:\.\d+)?|\.\d+))(.*)$/
  );

  if (!match) {
    return null;
  }

  const signText = match[1] || "";
  const sign = signText === "-" ? -1 : 1;
  let numericValue = null;

  if (match[2]) {
    numericValue = Number(match[2]) + 0.5;
  } else if (match[3]) {
    numericValue = Number(match[3]) + 0.5;
  } else if (match[4]) {
    numericValue = 0.5;
  } else if (match[5]) {
    numericValue = Number.parseFloat(match[5]);
  }

  return Number.isFinite(numericValue)
    ? {
        numericValue: sign * numericValue,
        hasExplicitPlus: signText === "+",
        suffixText: match[6] || "",
      }
    : null;
}

function parseScoreNumber(value) {
  return readLeadingScoreNumber(value)?.numericValue ?? null;
}

function formatNumberAsFraction(value, hasExplicitPlus = false) {
  if (!Number.isFinite(value)) return "";

  const sign = value < 0 ? "-" : hasExplicitPlus && value > 0 ? "+" : "";
  const absoluteValue = Math.abs(value);
  const doubledValue = Math.round(absoluteValue * 2);

  if (Math.abs(absoluteValue * 2 - doubledValue) > 0.001) {
    return `${sign}${absoluteValue}`;
  }

  const whole = Math.floor(doubledValue / 2);
  const hasHalf = doubledValue % 2 === 1;

  if (!hasHalf) {
    return `${sign}${whole}`;
  }

  return `${sign}${whole ? whole : ""}½`;
}

export function parseScoreValue(value) {
  return parseScoreNumber(value) ?? 0;
}

export function parseScoreTotalValue(value) {
  return parseScoreNumber(value);
}

export function formatScoreValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const parsed = readLeadingScoreNumber(text);
  if (!parsed) return text;

  return formatNumberAsFraction(parsed.numericValue, parsed.hasExplicitPlus);
}

export function formatTotalValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const parsed = readLeadingScoreNumber(text);
  if (!parsed) return text;

  return `${formatNumberAsFraction(
    parsed.numericValue,
    parsed.hasExplicitPlus
  )}${parsed.suffixText}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePenaltyToken(token) {
  return String(token ?? "").replace(/\s+/g, " ").trim();
}

function isSpecialPenaltyToken(token, specialTokens = []) {
  const normalizedToken = normalizePenaltyToken(token);

  return specialTokens.some(
    (specialToken) => normalizePenaltyToken(specialToken) === normalizedToken
  );
}

export function splitPenaltyTokens(value, specialTokens = []) {
  const text = String(value ?? "").trim();
  if (!text) return [];

  let tokenizedText = text;
  const specialTokenByPlaceholder = new Map();
  const sortedSpecialTokens = [...specialTokens]
    .map(normalizePenaltyToken)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  sortedSpecialTokens.forEach((token, index) => {
    const placeholder = `__SPECIAL_PENALTY_${index}__`;

    specialTokenByPlaceholder.set(placeholder, token);
    tokenizedText = tokenizedText.replace(
      new RegExp(escapeRegExp(token), "g"),
      ` ${placeholder} `
    );
  });

  return tokenizedText
    .replace(/[+;]/g, ",")
    .split(/\s*,\s*|\s+/)
    .map((token) => specialTokenByPlaceholder.get(token) || token)
    .map(normalizePenaltyToken)
    .filter(Boolean);
}

export function formatPenaltyTokens(tokens = []) {
  return tokens.map(normalizePenaltyToken).filter(Boolean).join(", ");
}

export function formatPenaltyValue(value, specialTokens = []) {
  return formatPenaltyTokens(splitPenaltyTokens(value, specialTokens));
}

export function appendPenaltyToken(value, token, specialTokens = []) {
  const normalizedToken = normalizePenaltyToken(token);
  if (!normalizedToken) return formatPenaltyValue(value, specialTokens);

  if (isSpecialPenaltyToken(normalizedToken, specialTokens)) {
    return togglePenaltySpecialToken(value, normalizedToken, specialTokens);
  }

  return formatPenaltyTokens([
    ...splitPenaltyTokens(value, specialTokens),
    normalizedToken,
  ]);
}

export function removeLastPenaltyToken(value, specialTokens = []) {
  const tokens = splitPenaltyTokens(value, specialTokens);

  return formatPenaltyTokens(tokens.slice(0, -1));
}

export function togglePenaltySpecialToken(value, token, specialTokens = []) {
  const normalizedToken = normalizePenaltyToken(token);
  const tokens = splitPenaltyTokens(value, specialTokens);
  const alreadySelected = tokens.includes(normalizedToken);
  const normalTokens = tokens.filter(
    (item) => !isSpecialPenaltyToken(item, specialTokens)
  );

  return formatPenaltyTokens(
    alreadySelected ? normalTokens : [...normalTokens, normalizedToken]
  );
}

export function parsePenaltyValue(value) {
  if (!value) return 0;

  const text = String(value)
    .replace(/\bP(2|5)\b/gi, "$1")
    .replace(/½|1\/2/g, "0.5");
  let total = 0;
  const numberRegex =
    /(^|[^A-Za-z0-9/.])([+-]?(?:\d+(?:[.,]\d+)?|\.\d+))(?=$|[^A-Za-z0-9/.])/g;

  for (const match of text.matchAll(numberRegex)) {
    const numberValue = Number.parseFloat(match[2].replace(",", "."));
    if (Number.isFinite(numberValue)) {
      total += numberValue;
    }
  }

  return total;
}

export function penaltyCellHasScoreZero(value) {
  if (!value) return false;
  return String(value).includes("Score 0");
}

export function penaltyCellHasOffPattern(value) {
  if (!value) return false;
  return String(value).includes("OP");
}

export function penaltyCellHasNoScore(value) {
  if (!value) return false;
  return String(value).includes("No score");
}

export function penaltyCellHasScratch(value) {
  if (!value) return false;
  return String(value).includes("Scratch");
}

export function penaltyCellHasVideoReview(value) {
  if (!value) return false;
  return String(value).includes("Révision vidéo");
}

export function penaltyCellHasDisqualification(value) {
  if (!value) return false;
  return String(value).includes("Disqualification");
}

export function getRunStatus(run) {
  if (run.penalties.some((cell) => penaltyCellHasVideoReview(cell))) {
    return "REVIEW";
  }

  if (run.penalties.some((cell) => penaltyCellHasDisqualification(cell))) {
    return "DQ";
  }

  if (run.penalties.some((cell) => penaltyCellHasScratch(cell))) {
    return "SCR";
  }

  if (run.penalties.some((cell) => penaltyCellHasNoScore(cell))) {
    return "NS";
  }

  if (run.penalties.some((cell) => penaltyCellHasScoreZero(cell))) {
    return "S0";
  }

  if (run.penalties.some((cell) => penaltyCellHasOffPattern(cell))) {
    return "OP";
  }

  return null;
}

export function runHasSpecialResult(run) {
  return ["DQ", "SCR", "NS", "S0"].includes(getRunStatus(run));
}

export function runHasVideoReview(run) {
  return getRunStatus(run) === "REVIEW";
}

export function runHasAnyData(run) {
  return run.scores.some((v) => v !== "") || run.penalties.some((v) => v !== "");
}

export function isScoredRunComplete(run, maneuverCount) {
  const scores = Array.isArray(run?.scores) ? run.scores : [];
  const penalties = Array.isArray(run?.penalties) ? run.penalties : [];

  if (!run?.backNumber) return false;

  if (runHasVideoReview({ ...run, scores, penalties })) {
    return false;
  }

  if (runHasSpecialResult({ ...run, scores, penalties })) {
    return true;
  }

  if (scores.length < maneuverCount) return false;

  for (let i = 0; i < maneuverCount; i += 1) {
    const scoreValue = String(scores[i] ?? "").trim();

    if (!scoreValue) {
      return false;
    }
  }

  return true;
}

export function recalculateRun(run, options = {}) {
  const baseScore = Number.isFinite(options.baseScore)
    ? options.baseScore
    : 70;
  const penaltyDisabledIndexes = new Set(options.penaltyDisabledIndexes || []);
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
  const scores = Array.isArray(run.scores) ? run.scores : [];
  const penTotalNumber = penalties.reduce(
    (sum, val, index) =>
      penaltyDisabledIndexes.has(index) ? sum : sum + parsePenaltyValue(val),
    0
  );

  const manoeuvreTotal = scores.reduce(
    (sum, val) => sum + parseScoreValue(val),
    0
  );

  const status = getRunStatus(run);

  let penTotalText = penTotalNumber ? formatScoreValue(penTotalNumber) : "";
  let scoreTotalText = runHasAnyData(run)
    ? formatScoreValue(baseScore + manoeuvreTotal - penTotalNumber)
    : "";

  if (status === "SCR") {
    penTotalText = penTotalText ? `${penTotalText} + Scratch` : "Scratch";
    scoreTotalText = runHasAnyData(run) ? "SCR" : "";
  }

  if (status === "REVIEW") {
    penTotalText = penTotalText
      ? `${penTotalText} + Révision vidéo`
      : "Révision vidéo";
    scoreTotalText = runHasAnyData(run) ? "Review" : "";
  }

  if (status === "DQ") {
    penTotalText = penTotalText
      ? `${penTotalText} + Disqualification`
      : "Disqualification";
    scoreTotalText = runHasAnyData(run) ? "DQ" : "";
  }

  if (status === "NS") {
    penTotalText = penTotalText ? `${penTotalText} + No score` : "No score";
    scoreTotalText = runHasAnyData(run) ? "NS" : "";
  }

  if (status === "S0") {
    penTotalText = penTotalText ? `${penTotalText} + Score 0` : "Score 0";
    scoreTotalText = runHasAnyData(run) ? "0" : "";
  }

  if (status === "OP") {
    penTotalText = penTotalText ? `${penTotalText} + OP` : "OP";
    scoreTotalText = scoreTotalText ? `${scoreTotalText} OP` : "";
  }

  return {
    ...run,
    penTotal: penTotalText,
    scoreTotal: scoreTotalText,
  };
}

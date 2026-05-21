const DEFAULT_HEADERS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];

const PATTERN_HEADERS = {
  "1": ["LR", "RR", "SB", "RS", "LS", "LLSL", "RLSL", "STOP"],
  "2": ["RSLL", "LSLL", "RR", "LR", "STOP", "RS", "LS"],
  "3": ["LR", "RR", "RLLS", "LLLS", "SB", "RS", "LS"],
  "4": ["RLLS", "RS", "LLLS", "LS", "F8", "RR", "LR", "SB"],
  "5": ["LLLS", "LS", "RLLS", "RS", "F8", "RR", "LR", "SB"],
  "6": ["RS", "LS", "LLLS", "RLLS", "LR", "RR", "STOP"],
  "7": ["LR", "RR", "SB", "RS", "LS", "RLLS", "LLLS", "STOP"],
  "8": ["LS", "RS", "RLSL", "LSLL", "LR", "RR", "STOP"],
  "9": ["SB", "RS", "LS", "LSLL", "RSLL", "RR", "LR", "STOP"],
  "10": ["SB", "RS", "LS", "RLLS", "LLLS", "LR", "RR", "STOP"],
  "11": ["LS", "RS", "RSLL", "LSLL", "RR", "LR", "SB"],
  "12": ["SB", "RS", "LS", "LLLS", "RLLS", "RR", "LR", "STOP"],
  "13": ["LLS", "RS", "RLS", "LS", "F8", "RR", "LR"],
  "14": ["LS", "RS", "RLLS", "LLLS", "LR", "RR", "SB"],
  "15": ["RS", "LS", "LLSL", "RLSL", "RR", "LR", "SB"],
  "16": ["SB", "LS", "RS", "RLLS", "LLLS", "LR", "RR", "STOP"],
  "17": ["LLS", "LS", "RLS", "RS", "F8", "RR", "LR", "SB"],
  "18": ["LLLS", "LS", "RLLS", "RS", "F8", "RR", "LR", "SB"],
  A: ["LLL", "LS", "RLL", "RS", "RR", "SB"],
  B: ["RR", "LR", "LLS", "LS", "RLS", "RS", "SB"],
};

export function getPatternHeaders(patternValue) {
  const key = String(patternValue || "").trim().toUpperCase();
  return PATTERN_HEADERS[key] || DEFAULT_HEADERS;
}

export function getPatternMoveCount(patternValue) {
  return getPatternHeaders(patternValue).length;
}
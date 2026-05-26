const DEFAULT_HEADERS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];

export const PATTERN_DISCIPLINES = {
  REINING: "reining",
  RANCH_RIDING: "ranch_riding",
  WESTERN_RIDING: "western_riding",
  TRAIL: "trail",
};

export const RANCH_APPEARANCE_HEADER = "RHA";
export const TRAIL_CUSTOM_PATTERN_ID = "TRAIL_CUSTOM";

export const CUSTOM_PATTERN_CONFIGS = {
  [PATTERN_DISCIPLINES.TRAIL]: {
    id: TRAIL_CUSTOM_PATTERN_ID,
    name: "Trail / Obstacle Western",
    discipline: PATTERN_DISCIPLINES.TRAIL,
    minManeuvers: 6,
    maxDescriptionLength: 80,
    defaultManeuverPrefix: "OB",
  },
};

const REINING_HEADERS = {
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

export const RANCH_ABBREVIATIONS = {
  W: "Walk",
  T: "Trot",
  ET: "Extended trot",
  CT: "Collect to a trot",
  LL: "Lope left lead",
  RL: "Lope right lead",
  EL: "Extended lope",
  ELL: "Extended lope left lead",
  ERL: "Extended lope right lead",
  CL: "Collect lope",
  LC: "Lead change simple or flying",
  ST: "Stop",
  BK: "Back",
  STBK: "Stop and back",
  WL: "Walk over logs",
  TL: "Trot over logs",
  LOL: "Lope over logs",
  SP_L: "Side pass left",
  SP_R: "Side pass right",
  SP_L_LOG: "Side pass left over log",
  SP_R_LOG: "Side pass right over log",
  T360L: "360 turn left",
  T360R: "360 turn right",
  T360E: "360 turn either direction",
  T360B: "360 turn each direction",
  T180E: "180 / 1/2 turn either direction",
  T180R: "180 / 1/2 turn right",
  T90R: "1/4 turn right",
  T540R: "1 1/2 turn right",
  T540E: "1 1/2 turn either direction",
  RB_R: "Rollback right",
  TSERP: "Trot serpentine",
  ETSERP: "Extended trot serpentine",
  TCIRCLE: "Trot circle",
  LCIRCLE: "Lope circle",
  TSQUARE: "Trot square",
  TF8: "Trot figure 8",
  GATE_L_IN: "Left hand push gate into pen",
  GATE_R: "Right hand push gate",
  GATE_R_OUT: "Right hand push gate out",
  GATE_TO: "Side pass to gate",
  CATTLE: "Walk through cattle",
};

export const WESTERN_RIDING_ABBREVIATIONS = {
  WJOL: "Walk, jog over log",
  LL: "Lope left lead",
  RL: "Lope right lead",
  LE: "Lope around end",
  LC1: "1st line change",
  LC2: "2nd line change",
  LC3: "3rd line change",
  LC4: "4th line change",
  CC1: "1st crossing change",
  CC2: "2nd crossing change",
  CC3: "3rd crossing change",
  CC4: "4th crossing change",
  LOL: "Lope over log",
  CIR: "Circle",
  STBK: "Stop and back",
  CTR: "Lope up the center",
};

const REINING_ABBREVIATIONS = {
  LR: "Left rollback",
  RR: "Right rollback",
  SB: "Stop and back",
  RS: "Right spins",
  LS: "Left spins",
  F8: "Figure 8",
  STOP: "Stop",
  LLS: "Left lead circles",
  RLS: "Right lead circles",
  LLL: "Left lead large circle",
  RLL: "Right lead large circle",
  LLLS: "Left lead circle sequence",
  RLLS: "Right lead circle sequence",
  LLSL: "Left lead circle sequence",
  RLSL: "Right lead circle sequence",
  LSLL: "Lead circle sequence",
  RSLL: "Lead circle sequence",
};

const RANCH_RIDING_PATTERNS = [
  {
    id: "RR1",
    name: "Ranch Riding #1",
    maneuvers: ["W", "T", "ET/ST", "T360L", "LL_1/2_CIRCLE", "LC", "RL_1/2_CIRCLE", "ERL", "CL", "ET", "WL", "STBK"],
  },
  {
    id: "RR2",
    name: "Ranch Riding #2",
    maneuvers: ["W", "T", "ET", "LL", "ST/T540R", "EL", "CL_RL", "LC/LL", "W", "WL", "T", "ET", "STBK"],
  },
  {
    id: "RR3",
    name: "Ranch Riding #3",
    maneuvers: ["W", "TSERP", "LL", "LC", "RL", "EL", "ET", "CT", "TL", "ST/T360B", "W/STBK"],
  },
  {
    id: "RR4",
    name: "Ranch Riding #4",
    maneuvers: ["W", "T", "ERL", "RL", "LC", "LL", "ET", "ST/SP_L/SP_R", "WL", "W", "TSQUARE", "ST/T360L/BK"],
  },
  {
    id: "RR5",
    name: "Ranch Riding #5",
    maneuvers: ["W", "WL", "T", "RL", "ET", "T", "LL", "LC", "ERL", "CL", "T", "W", "STBK", "T360B"],
  },
  {
    id: "RR6",
    name: "Ranch Riding #6",
    maneuvers: ["W", "WL", "RL", "ERL", "T", "ST/T540R", "W", "T", "ET", "LL", "STBK", "SP_R"],
  },
  {
    id: "RR7",
    name: "Ranch Riding #7",
    maneuvers: ["W", "T", "ET", "STBK", "SP_R_LOG", "T90R/WL", "W", "LL", "ELL", "CL/LC", "RL", "T", "ST/T360E"],
  },
  {
    id: "RR8",
    name: "Ranch Riding #8",
    maneuvers: ["W", "SP_L_LOG/SP_R_HALF", "WL", "ET", "T", "ST/T360B", "RL", "ERL", "CL/LC/LL", "W", "LL", "ET", "T", "STBK"],
  },
  {
    id: "RR9",
    name: "Ranch Riding #9",
    maneuvers: ["T", "TL_2SETS", "TCIRCLE/ST/SP_L_LOG", "W", "RL", "LC", "LL", "ELL", "ET", "T", "W", "STBK", "T360B"],
  },
  {
    id: "RR10",
    name: "Ranch Riding #10",
    maneuvers: ["W", "ET", "W", "ST/SP_L_LOG", "T", "RL", "ERL", "CL/LC", "LL", "STBK", "T180R", "T"],
  },
  {
    id: "RR11",
    name: "Ranch Riding #11",
    maneuvers: ["W", "TSERP", "W", "ET", "T", "LL", "LOL", "ELL", "CL/LC", "RL", "LCIRCLE", "STBK", "GATE_TO/GATE_L_IN", "CATTLE/GATE_R_OUT"],
  },
  {
    id: "RR12",
    name: "Ranch Riding #12",
    maneuvers: ["W", "T", "TL/ST", "SP_R_LOG", "T540R", "ERL", "RL", "ET", "LL", "W", "T", "STBK"],
  },
  {
    id: "RR13",
    name: "Ranch Riding #13",
    maneuvers: ["W", "WL", "T", "ETSERP", "RL", "LC", "ELL/CL", "ST/T540E", "T", "W_TO_GATE", "GATE_R", "W/LL", "STBK"],
  },
  {
    id: "RR14",
    name: "Ranch Riding #14",
    maneuvers: ["T", "ET", "LL", "ET", "W", "RL", "T", "ELL", "CL/LC/ERL/CL", "T", "GATE_L_IN", "WL", "GATE_R_OUT", "W", "ST/T360B", "BK"],
  },
  {
    id: "RR15",
    name: "Ranch Riding #15",
    maneuvers: ["ET", "ST/RB_R", "RL", "ERL", "T", "W", "WL", "W", "T", "ST/T360L", "LL", "STBK"],
  },
];

const SMALL_FRY_RANCH_RIDING_PATTERNS = [
  {
    id: "SFRR1",
    name: "Small Fry Ranch Riding #1",
    maneuvers: ["WL", "TSQUARE", "ET", "W", "STBK_2HL", "T180E", "W", "T", "ET", "CT", "W"],
  },
  {
    id: "SFRR2",
    name: "Small Fry Ranch Riding #2",
    maneuvers: ["W", "T_BETWEEN_LOGS", "ET", "W/STBK", "T360E", "WL", "T", "ET", "CT", "W"],
  },
  {
    id: "SFRR3",
    name: "Small Fry Ranch Riding #3",
    maneuvers: ["W", "ST/T360E", "WL", "TF8", "ET/ST", "T180R", "ET", "CT", "W"],
  },
  {
    id: "SFRR4",
    name: "Small Fry Ranch Riding #4",
    maneuvers: ["WL", "T", "ET", "CT", "ST", "T180E", "ET", "CT", "W", "STBK"],
  },
  {
    id: "SFRR5",
    name: "Small Fry Ranch Riding #5",
    maneuvers: ["W", "T", "ET", "TL", "W", "ST", "BK", "T180E", "W"],
  },
];

const WESTERN_RIDING_PATTERNS = [
  {
    id: "WR1",
    name: "Western Riding #1",
    maneuvers: [
      "WJOL",
      "LL/LE",
      "LC1",
      "LC2",
      "LC3",
      "LC4/LE",
      "CC1",
      "CC2",
      "LOL",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "WR2",
    name: "Western Riding #2",
    maneuvers: [
      "WJOL",
      "LL",
      "CC1",
      "CC2",
      "CC3",
      "CIR/LC1",
      "LC2",
      "LC3",
      "LC4/CIR",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "WR3",
    name: "Western Riding #3",
    maneuvers: [
      "WJOL",
      "LL",
      "CC1",
      "LOL",
      "CC2",
      "LC1",
      "LC2",
      "LC3",
      "LC4",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "WR4",
    name: "Western Riding #4",
    maneuvers: [
      "WJOL",
      "RL",
      "LC1",
      "LC2",
      "LC3",
      "LC4",
      "CC1",
      "CC2",
      "CC3",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "WR5",
    name: "Western Riding #5",
    maneuvers: [
      "WJOL",
      "LL",
      "LC1",
      "LC2",
      "LC3",
      "LC4",
      "CC1",
      "LOL",
      "CC2",
      "CC3",
      "CC4",
      "STBK",
    ],
  },
  {
    id: "WR6",
    name: "Western Riding #6",
    maneuvers: [
      "WJOL",
      "RL/LE",
      "LC1",
      "LC2",
      "LC3",
      "LC4/LE",
      "CC1",
      "CC2",
      "LOL",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "WR7",
    name: "Western Riding #7",
    maneuvers: [
      "WJOL",
      "RL",
      "CC1",
      "CC2",
      "CC3",
      "CIR/LC1",
      "LC2",
      "LC3",
      "LC4/CIR",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "WR8",
    name: "Western Riding #8",
    maneuvers: [
      "WJOL",
      "RL",
      "CC1",
      "LOL",
      "CC2",
      "LC1",
      "LC2",
      "LC3",
      "LC4",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "WR9",
    name: "Western Riding #9",
    maneuvers: [
      "WJOL",
      "LL",
      "LC1",
      "LC2",
      "LC3",
      "LC4",
      "CC1",
      "CC2",
      "CC3",
      "LOL",
      "STBK",
    ],
  },
];

const LEVEL_1_WESTERN_RIDING_PATTERNS = [
  {
    id: "L1WR1",
    name: "Level 1 Western Riding #1",
    maneuvers: [
      "WJOL",
      "LL/LE",
      "LC1",
      "LC2/LE",
      "CC1",
      "CC2",
      "LOL",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "L1WR2",
    name: "Level 1 Western Riding #2",
    maneuvers: [
      "WJOL",
      "LL",
      "CC1",
      "CC2",
      "CC3",
      "CIR/LC1",
      "LC2/CIR",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "L1WR4",
    name: "Level 1 Western Riding #4",
    maneuvers: [
      "WJOL",
      "RL/LE",
      "LC1",
      "LC2/LE",
      "CC1",
      "CC2",
      "CC3",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "L1WR6",
    name: "Level 1 Western Riding #6",
    maneuvers: [
      "WJOL",
      "RL/LE",
      "LC1",
      "LC2/LE",
      "CC1",
      "CC2",
      "LOL",
      "CC3",
      "CC4",
      "CTR/STBK",
    ],
  },
  {
    id: "L1WR7",
    name: "Level 1 Western Riding #7",
    maneuvers: [
      "WJOL",
      "RL",
      "CC1",
      "CC2",
      "CC3",
      "CIR/LC1",
      "LC2/CIR",
      "LOL",
      "STBK",
    ],
  },
  {
    id: "L1WR9",
    name: "Level 1 Western Riding #9",
    maneuvers: [
      "WJOL",
      "LL/LE",
      "LC1",
      "LC2/LE",
      "CC1",
      "CC2",
      "CC3",
      "LOL",
      "STBK",
    ],
  },
];

const REINING_PATTERNS = Object.entries(REINING_HEADERS).map(
  ([number, headers]) => ({
    id: `R${number}`,
    legacyId: number,
    name: `Reining #${number}`,
    discipline: PATTERN_DISCIPLINES.REINING,
    maneuvers: headers,
  })
);

const PATTERN_DEFINITIONS = [
  ...REINING_PATTERNS,
  ...RANCH_RIDING_PATTERNS.map((pattern) => ({
    ...pattern,
    discipline: PATTERN_DISCIPLINES.RANCH_RIDING,
    maneuvers: [...pattern.maneuvers, RANCH_APPEARANCE_HEADER],
  })),
  ...SMALL_FRY_RANCH_RIDING_PATTERNS.map((pattern) => ({
    ...pattern,
    discipline: PATTERN_DISCIPLINES.RANCH_RIDING,
    maneuvers: [...pattern.maneuvers, RANCH_APPEARANCE_HEADER],
  })),
  ...WESTERN_RIDING_PATTERNS.map((pattern) => ({
    ...pattern,
    discipline: PATTERN_DISCIPLINES.WESTERN_RIDING,
  })),
  ...LEVEL_1_WESTERN_RIDING_PATTERNS.map((pattern) => ({
    ...pattern,
    discipline: PATTERN_DISCIPLINES.WESTERN_RIDING,
  })),
  ...Object.values(CUSTOM_PATTERN_CONFIGS).map((config) => ({
    id: config.id,
    name: config.name,
    discipline: config.discipline,
    isCustom: true,
    maneuvers: [],
  })),
];

export const PATTERN_OPTION_GROUPS = [
  {
    label: "Reining",
    options: REINING_PATTERNS.map(({ id, name }) => ({ id, name })),
  },
  {
    label: "Ranch Riding",
    options: RANCH_RIDING_PATTERNS.map(({ id, name }) => ({ id, name })),
  },
  {
    label: "Small Fry Ranch Riding",
    options: SMALL_FRY_RANCH_RIDING_PATTERNS.map(({ id, name }) => ({
      id,
      name,
    })),
  },
  {
    label: "Western Riding",
    options: WESTERN_RIDING_PATTERNS.map(({ id, name }) => ({ id, name })),
  },
  {
    label: "Level 1 Western Riding",
    options: LEVEL_1_WESTERN_RIDING_PATTERNS.map(({ id, name }) => ({
      id,
      name,
    })),
  },
  {
    label: "Patrons custom",
    options: Object.values(CUSTOM_PATTERN_CONFIGS).map(({ id, name }) => ({
      id,
      name,
    })),
  },
];

function simplifyPatternValue(patternValue) {
  return String(patternValue || "")
    .trim()
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function getPatternKey(patternValue) {
  const key = simplifyPatternValue(patternValue);
  if (!key) return "";

  if (
    key === TRAIL_CUSTOM_PATTERN_ID ||
    key === "TRAIL" ||
    key === "TRAIL / OBSTACLE WESTERN" ||
    key === "OBSTACLE WESTERN"
  ) {
    return TRAIL_CUSTOM_PATTERN_ID;
  }

  if (/^([1-9]|1[0-8]|A|B)$/.test(key)) {
    return `R${key}`;
  }

  const reiningMatch = key.match(/^R(?:EINING)?\s*#?\s*([1-9]|1[0-8]|A|B)$/);
  if (reiningMatch) {
    return `R${reiningMatch[1]}`;
  }

  const ranchMatch = key.match(/^RANCH RIDING\s*#?\s*([1-9]|1[0-5])$/);
  if (ranchMatch) {
    return `RR${ranchMatch[1]}`;
  }

  const smallFryMatch = key.match(
    /^SMALL FRY RANCH RIDING\s*(?:#|PATTERN)?\s*([1-5])$/
  );
  if (smallFryMatch) {
    return `SFRR${smallFryMatch[1]}`;
  }

  const westernRidingMatch = key.match(
    /^(?:WR|WESTERN RIDING)\s*(?:#|PATTERN)?\s*([1-9])$/
  );
  if (westernRidingMatch) {
    return `WR${westernRidingMatch[1]}`;
  }

  const levelOneWesternRidingMatch = key.match(
    /^(?:L1WR|LEVEL 1 WESTERN RIDING|LEVEL ONE WESTERN RIDING)\s*(?:#|PATTERN)?\s*([1-9])$/
  );
  if (levelOneWesternRidingMatch) {
    return `L1WR${levelOneWesternRidingMatch[1]}`;
  }

  return key;
}

export function getPatternDefinition(patternValue) {
  const key = getPatternKey(patternValue);
  return PATTERN_DEFINITIONS.find((pattern) => pattern.id === key) || null;
}

export function getPatternSelectValue(patternValue) {
  return getPatternDefinition(patternValue)?.id || String(patternValue || "");
}

export function getPatternDisplayName(patternValue, customPattern = null) {
  const custom = normalizeCustomPattern(customPattern, patternValue);

  if (custom) {
    return custom.name || getCustomPatternConfig(custom.discipline)?.name || "";
  }

  const definition = getPatternDefinition(patternValue);
  return definition?.name || String(patternValue || "").trim();
}

export function getPatternDiscipline(patternValue, customPattern = null) {
  const custom = normalizeCustomPattern(customPattern, patternValue);

  if (custom) {
    return custom.discipline;
  }

  return getPatternDefinition(patternValue)?.discipline || PATTERN_DISCIPLINES.REINING;
}

export function isRanchRidingPattern(patternValue, customPattern = null) {
  return (
    getPatternDiscipline(patternValue, customPattern) ===
    PATTERN_DISCIPLINES.RANCH_RIDING
  );
}

export function isWesternRidingPattern(patternValue, customPattern = null) {
  return (
    getPatternDiscipline(patternValue, customPattern) ===
    PATTERN_DISCIPLINES.WESTERN_RIDING
  );
}

export function isTrailPattern(patternValue, customPattern = null) {
  return (
    getPatternDiscipline(patternValue, customPattern) === PATTERN_DISCIPLINES.TRAIL
  );
}

export function isCustomPatternValue(patternValue) {
  return Boolean(getPatternDefinition(patternValue)?.isCustom);
}

export function getCustomPatternConfig(disciplineOrPattern) {
  const key = getPatternKey(disciplineOrPattern);
  const byPattern = Object.values(CUSTOM_PATTERN_CONFIGS).find(
    (config) => config.id === key
  );

  if (byPattern) {
    return byPattern;
  }

  return CUSTOM_PATTERN_CONFIGS[disciplineOrPattern] || null;
}

export function getCustomPatternConfigForPattern(patternValue) {
  const definition = getPatternDefinition(patternValue);

  if (!definition?.isCustom) {
    return null;
  }

  return getCustomPatternConfig(definition.discipline);
}

export function createDefaultCustomPattern(patternValue = TRAIL_CUSTOM_PATTERN_ID) {
  const config = getCustomPatternConfigForPattern(patternValue);

  if (!config) {
    return null;
  }

  return {
    discipline: config.discipline,
    name: config.name,
    maneuvers: createDefaultCustomManeuvers(config.minManeuvers, config),
  };
}

export function normalizeCustomPattern(customPattern, patternValue = "") {
  const patternConfig = getCustomPatternConfigForPattern(patternValue);
  const config =
    patternConfig ||
    (!String(patternValue || "").trim()
      ? getCustomPatternConfig(customPattern?.discipline)
      : null);

  if (!config) {
    return null;
  }

  const sourceManeuvers = Array.isArray(customPattern?.maneuvers)
    ? customPattern.maneuvers
    : [];
  const minCount = config.minManeuvers || 1;
  const targetCount = Math.max(sourceManeuvers.length, minCount);
  const maneuvers = Array.from({ length: targetCount }, (_, index) =>
    normalizeCustomManeuver(sourceManeuvers[index], index, config)
  );

  return {
    discipline: config.discipline,
    name: String(customPattern?.name || config.name || "").trim(),
    maneuvers,
  };
}

export function isCustomPatternReady(patternValue, customPattern = null) {
  const config = getCustomPatternConfigForPattern(patternValue);

  if (!config) {
    return true;
  }

  const custom = normalizeCustomPattern(customPattern, patternValue);

  if (!custom || custom.maneuvers.length < config.minManeuvers) {
    return false;
  }

  return custom.maneuvers.every(
    (maneuver) => maneuver.abbreviation && maneuver.description.trim()
  );
}

export function getPatternHeaders(patternValue, customPattern = null) {
  const custom = normalizeCustomPattern(customPattern, patternValue);

  if (custom) {
    return custom.maneuvers.map(
      (maneuver, index) => maneuver.abbreviation || `M${index + 1}`
    );
  }

  return getPatternDefinition(patternValue)?.maneuvers || DEFAULT_HEADERS;
}

export function getPatternManeuverDescription(
  maneuver,
  patternValue = "",
  customPattern = null
) {
  const token = String(maneuver || "").trim();

  if (!token) {
    return "";
  }

  const custom = normalizeCustomPattern(customPattern, patternValue);

  if (custom) {
    const customManeuver = custom.maneuvers.find(
      (item, index) =>
        item.abbreviation === token || (!item.abbreviation && token === `M${index + 1}`)
    );

    return customManeuver?.description.trim() || token;
  }

  if (token === RANCH_APPEARANCE_HEADER) {
    return "Natural ranch horse appearance";
  }

  const discipline = getPatternDiscipline(patternValue, customPattern);
  const parts = splitManeuverParts(token);

  if (parts.length > 1) {
    return parts
      .map((part) =>
        getPatternManeuverDescription(part, patternValue, customPattern)
      )
      .filter(Boolean)
      .join(" / ");
  }

  if (discipline === PATTERN_DISCIPLINES.RANCH_RIDING) {
    return describeRanchManeuver(token);
  }

  if (discipline === PATTERN_DISCIPLINES.WESTERN_RIDING) {
    return WESTERN_RIDING_ABBREVIATIONS[token] || token;
  }

  return REINING_ABBREVIATIONS[token] || token;
}

export function getPatternMoveCount(patternValue, customPattern = null) {
  return getPatternHeaders(patternValue, customPattern).length;
}

function createDefaultCustomManeuvers(count, config) {
  return Array.from({ length: count }, (_, index) =>
    normalizeCustomManeuver(null, index, config)
  );
}

function normalizeCustomManeuver(maneuver, index, config) {
  const fallbackPrefix = config.defaultManeuverPrefix || "M";
  const fallbackAbbreviation = `${fallbackPrefix}${index + 1}`;
  const abbreviation = String(
    maneuver?.abbreviation || maneuver?.abbr || maneuver?.name || ""
  )
    .trim()
    .toUpperCase();
  const maxDescriptionLength = config.maxDescriptionLength || 80;
  const description = String(maneuver?.description || maneuver?.label || "").slice(
    0,
    maxDescriptionLength
  );

  return {
    abbreviation: abbreviation || fallbackAbbreviation,
    description,
  };
}

function splitManeuverParts(token) {
  const parts = [];
  let current = "";

  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];

    if (
      character === "/" &&
      !isDigit(token[index - 1]) &&
      !isDigit(token[index + 1])
    ) {
      if (current) {
        parts.push(current);
      }
      current = "";
    } else {
      current += character;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function isDigit(character) {
  return Boolean(character && character >= "0" && character <= "9");
}

function describeRanchManeuver(token) {
  if (RANCH_ABBREVIATIONS[token]) {
    return RANCH_ABBREVIATIONS[token];
  }

  const matchingKey = Object.keys(RANCH_ABBREVIATIONS)
    .sort((a, b) => b.length - a.length)
    .find((key) => token.startsWith(`${key}_`));

  if (!matchingKey) {
    return token.replace(/_/g, " ");
  }

  const suffix = token
    .slice(matchingKey.length + 1)
    .replace(/_/g, " ")
    .toLowerCase();

  return `${RANCH_ABBREVIATIONS[matchingKey]} ${suffix}`;
}

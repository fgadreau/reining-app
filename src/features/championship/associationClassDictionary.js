import {
  getChampionshipClassByCode,
  getChampionshipClassById,
  getChampionshipClassLabel,
  getExcludedClassCodeReason,
} from "./championshipClasses";

export const ASSOCIATION_CLASS_MATCH_STATUSES = {
  MATCHED: "matched",
  EXCLUDED: "excluded",
  UNKNOWN: "unknown",
};

export const ASSOCIATION_CLASS_MATCH_TYPES = {
  FUNWARE_CODE: "funwareCode",
  CHAMPIONSHIP_CODE: "championshipCode",
  ALIAS: "alias",
};

const AQR_CLASS_DICTIONARY = [
  {
    championshipClassId: "nrha-open-novice-horse-level-1",
    funwareCodes: ["101"],
    championshipCodes: ["1700"],
    aliases: ["NOVICE HORSE OP1 NRHA", "NOVICE HORSE OPEN 1 NRHA"],
  },
  {
    championshipClassId: "nrha-open-novice-horse-level-2",
    funwareCodes: ["102"],
    championshipCodes: ["1750"],
    aliases: ["NOVICE HORSE OP2 NRHA", "NOVICE HORSE OPEN 2 NRHA"],
  },
  {
    championshipClassId: "nrha-non-pro-novice-horse-level-1",
    funwareCodes: ["103"],
    championshipCodes: ["1800"],
    aliases: ["NOVICE HORSE NP1 NRHA", "NOVICE HORSE NON PRO 1 NRHA"],
  },
  {
    championshipClassId: "nrha-non-pro-novice-horse-level-2",
    funwareCodes: ["104"],
    championshipCodes: ["1850"],
    aliases: ["NOVICE HORSE NP2 NRHA", "NOVICE HORSE NON PRO 2 NRHA"],
  },
  {
    status: ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED,
    funwareCodes: ["5393"],
    aliases: ["NOVICE HORSE NP - AQR", "NOVICE HORSE NON PRO AQR"],
    reason:
      "AQR Novice Horse Non Pro generique: ne fait pas partie des classes Novice Horse Level 1/2.",
  },
  {
    status: ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED,
    funwareCodes: ["5394"],
    aliases: ["NOVICE HORSE OPEN - AQR", "NOVICE HORSE OP AQR"],
    reason:
      "AQR Novice Horse Open generique: ne fait pas partie des classes Novice Horse Level 1/2.",
  },
  {
    championshipClassId: "nrha-open",
    funwareCodes: ["116"],
    championshipCodes: ["1100"],
    aliases: ["OMNIUM NRHA", "OPEN NRHA"],
  },
  {
    championshipClassId: "nrha-intermediate-open",
    funwareCodes: ["117"],
    championshipCodes: ["1200"],
    aliases: ["OMNIUM INTER NRHA", "INTERMEDIATE OPEN NRHA"],
  },
  {
    championshipClassId: "nrha-prime-time-open",
    funwareCodes: ["118"],
    championshipCodes: ["1110"],
    aliases: ["OMNIUM PT NRHA", "PRIME TIME OPEN NRHA"],
  },
  {
    championshipClassId: "nrha-limited-open",
    funwareCodes: ["126"],
    championshipCodes: ["1301"],
    aliases: ["OMINUM LTD NRHA", "OMNIUM LTD NRHA", "LIMITED OPEN NRHA"],
  },
  {
    championshipClassId: "nrha-rookie-professional",
    funwareCodes: ["127"],
    championshipCodes: ["1350"],
    aliases: ["ROOKIE PRO NRHA", "ROOKIE PROFESSIONAL NRHA"],
  },
  {
    championshipClassId: "nrha-non-pro",
    funwareCodes: ["111"],
    championshipCodes: ["1400"],
    aliases: ["NON-PRO NRHA", "NON PRO NRHA"],
  },
  {
    championshipClassId: "nrha-intermediate-non-pro",
    funwareCodes: ["112"],
    championshipCodes: ["1500"],
    aliases: ["NON-PRO INTER NRHA", "NON PRO INTER NRHA"],
  },
  {
    championshipClassId: "nrha-prime-time-non-pro",
    funwareCodes: ["113"],
    championshipCodes: ["1650"],
    aliases: ["NON-PRO PT NRHA", "NON PRO PT NRHA"],
  },
  {
    championshipClassId: "nrha-masters-non-pro",
    funwareCodes: ["114"],
    championshipCodes: ["1660"],
    aliases: ["NON-PRO MASTER NRHA", "NON PRO MASTER NRHA"],
  },
  {
    championshipClassId: "nrha-rookie-level-1",
    funwareCodes: ["105"],
    championshipCodes: ["5300"],
    aliases: ["ROOKIE NP 1 NRHA", "ROOKIE NON PRO 1 NRHA"],
  },
  {
    championshipClassId: "nrha-rookie-level-2",
    funwareCodes: ["106"],
    championshipCodes: ["5310"],
    aliases: ["ROOKIE NP 2 NRHA", "ROOKIE NON PRO 2 NRHA", "ROOKIE II"],
  },
  {
    championshipClassId: "aqr-beginner-non-pro-level-1",
    funwareCodes: ["107"],
    championshipCodes: ["5399"],
    aliases: [
      "DEBUTANT NP 1 AQR",
      "DÉBUTANT NP 1 AQR",
      "DEBUTANT NON PRO 1 AQR",
    ],
  },
  {
    championshipClassId: "aqr-beginner-non-pro-level-2",
    funwareCodes: ["108"],
    championshipCodes: ["5400"],
    aliases: [
      "DEBUTANT NP 2 AQR",
      "DÉBUTANT NP 2 AQR",
      "DEBUTANT NON PRO 2 AQR",
    ],
  },
  {
    championshipClassId: "nrha-rookie-prime-time",
    funwareCodes: ["109"],
    championshipCodes: ["5301"],
    aliases: ["ROOKIE NP PT NRHA", "PT ROOKIE", "PRIME TIME ROOKIE"],
  },
  {
    championshipClassId: "aqr-beginner-non-pro-prime-time",
    funwareCodes: ["129"],
    championshipCodes: ["5402"],
    aliases: [
      "DEBUTANT NP PT AQR",
      "DÉBUTANT NP PT AQR",
      "DEBUTANT NON PRO PRIME TIME AQR",
    ],
  },
  {
    status: ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED,
    funwareCodes: ["5395"],
    aliases: ['SLIDING "D"', "SLIDING D"],
    reason: "Classe speciale AQR: ne fait pas partie du championnat de saison.",
  },
  {
    championshipClassId: "aqr-first-year-19-plus",
    funwareCodes: ["5406"],
    championshipCodes: ["5406"],
    aliases: [
      "DEBUTANT 1IERE A VIE 19 ANS ET+ AQR",
      "DÉBUTANT 1IÈRE À VIE (19 ANS ET+) AQR",
    ],
  },
  {
    championshipClassId: "ranch-riding",
    funwareCodes: ["399"],
    championshipCodes: ["399"],
    aliases: ["RANCH RIDING"],
  },
  {
    championshipClassId: "nrha-youth-13-under",
    funwareCodes: ["121"],
    championshipCodes: ["3100"],
    aliases: ["JEUNE 13 ANS ET - NRHA", "YOUTH 13 AND UNDER NRHA"],
  },
  {
    championshipClassId: "nrha-youth-14-18",
    funwareCodes: ["122"],
    championshipCodes: ["3200"],
    aliases: ["JEUNE 14 - 18 ANS NRHA", "YOUTH 14-18 NRHA"],
  },
  {
    championshipClassId: "aqr-beginner-youth-18-under",
    funwareCodes: ["123"],
    championshipCodes: ["5397"],
    aliases: [
      "JEUNE 18 ANS ET - AQR",
      "JEUNE DEBUTANT 18 ANS ET MOINS AQR",
      "JEUNE DÉBUTANT 18 ANS ET MOINS AQR",
    ],
  },
  {
    championshipClassId: "aqr-young-rider-14-21",
    funwareCodes: ["124"],
    championshipCodes: ["5396"],
    aliases: ["JEUNE 14 - 21 ANS AQR", "JEUNE CAVALIER 14 A 21 ANS AQR"],
  },
  {
    championshipClassId: "aqr-first-year-18-under",
    funwareCodes: ["5407"],
    championshipCodes: ["5407"],
    aliases: [
      "DEBUTANT 1IERE A VIE 18 ANS ET- AQR",
      "DÉBUTANT 1IÈRE À VIE (18 ANS ET-) AQR",
    ],
  },
  {
    championshipClassId: "aqr-short-legs-10-under",
    funwareCodes: ["5500"],
    championshipCodes: ["3500"],
    aliases: ["JAMBES COURTES", "SHORT LEGS"],
  },
  {
    championshipClassId: "nrha-limited-non-pro",
    funwareCodes: ["119"],
    championshipCodes: ["1600"],
    aliases: ["NON-PRO LTD NRHA", "NON PRO LTD NRHA"],
  },
  {
    championshipClassId: "aqr-limited-non-pro",
    funwareCodes: ["120"],
    championshipCodes: ["5398"],
    aliases: ["NON-PRO LTD AQR", "NON PRO LTD AQR"],
  },
];

const ASSOCIATION_DICTIONARIES = {
  AQR: AQR_CLASS_DICTIONARY,
};

export function buildAssociationChampionshipClassSummary({
  association,
  blockClasses = [],
} = {}) {
  const dictionary = getAssociationClassDictionary(association);

  if (!dictionary) {
    return {
      associationKey: "",
      rows: [],
      available: false,
    };
  }

  const index = buildDictionaryIndex(dictionary.entries);
  const rows = (Array.isArray(blockClasses) ? blockClasses : [])
    .map((classEntry) => resolveImportedClass(classEntry, index))
    .filter(Boolean);

  return {
    associationKey: dictionary.key,
    rows,
    available: true,
    matchedCount: rows.filter(
      (row) => row.status === ASSOCIATION_CLASS_MATCH_STATUSES.MATCHED
    ).length,
    excludedCount: rows.filter(
      (row) => row.status === ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED
    ).length,
    unknownCount: rows.filter(
      (row) => row.status === ASSOCIATION_CLASS_MATCH_STATUSES.UNKNOWN
    ).length,
  };
}

export function resolveAssociationChampionshipClass({
  association,
  code = "",
  name = "",
  entryCount = 0,
} = {}) {
  const dictionary = getAssociationClassDictionary(association);

  if (!dictionary) {
    return null;
  }

  const index = buildDictionaryIndex(dictionary.entries);
  return resolveImportedClass({ code, name, entryCount }, index);
}

function getAssociationClassDictionary(association) {
  const candidates = [
    association?.shortName,
    association?.id,
    association?.name,
  ].map(normalizeAssociationKey);

  const key = candidates.find(
    (candidate) => ASSOCIATION_DICTIONARIES[candidate]
  );
  if (!key) return null;

  return {
    key,
    entries: ASSOCIATION_DICTIONARIES[key],
  };
}

function buildDictionaryIndex(entries) {
  const funwareCodes = new Map();
  const championshipCodes = new Map();
  const aliases = new Map();

  entries.forEach((entry) => {
    const normalizedEntry = normalizeDictionaryEntry(entry);

    normalizedEntry.funwareCodes.forEach((code) => {
      funwareCodes.set(code, normalizedEntry);
    });
    normalizedEntry.championshipCodes.forEach((code) => {
      championshipCodes.set(code, normalizedEntry);
    });
    normalizedEntry.aliases.forEach((alias) => {
      aliases.set(alias, normalizedEntry);
    });
  });

  return { funwareCodes, championshipCodes, aliases };
}

function normalizeDictionaryEntry(entry) {
  const championshipClass = entry.championshipClassId
    ? getChampionshipClassById(entry.championshipClassId)
    : null;
  const championshipCodes = [
    ...(entry.championshipCodes || []),
    ...(championshipClass?.classCodes || []),
  ];

  return {
    ...entry,
    status: entry.status || ASSOCIATION_CLASS_MATCH_STATUSES.MATCHED,
    championshipClass,
    championshipClassName: championshipClass
      ? getChampionshipClassLabel(championshipClass)
      : "",
    funwareCodes: normalizeCodeList(entry.funwareCodes),
    championshipCodes: normalizeCodeList(championshipCodes),
    aliases: normalizeAliasList(entry.aliases),
    reason: String(entry.reason || "").trim(),
  };
}

function resolveImportedClass(classEntry, index) {
  const code = normalizeClassDictionaryCode(classEntry?.code);
  const name = String(classEntry?.name || "").trim();
  const alias = normalizeClassDictionaryAlias(name);
  const entryCount = Number.parseInt(classEntry?.entryCount, 10) || 0;

  if (!code && !alias) return null;

  const funwareMatch = code ? index.funwareCodes.get(code) : null;
  if (funwareMatch) {
    return buildMatchRow(classEntry, funwareMatch, {
      matchType: ASSOCIATION_CLASS_MATCH_TYPES.FUNWARE_CODE,
      matchedValue: code,
      entryCount,
    });
  }

  const dictionaryChampionshipMatch = code
    ? index.championshipCodes.get(code)
    : null;
  if (dictionaryChampionshipMatch) {
    return buildMatchRow(classEntry, dictionaryChampionshipMatch, {
      matchType: ASSOCIATION_CLASS_MATCH_TYPES.CHAMPIONSHIP_CODE,
      matchedValue: code,
      entryCount,
    });
  }

  const excluded = code ? getExcludedClassCodeReason(code) : null;
  if (excluded) {
    return {
      code,
      importName: name,
      entryCount,
      status: ASSOCIATION_CLASS_MATCH_STATUSES.EXCLUDED,
      reason: excluded.reason || "",
      matchType: ASSOCIATION_CLASS_MATCH_TYPES.CHAMPIONSHIP_CODE,
      matchedValue: code,
      championshipClassId: "",
      championshipClassName: "",
      championshipClassCode: "",
      championshipCodes: [],
    };
  }

  const championshipClass = code ? getChampionshipClassByCode(code) : null;
  if (championshipClass) {
    return {
      code,
      importName: name,
      entryCount,
      status: ASSOCIATION_CLASS_MATCH_STATUSES.MATCHED,
      matchType: ASSOCIATION_CLASS_MATCH_TYPES.CHAMPIONSHIP_CODE,
      matchedValue: code,
      championshipClassId: championshipClass.id,
      championshipClassName: getChampionshipClassLabel(championshipClass),
      championshipClassCode: normalizeClassDictionaryCode(
        championshipClass.classCodes?.[0]
      ),
      championshipCodes: normalizeCodeList(championshipClass.classCodes),
      reason: "",
    };
  }

  const aliasMatch = alias ? index.aliases.get(alias) : null;
  if (aliasMatch) {
    return buildMatchRow(classEntry, aliasMatch, {
      matchType: ASSOCIATION_CLASS_MATCH_TYPES.ALIAS,
      matchedValue: name,
      entryCount,
    });
  }

  return {
    code,
    importName: name,
    entryCount,
    status: ASSOCIATION_CLASS_MATCH_STATUSES.UNKNOWN,
    reason: "",
    matchType: "",
    matchedValue: "",
    championshipClassId: "",
    championshipClassName: "",
    championshipClassCode: "",
    championshipCodes: [],
  };
}

function buildMatchRow(classEntry, dictionaryEntry, details) {
  const code = normalizeClassDictionaryCode(classEntry?.code);
  const importName = String(classEntry?.name || "").trim();

  return {
    code,
    importName,
    entryCount: details.entryCount,
    status: dictionaryEntry.status,
    matchType: details.matchType,
    matchedValue: details.matchedValue,
    championshipClassId: dictionaryEntry.championshipClass?.id || "",
    championshipClassName: dictionaryEntry.championshipClassName,
    championshipClassCode: dictionaryEntry.championshipCodes[0] || "",
    championshipCodes: dictionaryEntry.championshipCodes,
    reason: dictionaryEntry.reason,
  };
}

function normalizeCodeList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(normalizeClassDictionaryCode)
        .filter(Boolean)
    )
  );
}

function normalizeAliasList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(normalizeClassDictionaryAlias)
        .filter(Boolean)
    )
  );
}

function normalizeAssociationKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeClassDictionaryCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeClassDictionaryAlias(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " ET ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

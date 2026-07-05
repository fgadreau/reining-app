export const CHAMPIONSHIP_CLASS_STATUSES = {
  ACTIVE: "active",
  EXCLUDED: "excluded",
};

export const CHAMPIONSHIP_CLASSES = [
  {
    id: "nrha-open",
    name: "Omnium NRHA",
    englishName: "Open",
    order: 10,
    classCodes: ["1100"],
  },
  {
    id: "nrha-intermediate-open",
    name: "Omnium Intermédiaire NRHA",
    englishName: "Intermediate Open",
    order: 20,
    classCodes: ["1200"],
  },
  {
    id: "nrha-prime-time-open",
    name: "Omnium Prime Time NRHA",
    englishName: "Prime Time Open",
    order: 30,
    classCodes: ["1110"],
  },
  {
    id: "nrha-limited-open",
    name: "Omnium Limité NRHA",
    englishName: "Limited Open",
    order: 40,
    classCodes: ["1301"],
  },
  {
    id: "nrha-rookie-professional",
    name: "Rookie Pro NRHA",
    englishName: "Rookie Professional",
    order: 50,
    classCodes: ["1350"],
  },
  {
    id: "nrha-non-pro",
    name: "Non Pro NRHA",
    englishName: "Non Pro",
    order: 60,
    classCodes: ["1400"],
  },
  {
    id: "nrha-intermediate-non-pro",
    name: "Non Pro Intermédiaire NRHA",
    englishName: "Intermediate Non Pro",
    order: 70,
    classCodes: ["1500"],
  },
  {
    id: "nrha-prime-time-non-pro",
    name: "Non Pro Prime Time NRHA",
    englishName: "Prime Time Non Pro",
    order: 80,
    classCodes: ["1650"],
  },
  {
    id: "nrha-masters-non-pro",
    name: "Non Pro Master NRHA",
    englishName: "Masters Non Pro",
    order: 90,
    classCodes: ["1660"],
  },
  {
    id: "nrha-limited-non-pro",
    name: "Non Pro Limité NRHA",
    englishName: "Limited Non Pro",
    order: 100,
    classCodes: ["1600"],
  },
  {
    id: "aqr-limited-non-pro",
    name: "Non Pro Limité AQR",
    englishName: "Limited Non Pro",
    order: 110,
    classCodes: ["5398"],
  },
  {
    id: "nrha-open-novice-horse-level-1",
    name: "Cheval Novice Omnium Niveau 1 NRHA",
    englishName: "Open Novice Horse Level 1",
    order: 120,
    classCodes: ["1700"],
  },
  {
    id: "nrha-open-novice-horse-level-2",
    name: "Cheval Novice Omnium Niveau 2 NRHA",
    englishName: "Open Novice Horse Level 2",
    order: 130,
    classCodes: ["1750"],
  },
  {
    id: "nrha-non-pro-novice-horse-level-1",
    name: "Cheval Novice Non Pro Niveau 1 NRHA",
    englishName: "Non Pro Novice Horse Level 1",
    order: 140,
    classCodes: ["1800"],
  },
  {
    id: "nrha-non-pro-novice-horse-level-2",
    name: "Cheval Novice Non Pro Niveau 2 NRHA",
    englishName: "Non Pro Novice Horse Level 2",
    order: 150,
    classCodes: ["1850"],
  },
  {
    id: "nrha-rookie-level-1",
    name: "Rookie Non Pro Niveau I NRHA",
    englishName: "Rookie Level I",
    order: 160,
    classCodes: ["5300"],
  },
  {
    id: "nrha-rookie-level-2",
    name: "Rookie Non Pro Niveau II NRHA",
    englishName: "Rookie Level II",
    order: 170,
    classCodes: ["5310"],
  },
  {
    id: "nrha-rookie-prime-time",
    name: "Rookie Non Pro Prime Time NRHA",
    englishName: "Prime Time Rookie",
    order: 180,
    classCodes: ["5301"],
  },
  {
    id: "aqr-beginner-non-pro-level-1",
    name: "Débutant Non Pro Niveau I AQR",
    englishName: "Non Pro Beginner Level I",
    order: 190,
    classCodes: ["5399"],
  },
  {
    id: "aqr-beginner-non-pro-level-2",
    name: "Débutant Non Pro Niveau II AQR",
    englishName: "Non Pro Beginner Level II",
    order: 200,
    classCodes: ["5400"],
  },
  {
    id: "aqr-beginner-non-pro-prime-time",
    name: "Débutant Non Pro Prime Time AQR",
    englishName: "Non Pro Prime Time Beginner",
    order: 210,
    classCodes: ["5402"],
  },
  {
    id: "aqr-first-year-19-plus",
    name: "Débutant 1ière année 19 et +",
    englishName: "First Year Beginner 19+",
    order: 220,
    classCodes: ["5406"],
  },
  {
    id: "aqr-first-year-18-under",
    name: "Débutant 1ière année 18 et -",
    englishName: "First Year Beginner 18 & under",
    order: 230,
    classCodes: ["5407"],
  },
  {
    id: "nrha-youth-13-under",
    name: "Jeune 13 ans et moins NRHA",
    englishName: "Youth 13 & under",
    order: 240,
    classCodes: ["3100"],
  },
  {
    id: "nrha-youth-14-18",
    name: "Jeune 14-18 ans NRHA",
    englishName: "Youth 14 thru 18",
    order: 250,
    classCodes: ["3200"],
  },
  {
    id: "aqr-beginner-youth-18-under",
    name: "Jeune Débutant 18 ans et moins AQR",
    englishName: "Beginner Youth 18 & under",
    order: 260,
    classCodes: ["5397"],
  },
  {
    id: "aqr-short-legs-10-under",
    name: "Jambes Courtes 10 ans et moins AQR",
    englishName: "Short Legs 10 & under",
    order: 270,
    classCodes: [],
  },
  {
    id: "aqr-young-rider-14-21",
    name: "Jeune Cavalier 14 à 21 ans AQR",
    englishName: "Young Rider 14 thru 21",
    order: 280,
    classCodes: ["5396"],
  },
  {
    id: "ranch-riding",
    name: "Ranch Riding",
    englishName: "Ranch Riding",
    order: 290,
    classCodes: ["399"],
  },
];

export const EXCLUDED_CHAMPIONSHIP_CLASS_CODES = {
  5393: {
    status: CHAMPIONSHIP_CLASS_STATUSES.EXCLUDED,
    reason:
      "AQR Novice Horse Non Pro generique: ne fait pas partie des classes Novice Horse Level 1/2.",
  },
  5394: {
    status: CHAMPIONSHIP_CLASS_STATUSES.EXCLUDED,
    reason:
      "AQR Novice Horse Open generique: ne fait pas partie des classes Novice Horse Level 1/2.",
  },
};

const classById = new Map(CHAMPIONSHIP_CLASSES.map((item) => [item.id, item]));
const classByCode = new Map();

CHAMPIONSHIP_CLASSES.forEach((championshipClass) => {
  (championshipClass.classCodes || []).forEach((code) => {
    classByCode.set(String(code), championshipClass);
  });
});

export function getChampionshipClassById(classId) {
  return classById.get(classId) || null;
}

export function getChampionshipClassByCode(classCode) {
  return classByCode.get(normalizeClassCode(classCode)) || null;
}

export function getExcludedClassCodeReason(classCode) {
  return EXCLUDED_CHAMPIONSHIP_CLASS_CODES[normalizeClassCode(classCode)] || null;
}

export function normalizeClassCode(classCode) {
  return String(classCode || "").trim();
}

export function getChampionshipClassLabel(championshipClass) {
  if (!championshipClass) return "";

  return championshipClass.englishName
    ? `${championshipClass.name} (${championshipClass.englishName})`
    : championshipClass.name;
}

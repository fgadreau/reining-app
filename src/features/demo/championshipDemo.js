import {
  applyChampionshipEventLabels,
  buildChampionshipDatasetFromImports,
  buildChampionshipImportBatchFromCsv,
  stripChampionshipMoneyData,
} from "../championship/championshipStandings";

const DEMO_ASSOCIATION_ID = "demo-championship-association";
const DEMO_SEASON_ID = "demo-championship-season-2026";
const DEMO_IMPORTED_AT = "2026-07-09T12:00:00.000Z";

function readJsonStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function upsertById(items, nextItem) {
  const values = Array.isArray(items) ? items : [];
  const withoutItem = values.filter((item) => item?.id !== nextItem.id);
  return [...withoutItem, nextItem];
}

function isLocalHost() {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost")
  );
}

export function shouldSeedChampionshipDemo(search) {
  if (typeof window === "undefined" || !isLocalHost()) return false;

  const params = new URLSearchParams(search || "");
  return params.get("seedChampionshipDemo") === "1";
}

export function getChampionshipDemoUrls(origin = window.location.origin) {
  return {
    publicUrl: `${origin}/public/associations/${DEMO_ASSOCIATION_ID}/championnat`,
    adminUrl: `${origin}/associations/${DEMO_ASSOCIATION_ID}/championship`,
  };
}

export function seedChampionshipDemo() {
  if (typeof window === "undefined") {
    return getChampionshipDemoUrls("");
  }

  const association = {
    id: DEMO_ASSOCIATION_ID,
    name: "Association Demo Championnat",
    shortName: "DEMO",
    timezone: "America/Toronto",
    logoDataUrl: null,
    websiteUrl: "",
    sponsorLogos: [],
    status: "active",
  };
  const mayImport = buildChampionshipImportBatchFromCsv({
    id: "demo-championship-import-may",
    fileName: "demo-championnat-mai.csv",
    importedAt: "2026-05-18T16:00:00.000Z",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      "MAY-1,Demo Mai,Open,1100,8,4,4,1,1,SHINEY STAR,1001,RIDER ALICE,2001,101,1,73,0",
      "MAY-1,Demo Mai,Open,1100,8,4,4,1,1,SMART GUN,1002,RIDER BEN,2002,202,2,71.5,0",
      "MAY-1,Demo Mai,Open,1100,8,4,4,1,1,CHROME WHIZ,1003,RIDER CAROL,2003,303,3,70,0",
      "MAY-1,Demo Mai,Rookie Level 1,5300,8,3,3,1,1,LITTLE ROOKIE,1101,RIDER ELISE,2101,401,1,71,0",
      "MAY-1,Demo Mai,Rookie Level 1,5300,8,3,3,1,1,QUIET LIL GUN,1102,RIDER MARC,2102,402,2,69.5,0",
      "MAY-1,Demo Mai,Rookie Level 1,5300,8,3,3,1,1,BLUE ROOKIE,1103,RIDER NORA,2103,403,3,68,0",
    ].join("\n"),
  });
  const julyImport = buildChampionshipImportBatchFromCsv({
    id: "demo-championship-import-july",
    fileName: "demo-championnat-juillet.csv",
    importedAt: "2026-07-09T12:00:00.000Z",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      "JUL-1,Demo Juillet,Open,1100,8,4,4,1,1,SMART GUN,1002,RIDER BEN,2002,202,1,72.5,0",
      "JUL-1,Demo Juillet,Open,1100,8,4,4,1,1,SHINEY STAR,1001,RIDER ALICE,2001,101,2,72,0",
      "JUL-1,Demo Juillet,Open,1100,8,4,4,1,1,CHROME WHIZ,1003,RIDER CAROL,2003,303,3,70.5,0",
      "JUL-1,Demo Juillet,Rookie Level 1,5300,8,3,3,1,1,QUIET LIL GUN,1102,RIDER MARC,2102,402,1,71.5,0",
      "JUL-1,Demo Juillet,Rookie Level 1,5300,8,3,3,1,1,LITTLE ROOKIE,1101,RIDER ELISE,2101,401,2,70,0",
      "JUL-1,Demo Juillet,Rookie Level 1,5300,8,3,3,1,1,BLUE ROOKIE,1103,RIDER NORA,2103,403,3,69,0",
    ].join("\n"),
  });
  const dataset = stripChampionshipMoneyData(
    buildChampionshipDatasetFromImports({
      imports: [mayImport, julyImport],
      seasonTitle: "Championnat demo 2026",
      year: "2026",
      status: "published",
    })
  );
  const publicEventLabels = {
    "MAY-1": "Mai",
    "JUL-1": "Juillet",
  };
  const publicEventOrder = {
    "MAY-1": 1,
    "JUL-1": 2,
  };
  const season = applyChampionshipEventLabels({
    ...dataset,
    id: DEMO_SEASON_ID,
    associationId: DEMO_ASSOCIATION_ID,
    title: "Championnat demo 2026",
    year: "2026",
    status: "published",
    publicEventLabels,
    publicEventOrder,
    createdAt: DEMO_IMPORTED_AT,
    updatedAt: DEMO_IMPORTED_AT,
  }, publicEventLabels, publicEventOrder);

  window.localStorage.setItem("showscore.language", "fr");
  writeJsonStorage(
    "reiningApp.associations",
    upsertById(readJsonStorage("reiningApp.associations", []), association)
  );
  writeJsonStorage(
    "showscore_championship_seasons_v1",
    upsertById(
      readJsonStorage("showscore_championship_seasons_v1", []),
      season
    )
  );

  return getChampionshipDemoUrls();
}

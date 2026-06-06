const DEMO_ASSOCIATION_ID = "demo-results-association";
const DEMO_SHOW_ID = "demo-results-show";
const DEMO_DAY_ID = "demo-results-day";
const DEMO_CLASS_ID = "demo-results-block-class";
const DEMO_USER_ID = "demo-results-user";
const DEMO_EMAIL = "demo@showscore.local";
const DEMO_PUBLISHED_AT = "2026-06-05T16:00:00.000Z";

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

export function shouldSeedClassResultsDemo(search) {
  if (typeof window === "undefined" || !isLocalHost()) return false;

  const params = new URLSearchParams(search || "");
  return params.get("seedClassResultsDemo") === "1";
}

export function getClassResultsDemoUrls(origin = window.location.origin) {
  return {
    publicUrl: `${origin}/public/associations/${DEMO_ASSOCIATION_ID}/shows/${DEMO_SHOW_ID}`,
    secretariatUrl: `${origin}/associations/${DEMO_ASSOCIATION_ID}/shows/${DEMO_SHOW_ID}/secretariat`,
  };
}

export function seedClassResultsDemo() {
  if (typeof window === "undefined") {
    return getClassResultsDemoUrls("");
  }

  const association = {
    id: DEMO_ASSOCIATION_ID,
    name: "Association Demo ShowScore",
    shortName: "DEMO",
    timezone: "America/Toronto",
    logoDataUrl: null,
    websiteUrl: "",
    sponsorLogos: [],
    status: "active",
  };

  const show = {
    id: DEMO_SHOW_ID,
    associationId: DEMO_ASSOCIATION_ID,
    name: "Demo resultats par classes/divisions",
    venue: "Centre equestre demo",
    location: "Arena principale",
    startDate: "2026-06-05",
    endDate: "2026-06-05",
    status: "active",
    isLivestreamPublic: false,
    livestreamUrl: "",
  };

  const day = {
    id: DEMO_DAY_ID,
    associationId: DEMO_ASSOCIATION_ID,
    showId: DEMO_SHOW_ID,
    label: "Vendredi",
    date: "2026-06-05",
    sortOrder: 1,
  };

  const classItem = {
    id: DEMO_CLASS_ID,
    associationId: DEMO_ASSOCIATION_ID,
    showId: DEMO_SHOW_ID,
    dayId: DEMO_DAY_ID,
    name: "Novice Horse Block",
    classCode: "BLOCK",
    pattern: "8",
    entryMode: "csv",
    judgeName: "Juge Demo",
    assignedScribeUserId: DEMO_USER_ID,
    status: "completed",
    liveVisible: false,
    publicVisible: false,
    totalRuns: 4,
    activeRunId: null,
  };

  const setupRuns = [
    {
      id: "demo-run-1",
      draw: 1,
      order: 1,
      backNumber: "101",
      rider: "Open Rider",
      horse: "Shiney Horse",
      owner: "Owner One",
      classCodes: ["NHO", "NH2"],
    },
    {
      id: "demo-run-2",
      draw: 2,
      order: 2,
      backNumber: "202",
      rider: "Level Two Rider",
      horse: "Smart Horse",
      owner: "Owner Two",
      classCodes: ["NH2"],
    },
    {
      id: "demo-run-3",
      draw: 3,
      order: 3,
      backNumber: "303",
      rider: "Non Pro Rider",
      horse: "Chrome Star",
      owner: "Owner Three",
      classCodes: ["NHO"],
    },
    {
      id: "demo-run-4",
      draw: 4,
      order: 4,
      backNumber: "404",
      rider: "Scratched Rider",
      horse: "Late Entry",
      owner: "Owner Four",
      classCodes: ["NH2"],
    },
  ];

  const officialRuns = [
    {
      ...setupRuns[0],
      scoreTotal: "72.0",
      penTotal: "0.0",
      status: "completed",
    },
    {
      ...setupRuns[1],
      scoreTotal: "70.5",
      penTotal: "0.0",
      status: "completed",
    },
    {
      ...setupRuns[2],
      scoreTotal: "69.5",
      penTotal: "0.0",
      status: "completed",
    },
    {
      ...setupRuns[3],
      scoreTotal: "SCR",
      penTotal: "",
      status: "scratched",
    },
  ];

  const resultGroups = [
    {
      id: `${DEMO_CLASS_ID}-NH2`,
      sourceClassId: DEMO_CLASS_ID,
      code: "NH2",
      className: "Novice Horse Level 2",
      classCode: "NH2",
      parentClassName: classItem.name,
      pattern: "Pattern 8",
      entries: [
        {
          ...setupRuns[0],
          scoreTotal: "72",
          penTotal: "0",
          status: "completed",
          rank: 1,
        },
        {
          ...setupRuns[1],
          scoreTotal: "70½",
          penTotal: "0",
          status: "completed",
          rank: 2,
        },
        {
          ...setupRuns[3],
          scoreTotal: "SCR",
          penTotal: "",
          status: "scratched",
          rank: 3,
        },
      ],
    },
    {
      id: `${DEMO_CLASS_ID}-NHO`,
      sourceClassId: DEMO_CLASS_ID,
      code: "NHO",
      className: "Novice Horse Open",
      classCode: "NHO",
      parentClassName: classItem.name,
      pattern: "Pattern 8",
      entries: [
        {
          ...setupRuns[0],
          scoreTotal: "72",
          penTotal: "0",
          status: "completed",
          rank: 1,
        },
        {
          ...setupRuns[2],
          scoreTotal: "69½",
          penTotal: "0",
          status: "completed",
          rank: 2,
        },
      ],
    },
  ];

  window.localStorage.setItem("showscore.language", "fr");
  writeJsonStorage("showscore_local_test_auth_v1", {
    access_token: "local-test-token",
    token_type: "bearer",
    expires_at: null,
    user: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      isLocalTestUser: true,
      app_metadata: {
        provider: "local-test",
      },
      user_metadata: {
        display_name: "Demo Secretariat",
        name: "Demo Secretariat",
      },
    },
  });
  writeJsonStorage(
    "reiningApp.associations",
    upsertById(readJsonStorage("reiningApp.associations", []), association)
  );
  writeJsonStorage(
    "reining_shows_v1",
    upsertById(readJsonStorage("reining_shows_v1", []), show)
  );
  writeJsonStorage(
    "reining_days_v1",
    upsertById(readJsonStorage("reining_days_v1", []), day)
  );
  writeJsonStorage(
    "reining_classes_v1",
    upsertById(readJsonStorage("reining_classes_v1", []), classItem)
  );

  writeJsonStorage("reining_class_setup_v1", {
    ...readJsonStorage("reining_class_setup_v1", {}),
    [DEMO_CLASS_ID]: {
      pattern: "8",
      customPattern: null,
      arena: "Arena principale",
      judges: [],
      blockClasses: [
        {
          code: "NHO",
          name: "Novice Horse Open",
          classNumber: "100",
          association: "AQR",
        },
        {
          code: "NH2",
          name: "Novice Horse Level 2",
          classNumber: "101",
          association: "AQR",
        },
      ],
      runs: setupRuns,
      isDrawImported: true,
      startedAt: DEMO_PUBLISHED_AT,
      dragInterval: "",
      dragDurationMinutes: 8,
      finalized: true,
      finalizedAt: DEMO_PUBLISHED_AT,
      judgeName: "Juge Demo",
      judgeSignature: null,
      judgeSignedAt: DEMO_PUBLISHED_AT,
      finalPdf: null,
      finalPdfFileName: null,
    },
  });

  writeJsonStorage("reining_class_records_v1", {
    ...readJsonStorage("reining_class_records_v1", {}),
    [DEMO_CLASS_ID]: {
      id: DEMO_CLASS_ID,
      official: {
        judgeName: "Juge Demo",
        judgeSignature: null,
        finalized: true,
        finalizedAt: DEMO_PUBLISHED_AT,
        judgeSignedAt: DEMO_PUBLISHED_AT,
        secretariatValidatedAt: DEMO_PUBLISHED_AT,
        finalPdfFileName: null,
        officialRuns,
      },
    },
  });

  writeJsonStorage("showscore_result_publications_v1", {
    ...readJsonStorage("showscore_result_publications_v1", {}),
    [DEMO_CLASS_ID]: {
      classId: DEMO_CLASS_ID,
      status: "published",
      publishedAt: DEMO_PUBLISHED_AT,
      publishedBy: DEMO_EMAIL,
      resultGroups,
    },
  });

  writeJsonStorage("reining_publication_states_v1", {
    ...readJsonStorage("reining_publication_states_v1", {}),
    [DEMO_CLASS_ID]: {
      classId: DEMO_CLASS_ID,
      status: "hidden",
      publishedAt: null,
      publishedBy: null,
      publicUrl: `/public/associations/${DEMO_ASSOCIATION_ID}/shows/${DEMO_SHOW_ID}`,
      visibleFields: [],
    },
  });

  return getClassResultsDemoUrls();
}

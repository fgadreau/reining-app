import {
  isScoredRunComplete,
  recalculateRun,
  runHasVideoReview,
} from "./utils/scoring";
import { parseImportedRuns } from "./features/classes/classSetupImport";
import {
  getPublicationState,
  publishClass,
  PUBLICATION_STATUSES,
  unpublishClass,
} from "./features/publication/publicationRepository";
import {
  buildPublicClassView,
  sortPublicResults,
} from "./features/publication/publicViewRepository";
import { buildAnnouncerClassView } from "./features/live/liveViewRepository";
import {
  ASSOCIATION_ROLES,
  canAdminAssociation,
  canEditImportedDrawAssociation,
  canEditManualDrawAssociation,
  canManageAssociation,
  canScoreAssociation,
} from "./features/auth/accessRoles";
import { buildAssociationInvitationUrl } from "./features/auth/invitationLinks";
import {
  calculateClassTimingSummary,
  stampRunTiming,
} from "./features/classes/classTiming";

beforeEach(() => {
  localStorage.clear();
});

test("calculates a scored run total", () => {
  const run = recalculateRun({
    scores: ["+0.5", "0", "-0.5"],
    penalties: ["", "1", ""],
  });

  expect(run.penTotal).toBe("1.0");
  expect(run.scoreTotal).toBe("69.0");
});

test("treats special run statuses as complete scores", () => {
  expect(
    isScoredRunComplete(
      {
        backNumber: "411",
        scores: ["", "", ""],
        penalties: ["Scratch", "", ""],
      },
      3
    )
  ).toBe(true);

  expect(
    isScoredRunComplete(
      {
        backNumber: "4444",
        scores: ["", "", ""],
        penalties: ["Score 0", "", ""],
      },
      3
    )
  ).toBe(true);

  expect(
    isScoredRunComplete(
      {
        backNumber: "500",
        scores: ["", "", ""],
        penalties: ["No score", "", ""],
      },
      3
    )
  ).toBe(true);
});

test("blocks finalization while a run is under video review", () => {
  const run = recalculateRun({
    backNumber: "808",
    scores: ["+0.5", "0", "-0.5"],
    penalties: ["", "Révision vidéo", ""],
  });

  expect(run.scoreTotal).toBe("Review");
  expect(runHasVideoReview(run)).toBe(true);
  expect(isScoredRunComplete(run, 3)).toBe(false);
});

test("parses imported draw rows in draw order", () => {
  const runs = parseImportedRuns(`
    2, 202, Marie Roy, Custom Whiz, Luc Roy
    1, 101, Felix Gadreau, Smart Spook, Jean Tremblay
  `);

  expect(runs).toMatchObject([
    {
      order: 1,
      backNumber: "101",
      rider: "Felix Gadreau",
      horse: "Smart Spook",
      owner: "Jean Tremblay",
    },
    {
      order: 2,
      backNumber: "202",
      rider: "Marie Roy",
      horse: "Custom Whiz",
      owner: "Luc Roy",
    },
  ]);
});

test("publishes and unpublishes a class publication state", () => {
  expect(getPublicationState("class-1").status).toBe("hidden");

  publishClass("class-1", "secretary-1");

  const published = getPublicationState("class-1");
  expect(published.status).toBe("published");
  expect(published.publishedBy).toBe("secretary-1");
  expect(published.publishedAt).toEqual(expect.any(String));

  unpublishClass("class-1");

  const hidden = getPublicationState("class-1");
  expect(hidden.status).toBe("hidden");
  expect(hidden.publishedAt).toBeNull();
});

test("sorts public results by numeric score before special results", () => {
  const runs = sortPublicResults([
    { id: "run-1", draw: 1, scoreTotal: "68.5" },
    { id: "run-2", draw: 2, scoreTotal: "SCR" },
    { id: "run-3", draw: 3, scoreTotal: "71.0" },
  ]);

  expect(runs.map((run) => run.id)).toEqual(["run-3", "run-1", "run-2"]);
  expect(runs.map((run) => run.rank)).toEqual([1, 2, 3]);
});

test("keeps public results hidden until secretariat validation", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.PUBLISHED,
    },
    official: {
      isFinalized: true,
      isSecretariatValidated: false,
    },
    scoringRuns: [{ id: "run-1", draw: 1, scoreTotal: "72.0" }],
  };

  expect(buildPublicClassView(classData)).toBeNull();

  expect(
    buildPublicClassView({
      ...classData,
      official: {
        ...classData.official,
        isSecretariatValidated: true,
      },
    })?.runs
  ).toHaveLength(1);
});

test("scopes secretary access to attached associations", () => {
  const memberships = [
    {
      userId: "user-1",
      associationId: "association-1",
      role: ASSOCIATION_ROLES.SECRETARY,
    },
    {
      userId: "user-1",
      associationId: "association-2",
      role: ASSOCIATION_ROLES.SCRIBE,
    },
  ];

  expect(canManageAssociation(memberships, "association-1")).toBe(true);
  expect(canAdminAssociation(memberships, "association-1")).toBe(false);
  expect(canScoreAssociation(memberships, "association-1")).toBe(true);
  expect(canManageAssociation(memberships, "association-2")).toBe(false);
  expect(canScoreAssociation(memberships, "association-2")).toBe(true);
  expect(canEditManualDrawAssociation(memberships, "association-2")).toBe(true);
  expect(canEditImportedDrawAssociation(memberships, "association-2")).toBe(false);
});

test("announcer latest score follows publication state", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.HIDDEN,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        scoreTotal: "72.0",
      },
    ],
  };

  expect(buildAnnouncerClassView(classData).latestScore).toBeNull();

  expect(
    buildAnnouncerClassView({
      ...classData,
      publication: {
        status: PUBLICATION_STATUSES.LIVE,
      },
    }).latestScore.scoreTotal
  ).toBe("72.0");
});

test("announcer live view exposes active, next, and recent completed runs", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
      pattern: "2",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Rider 1",
        scoreTotal: "71.0",
        scores: ["0", "+0.5"],
        penalties: ["", ""],
      },
      {
        id: "run-2",
        draw: 2,
        backNumber: "202",
        rider: "Rider 2",
        isActive: true,
        scoreTotal: "Review",
        scores: ["+1", ""],
        penalties: ["Révision vidéo", ""],
      },
      {
        id: "run-3",
        draw: 3,
        backNumber: "303",
        rider: "Rider 3",
        scoreTotal: "",
        scores: [],
        penalties: [],
      },
    ],
  };

  const classView = buildAnnouncerClassView(classData);

  expect(classView.activeRun.draw).toBe(2);
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.latestScore.draw).toBe(1);
  expect(classView.lastCompletedRuns.map((run) => run.draw)).toEqual([1]);
  expect(classView.lastCompletedRuns[0].manoeuvres[0]).toMatchObject({
    name: "RSLL",
    score: "0",
  });
});

test("builds invitation links for invited users", () => {
  const url = buildAssociationInvitationUrl("http://localhost:3001/", {
    token: "invite-token",
    email: "scribe@example.com",
  });

  expect(url).toBe(
    "http://localhost:3001/login?invite=invite-token&email=scribe%40example.com"
  );
});

test("tracks run timing and estimates remaining class time with drags", () => {
  const started = stampRunTiming(
    recalculateRun({
      backNumber: "101",
      scores: ["0", ""],
      penalties: ["", ""],
    }),
    2,
    "2026-05-22T14:00:00.000Z"
  );
  const completed = stampRunTiming(
    recalculateRun({
      ...started,
      scores: ["0", "+0.5"],
    }),
    2,
    "2026-05-22T14:02:00.000Z"
  );

  const summary = calculateClassTimingSummary({
    runs: [
      completed,
      { backNumber: "102", scores: ["", ""], penalties: ["", ""] },
      { backNumber: "103", scores: ["", ""], penalties: ["", ""] },
    ],
    maneuverCount: 2,
    dragInterval: 2,
    dragDurationMinutes: 8,
    now: new Date("2026-05-22T14:03:00.000Z"),
  });

  expect(completed.durationSeconds).toBe(120);
  expect(summary.averageRunSeconds).toBe(120);
  expect(summary.remainingRuns).toBe(2);
  expect(summary.remainingDragBreaks).toBe(1);
  expect(summary.remainingSeconds).toBe(720);
});

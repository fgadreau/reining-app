const ASSOCIATION_ID = "e2e-robot-association";
const SHOW_ID = "e2e-robot-show";
const DAY_ID = "e2e-robot-day";
const CLASS_ID = "e2e-robot-class";
const LOCAL_TEST_USER_ID = "local-test-user";
const LOCAL_TEST_EMAIL = "test@showscore.local";
const MANEUVER_COUNT = 13;

const timestamp = "2026-05-28T14:00:00.000Z";

const judges = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map(
  (name, index) => ({
    id: `judge-${index + 1}`,
    name: `Juge ${name}`,
    order: index + 1,
  })
);

const setupRuns = Array.from({ length: 10 }, (_, index) => {
  const order = index + 1;

  return {
    id: `robot-run-${order}`,
    draw: order,
    order,
    backNumber: String(100 + order),
    rider: `Cavalier ${order}`,
    horse: `Cheval ${order}`,
    owner: `Proprio ${order}`,
  };
});

function makeScores(halfPointCount, complete) {
  if (!complete) {
    return Array.from({ length: MANEUVER_COUNT }, (_, index) =>
      index < 3 ? "0" : ""
    );
  }

  return Array.from({ length: MANEUVER_COUNT }, (_, index) =>
    index < halfPointCount ? "+0.5" : "0"
  );
}

function makeJudgeRun(setupRun, judgeIndex) {
  const isCompleted = setupRun.draw <= 2;
  const halfPointCount =
    judgeIndex * 2 + (setupRun.draw === 2 && isCompleted ? 1 : 0);
  const scoreTotal = isCompleted
    ? (70 + halfPointCount * 0.5).toFixed(1)
    : "";

  return {
    ...setupRun,
    scores: makeScores(halfPointCount, isCompleted),
    penalties: Array.from({ length: MANEUVER_COUNT }, () => ""),
    penTotal: "",
    scoreTotal,
    status: isCompleted ? "completed" : "",
    note: "",
    startedAt:
      setupRun.draw <= 3
        ? `2026-05-28T14:${String(setupRun.draw + judgeIndex).padStart(
            2,
            "0"
          )}:00.000Z`
        : null,
    completedAt: isCompleted
      ? `2026-05-28T14:${String(
          10 + setupRun.draw + judgeIndex
        ).padStart(2, "0")}:00.000Z`
      : null,
    durationSeconds: isCompleted ? 92 + setupRun.draw : null,
  };
}

function makeJudgeSession(judge, judgeIndex) {
  return {
    classId: CLASS_ID,
    judgeId: judge.id,
    judgeName: judge.name,
    claimedBy: LOCAL_TEST_USER_ID,
    claimedByEmail: LOCAL_TEST_EMAIL,
    claimedAt: timestamp,
    runs: setupRuns.map((run) => makeJudgeRun(run, judgeIndex)),
    activeManoeuvre: {
      draw: 3,
      manoeuvreIndex: 2,
    },
    judgeSignature: null,
    finalized: false,
    finalizedAt: null,
    judgeSignedAt: null,
    updatedAt: `2026-05-28T14:${String(20 + judgeIndex).padStart(
      2,
      "0"
    )}:00.000Z`,
  };
}

function makeLocalTestSession() {
  return {
    access_token: "local-test-token",
    token_type: "bearer",
    user: {
      id: LOCAL_TEST_USER_ID,
      email: LOCAL_TEST_EMAIL,
      isLocalTestUser: true,
      app_metadata: {
        provider: "local-test",
      },
      user_metadata: {
        display_name: "Test local",
        name: "Test local",
      },
    },
    expires_at: null,
  };
}

function makeJudgeSessionStorage() {
  return Object.fromEntries(
    judges.map((judge, index) => [
      `${CLASS_ID}:${judge.id}`,
      makeJudgeSession(judge, index),
    ])
  );
}

function buildRobotShowStorageSeed() {
  const classItem = {
    id: CLASS_ID,
    associationId: ASSOCIATION_ID,
    showId: SHOW_ID,
    dayId: DAY_ID,
    name: "Classe robot 5 juges",
    classCode: "E2E-5J",
    arena: "Manege Robot",
    pattern: "RR1",
    customPattern: null,
    judgeName: "",
    sortOrder: 1,
  };

  const setup = {
    pattern: "RR1",
    customPattern: null,
    judges,
    runs: setupRuns,
    isDrawImported: true,
    startedAt: timestamp,
    dragInterval: "",
    dragDurationMinutes: 8,
    finalized: false,
    finalizedAt: null,
    judgeName: judges[0].name,
    judgeSignature: null,
    judgeSignedAt: null,
    finalPdf: null,
    finalPdfFileName: null,
  };

  return {
    raw: {
      "showscore.language": "fr",
    },
    json: {
      "showscore_local_test_auth_v1": makeLocalTestSession(),
      "reiningApp.associations": [
        {
          id: ASSOCIATION_ID,
          name: "Association Robot Ranch",
          shortName: "ROBOT",
          timezone: "America/Toronto",
          logoDataUrl: null,
          websiteUrl: "",
        },
      ],
      "reining_shows_v1": [
        {
          id: SHOW_ID,
          associationId: ASSOCIATION_ID,
          name: "Robot Derby local",
          venue: "Centre de test",
          location: "Manege A",
          startDate: "2026-05-28",
          endDate: "2026-05-28",
          status: "active",
        },
      ],
      "reining_days_v1": [
        {
          id: DAY_ID,
          associationId: ASSOCIATION_ID,
          showId: SHOW_ID,
          label: "Jour robot",
          date: "2026-05-28",
          sortOrder: 1,
        },
      ],
      "reining_classes_v1": [classItem],
      "reining_class_setup_v1": {
        [CLASS_ID]: setup,
      },
      "reining_publication_states_v1": {
        [CLASS_ID]: {
          classId: CLASS_ID,
          status: "live_scoring",
          publishedAt: timestamp,
          publishedBy: LOCAL_TEST_EMAIL,
          publicUrl: `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`,
          visibleFields: [
            "draw",
            "backNumber",
            "rider",
            "horse",
            "owner",
            "scoreTotal",
            "status",
          ],
        },
      },
      "showscore_judge_scoring_sessions_v1": makeJudgeSessionStorage(),
      [`reining-scoring-runs-${CLASS_ID}`]: makeJudgeSession(
        judges[0],
        0
      ).runs,
      [`reining-scoring-active-manoeuvre-${CLASS_ID}`]: {
        draw: 3,
        manoeuvreIndex: 2,
      },
      "showscore_app_events_v1": [],
    },
  };
}

module.exports = {
  ASSOCIATION_ID,
  SHOW_ID,
  CLASS_ID,
  buildRobotShowStorageSeed,
};

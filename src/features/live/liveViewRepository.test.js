import { beforeEach, expect, test } from "vitest";
import { getAnnouncerShowView } from "./liveViewRepository";

const SHOW_ID = "concurrent-show";
const DAY_ID = "concurrent-day";
const MAIN_CLASS_ID = "derby-non-pro";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(
    "reining_days_v1",
    JSON.stringify([
      {
        id: DAY_ID,
        showId: SHOW_ID,
        label: "Jeudi 30 juillet",
        date: "2026-07-30",
        sortOrder: 1,
      },
    ])
  );
  localStorage.setItem(
    "reining_classes_v1",
    JSON.stringify([
      {
        id: "beginner",
        showId: SHOW_ID,
        dayId: DAY_ID,
        name: "Débutant",
        pattern: "RR3",
        sortOrder: 1,
      },
      {
        id: MAIN_CLASS_ID,
        showId: SHOW_ID,
        dayId: DAY_ID,
        name: "Derby Non-pro Performance Québec NRHA",
        pattern: "RR16",
        sortOrder: 2,
      },
      {
        id: "non-pro",
        showId: SHOW_ID,
        dayId: DAY_ID,
        name: "Non-Pro",
        sortOrder: 3,
        eligibilityRules: {
          concurrent_class_id: MAIN_CLASS_ID,
        },
      },
      {
        id: "derby-aqr-non-pro",
        showId: SHOW_ID,
        dayId: DAY_ID,
        name: "Derby AQR Non-pro",
        sortOrder: 4,
        eligibilityRules: {
          concurrent_class_id: "non-pro",
        },
      },
    ])
  );
  localStorage.setItem(
    "reining_class_setup_v1",
    JSON.stringify({
      beginner: {
        pattern: "RR3",
        runs: [],
      },
      [MAIN_CLASS_ID]: {
        pattern: "RR16",
        runs: [
          {
            id: "shared-run-1",
            order: 1,
            draw: 1,
            rider: "Cavalier partagé",
            horse: "Cheval partagé",
            classCodes: ["DERBY-NP", "NP", "AQR-NP"],
          },
        ],
      },
    })
  );
});

test("shows one announcer card and one draw for concurrent HSP classes", () => {
  const view = getAnnouncerShowView(SHOW_ID);
  const classes = view.sections[0]?.classes || [];

  expect(classes.map((classView) => classView.classId)).toEqual([
    "beginner",
    MAIN_CLASS_ID,
  ]);
  expect(classes[1]).toMatchObject({
    className: "Derby Non-pro Performance Québec NRHA",
    runCount: 1,
  });
});

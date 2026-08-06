import { describe, expect, test } from "vitest";
import {
  SNAPSHOT_SCHEMA_VERSION,
  buildLocalDisplaySnapshot,
} from "./localDisplaySnapshot";

describe("local display snapshot", () => {
  test("includes the active drag, next rider, and sponsor assets needed offline", () => {
    const snapshot = buildLocalDisplaySnapshot({
      generatedAt: "2026-08-06T20:00:00.000Z",
      association: {
        id: "aqr",
        name: "Association de reining",
        sponsorGroups: [
          {
            id: "gold",
            name: "Or",
            logos: [
              {
                id: "sponsor-1",
                name: "Sellerie locale",
                logoDataUrl: "data:image/png;base64,bG9nbw==",
              },
            ],
          },
        ],
      },
      show: {
        id: "show-1",
        name: "Derby",
        obsOverlayMode: "live",
        isTvDisplayPaused: true,
        tvDisplayMessageFr: "Retour bientôt",
      },
      liveView: {
        sections: [
          {
            classes: [
              {
                classId: "class-1",
                className: "Open",
                arena: "Manège 1",
                activeDragItem: {
                  id: "drag-1",
                  type: "drag",
                  isActive: true,
                  startedAt: "2026-08-06T20:00:00.000Z",
                  nextRun: { id: "run-2", draw: 2, rider: "Alex" },
                },
                classStandings: [
                  {
                    id: "open",
                    classCode: "OPEN",
                    className: "Open",
                    entries: [
                      {
                        id: "leader",
                        rank: 1,
                        rider: "Sam",
                        horse: "Star",
                        scoreTotal: "73.5",
                      },
                    ],
                  },
                ],
              },
            ],
            paidWarmups: [],
          },
        ],
      },
    });

    expect(snapshot).toMatchObject({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: "2026-08-06T20:00:00.000Z",
      show: {
        id: "show-1",
        obsOverlayMode: "live",
        isTvDisplayPaused: true,
        tvDisplayMessageFr: "Retour bientôt",
      },
      liveClasses: [
        {
          classId: "class-1",
          activeDragItem: {
            id: "drag-1",
            isActive: true,
            nextRun: { id: "run-2", draw: 2, rider: "Alex" },
          },
          classStandings: [
            {
              id: "open",
              classCode: "OPEN",
              entries: [
                {
                  rank: 1,
                  rider: "Sam",
                  horse: "Star",
                  scoreTotal: "73.5",
                },
              ],
            },
          ],
        },
      ],
      association: {
        sponsorGroups: [
          {
            id: "gold",
            logos: [
              {
                id: "sponsor-1",
                logoDataUrl: "data:image/png;base64,bG9nbw==",
              },
            ],
          },
        ],
      },
    });
  });

  test("includes paid warm-up drags and their upcoming entries", () => {
    const snapshot = buildLocalDisplaySnapshot({
      show: { id: "show-1" },
      liveView: {
        sections: [
          {
            classes: [],
            paidWarmups: [
              {
                id: "warmup-1",
                name: "Paid warm up",
                activeDragItem: { id: "warmup-drag", startedAt: "now" },
                nextEntry: { id: "entry-4", order: 4, rider: "Camille" },
                secondNextEntry: { id: "entry-5", order: 5, rider: "Jo" },
              },
            ],
          },
        ],
      },
    });

    expect(snapshot.livePaidWarmups[0]).toMatchObject({
      activeDragItem: { id: "warmup-drag" },
      nextEntry: { draw: 4, rider: "Camille" },
      secondNextEntry: { draw: 5, rider: "Jo" },
    });
  });

  test("does not send standings when the block uses order-only display", () => {
    const snapshot = buildLocalDisplaySnapshot({
      show: { id: "show-1" },
      liveView: {
        sections: [
          {
            paidWarmups: [],
            classes: [
              {
                classId: "class-1",
                liveDisplayMode: "order_only",
                classStandings: [
                  {
                    id: "secret",
                    entries: [
                      { id: "run-1", rider: "Hidden", scoreTotal: "74" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(snapshot.liveClasses[0].classStandings).toEqual([]);
  });
});

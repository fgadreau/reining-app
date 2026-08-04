import { beforeEach, expect, test, vi } from "vitest";

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
  isSupabaseConfigured: () => true,
}));

import {
  getClassFullDataForClassesRepository,
  getClassesForDayDataRepository,
} from "./classRepository";

function createSupabaseStub(tableRows) {
  const queries = [];

  return {
    queries,
    client: {
      from(table) {
        const query = {
          table,
          filters: [],
        };
        queries.push(query);

        const builder = {
          select() {
            return builder;
          },
          eq(column, value) {
            query.filters.push({ operator: "eq", column, value });
            return builder;
          },
          in(column, value) {
            query.filters.push({ operator: "in", column, value });
            return builder;
          },
          order() {
            return builder;
          },
          then(resolve, reject) {
            return Promise.resolve({
              data: tableRows[table] || [],
              error: null,
            }).then(resolve, reject);
          },
        };

        return builder;
      },
    },
  };
}

const classes = [
  {
    id: "class-1",
    showId: "show-1",
    dayId: "day-1",
    name: "Class 1",
    pattern: "RR1",
    scheduleStartMode: "after_previous",
    scheduleStartTime: "",
  },
  {
    id: "class-2",
    showId: "show-1",
    dayId: "day-1",
    name: "Class 2",
    pattern: "RR2",
    scheduleStartMode: "after_previous",
    scheduleStartTime: "",
  },
  {
    id: "class-3",
    showId: "show-1",
    dayId: "day-1",
    name: "Class 3",
    pattern: "RR3",
    scheduleStartMode: "after_previous",
    scheduleStartTime: "",
  },
];

const classRows = classes.map((classItem, index) => ({
  id: classItem.id,
  show_id: classItem.showId,
  show_day_id: classItem.dayId,
  name: classItem.name,
  pattern: classItem.pattern,
  schedule_start_mode: classItem.scheduleStartMode,
  schedule_start_time: classItem.scheduleStartTime,
  block_type: "competition",
  sort_order: index + 1,
}));

const setupRows = classes.map((classItem, index) => ({
  block_id: classItem.id,
  pattern: classItem.pattern,
  runs: [],
  schedule_details: {
    startMode: classItem.scheduleStartMode,
    startTime: classItem.scheduleStartTime,
  },
  judges:
    index === 0
      ? [
          { id: "judge-1", name: "Judge 1" },
          { id: "judge-2", name: "Judge 2" },
        ]
      : [],
}));

beforeEach(() => {
  localStorage.clear();
  getSupabaseClientMock.mockReset();
});

test("hydrates a day with one batched query per related table", async () => {
  const supabase = createSupabaseStub({
    blocks: classRows,
    show_score_block_setups: setupRows,
    show_score_official_results: [],
    show_score_publication_states: [],
  });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const result = await getClassesForDayDataRepository("day-1");

  expect(result.classes).toHaveLength(3);
  expect(result.setupsByClassId).toHaveProperty("class-1");
  expect(
    supabase.queries.map((query) => query.table)
  ).toEqual([
    "blocks",
    "show_score_block_setups",
    "show_score_official_results",
    "show_score_publication_states",
  ]);
  expect(
    supabase.queries
      .filter((query) => query.table !== "blocks")
      .flatMap((query) => query.filters)
  ).toEqual([
    { operator: "in", column: "block_id", value: classes.map(({ id }) => id) },
    { operator: "in", column: "block_id", value: classes.map(({ id }) => id) },
    { operator: "in", column: "block_id", value: classes.map(({ id }) => id) },
  ]);
});

test("hydrates full announcer data in fixed batches instead of per class", async () => {
  const supabase = createSupabaseStub({
    show_score_block_setups: setupRows,
    show_score_official_results: [],
    show_score_publication_states: [],
    show_score_scoring_sessions: classRows.map((row) => ({
      block_id: row.id,
      runs: [],
    })),
    show_score_announcer_live_sessions: [],
    show_score_judge_sessions: [],
  });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const result = await getClassFullDataForClassesRepository(classes);

  expect(Object.keys(result)).toEqual(classes.map(({ id }) => id));
  expect(
    supabase.queries.map((query) => query.table)
  ).toEqual([
    "show_score_block_setups",
    "show_score_publication_states",
    "show_score_official_results",
    "show_score_scoring_sessions",
    "show_score_announcer_live_sessions",
    "show_score_judge_sessions",
  ]);
  expect(
    supabase.queries
      .filter((query) => query.table.startsWith("show_score_"))
      .map((query) => query.filters.find((filter) => filter.operator === "in")?.column)
  ).toEqual([
    "block_id",
    "block_id",
    "block_id",
    "block_id",
    "class_id",
    "block_id",
  ]);
});

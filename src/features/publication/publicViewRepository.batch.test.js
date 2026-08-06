import { beforeEach, expect, test, vi } from "vitest";

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
  isSupabaseConfigured: () => true,
}));

import {
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "./publicViewRepository";

function createSupabaseStub(tableRows, rpcRows = {}) {
  const queries = [];
  const rpcCalls = [];

  return {
    queries,
    rpcCalls,
    client: {
      from(table) {
        const query = {
          table,
          filters: [],
        };
        queries.push(query);

        const response = () => ({
          data: tableRows[table] || [],
          error: null,
        });
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
          maybeSingle() {
            const rows = tableRows[table] || [];
            return Promise.resolve({
              data: Array.isArray(rows) ? rows[0] || null : rows,
              error: null,
            });
          },
          then(resolve, reject) {
            return Promise.resolve(response()).then(resolve, reject);
          },
        };

        return builder;
      },
      rpc(name, parameters) {
        rpcCalls.push({ name, parameters });
        return Promise.resolve({
          data: rpcRows[name] || [],
          error: null,
        });
      },
    },
  };
}

const days = ["day-1", "day-2", "day-3"].map((id, index) => ({
  id,
  organization_id: "organization-1",
  show_id: "show-1",
  day_name: `Day ${index + 1}`,
  day_date: `2026-07-${30 + index}`,
  sort_order: index + 1,
}));
const classes = days.map((day, index) => ({
  id: `class-${index + 1}`,
  organization_id: "organization-1",
  show_id: "show-1",
  show_day_id: day.id,
  name: `Class ${index + 1}`,
  pattern: `RR${index + 1}`,
  block_type: "competition",
  sort_order: 1,
}));

beforeEach(() => {
  localStorage.clear();
  getSupabaseClientMock.mockReset();
});

test("loads a multi-day public show with one query per table", async () => {
  const supabase = createSupabaseStub(
    {
      shows: [
        {
          id: "show-1",
          organization_id: "organization-1",
          name: "Summer Show",
          status: "active",
          is_public: true,
        },
      ],
      show_score_class_documents: [],
      show_days: days,
      blocks: classes,
      show_score_paid_warmups: [],
      show_score_publication_states: classes.map((classItem) => ({
        block_id: classItem.id,
        status: "live",
      })),
      show_score_official_results: [],
      show_score_scoring_sessions: classes.map((classItem) => ({
        block_id: classItem.id,
        runs: [],
      })),
      show_score_judge_sessions: [],
      show_score_block_setups: classes.map((classItem) => ({
        block_id: classItem.id,
        pattern: classItem.pattern,
        runs: [],
      })),
      show_score_announcer_live_sessions: [],
      block_result_publications: [],
    },
    {
      public_show_timing_summary: [],
    }
  );
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const view = await getPublicShowViewRepository("show-1");

  expect(view.show).toMatchObject({
    id: "show-1",
    name: "Summer Show",
  });
  expect(view.classIds).toEqual(classes.map(({ id }) => id));
  expect(supabase.rpcCalls).toHaveLength(1);
  expect(supabase.queries).toHaveLength(12);

  const queryCountByTable = supabase.queries.reduce((counts, query) => {
    counts[query.table] = (counts[query.table] || 0) + 1;
    return counts;
  }, {});

  expect(queryCountByTable).toEqual({
    shows: 1,
    show_score_class_documents: 1,
    show_days: 1,
    blocks: 1,
    show_score_paid_warmups: 1,
    show_score_publication_states: 1,
    show_score_official_results: 1,
    show_score_scoring_sessions: 1,
    show_score_judge_sessions: 1,
    show_score_block_setups: 1,
    show_score_announcer_live_sessions: 1,
    block_result_publications: 1,
  });

  const classQuery = supabase.queries.find(
    (query) => query.table === "blocks"
  );
  const paidWarmupQuery = supabase.queries.find(
    (query) => query.table === "show_score_paid_warmups"
  );

  expect(classQuery.filters).toContainEqual({
    operator: "eq",
    column: "show_id",
    value: "show-1",
  });
  expect(paidWarmupQuery.filters).toContainEqual({
    operator: "eq",
    column: "show_id",
    value: "show-1",
  });
  expect(
    [...classQuery.filters, ...paidWarmupQuery.filters].some(
      (filter) => filter.column === "show_day_id"
    )
  ).toBe(false);
});

test("subscribes public displays to every table that can change live output", () => {
  const bindings = [];
  const channel = {
    on(event, config, callback) {
      bindings.push({ event, config, callback });
      return channel;
    },
    subscribe: vi.fn(),
  };
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };
  const onChange = vi.fn();
  getSupabaseClientMock.mockReturnValue(supabase);

  const unsubscribe = subscribePublicShowViewRepository(
    "show-1",
    ["class-1", "class-2", "class-1"],
    onChange
  );

  expect(bindings.map(({ config }) => config).slice(0, 2)).toEqual([
    {
      event: "UPDATE",
      schema: "public",
      table: "shows",
      filter: "id=eq.show-1",
    },
    {
      event: "*",
      schema: "public",
      table: "show_score_paid_warmups",
      filter: "show_id=eq.show-1",
    },
  ]);
  expect(
    bindings.slice(2).map(({ config }) => [config.table, config.filter])
  ).toEqual(
    ["class-1", "class-2"].flatMap((classId) => [
      ["show_score_scoring_sessions", `block_id=eq.${classId}`],
      ["show_score_judge_sessions", `block_id=eq.${classId}`],
      ["show_score_block_setups", `block_id=eq.${classId}`],
      ["show_score_publication_states", `block_id=eq.${classId}`],
      ["show_score_official_results", `block_id=eq.${classId}`],
      ["show_score_announcer_live_sessions", `class_id=eq.${classId}`],
    ])
  );
  expect(channel.subscribe).toHaveBeenCalledOnce();

  unsubscribe();

  expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
});

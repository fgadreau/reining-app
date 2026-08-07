import { beforeEach, expect, test, vi } from "vitest";

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
  isSupabaseConfigured: () => true,
}));

import {
  applyPublicShowViewRealtimeChange,
  getPublicShowView,
  getPublicShowViewRepository,
  isPublicShowViewRealtimeReady,
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

  expect(isPublicShowViewRealtimeReady(getPublicShowView("show-1"))).toBe(false);

  const view = await getPublicShowViewRepository("show-1");

  expect(view.show).toMatchObject({
    id: "show-1",
    name: "Summer Show",
  });
  expect(view.classIds).toEqual(classes.map(({ id }) => id));
  expect(isPublicShowViewRealtimeReady(view)).toBe(true);
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

test("applies a live scoring event without issuing another public read", async () => {
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
      show_days: [days[0]],
      blocks: [classes[0]],
      show_score_paid_warmups: [],
      show_score_publication_states: [
        { block_id: "class-1", status: "live" },
      ],
      show_score_official_results: [],
      show_score_scoring_sessions: [
        { block_id: "class-1", runs: [], updated_at: "2026-08-05T12:00:00Z" },
      ],
      show_score_judge_sessions: [],
      show_score_block_setups: [
        { block_id: "class-1", pattern: "RR1", runs: [] },
      ],
      show_score_announcer_live_sessions: [],
      block_result_publications: [],
    },
    { public_show_timing_summary: [] }
  );
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const view = await getPublicShowViewRepository("show-1");
  const readCount = supabase.queries.length;
  const nextView = applyPublicShowViewRealtimeChange(view, {
    event_seq: 10,
    row_key: "class-1",
    show_id: "show-1",
    block_id: "class-1",
    table: "show_score_scoring_sessions",
    eventType: "UPDATE",
    new: {
      block_id: "class-1",
      runs: [
        {
          id: "run-1",
          draw: 1,
          rider: "Realtime Rider",
          horse: "Realtime Horse",
          scoreTotal: "70",
          status: "completed",
          isComplete: true,
          completedAt: "2026-08-05T12:00:05Z",
        },
      ],
      updated_at: "2026-08-05T12:00:05Z",
    },
  });

  expect(nextView).not.toBeNull();
  expect(isPublicShowViewRealtimeReady(nextView)).toBe(true);
  expect(nextView.liveClass).toMatchObject({
    classId: "class-1",
    liveUpdatedAt: "2026-08-05T12:00:05Z",
    latestScore: {
      rider: "Realtime Rider",
      horse: "Realtime Horse",
      scoreTotal: "70",
    },
  });
  expect(supabase.queries).toHaveLength(readCount);
  expect(supabase.rpcCalls).toHaveLength(1);

  const staleView = applyPublicShowViewRealtimeChange(nextView, {
    event_seq: 9,
    row_key: "class-1",
    show_id: "show-1",
    block_id: "class-1",
    table: "show_score_scoring_sessions",
    eventType: "UPDATE",
    new: {
      block_id: "class-1",
      runs: [
        {
          id: "run-1",
          draw: 1,
          rider: "Stale Rider",
          horse: "Stale Horse",
          scoreTotal: "60",
          status: "completed",
          isComplete: true,
        },
      ],
    },
  });
  expect(staleView).toBe(nextView);
  expect(staleView.liveClass.latestScore.scoreTotal).toBe("70");

  expect(
    applyPublicShowViewRealtimeChange(nextView, {
      event_seq: 11,
      row_key: "private-class",
      show_id: "show-1",
      block_id: "private-class",
      table: "show_score_scoring_sessions",
      eventType: "UPDATE",
      new: { block_id: "private-class", runs: [] },
    })
  ).toBe(nextView);

  expect(
    applyPublicShowViewRealtimeChange(nextView, {
      event_seq: 12,
      row_key: "class-1",
      show_id: "show-1",
      block_id: "class-1",
      table: "public_show_snapshot",
      eventType: "INVALIDATE",
      new: null,
      old: null,
    })
  ).toBeNull();
});

test("subscribes public displays to one private broadcast per show", () => {
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
  const onStatus = vi.fn();
  getSupabaseClientMock.mockReturnValue(supabase);

  const unsubscribe = subscribePublicShowViewRepository(
    "show-1",
    ["class-1", "class-2", "class-1"],
    onChange,
    onStatus
  );

  expect(supabase.channel).toHaveBeenCalledWith("showscore-public:show-1", {
    config: { private: true },
  });
  expect(bindings).toHaveLength(1);
  expect(bindings[0]).toMatchObject({
    event: "broadcast",
    config: { event: "change" },
  });
  expect(channel.subscribe).toHaveBeenCalledOnce();

  const broadcastPayload = {
    version: 1,
    table: "show_score_scoring_sessions",
    eventType: "UPDATE",
  };
  bindings[0].callback({ payload: broadcastPayload });
  expect(onChange).toHaveBeenCalledWith(broadcastPayload);

  const statusCallback = channel.subscribe.mock.calls[0][0];
  statusCallback("SUBSCRIBED");
  expect(onStatus).toHaveBeenCalledWith("SUBSCRIBED");
  expect(onChange).toHaveBeenCalledTimes(2);

  unsubscribe();

  statusCallback("CLOSED");

  expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  expect(onStatus).toHaveBeenCalledTimes(1);
});

test("falls back to the existing Postgres Changes bindings when broadcast fails", () => {
  const channels = [];
  const supabase = {
    channel: vi.fn((topic, options) => {
      const bindings = [];
      const channel = {
        topic,
        options,
        bindings,
        on(event, config, callback) {
          bindings.push({ event, config, callback });
          return channel;
        },
        subscribe: vi.fn(),
      };
      channels.push(channel);
      return channel;
    }),
    removeChannel: vi.fn(),
  };
  const onChange = vi.fn();
  const onStatus = vi.fn();
  getSupabaseClientMock.mockReturnValue(supabase);

  const unsubscribe = subscribePublicShowViewRepository(
    "show-1",
    ["class-1", "class-2", "class-1"],
    onChange,
    onStatus
  );

  expect(channels).toHaveLength(1);
  channels[0].subscribe.mock.calls[0][0]("CHANNEL_ERROR");

  expect(channels).toHaveLength(2);
  expect(channels[1].topic).toBe("public-show-fallback:show-1");
  expect(channels[1].bindings.map(({ config }) => config).slice(0, 2)).toEqual([
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
    channels[1].bindings.slice(2).map(({ config }) => [
      config.table,
      config.filter,
    ])
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

  channels[1].subscribe.mock.calls[0][0]("SUBSCRIBED");
  expect(onChange).toHaveBeenCalledOnce();

  unsubscribe();
  expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0]);
  expect(supabase.removeChannel).toHaveBeenCalledWith(channels[1]);
});

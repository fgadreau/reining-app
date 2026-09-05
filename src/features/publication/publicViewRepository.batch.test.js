import { act, renderHook } from "@testing-library/react";
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
  getPublicShowAnnouncerRevisionRepository,
  getPublicShowAnnouncerRevisionSnapshot,
  getPublicShowViewRepository,
  isPublicShowViewRealtimeReady,
  hasActivePublicAnnouncerSession,
  shouldPublishPublicShowViewSnapshot,
  shouldRefreshForAnnouncerRevisions,
  subscribePublicShowViewRepository,
} from "./publicViewRepository";
import { usePublicShowViewUpdates } from "./usePublicShowViewUpdates";

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
          select(columns) {
            query.columns = columns;
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

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
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

test("loads announcer identity and version markers with one lightweight query", async () => {
  const supabase = createSupabaseStub({
    shows: [{ id: "show-1", updated_at: "2026-09-03T12:00:00Z" }],
    show_score_paid_warmups: [],
    show_score_scoring_sessions: [
      { block_id: "class-1", updated_at: "2026-09-03T12:00:01Z" },
    ],
    show_score_judge_sessions: [],
    show_score_block_setups: [],
    show_score_publication_states: [],
    show_score_official_results: [],
    show_score_announcer_live_sessions: [
      { class_id: "class-1", revision: 4, updated_at: "ignored" },
    ],
  });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const snapshot = await getPublicShowAnnouncerRevisionRepository([
    "class-1",
    "class-1",
  ]);

  expect(supabase.queries).toHaveLength(1);
  expect(supabase.rpcCalls).toHaveLength(0);
  expect(supabase.queries[0]).toMatchObject({
    table: "show_score_announcer_live_sessions",
    columns: "class_id,revision,updated_at",
  });
  expect(snapshot).toEqual([
    { classId: "class-1", revision: 4, updatedAt: "ignored" },
  ]);
});

test("compares added, removed and unversioned lightweight sessions", () => {
  const stable = [{ classId: "class-1", revision: 2, updatedAt: "now" }];
  const added = [
    ...stable,
    { classId: "class-2", revision: 1, updatedAt: "now" },
  ];
  const unversioned = [
    { classId: "class-1", revision: null, updatedAt: null },
  ];

  expect(shouldRefreshForAnnouncerRevisions(stable, stable)).toBe(false);
  expect(
    shouldRefreshForAnnouncerRevisions(stable, [
      { classId: "class-1", revision: 3, updatedAt: "later" },
    ])
  ).toBe(true);
  expect(
    shouldRefreshForAnnouncerRevisions(stable, [
      { classId: "class-1", revision: 1, updatedAt: "older" },
    ])
  ).toBe(false);
  expect(shouldRefreshForAnnouncerRevisions(stable, added)).toBe(true);
  expect(shouldRefreshForAnnouncerRevisions(added, stable)).toBe(true);
  expect(shouldRefreshForAnnouncerRevisions(unversioned, unversioned)).toBe(true);
});

test("treats numeric and string zero announcer revisions as valid", () => {
  const revision = (value, updatedAt = null) => [
    { classId: "class-1", revision: value, updatedAt },
  ];

  expect(shouldRefreshForAnnouncerRevisions(revision(0), revision(0))).toBe(
    false
  );
  expect(shouldRefreshForAnnouncerRevisions(revision(0), revision(1))).toBe(
    true
  );
  expect(shouldRefreshForAnnouncerRevisions(revision(1), revision(0))).toBe(
    false
  );
  expect(shouldRefreshForAnnouncerRevisions(revision(0), revision("0"))).toBe(
    false
  );
  expect(
    shouldRefreshForAnnouncerRevisions(
      revision(null, "2026-09-03T12:00:00Z"),
      revision(null, "2026-09-03T12:00:01Z")
    )
  ).toBe(true);
});

test("integrates revision probing with the global GET generation barrier", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const tableRows = {
    shows: [
      {
        id: "show-1",
        organization_id: "organization-1",
        name: "Initial show",
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
    show_score_scoring_sessions: [],
    show_score_judge_sessions: [],
    show_score_block_setups: [
      { block_id: "class-1", live_data_source: "announcer", runs: [] },
    ],
    show_score_announcer_live_sessions: [
      { class_id: "class-1", revision: 0, runs: [] },
    ],
    block_result_publications: [],
  };
  const supabase = createSupabaseStub(tableRows, {
    public_show_timing_summary: [],
  });
  let broadcastCallback;
  const channel = {
    on(event, _config, callback) {
      if (event === "broadcast") broadcastCallback = callback;
      return channel;
    },
    subscribe(callback) {
      callback("SUBSCRIBED");
      return channel;
    },
  };
  supabase.client.channel = () => channel;
  supabase.client.removeChannel = vi.fn();
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const revision0View = await getPublicShowViewRepository("show-1");
  tableRows.show_score_announcer_live_sessions[0].revision = 1;
  const staleRevision1View = await getPublicShowViewRepository("show-1");
  tableRows.show_score_announcer_live_sessions[0].revision = 0;
  const staleRequest = createDeferred();
  const load = vi
    .fn()
    .mockResolvedValueOnce(revision0View)
    .mockReturnValueOnce(staleRequest.promise)
    .mockImplementation(() => getPublicShowViewRepository("show-1"));
  const onData = vi.fn();

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: ["class-1"],
      data: revision0View,
      load,
      onData,
    })
  );
  await act(async () => vi.advanceTimersByTimeAsync(300));
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(load).toHaveBeenCalledOnce();

  tableRows.show_score_announcer_live_sessions[0].revision = 1;
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(load).toHaveBeenCalledTimes(2);

  tableRows.shows[0] = {
    ...tableRows.shows[0],
    name: "Realtime show",
  };
  act(() =>
    broadcastCallback({
      payload: {
        event_seq: 1,
        row_key: "show-1",
        show_id: "show-1",
        table: "shows",
        eventType: "UPDATE",
        new: tableRows.shows[0],
      },
    })
  );
  staleRequest.resolve(staleRevision1View);
  await act(async () => staleRequest.promise);
  await act(async () => Promise.resolve());

  expect(load).toHaveBeenCalledTimes(3);
  expect(
    onData.mock.calls.some(([published]) => published === staleRevision1View)
  ).toBe(false);
  expect(onData).toHaveBeenLastCalledWith(
    expect.objectContaining({ show: expect.objectContaining({ name: "Realtime show" }) })
  );
  unmount();
  vi.useRealTimers();
});

test("exposes the imported draw of the next class from Supabase", async () => {
  const currentClass = {
    id: "current-class",
    organization_id: "organization-1",
    show_id: "show-next-draw",
    show_day_id: "day-next-draw",
    name: "Current class",
    pattern: "8",
    block_type: "competition",
    sort_order: 1,
  };
  const nextClass = {
    ...currentClass,
    id: "next-class",
    name: "Next class",
    sort_order: 2,
  };
  const supabase = createSupabaseStub(
    {
      shows: [
        {
          id: "show-next-draw",
          organization_id: "organization-1",
          name: "Draw Show",
          status: "active",
          is_public: true,
        },
      ],
      show_score_class_documents: [],
      show_days: [
        {
          id: "day-next-draw",
          organization_id: "organization-1",
          show_id: "show-next-draw",
          day_name: "Day 1",
          day_date: "2026-08-27",
          sort_order: 1,
        },
      ],
      blocks: [currentClass, nextClass],
      show_score_paid_warmups: [],
      show_score_publication_states: [
        { block_id: currentClass.id, status: "live_no_score" },
        { block_id: nextClass.id, status: "hidden" },
      ],
      show_score_official_results: [],
      show_score_scoring_sessions: [],
      show_score_judge_sessions: [],
      show_score_block_setups: [
        { block_id: currentClass.id, pattern: "8", runs: [] },
        {
          block_id: nextClass.id,
          pattern: "8",
          is_draw_imported: true,
          runs: [
            {
              id: "next-run-1",
              draw: 1,
              backNumber: "101",
              rider: "First Rider",
              horse: "First Horse",
            },
            {
              id: "next-run-2",
              draw: 2,
              backNumber: "202",
              rider: "Second Rider",
              horse: "Second Horse",
            },
          ],
        },
      ],
      show_score_announcer_live_sessions: [],
      block_result_publications: [],
    },
    { public_show_timing_summary: [] }
  );
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const view = await getPublicShowViewRepository("show-next-draw");

  expect(view.liveClass.nextScheduleItem).toMatchObject({
    itemId: nextClass.id,
    name: "Next class",
    orderRuns: [
      {
        draw: 1,
        backNumber: "101",
        rider: "First Rider",
        horse: "First Horse",
      },
      {
        draw: 2,
        backNumber: "202",
        rider: "Second Rider",
        horse: "Second Horse",
      },
    ],
  });
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

test("publishes REST snapshots only when session revisions do not regress", async () => {
  const tableRows = {
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
    show_score_scoring_sessions: [],
    show_score_judge_sessions: [],
    show_score_block_setups: [
      {
        block_id: "class-1",
        pattern: "RR1",
        runs: [],
        live_data_source: "announcer",
      },
    ],
    show_score_announcer_live_sessions: [],
    block_result_publications: [],
  };
  const supabase = createSupabaseStub(tableRows, {
    public_show_timing_summary: [],
  });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const loadWithAnnouncerSession = async (revision, rider = "Rider") => {
    tableRows.show_score_announcer_live_sessions = [
      {
        class_id: "class-1",
        runs: [{ id: "run-1", rider }],
        revision,
        updated_at: `2026-09-03T12:00:0${revision || 0}.000Z`,
      },
    ];
    return getPublicShowViewRepository("show-1");
  };

  const revision2 = await loadWithAnnouncerSession(2, "Current");
  const revision1 = await loadWithAnnouncerSession(1, "Old");
  const sameRevision = await loadWithAnnouncerSession(2, "Same revision");
  const revision3 = await loadWithAnnouncerSession(3, "New");

  expect(hasActivePublicAnnouncerSession(revision2)).toBe(true);
  expect(getPublicShowAnnouncerRevisionSnapshot(revision2)).toEqual([
    {
      classId: "class-1",
      revision: 2,
      updatedAt: "2026-09-03T12:00:02.000Z",
    },
  ]);
  expect(shouldPublishPublicShowViewSnapshot(revision2, revision1)).toBe(false);
  expect(shouldPublishPublicShowViewSnapshot(revision2, sameRevision)).toBe(true);
  expect(shouldPublishPublicShowViewSnapshot(revision2, revision3)).toBe(true);

  const showChangedDuringRequest = applyPublicShowViewRealtimeChange(revision2, {
    event_seq: 20,
    row_key: "show-1",
    show_id: "show-1",
    table: "shows",
    eventType: "UPDATE",
    new: {
      id: "show-1",
      organization_id: "organization-1",
      name: "Newer show name",
      status: "open",
      is_public: true,
      updated_at: "2026-09-03T12:00:04.000Z",
    },
  });
  expect(
    shouldPublishPublicShowViewSnapshot(
      showChangedDuringRequest,
      sameRevision,
      revision2
    )
  ).toBe(false);

  const realtimeRevision = applyPublicShowViewRealtimeChange(revision2, {
    event_seq: 10,
    row_key: "class-1",
    show_id: "show-1",
    block_id: "class-1",
    table: "show_score_announcer_live_sessions",
    eventType: "UPDATE",
    new: {
      class_id: "class-1",
      runs: [{ id: "run-1", rider: "Realtime" }],
      revision: 2.5,
      updated_at: "2026-09-03T12:00:02.500Z",
    },
  });
  expect(shouldPublishPublicShowViewSnapshot(realtimeRevision, revision3)).toBe(true);
  expect(
    applyPublicShowViewRealtimeChange(revision3, {
      event_seq: 9,
      row_key: "class-1",
      show_id: "show-1",
      block_id: "class-1",
      table: "show_score_announcer_live_sessions",
      eventType: "UPDATE",
      new: {
        class_id: "class-1",
        runs: [{ id: "run-1", rider: "Replayed old event" }],
        revision: 1,
        updated_at: "2026-09-03T12:00:01.000Z",
      },
    })
  ).toBe(revision3);

  tableRows.show_score_announcer_live_sessions = [];
  const missingSession = await getPublicShowViewRepository("show-1");
  expect(shouldPublishPublicShowViewSnapshot(revision2, missingSession)).toBe(false);
  expect(
    shouldPublishPublicShowViewSnapshot(revision2, missingSession, revision2)
  ).toBe(true);
  expect(shouldPublishPublicShowViewSnapshot(missingSession, revision3)).toBe(true);
});

test("keeps the current session when changed REST data has no revision", async () => {
  const tableRows = {
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
    show_score_scoring_sessions: [],
    show_score_judge_sessions: [],
    show_score_block_setups: [
      { block_id: "class-1", live_data_source: "announcer" },
    ],
    show_score_announcer_live_sessions: [
      { class_id: "class-1", runs: [{ id: "run-1", rider: "Current" }] },
    ],
    block_result_publications: [],
  };
  const supabase = createSupabaseStub(tableRows, {
    public_show_timing_summary: [],
  });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  const current = await getPublicShowViewRepository("show-1");
  const identical = await getPublicShowViewRepository("show-1");
  tableRows.show_score_announcer_live_sessions = [
    { class_id: "class-1", runs: [{ id: "run-1", rider: "Unknown age" }] },
  ];
  const changed = await getPublicShowViewRepository("show-1");

  expect(shouldPublishPublicShowViewSnapshot(current, identical)).toBe(true);
  expect(shouldPublishPublicShowViewSnapshot(current, changed)).toBe(false);
  expect(shouldPublishPublicShowViewSnapshot(current, changed, current)).toBe(true);
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

test.each(["CHANNEL_ERROR", "TIMED_OUT"])(
  "falls back to the existing Postgres Changes bindings on %s",
  (failureStatus) => {
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
    channels[0].subscribe.mock.calls[0][0](failureStatus);

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
  }
);

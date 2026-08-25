import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

class FakeWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  receive(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  send(value) {
    this.sent.push(JSON.parse(value));
  }

  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

beforeEach(() => {
  localStorage.clear();
  FakeWebSocket.instances = [];
  vi.resetModules();
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("local relay client", () => {
  test("migrates the former default port while preserving relay settings", async () => {
    localStorage.setItem(
      "showscore_local_relay_v1",
      JSON.stringify({
        enabled: true,
        relayUrl: "ws://127.0.0.1:3000/ws/producer",
        pairingCode: "482731",
        producerId: "producer-1",
      })
    );

    const client = await import("./localRelayClient");

    expect(client.getLocalRelayState()).toMatchObject({
      enabled: true,
      relayUrl: "ws://127.0.0.1:9874/ws/producer",
      pairingCode: "482731",
      producerId: "producer-1",
    });
  });

  test("publishes the newest snapshot after pairing and advances past relay state", async () => {
    const client = await import("./localRelayClient");
    client.publishLocalRelaySnapshot({ schemaVersion: 1, show: { id: "show-1" } });
    client.configureLocalRelay({
      relayUrl: "http://127.0.0.1:3000/anything",
      pairingCode: "482731",
      enabled: true,
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe("ws://127.0.0.1:3000/ws/producer");
    socket.open();
    expect(socket.sent[0]).toMatchObject({
      type: "producer.hello",
      pairingCode: "482731",
    });

    socket.receive({
      type: "producer.ready",
      lastVersion: "9999999999999999999",
      viewerCount: 3,
      overlayViewerCount: 1,
      tvViewerCount: 2,
      overlayUrls: ["http://192.168.50.10:3000/overlay"],
      tvUrls: [
        {
          kind: "general",
          arena: "",
          url: "http://192.168.50.10:3000/tv",
        },
      ],
    });

    expect(socket.sent[1]).toMatchObject({
      type: "snapshot.publish",
      version: "10000000000000000000",
      snapshot: { show: { id: "show-1" } },
    });
    expect(client.getLocalRelayState()).toMatchObject({
      status: "connected",
      viewerCount: 3,
      overlayViewerCount: 1,
      tvViewerCount: 2,
      lastVersion: "10000000000000000000",
    });
  });

  test("stops reconnecting when a newer announcer tab replaces it", async () => {
    vi.useFakeTimers();
    const client = await import("./localRelayClient");
    client.configureLocalRelay({
      relayUrl: "ws://127.0.0.1:3000/ws/producer",
      pairingCode: "482731",
      enabled: true,
    });

    const socket = FakeWebSocket.instances[0];
    socket.open();
    socket.close(4002);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(client.getLocalRelayState()).toMatchObject({
      status: "error",
      error: expect.stringContaining("autre tableau annonceur"),
    });
  });

  test("a disabled relay never opens a socket", async () => {
    const client = await import("./localRelayClient");
    client.configureLocalRelay({
      relayUrl: "ws://127.0.0.1:3000/ws/producer",
      pairingCode: "482731",
      enabled: false,
    });
    client.publishLocalRelaySnapshot({ schemaVersion: 1, show: { id: "show-1" } });

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(client.getLocalRelayState().status).toBe("disabled");
  });
});

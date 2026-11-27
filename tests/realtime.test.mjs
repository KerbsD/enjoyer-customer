import assert from "node:assert/strict";
import { test } from "node:test";
import { watchRealtime } from "../src/api/realtime.ts";

test("a sync frame refreshes every resource even when the revision is unchanged", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const state = {
    revision: "a".repeat(64),
    resources: { cart: "cart", orders: "orders", menu: "menu", store: "store", tables: "tables" },
    scope: { kind: "table", tableId: 1, sessionId: "test-visit" },
  };
  const sync = `event: sync\ndata: ${JSON.stringify(state)}\n\n`;
  const requested = [];
  const updates = [];
  globalThis.fetch = async (url, options) => {
    requested.push({ url, options });
    return new Response(sync + sync, { headers: { "Content-Type": "text/event-stream" } });
  };
  try {
    const watcher = watchRealtime({
      url: "http://localhost:4000/tables/realtime?sessionId=test-visit",
      headers: () => ({ "X-Table-Token": "test-token" }),
      signal: controller.signal,
      onChange: (_revision, changed) => {
        updates.push(changed);
        if (updates.length === 2) controller.abort();
      },
    });
    await watcher.done;
    assert.deepEqual(updates, [Object.keys(state.resources), Object.keys(state.resources)]);
    assert.equal(requested.length, 1);
    assert.equal(requested[0].url.pathname, "/tables/realtime/events");
    assert.equal(requested[0].url.searchParams.get("sessionId"), "test-visit");
    assert.equal(requested[0].options.headers["X-Table-Token"], "test-token");
    assert.ok(requested[0].options.signal.aborted);
  } finally {
    controller.abort();
    globalThis.fetch = original;
  }
});

test("a failed same-revision resync forces polling to apply the full snapshot", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  const state = {
    revision: "b".repeat(64),
    resources: { cart: "cart", orders: "orders" },
    scope: { kind: "table", tableId: 1, sessionId: "test-visit" },
  };
  const sync = `event: sync\ndata: ${JSON.stringify(state)}\n\n`;
  const requests = [];
  const applied = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url.pathname.endsWith("/events"))
      return new Response(sync + sync, { headers: { "Content-Type": "text/event-stream" } });
    return Response.json({ data: state });
  };
  try {
    const watcher = watchRealtime({
      url: "http://localhost:4000/tables/realtime?sessionId=test-visit",
      headers: () => ({ "X-Table-Token": "test-token" }),
      signal: controller.signal,
      onChange: (_revision, changed) => {
        applied.push(changed);
        if (applied.length === 2) throw new Error("A resource failed");
        if (applied.length === 3) controller.abort();
      },
    });
    await watcher.done;
    assert.equal(requests.length, 2);
    assert.ok(requests[1].pathname.endsWith("/changes"));
    assert.equal(requests[1].searchParams.has("since"), false);
    assert.deepEqual(applied, Array.from({ length: 3 }, () => ["cart", "orders"]));
  } finally {
    controller.abort();
    globalThis.fetch = original;
  }
});

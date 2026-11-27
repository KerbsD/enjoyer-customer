import assert from "node:assert/strict";
import { test } from "node:test";
import { tableTokenFromHash } from "../src/lib/table-token.ts";
import { ApiError, publicRequest, resumeTable } from "../src/api/public.ts";

test("QR token is read only from a single valid fragment field", () => {
  const token = "A".repeat(43);
  assert.equal(tableTokenFromHash(`#table=${token}`), token);
  assert.equal(tableTokenFromHash(`#other=x&table=${token}`), token);
  for (const hash of ["", "?table=" + token, "#table=", "#table=not-a-token", "#table=x&table=y", "#category-1"]) {
    assert.equal(tableTokenFromHash(hash), null);
  }
});

test("timeouts abort stalled requests and preserve uncertain-write handling", async () => {
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => {
      aborted = true;
      reject(signal.reason);
    }, { once: true });
  });
  try {
    await assert.rejects(
      publicRequest("/tables/cart/items", { method: "POST", timeoutMs: 10 }),
      (error) => error instanceof ApiError && error.status === 0,
    );
    assert.equal(aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("truncated successful responses are treated as uncertain writes", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"success":');
  try {
    await assert.rejects(
      publicRequest("/tables/cart/items", { method: "POST" }),
      (error) => error instanceof ApiError && error.status === 0,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("the timeout also covers a stalled response body", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  try {
    await assert.rejects(
      publicRequest("/tables/cart/items", { method: "POST", timeoutMs: 10 }),
      (error) => error instanceof ApiError && error.status === 0,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("public requests send QR token in JSON or header, never URL", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await publicRequest("/tables/resolve", { method: "POST", body: { token: "secret" } });
    await publicRequest("/tables/orders", { tableToken: "secret" });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url.includes("secret"), false);
    assert.deepEqual(JSON.parse(calls[0].options.body), { token: "secret" });
    assert.equal(calls[1].url.includes("secret"), false);
    assert.equal(calls[1].options.headers["X-Table-Token"], "secret");
  } finally {
    globalThis.fetch = original;
  }
});

test("resume keeps the remembered session out of the URL", async () => {
  const original = globalThis.fetch;
  const calls = [];
  const sessionId = "11111111-1111-4111-8111-111111111111";
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          table: { id: 1, name: "Table 1", orderLimit: 5 },
          session: {
            id: sessionId,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          cart: { id: "cart", version: 0 },
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    await resumeTable("secret-token", sessionId);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.includes("secret-token"), false);
    assert.equal(calls[0].url.includes(sessionId), false);
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      token: "secret-token",
      sessionId,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("public API preserves error codes and reports network failures", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, code: "INVALID_TABLE_QR", message: "Invalid code." }),
      { status: 404 },
    );
    await assert.rejects(publicRequest("/tables/resolve"), (error) =>
      error instanceof ApiError && error.code === "INVALID_TABLE_QR" && error.status === 404);
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(publicRequest("/menu"), (error) =>
      error instanceof ApiError && error.status === 0 && !error.message.includes("TypeError"));
  } finally {
    globalThis.fetch = original;
  }
});

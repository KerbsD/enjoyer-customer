import assert from "node:assert/strict";
import { test } from "node:test";
import { tableTokenFromHash } from "../src/lib/table-token.ts";
import { ApiError, publicRequest } from "../src/api/public.ts";

test("QR token is read only from a single valid fragment field", () => {
  const token = "A".repeat(43);
  assert.equal(tableTokenFromHash(`#table=${token}`), token);
  assert.equal(tableTokenFromHash(`#other=x&table=${token}`), token);
  for (const hash of ["", "?table=" + token, "#table=", "#table=not-a-token", "#table=x&table=y", "#category-1"]) {
    assert.equal(tableTokenFromHash(hash), null);
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

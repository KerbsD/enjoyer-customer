import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cartCustomizationFields,
  customizationSchema,
  cartSchema,
} from "../src/schemas/cart.ts";
import { fromCentavos, toCentavos } from "../src/lib/money.ts";
import { ApiError, publicRequest } from "../src/api/public.ts";
import {
  addCartLine,
  clearCart,
  removeCartLine,
  updateCartLine,
} from "../src/api/cart.ts";

const item = {
  id: 7,
  name: "Latte",
  description: "",
  price: "120.00",
  isAvailable: true,
  isSpicy: false,
  sortOrder: 0,
  optionGroups: [
    {
      id: 2,
      name: "Temperature",
      minSelections: 1,
      maxSelections: 1,
      options: [
        {
          id: 11,
          name: "Iced",
          priceDelta: "0.00",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          id: 12,
          name: "Hot",
          priceDelta: "0.00",
          isAvailable: false,
          sortOrder: 1,
        },
      ],
    },
    {
      id: 3,
      name: "Extras",
      minSelections: 0,
      maxSelections: 2,
      options: [
        {
          id: 13,
          name: "Oat",
          priceDelta: "30.00",
          isAvailable: true,
          sortOrder: 0,
        },
      ],
    },
  ],
};

test("item options, quantities and per-line notes follow the API rules", () => {
  const schema = customizationSchema(item);
  const value = { quantity: 2, note: "  light ice  ", optionIds: [11, 13] };
  assert.deepEqual(schema.parse(value), { ...value, note: "light ice" });
  for (const invalid of [
    { ...value, optionIds: [] },
    { ...value, optionIds: [11, 12] },
    { ...value, optionIds: [12] },
    { ...value, optionIds: [99] },
    { ...value, optionIds: [11, 11] },
    { ...value, quantity: 100 },
    { ...value, note: "x".repeat(501) },
  ])
    assert.equal(schema.safeParse(invalid).success, false);
  assert.equal(
    cartCustomizationFields.safeParse({ quantity: 1, note: "", optionIds: [] })
      .success,
    true,
  );
});

test("peso arithmetic uses exact centavos", () => {
  assert.equal(toCentavos("350.00"), 35000);
  assert.equal(toCentavos("0.29") + toCentavos("0.01"), 30);
  assert.equal(
    fromCentavos((toCentavos("350.00") + toCentavos("60.00")) * 2),
    "820.00",
  );
  assert.throws(() => toCentavos("5.009"));
});

test("cart mutation endpoints keep token in header and send the observed version", async () => {
  const cartId = "22222222-2222-4222-8222-222222222222";
  const old = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: "cart", version: 4, reviewFingerprint: "a".repeat(64), updatedAt: new Date().toISOString(), items: [],
          totals: { itemCount: 0, subtotal: "0.00", total: "0.00" },
        },
      }),
    );
  };
  try {
    await addCartLine("secret", {
      menuItemId: 7,
      quantity: 2,
      note: "light ice",
      optionIds: [11],
      cartId,
      version: 3,
    });
    await updateCartLine("secret", 1, {
      quantity: 3,
      note: "",
      optionIds: [11],
      cartId,
      version: 4,
    });
    await removeCartLine("secret", 1, { cartId, version: 5 });
    await clearCart("secret", { cartId, version: 6 });
    assert.deepEqual(
      calls.map((call) => call.options.method),
      ["POST", "PATCH", "DELETE", "DELETE"],
    );
    assert.deepEqual(
      calls.map((call) => call.options.headers["X-Table-Token"]),
      Array(4).fill("secret"),
    );
    assert.ok(calls.every((call) => !call.url.includes("secret")));
    assert.equal(JSON.parse(calls[0].options.body).version, 3);
    assert.equal(JSON.parse(calls[1].options.body).version, 4);
    assert.equal(JSON.parse(calls[0].options.body).cartId, cartId);
    assert.equal(JSON.parse(calls[1].options.body).cartId, cartId);
    assert.ok(calls[2].url.endsWith(`/tables/cart/items/1?cartId=${cartId}&version=5`));
    assert.ok(calls[3].url.endsWith(`/tables/cart?cartId=${cartId}&version=6`));
  } finally {
    globalThis.fetch = old;
  }
});

test("cart validation rejects malformed nested lines and totals", () => {
  const cart = {
    id: "cart", version: 0, reviewFingerprint: "a".repeat(64), updatedAt: new Date().toISOString(), items: [],
    totals: { itemCount: 0, subtotal: "0.00", total: "0.00" },
  };
  assert.equal(cartSchema.safeParse(cart).success, true);
  for (const invalid of [
    { ...cart, version: -1 },
    { ...cart, totals: { total: "0.00" } },
    { ...cart, items: [{ id: 1, options: null }] },
    { ...cart, totals: { ...cart.totals, total: "NaN" } },
  ]) assert.equal(cartSchema.safeParse(invalid).success, false);
});

test("conflict errors expose the latest server cart for safe review", async () => {
  const old = globalThis.fetch;
  const latest = {
    id: "cart",
    version: 5,
    items: [],
    totals: { total: "0.00" },
  };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        success: false,
        code: "CART_VERSION_CONFLICT",
        message: "Review the latest cart.",
        data: latest,
      }),
      { status: 409 },
    );
  try {
    await assert.rejects(
      publicRequest("/tables/cart"),
      (error) =>
        error instanceof ApiError &&
        error.code === "CART_VERSION_CONFLICT" &&
        error.data?.version === 5,
    );
  } finally {
    globalThis.fetch = old;
  }
});

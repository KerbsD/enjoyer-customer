import { createHash } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const token = "A".repeat(43);
const sessionId = "11111111-1111-4111-8111-111111111111";
const table = { id: 99, name: "Test Table", orderLimit: 5 };

const menu = [
  {
    id: 1,
    name: "Coffee",
    sortOrder: 0,
    items: [
      {
        id: 7,
        name: "Test Latte",
        description: "Smooth & warm.",
        price: "120.00",
        isSpicy: false,
        isAvailable: true,
        sortOrder: 0,
        optionGroups: [
          {
            id: 1,
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
                isAvailable: true,
                sortOrder: 1,
              },
            ],
          },
          {
            id: 2,
            name: "Milk",
            minSelections: 0,
            maxSelections: 1,
            options: [
              {
                id: 13,
                name: "Oat milk",
                priceDelta: "30.00",
                isAvailable: true,
                sortOrder: 0,
              },
            ],
          },
        ],
      },
      {
        id: 8,
        name: "Sold out pastry",
        description: "",
        price: "90.00",
        isSpicy: false,
        isAvailable: false,
        sortOrder: 1,
        optionGroups: [],
      },
    ],
  },
];

type Line = {
  id: number;
  menuItem: {
    id: number;
    name: string;
    price: string;
    isAvailable: boolean;
    isHidden: boolean;
  };
  quantity: number;
  note: string;
  options: {
    id: number;
    name: string;
    priceDelta: string;
    isAvailable: boolean;
    groupId: number;
    groupName: string;
  }[];
  unitPrice: string;
  lineTotal: string;
};

function cents(amount: string) {
  const [whole, part] = amount.split(".");
  return Number(whole) * 100 + Number((part ?? "").padEnd(2, "0"));
}
function amount(value: number) {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

async function fixture(context: BrowserContext, closed = false) {
  const currentMenu = structuredClone(menu);
  let version = 0;
  let nextId = 1;
  let lines: Line[] = [];
  let currentSessionId = sessionId;
  let cartId = "33333333-3333-4333-8333-333333333333";
  let sessionEnded = false;
  let networkAllowed = true;
  let readsFail = false;
  let menuFails = false;
  let unavailableNextWrite = false;
  let malformedConflict = false;
  let conflictNextWrite = false;
  let replaceCartOnWrite = false;
  let holdRecovery: Promise<void> | null = null;
  let holdWrite: Promise<void> | null = null;
  let writeCount = 0;
  let dropNextWrite = false;
  let rejectNextWrite = false;
  let holdCartRead: Promise<void> | null = null;
  let replaceOnResume = false;
  let openCalls = 0;
  let resumeCalls = 0;
  let orderPosts = 0;
  let resolutionPosts = 0;
  let loseOrderResponse = false;
  let loseOrderBeforeCommit = false;
  let failOrderReads = false;
  let raceCancellation = false;
  let cancelPosts = 0;
  let realtimeEnabled = false;
  let realtimeEnded = false;
  let realtimeStream = false;
  let streamStatus = 503;
  let streamRejectedAt = 0;
  let firstPollAt = 0;
  let realtimeCartRevision = 0;
  const observedCursors: (string | null)[] = [];
  let failedCartReadsAfterPoll = 0;
  let orderFailure: { code: string; message: string } | null = null;
  const placedOrders: {
    id: string;
    tableSessionId: string;
    orderNumber: string;
    status: string;
    total: string;
    createdAt: string;
    paymentStatus: string;
    cancellationReason: string | null;
    rejectionReason: string | null;
    items: {
      id: number;
      name: string;
      quantity: number;
      note: string;
      lineTotal: string;
      options: Line["options"];
    }[];
  }[] = [];
  const replaceVisit = () => {
    currentSessionId = "22222222-2222-4222-8222-222222222222";
    cartId = "44444444-4444-4444-8444-444444444444";
    lines = [];
    version = 0;
  };
  const cart = () => {
    const total = lines.reduce((sum, line) => sum + cents(line.lineTotal), 0);
    return {
      id: cartId,
      version,
      reviewFingerprint: createHash("sha256")
        .update(JSON.stringify(lines))
        .digest("hex"),
      updatedAt: new Date().toISOString(),
      items: lines,
      totals: {
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotal: amount(total),
        total: amount(total),
      },
    };
  };
  const envelope = (data: unknown) => ({
    success: true,
    currency: "PHP",
    data,
  });
  await context.route("http://localhost:4000/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,X-Table-Token,Accept",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    };
    const send = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers,
        body: JSON.stringify(data),
      });
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (
      !networkAllowed &&
      (["/tables/open", "/tables/resume"].includes(url.pathname) ||
        /^\/tables\/(cart|orders|realtime)(\/|$)/.test(url.pathname))
    ) {
      await send(
        {
          success: false,
          code: "ORDERING_NETWORK_REQUIRED",
          message:
            "Connect to the café’s guest Wi-Fi to order. You can still browse the menu.",
        },
        403,
      );
      return;
    }
    if (realtimeEnabled && url.pathname.startsWith("/tables/realtime/")) {
      expect(request.headers()["x-table-token"]).toBe(token);
      expect(url.href).not.toContain(token);
      expect(url.searchParams.get("sessionId")).toBe(currentSessionId);
      const revision = String(realtimeCartRevision).padStart(64, "0");
      const state = {
        revision,
        scope: {
          kind: "table",
          tableId: table.id,
          sessionId: currentSessionId,
        },
        resources: {
          cart: revision,
          menu: "1",
          store: "1",
          orders: "1",
          tables: "1",
        },
      };
      if (realtimeEnded) {
        await send({ code: "TABLE_SESSION_REQUIRED" }, 409);
      } else if (url.pathname.endsWith("/events")) {
        if (realtimeStream) {
          realtimeStream = false;
          await route.fulfill({
            headers,
            contentType: "text/event-stream",
            body: `event: sync\ndata: ${JSON.stringify(state)}\n\n`,
          });
        } else if (streamStatus === 429) {
          streamRejectedAt = Date.now();
          await route.fulfill({
            status: 429,
            headers: {
              ...headers,
              "Access-Control-Expose-Headers": "Retry-After",
              "Retry-After": "1",
            },
            contentType: "application/json",
            body: JSON.stringify({ success: false, code: "STREAM_LIMIT" }),
          });
        } else await send({ success: false }, streamStatus);
      } else {
        if (!firstPollAt) firstPollAt = Date.now();
        const since = url.searchParams.get("since");
        observedCursors.push(since);
        if (since === revision) await route.fulfill({ status: 204, headers });
        else await send(envelope(state));
      }
      return;
    }
    if (url.pathname === "/menu") {
      if (menuFails)
        await send({ success: false, message: "Menu offline." }, 503);
      else await send(envelope(currentMenu));
      return;
    }
    if (url.pathname === "/store/status") {
      await send(
        envelope({
          isOpen: !closed,
          configured: true,
          timezone: "Asia/Manila",
          today: {
            date: "2026-11-18",
            closed,
            openTime: closed ? null : "08:00",
            closeTime: closed ? null : "20:00",
          },
          nextOpen: closed ? "2026-11-19T00:00:00Z" : null,
        }),
      );
      return;
    }
    if (url.pathname === "/tables/resolve") {
      await send(envelope(table));
      return;
    }
    if (url.pathname === "/tables/open") {
      openCalls++;
      sessionEnded = false;
      await send(
        envelope({
          table,
          session: {
            id: currentSessionId,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          cart: cart(),
          created: false,
        }),
      );
      return;
    }
    if (url.pathname === "/tables/resume") {
      resumeCalls++;
      const body = request.postDataJSON() as { sessionId?: string } | null;
      if (replaceOnResume) {
        replaceOnResume = false;
        replaceVisit();
      }
      if (sessionEnded || body?.sessionId !== currentSessionId) {
        await send(
          {
            success: false,
            code: "TABLE_SESSION_REQUIRED",
            message: "This visit has ended.",
          },
          409,
        );
        return;
      }
      await send(
        envelope({
          table,
          session: {
            id: currentSessionId,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          cart: cart(),
        }),
      );
      return;
    }
    if (url.pathname === "/tables/orders") {
      expect(request.headers()["x-table-token"]).toBe(token);
      const currentOrders = () =>
        placedOrders.filter(
          (order) => order.tableSessionId === currentSessionId,
        );
      const summary = () => {
        const eligible = currentOrders().filter(
          (order) => !["cancelled", "rejected"].includes(order.status),
        );
        return {
          ordersRemaining: 5 - eligible.length,
          ordersUsed: eligible.length,
          total: amount(
            eligible.reduce((sum, order) => sum + cents(order.total), 0),
          ),
          awaitingConfirmation: eligible.some(
            (order) => order.status === "pending_confirmation",
          ),
        };
      };
      if (request.method() === "GET") {
        if (
          sessionEnded ||
          url.searchParams.get("sessionId") !== currentSessionId
        ) {
          await send({ success: false, code: "TABLE_SESSION_REQUIRED" }, 409);
          return;
        }
        if (failOrderReads) await send({ success: false }, 503);
        else
          await send(
            envelope({
              session: { id: currentSessionId, status: "pending" },
              orders: currentOrders(),
              summary: summary(),
            }),
          );
        return;
      }
      const body = request.postDataJSON() as {
        cartId: string;
        requestId: string;
        version: number;
        total: string;
        reviewFingerprint: string;
        resolveOnly?: true;
        customerName?: string;
      };
      expect(body.customerName).toBe(body.resolveOnly ? undefined : "Alex");
      if (body.resolveOnly) resolutionPosts++;
      else orderPosts++;
      const existing = placedOrders.find(
        (order) => order.id === body.requestId,
      );
      if (existing) {
        await send(
          envelope({ order: existing, cart: cart(), summary: summary() }),
        );
        return;
      }
      expect(body.cartId).toBe(cartId);
      expect(body.requestId).toMatch(/^[\da-f-]{36}$/);
      if (body.resolveOnly) {
        if (body.version === version) version++;
        await send({ success: false, code: "ORDER_ATTEMPT_CLOSED" }, 409);
        return;
      }
      if (loseOrderBeforeCommit) {
        loseOrderBeforeCommit = false;
        await route.abort("failed");
        return;
      }
      if (orderFailure) {
        await send({ success: false, ...orderFailure }, 409);
        return;
      }
      if (
        body.version !== version ||
        body.total !== cart().totals.total ||
        body.reviewFingerprint !== cart().reviewFingerprint
      ) {
        await send(
          { success: false, code: "CART_VERSION_CONFLICT", data: cart() },
          409,
        );
        return;
      }
      const order = {
        id: body.requestId,
        tableSessionId: currentSessionId,
        orderNumber: "20261119-001",
        status: "pending_confirmation",
        total: body.total,
        createdAt: new Date().toISOString(),
        paymentStatus: "unpaid",
        cancellationReason: null,
        rejectionReason: null,
        items: lines.map((line) => ({
          id: line.id,
          name: line.menuItem.name,
          quantity: line.quantity,
          note: line.note,
          lineTotal: line.lineTotal,
          options: structuredClone(line.options),
        })),
      };
      placedOrders.push(order);
      lines = [];
      version++;
      if (loseOrderResponse) {
        loseOrderResponse = false;
        await route.abort("failed");
        return;
      }
      await send(envelope({ order, cart: cart(), summary: summary() }), 201);
      return;
    }
    if (
      /^\/tables\/orders\/[^/]+\/cancel$/.test(url.pathname) &&
      request.method() === "POST"
    ) {
      expect(request.headers()["x-table-token"]).toBe(token);
      cancelPosts++;
      if (
        sessionEnded ||
        url.searchParams.get("sessionId") !== currentSessionId
      ) {
        await send({ success: false, code: "TABLE_SESSION_REQUIRED" }, 409);
        return;
      }
      const order = placedOrders.find(
        (item) =>
          item.id === url.pathname.split("/")[3] &&
          item.tableSessionId === currentSessionId,
      );
      if (!order) {
        await send({ success: false, code: "ORDER_NOT_FOUND" }, 404);
        return;
      }
      if (raceCancellation) {
        raceCancellation = false;
        order.status = "preparing";
      }
      if (!["pending_confirmation", "received"].includes(order.status)) {
        await send(
          {
            success: false,
            code: "ORDER_NOT_CANCELLABLE",
            message: "Staff have started preparing this order.",
          },
          409,
        );
        return;
      }
      order.status = "cancelled";
      await send(envelope(order));
      return;
    }
    if (url.pathname === "/tables/cart" && request.method() === "GET") {
      const held = holdCartRead;
      holdCartRead = null;
      if (held) await held;
      if (sessionEnded) {
        await send({ success: false, code: "TABLE_SESSION_REQUIRED" }, 409);
        return;
      }
      if (readsFail) {
        if (observedCursors.length) failedCartReadsAfterPoll++;
        await send({ success: false, message: "Temporarily offline." }, 503);
        return;
      }
      await send(envelope(cart()));
      return;
    }
    if (url.pathname.startsWith("/tables/cart")) {
      writeCount++;
      expect(request.headers()["x-table-token"]).toBe(token);
      const body = request.postDataJSON() as {
        cartId: string;
        version: number;
        menuItemId?: number;
        quantity?: number;
        note?: string;
        optionIds?: number[];
      } | null;
      const observedCartId = body?.cartId ?? url.searchParams.get("cartId");
      expect(observedCartId).toMatch(/^[\da-f-]{36}$/);
      const observed = body?.version ?? Number(url.searchParams.get("version"));
      if (replaceCartOnWrite) {
        replaceCartOnWrite = false;
        replaceVisit();
      }
      if (sessionEnded || observedCartId !== cartId) {
        await send({ success: false, code: "TABLE_SESSION_REQUIRED" }, 409);
        return;
      }
      if (conflictNextWrite) {
        conflictNextWrite = false;
        lines = [];
        version++;
        await send(
          {
            success: false,
            code: "CART_VERSION_CONFLICT",
            data: cart(),
          },
          409,
        );
        return;
      }
      if (unavailableNextWrite) {
        unavailableNextWrite = false;
        currentMenu[0].items[0].optionGroups[1].options[0].isAvailable = false;
        await send(
          {
            success: false,
            code: "OPTION_UNAVAILABLE",
            message: "Oat milk is sold out.",
          },
          409,
        );
        return;
      }
      if (malformedConflict) {
        malformedConflict = false;
        holdCartRead = holdRecovery;
        holdRecovery = null;
        await send(
          {
            success: false,
            code: "CART_VERSION_CONFLICT",
            data: { ...cart(), items: [{ id: 1, options: null }] },
          },
          409,
        );
        return;
      }
      if (rejectNextWrite) {
        rejectNextWrite = false;
        await send(
          {
            success: false,
            code: "CART_REJECTED",
            message: "This item could not be added. Please try again.",
          },
          400,
        );
        return;
      }
      if (observed !== version) {
        await send(
          {
            success: false,
            code: "CART_VERSION_CONFLICT",
            message: "Review latest cart.",
            data: cart(),
          },
          409,
        );
        return;
      }
      if (request.method() === "POST") {
        const selected = (body?.optionIds ?? []).map((id) => ({
          id,
          name: id === 13 ? "Oat milk" : id === 12 ? "Hot" : "Iced",
          priceDelta: id === 13 ? "30.00" : "0.00",
          isAvailable: true,
          groupId: id === 13 ? 2 : 1,
          groupName: id === 13 ? "Milk" : "Temperature",
        }));
        const unit =
          12000 +
          selected.reduce((sum, option) => sum + cents(option.priceDelta), 0);
        lines.push({
          id: nextId++,
          menuItem: {
            id: 7,
            name: "Test Latte",
            price: "120.00",
            isAvailable: true,
            isHidden: false,
          },
          quantity: body?.quantity ?? 1,
          note: body?.note ?? "",
          options: selected,
          unitPrice: amount(unit),
          lineTotal: amount(unit * (body?.quantity ?? 1)),
        });
      } else if (request.method() === "PATCH") {
        const line = lines.find(
          (entry) => entry.id === Number(url.pathname.split("/").pop()),
        );
        if (line) {
          line.quantity = body?.quantity ?? line.quantity;
          line.note = body?.note ?? line.note;
          if (body?.optionIds) {
            line.options = currentMenu[0].items[0].optionGroups.flatMap(
              (group) =>
                group.options
                  .filter((option) => body.optionIds!.includes(option.id))
                  .map((option) => ({
                    ...option,
                    groupId: group.id,
                    groupName: group.name,
                  })),
            );
            line.unitPrice = amount(
              cents(line.menuItem.price) +
                line.options.reduce(
                  (sum, option) => sum + cents(option.priceDelta),
                  0,
                ),
            );
          }
          line.lineTotal = amount(cents(line.unitPrice) * line.quantity);
        }
      } else if (request.method() === "DELETE") {
        if (url.pathname === "/tables/cart") lines = [];
        else
          lines = lines.filter(
            (line) => line.id !== Number(url.pathname.split("/").pop()),
          );
      }
      version++;
      if (dropNextWrite) {
        dropNextWrite = false;
        holdCartRead = holdRecovery;
        holdRecovery = null;
        await route.abort("failed");
        return;
      }
      const response = structuredClone(cart());
      const held = holdWrite;
      holdWrite = null;
      if (held) await held;
      await send(envelope(response));
      return;
    }
    await send(
      { success: false, message: "Unexpected test API request." },
      500,
    );
  });
  return {
    cart,
    writes: () => writeCount,
    failReads: (fail: boolean) => {
      readsFail = fail;
    },
    failMenu: (fail: boolean) => {
      menuFails = fail;
    },
    unavailableOnce: () => {
      unavailableNextWrite = true;
    },
    conflictOnce: () => {
      conflictNextWrite = true;
    },
    replaceOnNextWrite: () => {
      replaceCartOnWrite = true;
    },
    replaceOnNextResume: () => {
      replaceOnResume = true;
    },
    addMenuCategory: (category: (typeof menu)[number]) => currentMenu.push(category),
    opens: () => openCalls,
    resumes: () => resumeCalls,
    orderPosts: () => orderPosts,
    resolutionPosts: () => resolutionPosts,
    cancelPosts: () => cancelPosts,
    enableRealtime: (stream = false) => {
      realtimeEnabled = true;
      realtimeStream = stream;
    },
    setNetworkAllowed: (allowed: boolean) => {
      networkAllowed = allowed;
    },
    failRealtimeStream: (status: number) => {
      realtimeEnabled = true;
      streamStatus = status;
    },
    fallbackDelay: () => firstPollAt - streamRejectedAt,
    endRealtime: () => {
      realtimeEnded = true;
    },
    bumpRealtimeCart: () => {
      realtimeCartRevision++;
    },
    cursors: () => observedCursors.slice(),
    failedCartReadsAfterPoll: () => failedCartReadsAfterPoll,
    startPreparingOnCancel: () => {
      raceCancellation = true;
    },
    replaceVisit,
    renameFirstLine: () => {
      lines[0].menuItem.name = "Renamed Latte";
    },
    orders: () => placedOrders.length,
    loseNextOrderResponse: () => {
      loseOrderResponse = true;
    },
    loseNextOrderBeforeCommit: () => {
      loseOrderBeforeCommit = true;
    },
    failOrderReads: (fail: boolean) => {
      failOrderReads = fail;
    },
    failPlacement: (code: string, message: string) => {
      orderFailure = { code, message };
    },
    hideFirstLine: () => {
      lines[0].menuItem.isHidden = true;
    },
    endVisit: () => {
      sessionEnded = true;
      replaceVisit();
    },
    holdRecoveryRead: (malformed = false) => {
      malformedConflict = malformed;
      let release!: () => void;
      holdRecovery = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    holdNextWriteResponse: () => {
      let release!: () => void;
      holdWrite = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    dropResponseOnce: () => {
      dropNextWrite = true;
    },
    rejectWriteOnce: () => {
      rejectNextWrite = true;
    },
    holdNextCartRead: () => {
      let release!: () => void;
      holdCartRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
  };
}

async function open(page: Page, total = "₱0.00") {
  await page.goto(`/order#table=${token}`);
  await expect(page.getByText("Test Table", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View menu" }).click();
  await expect(page.getByTestId("cart-dock")).toContainText(total);
}

async function viewCart(page: Page) {
  await page.getByRole("button", { name: /View cart|Review cart/ }).click();
  await expect(
    page.getByRole("dialog", { name: "The shared cart" }),
  ).toBeVisible();
}

test("the welcome and menu headers use the Enjoyer branding", async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.goto("/");
  const headline = page.getByRole("heading", { name: "Sip, Stay, Enjoy." });
  await expect(headline).toHaveCSS("font-family", /DM[ _]Serif[ _]Display/i);
  await expect(headline).toHaveCSS("font-style", "italic");
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute("href", "/favicon.png");
  const favicon = await page.request.get("/favicon.png");
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()["content-type"]).toBe("image/png");
  const photo = page.locator('header img[src*="landing-img.jpg"]:visible');
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  for (const file of ["logo-white.png", "logo.png"]) {
    if (file === "logo.png") {
      await page.getByRole("button", { name: "View menu", exact: true }).click();
    }
    const logo = page.locator(`header img[src="/${file}"]:visible`);
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(photo).toHaveCount(0);
});

test("View menu focuses the menu without starting a table visit", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await page.setViewportSize({ width: 380, height: 800 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sip, Stay, Enjoy." }),
  ).toBeVisible();
  const viewMenu = page.getByRole("button", { name: "View menu" });
  await viewMenu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("main", { name: "Menu", exact: true }),
  ).toBeFocused();
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  await expect(
    page.getByRole("tablist", { name: "Menu categories" }),
  ).toBeInViewport();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByRole("heading", { name: "Sip, Stay, Enjoy." })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("button", { name: "View menu" })).toBeVisible();
  expect(server.opens()).toBe(0);
});

test("the table menu and welcome screen share the same visit and cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await expect(page).toHaveURL(`/order/menu#table=${token}`);
  await addLatte(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.getByRole("button", { name: "Back to welcome" }).click();
  await expect(page).toHaveURL(`/order#table=${token}`);
  await expect(page.getByRole("button", { name: "View menu" })).toBeFocused();
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  await page.getByRole("button", { name: "View menu" }).click();
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(server.opens()).toBe(1);
  expect(server.resumes()).toBe(0);
  await page.reload();
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00");
  expect(server.opens()).toBe(1);
  expect(server.resumes()).toBe(1);
});

test("the menu shows only the selected category and keeps the shared cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.addMenuCategory({
    id: 2,
    name: "Tea",
    sortOrder: 1,
    items: [{ ...menu[0].items[0], id: 9, name: "Jasmine Tea", optionGroups: [] }],
  });
  await open(page);
  const coffee = page.getByRole("tab", { name: "Coffee" });
  const tea = page.getByRole("tab", { name: "Tea" });
  await expect(coffee).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Jasmine Tea" })).toHaveCount(0);
  await addLatte(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  await tea.click();
  await expect(tea).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Tea" })).toContainText("02 / 02");
  await expect(page.getByRole("heading", { name: "Test Latte" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Jasmine Tea" })).toBeVisible();
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00");
  await tea.press("ArrowLeft");
  await expect(coffee).toBeFocused();
  await expect(page.getByRole("heading", { name: "Test Latte" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jasmine Tea" })).toHaveCount(0);
  expect(server.opens()).toBe(1);
});

test("the cart opens as a keyboard-dismissible right drawer", async ({
  page,
  context,
}) => {
  await fixture(context);
  await open(page);
  await expect(
    page.getByRole("button", { name: "View cart" }).locator("svg"),
  ).toHaveCount(1);
  await viewCart(page);
  const drawer = page.getByRole("dialog", { name: "The shared cart" });
  await expect(drawer).toHaveCSS("right", "0px");
  await expect(drawer).toContainText("Nothing here yet");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "View cart" }).locator("svg"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /View cart/ }).focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close cart" }).click();
  await expect(drawer).toHaveCount(0);
});

test("the drawer and customizer open without animation", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fixture(context);
  await open(page);
  await viewCart(page);
  const drawer = page.getByRole("dialog", { name: "The shared cart" });
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  expect(await drawer.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await page.getByRole("button", { name: /Customize item/ }).click();
  const customizer = page.getByRole("dialog", { name: "Test Latte" });
  await expect(customizer).toBeVisible();
  expect(await customizer.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(customizer).toHaveCount(0);
});

test("customize, edit, remove and clear the shared cart", async ({
  page,
  context,
}) => {
  await fixture(context);
  await open(page);
  await expect(page.getByTestId("cart-dock")).toBeInViewport();
  await viewCart(page);
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.getByRole("button", { name: /Customize item/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /Add to cart/ })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Iced/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(dialog.getByText("Choose 1")).toBeVisible();
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("Choose exactly 1");
  await dialog.getByLabel("Iced").check();
  await dialog.getByLabel("Oat milk").check();
  await dialog.getByLabel("Note for this item").fill("less ice");
  await dialog.getByRole("button", { name: "Increase quantity" }).click();
  await expect(
    dialog.getByRole("button", { name: /Add to cart/ }),
  ).toContainText("₱300.00");
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await viewCart(page);
  await expect(page.getByTestId("cart-total")).toContainText("₱300.00");
  await expect(page.getByTestId("cart-line")).toContainText("less ice");
  await expect(
    page
      .getByTestId("cart-line")
      .getByRole("button", { name: "Edit" })
      .locator("svg"),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("cart-line")
      .getByRole("button", { name: "Remove" })
      .locator("svg"),
  ).toHaveCount(1);
  await page.reload();
  await viewCart(page);
  await expect(page.getByTestId("cart-total")).toContainText("₱300.00");
  await page
    .getByTestId("cart-line")
    .getByRole("button", { name: "Edit" })
    .click();
  await page
    .getByRole("dialog", { name: "Test Latte" })
    .getByLabel("Oat milk")
    .uncheck();
  await page
    .getByRole("dialog", { name: "Test Latte" })
    .getByLabel("Hot", { exact: false })
    .check();
  await page
    .getByRole("dialog", { name: "Test Latte" })
    .getByLabel("Note for this item")
    .fill("extra hot");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Increase quantity" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Update item/ })
    .click();
  await expect(page.getByTestId("cart-total")).toContainText("₱360.00");
  await expect(page.getByTestId("cart-line")).toContainText("Hot");
  await expect(page.getByTestId("cart-line")).toContainText("extra hot");
  await expect(page.getByTestId("cart-line")).not.toContainText("Oat milk");
  await page
    .getByTestId("cart-line")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.getByRole("button", { name: /Customize item/ }).click();
  await page.getByRole("dialog").getByLabel("Iced").check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Add to cart/ })
    .click();
  await viewCart(page);
  await page.getByRole("button", { name: "Clear cart" }).click();
  await page.getByRole("button", { name: "Yes, clear cart" }).click();
  await expect(page.getByTestId("cart-dock")).toContainText("₱0.00");
});

test("a failed add stays open and explains why the cart did not change", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await page.getByRole("button", { name: /Customize item/ }).click();
  await page.getByRole("dialog").getByLabel("Iced").check();
  server.rejectWriteOnce();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Add to cart/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "could not be added",
  );
  expect(server.cart().items).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Add to cart/ })
    .click();
  await expect(page.getByRole("dialog", { name: "Test Latte" })).toHaveCount(0);
  await viewCart(page);
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
});

test("a slow focus refresh does not swallow a customize click", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const release = server.holdNextCartRead();
  try {
    const request = page.waitForRequest(
      (value) =>
        new URL(value.url()).pathname === "/tables/cart" &&
        value.method() === "GET",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await request;
    await expect(
      page.getByRole("button", { name: /Customize item/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Customize item/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally {
    release();
  }
});

test("a stale phone must review the latest cart before writing again", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await fixture(context);
  const first = await context.newPage();
  const second = await context.newPage();
  try {
    await open(first);
    await open(second);
    await first.getByRole("button", { name: /Customize item/ }).click();
    await first.getByRole("dialog").getByLabel("Iced").check();
    await first
      .getByRole("dialog")
      .getByRole("button", { name: /Add to cart/ })
      .click();
    await viewCart(first);
    await expect(first.getByTestId("cart-total")).toContainText("₱120.00");
    await second.getByRole("button", { name: /Customize item/ }).click();
    await second.getByRole("dialog").getByLabel("Hot").check();
    await second
      .getByRole("dialog")
      .getByRole("button", { name: /Add to cart/ })
      .click();
    await expect(second.getByTestId("cart-conflict")).toContainText(
      "cart changed on another phone",
    );
    await expect(second.getByTestId("cart-line")).toHaveCount(1);
    await expect(
      second.getByRole("button", { name: /Customize item/ }),
    ).toHaveCount(0);
    await second.getByRole("button", { name: /reviewed the cart/ }).click();
    await second.getByRole("button", { name: "Close cart" }).click();
    await second.getByRole("button", { name: /Customize item/ }).click();
    await second.getByRole("dialog").getByLabel("Hot").check();
    await second
      .getByRole("dialog")
      .getByRole("button", { name: /Add to cart/ })
      .click();
    await viewCart(second);
    await expect(second.getByTestId("cart-line")).toHaveCount(2);
    await first.getByRole("button", { name: "Refresh cart" }).click();
    await expect(first.getByTestId("cart-line")).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test("lost write response refetches the cart before allowing a retry", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await page.getByRole("button", { name: /Customize item/ }).click();
  await page.getByRole("dialog").getByLabel("Iced").check();
  server.dropResponseOnce();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Add to cart/ })
    .click();
  await expect(page.getByTestId("cart-conflict")).toContainText(
    "may have changed",
  );
  await expect(page.getByTestId("cart-line")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /reviewed the cart/ }).click();
  await page.getByRole("button", { name: "Close cart" }).click();
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toBeVisible();
  expect(server.cart().items).toHaveLength(1);
});

test("browse mode and closed shop cannot add; narrow layouts remain accessible", async ({
  page,
  context,
}) => {
  await fixture(context, true);
  await page.goto("/");
  await expect(page.getByText(/We're closed right now/)).toBeVisible();
  await page.getByRole("button", { name: "View menu" }).click();
  await expect(
    page.getByRole("main", { name: "Menu" }).getByText("SOLD OUT TODAY"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toHaveCount(0);
  await open(page);
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toHaveCount(0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 760 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(width);
    await viewCart(page);
    const drawerWidth = await page
      .getByRole("dialog", { name: "The shared cart" })
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(drawerWidth).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Close cart" }).click();
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

async function customize(page: Page) {
  await page.getByRole("button", { name: "Add to Order" }).click();
  const dialog = page.getByRole("dialog", { name: "Test Latte" });
  await dialog.getByLabel("Iced").check();
  return dialog;
}

async function submitLatte(page: Page) {
  const dialog = await customize(page);
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await expect(dialog).toHaveCount(0);
}

async function addLatte(page: Page) {
  await submitLatte(page);
  await viewCart(page);
}

test("adding items updates the cart dock without opening the drawer", async ({
  page,
  context,
}) => {
  await fixture(context);
  await open(page);
  for (const total of ["₱120.00", "₱240.00"]) {
    await submitLatte(page);
    await expect(page.getByTestId("cart-dock")).toContainText(total);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Customize item/ })).toBeVisible();
  }
  await viewCart(page);
  await expect(page.getByTestId("cart-total")).toContainText("₱240.00");
});

test("failed background refresh preserves the cart and recovers its warning", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.failReads(true);
  await page.getByRole("button", { name: "Refresh cart" }).click();
  await expect(page.getByTestId("cart-warning")).toContainText(
    "Showing the last loaded cart",
  );
  await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  server.failReads(false);
  await page.getByRole("button", { name: "Refresh cart" }).click();
  await expect(page.getByTestId("cart-warning")).toHaveCount(0);
  await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
});

test("refresh resumes the remembered visit without opening another", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  const opens = server.opens();
  await page.reload();
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00");
  expect(server.resumes()).toBe(1);
  expect(server.opens()).toBe(opens);
  expect(server.writes()).toBe(1);
});

test("a visit replaced at the resume boundary is never joined", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const opens = server.opens();
  server.replaceOnNextResume();
  await page.reload();
  await expect(page.getByText(/previous visit.*has ended/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset this visit" }),
  ).toBeVisible();
  expect(server.resumes()).toBe(1);
  expect(server.opens()).toBe(opens);
  expect(server.writes()).toBe(0);
});

test("menu failure is distinct from a hidden cart item", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.failMenu(true);
  await page.reload();
  await expect(page.getByText("Menu offline.", { exact: true })).toBeVisible();
  await viewCart(page);
  await expect(page.getByText(/Menu details are unavailable/)).toBeVisible();
  await expect(page.getByText(/No longer available/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  server.failMenu(false);
  await page.getByRole("button", { name: "Close cart" }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toBeVisible();
  await viewCart(page);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  server.hideFirstLine();
  await page.getByRole("button", { name: "Refresh cart" }).click();
  await expect(page.getByText(/No longer available/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toBeEnabled();
});

test("remote additions never cover the customizer or steal focus", async ({
  page,
  context,
}) => {
  await fixture(context);
  await open(page);
  const dialog = await customize(page);
  const note = dialog.getByLabel("Note for this item");
  await note.fill("Keep my choices");
  const other = await context.newPage();
  await open(other);
  await addLatte(other);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(dialog).toBeVisible();
  await expect(note).toBeFocused();
  await expect(note).toHaveValue("Keep my choices");
  await expect(dialog.getByLabel("Iced")).toBeChecked();
  await other.close();
});

test("edit waits for drawer close and Escape restores keyboard focus", async ({
  page,
  context,
}) => {
  await fixture(context);
  await open(page);
  await addLatte(page);
  await page.getByRole("button", { name: "Edit", exact: true }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Test Latte" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(
    dialog.getByRole("button", { name: "Close customization" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Iced")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View cart" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "The shared cart" }),
  ).toBeVisible();
});

test("reset clears an ended visit without opening another until the QR is scanned again", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await customize(page);
  server.endVisit();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/previous visit.*has ended/)).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const opens = server.opens();
  await page.getByRole("button", { name: "Reset this visit" }).click();
  await expect(page).toHaveURL(/\/order$/);
  await expect(page.getByText(/This page needs a table QR/)).toBeVisible();
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/This page needs a table QR/)).toBeVisible();
  expect(server.opens()).toBe(opens);
  await open(page);
  expect(server.opens()).toBe(opens + 1);
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByTestId("cart-dock")).toContainText("₱0.00");
  expect(server.writes()).toBe(0);
});

test("new visits do not inherit conflict review state", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  server.dropResponseOnce();
  await submitLatte(page);
  await expect(page.getByTestId("cart-conflict")).toBeVisible();
  server.endVisit();
  await page.getByRole("button", { name: "Refresh cart" }).click();
  await page.getByRole("button", { name: "Reset this visit" }).click();
  await open(page);
  await expect(
    page.getByRole("button", { name: /Customize item/ }),
  ).toBeVisible();
  await viewCart(page);
  await expect(page.getByTestId("cart-conflict")).toHaveCount(0);
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
});

test("late write responses cannot replace a new visit's cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const release = server.holdNextWriteResponse();
  try {
    const dialog = await customize(page);
    await dialog.getByRole("button", { name: /Add to cart/ }).click();
    await expect.poll(server.writes).toBe(1);
    await page.evaluate(() => {
      window.location.hash = "";
    });
    await expect(page.getByText(/This page needs a table QR/)).toBeVisible();
    server.endVisit();
    await page.evaluate((value) => {
      window.location.hash = `table=${value}`;
    }, token);
    await page.getByRole("button", { name: "Reset this visit" }).click();
    await expect(page).toHaveURL(/\/order$/);
    await page.evaluate((value) => {
      window.location.hash = `table=${value}`;
    }, token);
    await expect(page.getByText("Test Table", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "View menu" }).click();
    await expect(
      page.getByRole("button", { name: /Customize item/ }),
    ).toBeVisible();
    const response = page.waitForResponse(
      (value) =>
        value.request().method() === "POST" &&
        new URL(value.url()).pathname === "/tables/cart/items",
    );
    release();
    await response;
    await viewCart(page);
    await expect(page.getByText(/Nothing here yet/)).toBeVisible();
    await expect(page.getByTestId("cart-conflict")).toHaveCount(0);
  } finally {
    release();
  }
});

test("unavailable choices close the stale editor and refresh menu options", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const dialog = await customize(page);
  await dialog.getByLabel("Oat milk").check();
  server.unavailableOnce();
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("cart-warning")).toContainText(
    "Oat milk is sold out",
  );
  await page.getByRole("button", { name: "Close cart" }).click();
  const fresh = await customize(page);
  await expect(fresh.getByLabel(/Oat milk/)).toBeDisabled();
  await fresh.getByRole("button", { name: /Add to cart/ }).click();
  await viewCart(page);
  await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
});

test("uncertain writes remain blocked until a successful recovery read", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const release = server.holdRecoveryRead();
  try {
    server.dropResponseOnce();
    await submitLatte(page);
    const review = page.getByRole("button", { name: /reviewed the cart/ });
    await expect(review).toBeDisabled();
    server.failReads(true);
    const failed = page.waitForResponse((value) => value.status() === 503);
    release();
    await failed;
    await expect(review).toBeDisabled();
    expect(server.writes()).toBe(1);
    server.failReads(false);
    await page.getByRole("button", { name: "Refresh cart" }).click();
    await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
    await expect(review).toBeEnabled();
    await review.click();
    await expect(page.getByTestId("cart-conflict")).toHaveCount(0);
    expect(server.writes()).toBe(1);
  } finally {
    release();
  }
});

test("malformed conflict payloads require a fresh cart before review", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const release = server.holdRecoveryRead(true);
  try {
    await submitLatte(page);
    const review = page.getByRole("button", { name: /reviewed the cart/ });
    await expect(review).toBeDisabled();
    await expect(page.getByTestId("cart-conflict")).toContainText(
      "Refresh and review",
    );
    release();
    await expect(review).toBeEnabled();
    await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  } finally {
    release();
  }
});

test("a server-side conflict after preflight displays the authoritative cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.conflictOnce();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByTestId("cart-conflict")).toContainText(
    "changed on another phone",
  );
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  const review = page.getByRole("button", { name: /reviewed the cart/ });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(page.getByTestId("cart-conflict")).toHaveCount(0);
  expect(server.writes()).toBe(2);
});

test("a refresh invalidates an open clear confirmation", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  await page.getByRole("button", { name: "Clear cart", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Yes, clear cart" });
  await expect(confirm).toBeEnabled();

  const other = await context.newPage();
  await open(other, "₱120.00");
  await addLatte(other);
  await page.getByRole("button", { name: "Refresh cart" }).click();
  await expect(page.getByTestId("cart-total")).toContainText("₱240.00");
  await expect(
    page.getByText("The cart changed. Review it before clearing."),
  ).toBeVisible();
  await expect(confirm).toBeDisabled();
  expect(server.writes()).toBe(2);

  await page.getByRole("button", { name: "Close cart" }).click();
  await viewCart(page);
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Clear cart", exact: true }).click();
  await confirm.click();
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
  expect(server.writes()).toBe(3);
  await other.close();
});

test("a failed preflight keeps the editor open and doesn't require review", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const dialog = await customize(page);
  await dialog.getByLabel("Note for this item").fill("Keep this note");
  server.failReads(true);
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nothing was sent");
  await expect(dialog.getByLabel("Note for this item")).toHaveValue(
    "Keep this note",
  );
  expect(server.writes()).toBe(0);
  server.failReads(false);
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await viewCart(page);
  await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
  await expect(page.getByTestId("cart-conflict")).toHaveCount(0);
  expect(server.writes()).toBe(1);
});

test("a visit replaced after preflight is not mutated", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  const dialog = await customize(page);
  server.replaceOnNextWrite();
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await expect(
    page.getByRole("button", { name: "Reset this visit" }),
  ).toBeVisible();
  expect(server.writes()).toBe(1);
  expect(server.cart().version).toBe(0);
  expect(server.cart().items).toEqual([]);
});

async function reviewOrder(page: Page, name = "  Alex  ") {
  await page.getByRole("button", { name: "Review order", exact: true }).click();
  const review = page.getByRole("form", { name: "Review your order" });
  await expect(review.getByRole("heading")).toBeFocused();
  if (name) await review.getByLabel("First name or nickname").fill(name);
  return review;
}

test("checkout reviews the table, customizations and payment before showing confirmation", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page);
  const item = await customize(page);
  await item.getByLabel("Oat milk").check();
  await item.getByLabel("Note for this item").fill("less ice");
  await item.getByRole("button", { name: /Add to cart/ }).click();
  await viewCart(page);
  const review = await reviewOrder(page, "");
  for (const text of [
    "Test Table",
    "Oat milk",
    "less ice",
    "₱150.00",
    "No payment is taken here.",
  ])
    await expect(review).toContainText(text);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await review.getByRole("button", { name: "Place order" }).click();
  expect(server.orderPosts()).toBe(0);
  const name = review.getByLabel("First name or nickname");
  await name.fill("   ");
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(review.getByRole("alert")).toContainText(
    "Enter a first name or nickname",
  );
  expect(server.orderPosts()).toBe(0);
  await name.fill("  Alex  ");
  await review.getByRole("button", { name: "Place order" }).click();
  const receipt = page.getByRole("region", { name: "Order 20261119-001" });
  await expect(receipt.getByRole("heading")).toBeFocused();
  await expect(receipt).toContainText("Waiting for staff confirmation");
  await expect(receipt).toContainText("4 orders remaining");
  await expect(page.getByTestId("cart-dock")).toContainText("₱0.00");
  expect(server.orderPosts()).toBe(1);
});

test("checkout does not submit a cart changed after review", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  const review = await reviewOrder(page);
  const other = await context.newPage();
  await open(other, "₱120.00");
  await addLatte(other);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText(/cart or its prices changed/)).toBeVisible();
  await expect(page.getByTestId("cart-dock")).toContainText("₱240.00");
  expect(server.orderPosts()).toBe(0);
  await other.close();
});

test("a lost placement response is recovered by exact order ID after reload", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.loseNextOrderResponse();
  server.failOrderReads(true);
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByText(/couldn't verify whether the order was placed/),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    sessionStorage.getItem("enjoyer:pending-order"),
  );
  expect(saved).toContain("requestId");
  expect(saved).not.toContain("customerName");
  expect(saved).not.toContain("Alex");
  await page.reload();
  await viewCart(page);
  server.failOrderReads(false);
  await page.getByRole("button", { name: "Check order status" }).click();
  await expect(
    page.getByRole("heading", { name: "Order 20261119-001" }),
  ).toBeVisible();
  expect(server.orderPosts()).toBe(1);
  expect(server.orders()).toBe(1);
});

test("an uncommitted placement can retry the same order after checking", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.loseNextOrderBeforeCommit();
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  expect(server.orders()).toBe(0);
  await page.getByRole("button", { name: "Retry same order" }).click();
  await expect(
    page.getByRole("heading", { name: "Order 20261119-001" }),
  ).toBeVisible();
  expect(server.orderPosts()).toBe(2);
  expect(server.orders()).toBe(1);
});

test("authoritative checkout rejection retains the shared cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.failPlacement(
    "ORDER_AWAITING_CONFIRMATION",
    "Please wait for staff to confirm your first order.",
  );
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByText("Please wait for staff to confirm your first order."),
  ).toBeVisible();
  await expect(page.getByTestId("cart-total")).toContainText("₱120.00");
  expect(server.orders()).toBe(0);
});

test("recovery resolves an unsent order when cart details change without a version bump", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.loseNextOrderBeforeCommit();
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same order" }),
  ).toBeVisible();
  server.renameFirstLine();
  await page.getByRole("button", { name: "Check order status" }).click();
  await expect(
    page.getByText(/wasn't placed.*cart or its prices changed/),
  ).toBeVisible();
  await expect(page.getByTestId("cart-line")).toContainText("Renamed Latte");
  await expect(
    page.getByRole("button", { name: "Review order" }),
  ).toBeEnabled();
  expect(server.resolutionPosts()).toBe(1);
  expect(server.orders()).toBe(0);
});

test("a definite retry rejection shows the reason and unlocks the cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.loseNextOrderBeforeCommit();
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same order" }),
  ).toBeVisible();
  server.failPlacement("OPTION_UNAVAILABLE", "Oat milk is sold out.");
  await page.getByRole("button", { name: "Retry same order" }).click();
  await expect(
    page.getByText("This order wasn't placed. Oat milk is sold out."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review order" }),
  ).toBeEnabled();
  expect(server.resolutionPosts()).toBe(1);
  expect(server.orders()).toBe(0);
});

async function placedLatte(page: Page) {
  await open(page);
  const dialog = await customize(page);
  await dialog.getByLabel("Note for this item").fill("Less ice");
  await dialog.getByRole("button", { name: /Add to cart/ }).click();
  await viewCart(page);
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("heading", { name: "Order 20261119-001" }),
  ).toBeVisible();
}

async function showTableOrders(page: Page) {
  await page.getByRole("button", { name: "Table orders", exact: true }).click();
  return page.getByRole("dialog", { name: "Table orders" });
}

test("table orders only appears beside the cart after an order exists", async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.setViewportSize({ width: 320, height: 700 });
  const initialOrders = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/tables/orders" &&
      response.request().method() === "GET" &&
      response.ok(),
  );
  await open(page);
  await initialOrders;
  const ordersButton = page.getByRole("button", { name: "Table orders", exact: true });
  await expect(ordersButton).toHaveCount(0);
  await addLatte(page);
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Order 20261119-001" })).toBeVisible();
  await page.getByRole("button", { name: "Close cart" }).click();
  await expect(ordersButton).toBeInViewport();
  const cartButton = page.getByRole("button", { name: /^View cart/ });
  const footer = page.getByRole("contentinfo");
  await page.setViewportSize({ width: 320, height: 380 });
  for (const top of [0, 100]) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    if (top > 0) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const orders = (await ordersButton.boundingBox())!;
    const cart = (await cartButton.boundingBox())!;
    const footerBox = (await footer.boundingBox())!;
    expect(orders.x + orders.width).toBeLessThanOrEqual(cart.x);
    expect(orders.y + orders.height).toBeCloseTo(cart.y + cart.height);
    expect(cart.y + cart.height).toBeLessThan(footerBox.y);
    expect(footerBox.y + footerBox.height).toBeCloseTo(380);
  }
});

test("the public menu footer stays at the bottom without ordering controls", async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.setViewportSize({ width: 320, height: 280 });
  await page.goto("/menu");
  await expect(page.getByRole("heading", { name: "Test Latte" })).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 100));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const bounds = (await footer.boundingBox())!;
  expect(bounds.y + bounds.height).toBeCloseTo(280);
});

test("a second phone can track and cancel a table order", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await placedLatte(page);
  const other = await context.newPage();
  await other.setViewportSize({ width: 320, height: 700 });
  await open(other);
  const orders = await showTableOrders(other);
  await expect(
    orders.getByText("Waiting for staff confirmation"),
  ).toBeVisible();
  await expect(orders.getByText("Payment: Unpaid")).toBeVisible();
  await expect(orders.getByText(/4 orders remaining/)).toBeVisible();
  await expect(orders.getByRole("button", { name: "Order again" })).toHaveCount(
    0,
  );
  await orders
    .getByText("Details for order 20261119-001", { exact: true })
    .click();
  await expect(orders.getByText("Note: Less ice")).toBeVisible();
  expect((await new AxeBuilder({ page: other }).analyze()).violations).toEqual(
    [],
  );
  await orders
    .getByRole("button", { name: "Cancel order 20261119-001" })
    .click();
  await expect(
    orders.getByRole("button", { name: "Keep order" }),
  ).toBeFocused();
  expect(server.cancelPosts()).toBe(0);
  await orders.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(orders.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(orders.getByText(/5 orders remaining/)).toBeVisible();
  await expect(orders.getByText("₱0.00", { exact: true })).toBeVisible();
  expect(server.cancelPosts()).toBe(1);
  await orders.getByRole("button", { name: "Order again" }).click();
  await expect(other.locator("#menu")).toBeFocused();
  await other.close();
});

test("a cancellation status race refreshes the list and removes the cancel action", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await placedLatte(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  const orders = await showTableOrders(page);
  server.startPreparingOnCancel();
  await orders
    .getByRole("button", { name: "Cancel order 20261119-001" })
    .click();
  await orders.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(
    orders.getByText("Staff have started preparing this order."),
  ).toBeVisible();
  await expect(orders.getByText("Preparing", { exact: true })).toBeVisible();
  await expect(
    orders.getByRole("button", { name: /Cancel order/ }),
  ).toHaveCount(0);
});

test("a stale orders drawer never follows a replacement visit", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await placedLatte(page);
  await page.getByRole("button", { name: "Close cart" }).click();
  const orders = await showTableOrders(page);
  await expect(
    orders.getByRole("heading", { name: "Order 20261119-001" }),
  ).toBeVisible();
  server.replaceVisit();
  await orders.getByRole("button", { name: "Refresh orders" }).click();
  await expect(
    page.getByRole("button", { name: "Reset this visit" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Table orders" })).toHaveCount(
    0,
  );
});

test("after reload an uncommitted placement is resolved without retaining its nickname", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  await open(page);
  await addLatte(page);
  server.loseNextOrderBeforeCommit();
  const review = await reviewOrder(page);
  await review.getByRole("button", { name: "Place order" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same order" }),
  ).toBeVisible();
  await page.reload();
  await viewCart(page);
  await page.getByRole("button", { name: "Check order status" }).click();
  await expect(page.getByText(/wasn't placed.*enter a name/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry same order" }),
  ).toHaveCount(0);
  expect(server.orderPosts()).toBe(1);
  expect(server.resolutionPosts()).toBe(1);
  const newReview = await reviewOrder(page, "");
  await expect(newReview.getByLabel("First name or nickname")).toHaveValue("");
});

test("stream sync falls back to session-scoped polling without reopening the cart", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.enableRealtime(true);
  await open(page);
  await expect(
    page.getByText("Checking for updates periodically"),
  ).toBeVisible();
  const dialog = await customize(page);
  const note = dialog.getByLabel("Note for this item");
  await note.fill("Keep my note");
  const other = await context.newPage();
  await open(other);
  await addLatte(other);
  server.bumpRealtimeCart();
  await expect
    .poll(
      () => server.cursors().some((cursor) => cursor === "1".padStart(64, "0")),
      { timeout: 14_000 },
    )
    .toBe(true);
  await expect(page.getByTestId("cart-dock")).toContainText("₱120.00", {
    timeout: 12_000,
  });
  await expect(dialog).toBeVisible();
  await expect(note).toHaveValue("Keep my note");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await other.close();
});

test("polling does not acknowledge a failed resource refresh and stops when access ends", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.enableRealtime();
  server.failReads(true);
  await page.goto(`/order/menu#table=${token}`);
  await expect.poll(server.failedCartReadsAfterPoll).toBeGreaterThan(0);
  server.failReads(false);
  await expect(page.getByText("Checking for updates periodically")).toBeVisible(
    { timeout: 15_000 },
  );
  expect(server.cursors().slice(0, 2)).toEqual([null, null]);
  server.endRealtime();
  await expect(
    page.getByRole("button", { name: "Reset this visit" }),
  ).toBeVisible({ timeout: 12_000 });
});

test("a generic stream 403 falls back without ending the visit", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.failRealtimeStream(403);
  await open(page);
  await expect(
    page.getByText("Checking for updates periodically"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset this visit" }),
  ).toHaveCount(0);
});

test("cross-origin polling waits for the stream's Retry-After", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.failRealtimeStream(429);
  await open(page);
  await expect(page.getByText("Checking for updates periodically")).toBeVisible(
    { timeout: 4_500 },
  );
  expect(server.fallbackDelay()).toBeGreaterThanOrEqual(1_000);
});

test("off-network QR scans can browse, then retry on café Wi-Fi", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.setNetworkAllowed(false);
  await page.goto(`/order#table=${token}`);
  await expect(
    page.getByText(/Connect to the café’s guest Wi-Fi/),
  ).toBeVisible();
  await page.getByRole("button", { name: "View menu" }).click();
  await expect(page.getByText("Test Latte", { exact: true })).toBeVisible();
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  expect(server.opens()).toBe(0);
  server.setNetworkAllowed(true);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("cart-dock")).toBeVisible();
  expect(server.opens()).toBe(1);
});

test("a network change suspends an active visit without opening a replacement", async ({
  page,
  context,
}) => {
  const server = await fixture(context);
  server.enableRealtime();
  await open(page);
  await expect(
    page.getByText("Checking for updates periodically"),
  ).toBeVisible();
  server.setNetworkAllowed(false);
  await expect(page.getByText(/Connect to the café’s guest Wi-Fi/)).toBeVisible(
    { timeout: 12_000 },
  );
  await expect(page.getByTestId("cart-dock")).toHaveCount(0);
  server.setNetworkAllowed(true);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("cart-dock")).toBeVisible();
  expect(server.opens()).toBe(1);
  expect(server.resumes()).toBe(1);
});

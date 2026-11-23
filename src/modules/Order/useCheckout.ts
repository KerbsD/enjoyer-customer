import { useEffect, useRef, useState } from "react";

import { getCart } from "@/api/cart";
import { getVisitOrders, placeOrder } from "@/api/orders";
import { ApiError } from "@/api/public";
import { PENDING_ORDER_KEY } from "@/constants/orders";
import { messageFor } from "@/lib/public-error";
import { tableTokenFromHash } from "@/lib/table-token";
import { orderAttemptSchema } from "@/schemas/orders";
import type { Cart } from "@/types/cart";
import type { OrderAttempt, OrderReceipt } from "@/types/orders";

const visitEnded = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.code === "TABLE_SESSION_REQUIRED" || error.code === "INVALID_TABLE_QR");

export const sameReviewedCart = (left: Cart, right: Cart) =>
  left.id === right.id && left.version === right.version &&
  left.reviewFingerprint === right.reviewFingerprint &&
  left.totals.total === right.totals.total;

function readAttempt(cartId: string | null) {
  if (!cartId) return null;
  try {
    const parsed = orderAttemptSchema.safeParse(
      JSON.parse(sessionStorage.getItem(PENDING_ORDER_KEY) ?? "null"),
    );
    return parsed.success && parsed.data.cartId === cartId ? parsed.data : null;
  } catch {
    return null;
  }
}

function newRequestId() {
  // getRandomValues works on local HTTP QR testing origins as well as HTTPS.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function useCheckout(
  sessionId: string | null,
  cartId: string | null,
  endVisit: (error?: ApiError) => void,
  refreshCart: () => void,
  applyPlacementCart: (cart: Cart) => void,
  refreshPublic: () => void,
) {
  const [attempt, setAttempt] = useState(() => readAttempt(cartId));
  const [busy, setBusy] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const inFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  function remember(value: OrderAttempt | null) {
    setAttempt(value);
    try {
      if (value) sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(value));
      else if (readAttempt(cartId)) sessionStorage.removeItem(PENDING_ORDER_KEY);
    } catch {
      // Recovery is still available in memory if browser storage is blocked.
    }
  }

  function complete(value: OrderReceipt) {
    setReceipt(value);
    setNotice("");
    remember(null);
  }

  function acceptPlacement(result: Awaited<ReturnType<typeof placeOrder>>) {
    if (result.order.tableSessionId !== sessionId)
      throw new ApiError("The shop returned an unexpected order response.", 0);
    if (result.cart) applyPlacementCart(result.cart);
    complete({ order: result.order, ordersRemaining: result.summary.ordersRemaining });
  }

  async function resolveAttempt(
    pending: OrderAttempt,
    token: string,
    signal: AbortSignal,
    active: () => boolean,
    reason: string,
  ) {
    try {
      const result = await placeOrder(token, { ...pending, resolveOnly: true }, signal);
      if (active()) acceptPlacement(result);
    } catch (error) {
      if (!active()) return;
      if (visitEnded(error)) return endVisit(error);
      if (error instanceof ApiError && error.code === "ORDER_ATTEMPT_CLOSED") {
        remember(null);
        setNotice(`This order wasn't placed. ${reason}`);
      } else {
        setNotice(`${reason} We couldn't verify whether the order was placed. Check again or ask staff.`);
      }
    }
  }

  const refreshAfterRejection = (error: ApiError) => {
    if (error.code === "STORE_CLOSED" || error.code?.startsWith("MENU_ITEM_") ||
        error.code?.startsWith("OPTION_")) refreshPublic();
  };

  async function run(
    action: (token: string, signal: AbortSignal, active: () => boolean) => Promise<void>,
  ) {
    const token = tableTokenFromHash(window.location.hash);
    const signal = lifetime.current?.signal;
    if (!token || !sessionId || !cartId || !signal || signal.aborted || inFlight.current) return;
    const active = () => !signal.aborted && tableTokenFromHash(window.location.hash) === token;
    inFlight.current = true;
    setBusy(true);
    setCanRetry(false);
    setNotice("");
    try {
      await action(token, signal, active);
    } finally {
      inFlight.current = false;
      if (active()) {
        setBusy(false);
        refreshCart();
      }
    }
  }

  async function reconcile(
    pending: OrderAttempt,
    token: string,
    signal: AbortSignal,
    active: () => boolean,
  ) {
    try {
      // Read the cart first. If its version advanced, a later order lookup
      // can rule out this attempt: it can no longer commit against that cart.
      const { data: cart } = await getCart(token, signal);
      if (!active()) return;
      if (cart.id !== pending.cartId) return endVisit();
      const result = await getVisitOrders(token, sessionId!, signal);
      if (!active()) return;
      const order = result.orders.find((item) =>
        item.id === pending.requestId && item.tableSessionId === sessionId);
      if (order) {
        complete({ order, ordersRemaining: result.summary.ordersRemaining });
      } else if (cart.version > pending.version) {
        remember(null);
        setNotice("This order wasn't placed. The shared cart changed; review it before placing an order.");
      } else if (cart.version === pending.version &&
        (cart.totals.total !== pending.total || cart.reviewFingerprint !== pending.reviewFingerprint)) {
        await resolveAttempt(pending, token, signal, active, "The cart or its prices changed. Review the latest cart before ordering.");
      } else if (cart.version === pending.version) {
        setCanRetry(true);
        setNotice("No matching order yet. You can check again or retry the same order without creating a duplicate.");
      } else {
        setNotice("We still can't confirm the order. Check again or ask staff before placing another order.");
      }
    } catch (error) {
      if (!active()) return;
      if (visitEnded(error)) endVisit(error);
      else setNotice("We couldn't verify whether the order was placed. Check again or ask staff before ordering again.");
    }
  }

  function submit(pending: OrderAttempt, reviewed?: Cart) {
    return run(async (token, signal, active) => {
      if (reviewed) {
        try {
          const { data } = await getCart(token, signal);
          if (!active()) return;
          if (data.id !== cartId) return endVisit();
          if (!sameReviewedCart(data, reviewed)) {
            setNotice("Nothing was sent. The cart or its prices changed. Review the latest cart first.");
            return;
          }
        } catch (error) {
          if (!active()) return;
          if (visitEnded(error)) endVisit(error);
          else setNotice(`Nothing was sent. Couldn't check the latest cart. ${messageFor(error)}`);
          return;
        }
      }
      remember(pending);
      try {
        const result = await placeOrder(token, pending, signal);
        if (!active()) return;
        acceptPlacement(result);
      } catch (error) {
        if (!active()) return;
        if (visitEnded(error)) return endVisit(error);
        if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.status === 429) {
          await reconcile(pending, token, signal, active);
          return;
        }
        const reason = error.code === "CART_VERSION_CONFLICT"
          ? "The cart or its prices changed. Review the latest cart before placing an order."
          : messageFor(error);
        refreshAfterRejection(error);
        if (!reviewed) {
          await resolveAttempt(pending, token, signal, active, reason);
        } else {
          remember(null);
          setNotice(reason);
        }
      }
    });
  }

  return {
    attempt,
    busy,
    notice,
    receipt,
    canRetry,
    place: (cart: Cart) => {
      if (attempt || cart.id !== cartId || !cart.items.length || inFlight.current) return;
      void submit({
        requestId: newRequestId(), cartId, version: cart.version,
        total: cart.totals.total, reviewFingerprint: cart.reviewFingerprint,
      }, cart);
    },
    check: () => {
      if (attempt) void run((token, signal, active) => reconcile(attempt, token, signal, active));
    },
    retry: () => {
      if (attempt && canRetry) void submit(attempt);
    },
    dismiss: () => setReceipt(null),
    clearNotice: () => setNotice(""),
  };
}

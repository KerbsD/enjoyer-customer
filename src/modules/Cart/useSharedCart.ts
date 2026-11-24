import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/api/public";
import {
  addCartLine,
  clearCart,
  getCart,
  removeCartLine,
  updateCartLine,
} from "@/api/cart";
import { messageFor, visitAccessLost } from "@/lib/public-error";
import { tableTokenFromHash } from "@/lib/table-token";
import type { Cart, CartActionResult, CartState } from "@/types/cart";
import { cartSchema, type CartCustomization } from "@/schemas/cart";

export default function useSharedCart(
  sessionId: string | null,
  cartId: string | null,
  endVisit: (error?: ApiError) => void,
  refreshPublic: () => void,
) {
  const [state, setState] = useState<CartState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [revealId, setRevealId] = useState(0);
  const cartRef = useRef<Cart | null>(null);
  const busyRef = useRef(false);
  const requestId = useRef(0);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
    };
  }, []);

  const refreshCart = useCallback(
    async (signal?: AbortSignal) => {
      if (!sessionId || !cartId || busyRef.current) return;
      const token = tableTokenFromHash(window.location.hash);
      if (!token) return;
      const scope = lifetime.current;
      if (!scope || scope.signal.aborted) return;
      const id = ++requestId.current;
      const active = () =>
        !scope.signal.aborted &&
        !signal?.aborted &&
        tableTokenFromHash(window.location.hash) === token &&
        requestId.current === id;
      // Keep the last known cart usable while a focus/manual refresh is in
      // flight. The server version still protects any concurrent mutations.
      setState((current) =>
        current.kind === "ready" && current.sessionId === sessionId
          ? current
          : { kind: "loading" },
      );
      try {
        const result = await getCart(token, signal ?? scope.signal);
        if (!active()) return;
        // /tables/open supplied this visit's cart ID. Checking it avoids
        // downloading the entire order history on every cart refresh.
        if (result.data.id !== cartId) {
          endVisit();
          setState({ kind: "idle" });
          cartRef.current = null;
          return;
        }
        cartRef.current = result.data;
        setState({ kind: "ready", data: result.data, sessionId });
        setRefreshError("");
        setCanReview(true);
        return true;
      } catch (error) {
        if (!active()) return;
        if (visitAccessLost(error)) {
          endVisit(error);
          cartRef.current = null;
          setState({ kind: "idle" });
        } else if (cartRef.current) {
          setRefreshError(
            `Couldn't refresh. Showing the last loaded cart. ${messageFor(error)}`,
          );
        } else {
          setState({ kind: "error", message: messageFor(error) });
        }
      }
    },
    [sessionId, cartId, endVisit],
  );

  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void refreshCart(controller.signal);
    });
    const onFocus = () => void refreshCart(controller.signal);
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void refreshCart(controller.signal);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, refreshCart]);

  const mutate = async (
    operation: (token: string, cart: Cart) => Promise<{ data: Cart }>,
    expectedVersion: number,
  ): Promise<CartActionResult> => {
    const token = tableTokenFromHash(window.location.hash);
    const current = cartRef.current;
    const scope = lifetime.current;
    if (
      !sessionId ||
      !token ||
      !current ||
      !scope ||
      scope.signal.aborted ||
      current.id !== cartId ||
      busyRef.current ||
      needsReview
    )
      return "error";

    const active = () =>
      !scope.signal.aborted &&
      tableTokenFromHash(window.location.hash) === token;
    if (current.version !== expectedVersion) {
      setNeedsReview(true);
      setCanReview(true);
      setNotice(
        "The cart changed. Review the latest cart before trying again.",
      );
      return "conflict";
    }
    busyRef.current = true;
    requestId.current++;
    setBusy(true);
    setNotice("");
    let refreshAfterFailure = false;
    let writeStarted = false;
    try {
      // Recheck the visit before a write from a phone that may have been idle.
      const latest = (await getCart(token, scope.signal)).data;
      if (!active()) return "error";
      setRefreshError("");
      if (latest.id !== cartId) {
        endVisit();
        return "error";
      }
      if (latest.version !== current.version) {
        throw new ApiError(
          "Review the latest cart.",
          409,
          "CART_VERSION_CONFLICT",
          latest,
        );
      }
      writeStarted = true;
      const result = await operation(token, current);
      if (!active()) return "error";
      if (result.data.id !== cartId) {
        endVisit();
        return "error";
      }
      cartRef.current = result.data;
      setState({ kind: "ready", data: result.data, sessionId });
      setRefreshError("");
      setRevealId((value) => value + 1);
      return "success";
    } catch (error) {
      if (!active()) return "error";
      const conflict =
        error instanceof ApiError && error.code === "CART_VERSION_CONFLICT"
          ? cartSchema.safeParse(error.data)
          : null;
      if (conflict?.success) {
        if (conflict.data.id !== cartId) {
          endVisit();
          return "error";
        }
        cartRef.current = conflict.data;
        setState({ kind: "ready", data: conflict.data, sessionId });
        setNeedsReview(true);
        setCanReview(true);
        setNotice(
          "The cart changed on another phone. Review the latest cart below before trying again.",
        );
        return "conflict";
      }
      if (error instanceof ApiError && error.code === "CART_VERSION_CONFLICT") {
        setNeedsReview(true);
        setCanReview(false);
        setNotice(
          "The cart changed on another phone. Refresh and review it before trying again.",
        );
        refreshAfterFailure = true;
        return "conflict";
      }
      if (visitAccessLost(error)) {
        endVisit(error);
        cartRef.current = null;
        setState({ kind: "idle" });
      } else {
        if (!writeStarted) {
          setNotice(
            `Nothing was sent. Couldn't check the latest cart. ${messageFor(error)}`,
          );
          return "error";
        }
        setNotice(messageFor(error));
        if (
          error instanceof ApiError &&
          [
            "MENU_ITEM_UNAVAILABLE",
            "MENU_ITEM_NOT_FOUND",
            "OPTION_UNAVAILABLE",
            "OPTION_INVALID",
            "OPTION_SELECTION_INVALID",
          ].includes(error.code ?? "")
        ) {
          refreshPublic();
          refreshAfterFailure = true;
          setRevealId((value) => value + 1);
          return "unavailable";
        }
        // The network may have failed after a successful write. Read back instead
        // of retrying a possibly completed mutation.
        if (
          error instanceof ApiError &&
          (error.status === 0 || error.status >= 500)
        ) {
          setNeedsReview(true);
          setCanReview(false);
          setNotice(
            "Connection interrupted. The cart may have changed. Review the latest cart before trying again.",
          );
          refreshAfterFailure = true;
          return "conflict";
        }
      }
      return "error";
    } finally {
      busyRef.current = false;
      if (active()) {
        setBusy(false);
        if (refreshAfterFailure) void refreshCart();
      }
    }
  };

  return {
    state:
      sessionId && state.kind === "ready" && state.sessionId !== sessionId
        ? { kind: "loading" as const }
        : state,
    busy,
    notice: [notice, refreshError].filter(Boolean).join(" "),
    needsReview,
    canReview,
    revealId,
    applyPlacementCart: (result: Cart) => {
      if (
        !sessionId ||
        result.id !== cartId ||
        (cartRef.current && result.version < cartRef.current.version)
      )
        return;
      requestId.current++;
      cartRef.current = result;
      setState({ kind: "ready", data: result, sessionId });
      setRefreshError("");
    },
    refreshCart: () => void refreshCart(),
    syncCart: refreshCart,
    acknowledgeReview: () => {
      if (!canReview || busyRef.current) return;
      setNeedsReview(false);
      setNotice("");
    },
    addItem: (
      menuItemId: number,
      form: CartCustomization,
      expectedVersion: number,
    ) =>
      mutate(
        (token, cart) =>
          addCartLine(token, {
            menuItemId,
            ...form,
            cartId: cart.id,
            version: cart.version,
          }),
        expectedVersion,
      ),
    updateItem: (
      id: number,
      form: CartCustomization,
      expectedVersion: number,
    ) =>
      mutate(
        (token, cart) =>
          updateCartLine(token, id, {
            ...form,
            cartId: cart.id,
            version: cart.version,
          }),
        expectedVersion,
      ),
    removeItem: (id: number, expectedVersion: number) =>
      mutate(
        (token, cart) =>
          removeCartLine(token, id, { cartId: cart.id, version: cart.version }),
        expectedVersion,
      ),
    clearItems: (expectedVersion: number) =>
      mutate(
        (token, cart) =>
          clearCart(token, { cartId: cart.id, version: cart.version }),
        expectedVersion,
      ),
  };
}

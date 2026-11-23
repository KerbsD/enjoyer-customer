import { useCallback, useEffect, useRef, useState } from "react";

import { cancelOrder, getVisitOrders } from "@/api/orders";
import { ApiError } from "@/api/public";
import { messageFor } from "@/lib/public-error";
import { tableTokenFromHash } from "@/lib/table-token";
import type { VisitOrders } from "@/types/orders";

export const canCancelOrder = (status: string) =>
  status === "pending_confirmation" || status === "received";

const visitEnded = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.code === "TABLE_SESSION_REQUIRED" || error.code === "INVALID_TABLE_QR");

export default function useTableOrders(
  open: boolean,
  sessionId: string,
  endVisit: (error?: ApiError) => void,
) {
  const [data, setData] = useState<VisitOrders | null>(null);
  const [reading, setReading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [readError, setReadError] = useState("");
  const [notice, setNotice] = useState("");
  const lifetime = useRef<AbortController | null>(null);
  const lastRead = useRef<AbortController | null>(null);
  const writing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      lastRead.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    const token = tableTokenFromHash(window.location.hash);
    if (!token || writing.current || !lifetime.current || lifetime.current.signal.aborted) return;
    lastRead.current?.abort();
    const controller = new AbortController();
    lastRead.current = controller;
    const active = () => !controller.signal.aborted &&
      tableTokenFromHash(window.location.hash) === token;
    setReading(true);
    try {
      const latest = await getVisitOrders(token, sessionId, controller.signal);
      if (!active()) return;
      setData(latest);
      setReadError("");
    } catch (error) {
      if (!active()) return;
      if (visitEnded(error)) {
        setData(null);
        endVisit(error);
      } else {
        setReadError(messageFor(error));
      }
    } finally {
      if (active()) setReading(false);
    }
  }, [sessionId, endVisit]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const onFocus = () => { if (mounted) void refresh(); };
    queueMicrotask(onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [open, refresh]);

  async function cancel(id: string) {
    const token = tableTokenFromHash(window.location.hash);
    const signal = lifetime.current?.signal;
    const order = data?.orders.find((item) => item.id === id);
    if (!token || !signal || signal.aborted || writing.current || reading ||
        readError || !order || !canCancelOrder(order.status)) return;
    const active = () => !signal.aborted && tableTokenFromHash(window.location.hash) === token;
    writing.current = true;
    setCancelling(true);
    setNotice("");
    let ended = false;
    try {
      await cancelOrder(token, sessionId, id, signal);
      if (active()) setNotice(`Order ${order.orderNumber} was cancelled. Its items were not returned to the cart.`);
    } catch (error) {
      if (!active()) return;
      if (visitEnded(error)) {
        ended = true;
        setData(null);
        endVisit(error);
        return;
      }
      setNotice(error instanceof ApiError && error.status > 0 && error.status < 500
        ? messageFor(error)
        : "We couldn't confirm the cancellation. Check the latest order status before trying again.");
    } finally {
      writing.current = false;
      if (active()) {
        if (!ended) await refresh();
        if (active()) setCancelling(false);
      }
    }
  }

  return { data, reading, cancelling, readError, notice, refresh, cancel };
}

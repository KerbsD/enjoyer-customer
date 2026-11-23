"use client";

import { ClipboardList, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Drawer from "@/components/Drawer";
import { actionButton } from "@/components/button-styles";
import { ORDER_STATUS_LABEL } from "@/constants/orders";
import { peso, shopTime } from "@/lib/shop-format";

import type { TableOrder, TableOrderProps } from "@/types/orders";

import { canCancelOrder } from "./useTableOrders";

function OrderDetails({ order }: { order: TableOrder }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-bold">
        Details for order {order.orderNumber}
      </summary>
      <p className="mt-2 text-secondary">
        <time dateTime={order.createdAt}>{shopTime(order.createdAt)}</time>
      </p>
      <ul className="mt-2 divide-y divide-line">
        {order.items.map((item) => (
          <li key={item.id} className="py-2">
            <div className="flex justify-between gap-3 font-bold">
              <span className="wrap-anywhere">
                {item.quantity} × {item.name}
              </span>
              <span className="shrink-0 font-mono">{peso(item.lineTotal)}</span>
            </div>
            {item.options.map((option) => (
              <p key={option.id} className="wrap-anywhere text-secondary">
                {option.groupName}: {option.name}
                {Number(option.priceDelta) !== 0 &&
                  ` (${peso(option.priceDelta)} each)`}
              </p>
            ))}
            {item.note && (
              <p className="wrap-anywhere text-secondary">Note: {item.note}</p>
            )}
          </li>
        ))}
      </ul>
      {(order.cancellationReason || order.rejectionReason) && (
        <p className="wrap-anywhere text-secondary">
          Reason: {order.cancellationReason || order.rejectionReason}
        </p>
      )}
    </details>
  );
}

export default function TableOrders({
  tableName,
  storeOpen,
  canOrder,
  orders,
}: TableOrderProps) {
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const keepOrderButton = useRef<HTMLButtonElement>(null);
  const focusMenu = useRef(false);
  const { refresh } = orders;
  useEffect(() => {
    if (!open) return;
    let active = true;
    const onFocus = () => { if (active) void refresh(); };
    queueMicrotask(onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [open, refresh]);
  const { data, reading, cancelling, readError, notice } = orders;
  const busy = reading || cancelling;
  const close = () => {
    setConfirmId(null);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-extrabold text-ink hover:bg-[#ffd34d]"
      >
        <ClipboardList aria-hidden="true" size={17} /> Table orders
      </button>
      <Drawer
        open={open}
        onClose={close}
        labelledBy="table-orders-title"
        onClosed={() => {
          if (focusMenu.current) {
            focusMenu.current = false;
            const menu = document.getElementById("menu");
            menu?.focus();
            menu?.scrollIntoView();
          } else trigger.current?.focus({ preventScroll: true });
        }}
      >
        <section className="flex min-h-full flex-col gap-4 px-6 pt-7 pb-8 max-[420px]:px-4.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="wrap-anywhere text-sm font-bold text-secondary">
                Orders for {tableName}
              </p>
              <h2
                id="table-orders-title"
                className="text-3xl font-black tracking-tight"
              >
                Table orders
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close table orders"
              onClick={close}
              className="shrink-0 rounded-md border border-line p-2 hover:bg-accent"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <p className="text-sm text-secondary">
            Orders for this visit only. Pay at the counter when served.
          </p>
          <button
            ref={refreshButton}
            type="button"
            className={`${actionButton} self-start`}
            aria-disabled={busy}
            onClick={() => {
              if (busy) return;
              setConfirmId(null);
              void orders.refresh();
            }}
          >
            <RefreshCw aria-hidden="true" size={16} /> Refresh orders
          </button>
          {!data && !readError && !notice && (
            <p role="status">Loading table orders…</p>
          )}
          {busy && data && (
            <p role="status">
              {cancelling ? "Checking cancellation…" : "Refreshing orders…"}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-lg border border-line bg-muted p-3 text-sm"
            >
              {notice}
            </p>
          )}
          {readError && (
            <p
              role="alert"
              className="rounded-lg border border-line p-3 text-sm"
            >
              {data
                ? "Couldn’t refresh. Showing the last loaded orders."
                : "Couldn’t load table orders."}{" "}
              {readError}
            </p>
          )}
          {data && (
            <>
              <div className="rounded-lg border border-line bg-muted p-4">
                <div className="flex justify-between gap-2 font-black">
                  <span>Table order total</span>
                  <span className="font-mono">{peso(data.summary.total)}</span>
                </div>
                <p className="mt-1 text-sm text-secondary">
                  Excludes rejected and cancelled orders.{" "}
                  {data.summary.ordersRemaining}{" "}
                  {data.summary.ordersRemaining === 1 ? "order" : "orders"}{" "}
                  remaining.
                </p>
                {data.summary.awaitingConfirmation && (
                  <p className="mt-2 text-sm font-bold">
                    Wait for staff to confirm the first order before ordering
                    again.
                  </p>
                )}
              </div>
              {data.orders.length === 0 && (
                <p className="text-secondary">No orders for this visit yet.</p>
              )}
              {data.orders.map((order) => {
                const cancellable = canCancelOrder(order.status);
                return (
                  <article className="border-b border-line pb-4" key={order.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-black">Order {order.orderNumber}</h3>
                      <span className="font-mono font-bold">
                        {peso(order.total)}
                      </span>
                    </div>
                    <p className="text-sm font-bold">
                      {ORDER_STATUS_LABEL[order.status]}
                    </p>
                    <p className="text-sm text-secondary">
                      Payment:{" "}
                      {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                    </p>
                    <OrderDetails order={order} />
                    {order.status === "preparing" ||
                    order.status === "ready" ||
                    order.status === "served" ? (
                      <p className="mt-3 text-sm text-secondary">
                        Need to change this order? Please ask staff.
                      </p>
                    ) : (
                      cancellable &&
                      (confirmId === order.id ? (
                        <div
                          role="group"
                          aria-label={`Cancel order ${order.orderNumber}?`}
                          className="mt-3 flex flex-wrap gap-2"
                        >
                          <p className="w-full text-sm font-bold">
                            Cancel this order for everyone at the table?
                          </p>
                          <button
                            ref={keepOrderButton}
                            type="button"
                            className={actionButton}
                            onClick={() => {
                              setConfirmId(null);
                              refreshButton.current?.focus();
                            }}
                          >
                            Keep order
                          </button>
                          <button
                            type="button"
                            className={actionButton}
                            disabled={busy || !!readError}
                            onClick={() => {
                              setConfirmId(null);
                              refreshButton.current?.focus();
                              void orders.cancel(order.id);
                            }}
                          >
                            Yes, cancel order
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`${actionButton} mt-3`}
                          disabled={busy || !!readError}
                          aria-label={`Cancel order ${order.orderNumber}`}
                          onClick={() => {
                            setConfirmId(order.id);
                            requestAnimationFrame(() =>
                              keepOrderButton.current?.focus(),
                            );
                          }}
                        >
                          Cancel order
                        </button>
                      ))
                    )}
                  </article>
                );
              })}
              {!!data.orders.length &&
                !busy &&
                !readError &&
                storeOpen &&
                canOrder &&
                !data.summary.awaitingConfirmation &&
                data.summary.ordersRemaining > 0 && (
                  <button
                    type="button"
                    className="self-start rounded-lg bg-accent px-4 py-3 font-extrabold text-ink"
                    onClick={() => {
                      focusMenu.current = true;
                      close();
                    }}
                  >
                    Order again
                  </button>
                )}
            </>
          )}
        </section>
      </Drawer>
    </>
  );
}

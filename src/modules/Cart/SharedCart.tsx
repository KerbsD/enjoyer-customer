"use client";

import { Eye, Pencil, RefreshCw, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Drawer from "@/components/Drawer";
import { peso } from "@/lib/shop-format";
import type { Cart, SharedCartProps } from "@/types/cart";

import { actionButton } from "@/components/button-styles";
import { OrderConfirmation, OrderReview } from "@/modules/Order/OrderReview";
import { sameReviewedCart } from "@/modules/Order/useCheckout";

import { useAnimateSharedCart } from "./useAnimateSharedCart";

export default function SharedCart({
  table,
  checkout,
  state,
  busy: cartBusy,
  notice,
  needsReview,
  canReview,
  revealId,
  customizing,
  menuReady,
  canEdit,
  findItem,
  onEdit,
  onRemove,
  onClear,
  onRefresh,
  onReview,
}: SharedCartProps) {
  const { open, setOpen, cart } = useAnimateSharedCart({
    state,
    needsReview,
    revealId,
    customizing,
  });
  const [clearVersion, setClearVersion] = useState<number | null>(null);
  const [review, setReview] = useState<Cart | null>(null);
  const busy = cartBusy || checkout.busy;
  const editingBlocked = busy || !!checkout.attempt;
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const receipt = checkout.receipt;
  useEffect(() => {
    if (open && review) reviewHeading.current?.focus();
  }, [open, review]);
  useEffect(() => {
    if (open && receipt) confirmationHeading.current?.focus();
  }, [open, receipt]);
  const closeDrawer = () => {
    setClearVersion(null);
    setReview(null);
    setOpen(false);
  };
  const pendingEdit = useRef<(() => void) | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Drawer
        open={open}
        onClose={closeDrawer}
        onClosed={() => {
          trigger.current?.focus({ preventScroll: true });
          const edit = pendingEdit.current;
          pendingEdit.current = null;
          edit?.();
        }}
        labelledBy="cart-title"
      >
        <section className="flex min-h-full flex-col px-6 pt-7 pb-8 max-[420px]:px-4.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1.75 text-[11px] font-extrabold tracking-[0.17em] text-[#805800]">
                AT YOUR TABLE
              </p>
              <h2
                id="cart-title"
                className="m-0 text-[clamp(25px,4vw,36px)] font-black tracking-[-0.06em]"
              >
                The shared cart
              </h2>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-line p-2 hover:bg-accent"
              aria-label="Close cart"
              ref={closeButton}
              onClick={closeDrawer}
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className={actionButton}
              onClick={onRefresh}
              disabled={busy}
            >
              <RefreshCw aria-hidden="true" size={16} /> Refresh cart
            </button>
          </div>
          <p className="mt-3 mb-7 text-[13px] leading-[1.55] text-secondary">
            Everyone at this table sees the same cart. Refresh to pick up
            changes from another phone.
          </p>
          {receipt && (
            <OrderConfirmation
              receipt={receipt}
              heading={confirmationHeading}
              onDismiss={() => {
                checkout.dismiss();
                closeButton.current?.focus();
              }}
            />
          )}
          {checkout.busy && (
            <p role="status" className="mb-4 text-sm font-bold">
              Checking your order…
            </p>
          )}
          {(checkout.notice || checkout.attempt) && (
            <div className="mb-4 grid gap-2 rounded-lg border border-line bg-muted p-4 text-sm">
              <p role="status">
                {checkout.notice ||
                  "An order submission is awaiting verification."}
              </p>
              {checkout.attempt && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={actionButton}
                    disabled={busy}
                    onClick={checkout.check}
                  >
                    Check order status
                  </button>
                  {checkout.canRetry &&
                    canEdit &&
                    cart?.version === checkout.attempt.version &&
                    cart.reviewFingerprint ===
                      checkout.attempt.reviewFingerprint &&
                    cart.totals.total === checkout.attempt.total && (
                      <button
                        type="button"
                        className={actionButton}
                        disabled={busy}
                        onClick={checkout.retry}
                      >
                        Retry same order
                      </button>
                    )}
                </div>
              )}
            </div>
          )}
          {notice && (
            <div
              data-testid={needsReview ? "cart-conflict" : "cart-warning"}
              className="my-3.75 rounded-lg border border-[#b17b00] bg-[#fff5d7] p-4 text-sm leading-normal"
              role="alert"
            >
              <p className="mb-2.5">{notice}</p>
              {needsReview && (
                <button
                  className="rounded-md bg-ink px-3 py-2.25 font-bold text-white disabled:opacity-55"
                  type="button"
                  disabled={!cart || !canReview || busy}
                  onClick={onReview}
                >
                  I&apos;ve reviewed the cart
                </button>
              )}
            </div>
          )}
          {state.kind === "loading" && (
            <p className="py-10.5 text-secondary" role="status">
              Loading your cart…
            </p>
          )}
          {state.kind === "error" && (
            <div className="py-10.5 text-secondary" role="alert">
              <p>{state.message}</p>
              <button
                className={actionButton}
                type="button"
                onClick={onRefresh}
              >
                Try again
              </button>
            </div>
          )}
          {cart &&
            (cart.items.length === 0 ? (
              <p className="border-t border-line py-8.75 text-secondary">
                Nothing here yet. Find something good on the menu above.
              </p>
            ) : (
              <div>
                {!menuReady && (
                  <p className="py-4 text-sm text-secondary" role="status">
                    Menu details are unavailable. Your saved cart is shown
                    below; editing will be available when the menu loads.
                  </p>
                )}
                {cart.items.map((line) => {
                  const item = findItem(line);
                  const canUpdate =
                    canEdit &&
                    !needsReview &&
                    !editingBlocked &&
                    !!item &&
                    item.isAvailable &&
                    line.menuItem.isAvailable &&
                    !line.menuItem.isHidden;
                  return (
                    <article
                      data-testid="cart-line"
                      className="border-t border-line py-4.5"
                      key={line.id}
                    >
                      <div className="flex items-start gap-3">
                        <span className="min-w-7 shrink-0 font-mono font-medium">
                          {line.quantity}×
                        </span>
                        <div className="min-w-0 flex-1">
                          <strong className="text-[15px]">
                            {line.menuItem.name}
                          </strong>
                          {line.options.length > 0 && (
                            <p className="mt-1 text-[13px] leading-normal text-secondary wrap-anywhere">
                              {line.options
                                .map((option) => option.name)
                                .join(" · ")}
                            </p>
                          )}
                          {line.note && (
                            <p className="mt-1 text-[13px] leading-normal text-secondary wrap-anywhere">
                              Note: {line.note}
                            </p>
                          )}
                          {(!line.menuItem.isAvailable ||
                            line.menuItem.isHidden ||
                            (menuReady && (!item || !item.isAvailable))) && (
                            <p className="mt-1 text-[13px] leading-normal font-bold text-[#8d3a22] wrap-anywhere">
                              No longer available. Remove this item to update
                              your cart.
                            </p>
                          )}
                          {line.options.some(
                            (option) => !option.isAvailable,
                          ) && (
                            <p className="mt-1 text-[13px] font-bold text-[#8d3a22]">
                              An add-on is sold out. Edit this item to choose an
                              available option.
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[13px]">
                          {peso(line.lineTotal)}
                        </span>
                      </div>
                      <div className="flex justify-end gap-2 pt-2.75">
                        <button
                          type="button"
                          className={actionButton}
                          disabled={!canUpdate}
                          onClick={() => {
                            if (item) {
                              pendingEdit.current = () => onEdit(item, line);
                              closeDrawer();
                            }
                          }}
                        >
                          <Pencil aria-hidden="true" size={15} /> Edit
                        </button>
                        <button
                          type="button"
                          className={actionButton}
                          disabled={editingBlocked || needsReview}
                          onClick={() => void onRemove(line.id, cart.version)}
                        >
                          <Trash2 aria-hidden="true" size={15} /> Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
                <div
                  data-testid="cart-total"
                  className="flex items-baseline justify-between gap-3 border-t-2 border-ink py-4.25 font-bold"
                >
                  <span>Total · {cart.totals.itemCount} items</span>
                  <strong className="font-mono text-[21px]">
                    {peso(cart.totals.total)}
                  </strong>
                </div>
                {clearVersion !== null ? (
                  <div
                    className="flex flex-wrap items-center justify-end gap-2.5 text-[13px]"
                    role="group"
                    aria-label="Clear cart confirmation"
                  >
                    <span className="mr-auto" role="status">
                      {clearVersion === cart.version
                        ? "Remove everything from the shared cart?"
                        : "The cart changed. Review it before clearing."}
                    </span>
                    <button
                      type="button"
                      className={actionButton}
                      disabled={
                        editingBlocked ||
                        needsReview ||
                        clearVersion !== cart.version
                      }
                      onClick={async () => {
                        setClearVersion(null);
                        await onClear(clearVersion);
                      }}
                    >
                      Yes, clear cart
                    </button>
                    <button
                      className={actionButton}
                      type="button"
                      onClick={() => setClearVersion(null)}
                    >
                      {clearVersion === cart.version ? "Keep items" : "Dismiss"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${actionButton} ml-auto flex`}
                    disabled={editingBlocked || needsReview}
                    onClick={() => setClearVersion(cart.version)}
                  >
                    Clear cart
                  </button>
                )}
              </div>
            ))}
          {review ? (
            <OrderReview
              cart={review}
              tableName={table.name}
              heading={reviewHeading}
              changed={!cart || !sameReviewedCart(cart, review)}
              disabled={editingBlocked || needsReview || !canEdit}
              onBack={() => {
                setReview(null);
                closeButton.current?.focus();
              }}
              onPlace={(customerName) => {
                checkout.place(review, customerName);
                setReview(null);
                closeButton.current?.focus();
              }}
            />
          ) : (
            !!cart?.items.length && (
              <button
                type="button"
                className="my-4 self-start rounded-lg bg-accent px-4 py-3 font-extrabold text-ink hover:bg-[#ffd34d] disabled:opacity-55"
                disabled={
                  editingBlocked ||
                  needsReview ||
                  !canEdit ||
                  clearVersion !== null
                }
                onClick={() => {
                  checkout.clearNotice();
                  setReview(cart);
                }}
              >
                Review order
              </button>
            )
          )}
          <p className="mt-auto border-t border-line pt-4 text-[13px] leading-[1.55] text-secondary">
            Pay at the counter when your order is served.
          </p>
        </section>
      </Drawer>
      <div
        data-testid="cart-dock"
        role="region"
        className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 bg-ink px-[max(24px,calc((100vw-1112px)/2))] py-3 text-paper shadow-[0_-6px_24px_#0a0a0a16] max-[600px]:px-4.5 max-[600px]:pb-[max(12px,env(safe-area-inset-bottom))]"
        aria-label="Shared cart summary"
      >
        <div className="grid gap-0.75">
          <span className="text-[10px] font-extrabold tracking-[0.13em]">
            {notice
              ? "CART NEEDS ATTENTION"
              : `SHARED CART · ${cart?.totals.itemCount ?? 0} ITEMS`}
          </span>
          <strong className="font-mono text-[17px]">
            {cart ? peso(cart.totals.total) : "—"}
          </strong>
        </div>
        <button
          ref={trigger}
          id="cart-trigger"
          type="button"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.75 font-extrabold text-ink hover:bg-[#ffd34d]"
          onClick={() => setOpen(true)}
        >
          {notice ? (
            <Eye aria-hidden="true" size={18} />
          ) : (
            <ShoppingCart aria-hidden="true" size={18} />
          )}
          {notice ? "Review cart" : "View cart"}
        </button>
      </div>
    </>
  );
}

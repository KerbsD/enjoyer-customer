import { ClipboardCheck, ReceiptText } from "lucide-react";

import { actionButton } from "@/components/button-styles";
import { ORDER_STATUS_LABEL } from "@/constants/orders";
import { peso } from "@/lib/shop-format";

import type { OrderConfirmationProps, OrderReviewProps } from "@/types/orders";

export function OrderReview({
  cart,
  tableName,
  changed,
  disabled,
  heading,
  onBack,
  onPlace,
}: OrderReviewProps) {
  return (
    <section
      className="my-5 grid gap-4 rounded-lg border border-line bg-muted p-4"
      aria-labelledby="order-review"
    >
      <div>
        <h3
          ref={heading}
          tabIndex={-1}
          id="order-review"
          className="flex items-center gap-2 text-xl font-black"
        >
          <ClipboardCheck aria-hidden="true" size={20} /> Review your order
        </h3>
        <p className="text-sm text-secondary">{tableName}</p>
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {cart.items.map((line) => (
          <li key={line.id} className="py-3 text-sm">
            <div className="flex justify-between gap-3 font-bold">
              <span className="wrap-anywhere">
                {line.quantity} × {line.menuItem.name}
              </span>
              <span className="shrink-0 font-mono">{peso(line.lineTotal)}</span>
            </div>
            {line.options.map((option) => (
              <p key={option.id} className="wrap-anywhere text-secondary">
                {option.groupName}: {option.name}
                {Number(option.priceDelta) !== 0 &&
                  ` (${peso(option.priceDelta)} each)`}
              </p>
            ))}
            {line.note && (
              <p className="wrap-anywhere text-secondary">Note: {line.note}</p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between gap-3 font-black">
        <span>Order total</span>
        <span className="font-mono">{peso(cart.totals.total)}</span>
      </div>
      <p className="text-sm">
        Pay at the counter when your order is served. No payment is taken here.
      </p>
      {changed && (
        <p role="alert" className="text-sm font-bold">
          The cart changed. Go back and review the latest cart.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={actionButton} onClick={onBack}>
          Back to cart
        </button>
        <button
          type="button"
          disabled={changed || disabled}
          onClick={onPlace}
          className="rounded-lg bg-accent px-4 py-3 font-extrabold text-ink hover:bg-[#ffd34d] disabled:opacity-55"
        >
          Place order
        </button>
      </div>
    </section>
  );
}

export function OrderConfirmation({
  receipt,
  onDismiss,
  heading,
}: OrderConfirmationProps) {
  const { order, ordersRemaining } = receipt;
  const inactive = order.status === "rejected" || order.status === "cancelled";
  return (
    <section
      className="mb-5 grid gap-2 rounded-lg border border-line bg-muted p-4"
      aria-labelledby="order-confirmation"
    >
      <h3
        ref={heading}
        tabIndex={-1}
        id="order-confirmation"
        className="flex items-center gap-2 text-xl font-black"
      >
        <ReceiptText aria-hidden="true" size={20} /> Order {order.orderNumber}
      </h3>
      <p className="font-bold">{ORDER_STATUS_LABEL[order.status]}</p>
      {order.status === "pending_confirmation" && (
        <p className="text-sm">
          Please wait for staff to confirm this order before sending another.
        </p>
      )}
      <p className="text-sm">
        {peso(order.total)} · {ordersRemaining}{" "}
        {ordersRemaining === 1 ? "order" : "orders"} remaining for this table
      </p>
      {!inactive && (
        <p className="text-sm">Pay at the counter when your order is served.</p>
      )}
      <button
        type="button"
        className={`${actionButton} justify-self-start`}
        onClick={onDismiss}
      >
        Done
      </button>
    </section>
  );
}

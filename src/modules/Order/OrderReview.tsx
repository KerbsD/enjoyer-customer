import { ClipboardCheck, ReceiptText } from "lucide-react";
import { useId, useState } from "react";

import { actionButton, primaryButton } from "@/components/button-styles";
import { ORDER_NAME_MAX_LENGTH, ORDER_STATUS_LABEL } from "@/constants/orders";
import { peso } from "@/lib/shop-format";
import { orderNameSchema } from "@/schemas/orders";

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
  const fieldId = useId();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  return (
    <form
      className="my-3 grid gap-4 rounded-xl border border-dashed border-control bg-muted p-4"
      aria-labelledby="order-review"
      onSubmit={(event) => {
        event.preventDefault();
        if (changed || disabled) return;
        const result = orderNameSchema.safeParse(name);
        if (!result.success) {
          setNameError(true);
          event.currentTarget.querySelector("input")?.focus();
          return;
        }
        onPlace(result.data);
      }}
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
      <div className="grid gap-1.5 text-sm">
        <label htmlFor={fieldId} className="font-bold">
          First name or nickname
        </label>
        <input
          id={fieldId}
          name="customerName"
          autoComplete="given-name"
          maxLength={ORDER_NAME_MAX_LENGTH}
          required
          value={name}
          aria-invalid={nameError || undefined}
          aria-describedby={`${fieldId}-hint${nameError ? ` ${fieldId}-error` : ""}`}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(false);
          }}
          className="min-h-11 min-w-0 rounded-md border border-control bg-paper px-3 py-2.5 text-base aria-invalid:border-danger"
        />
        <p id={`${fieldId}-hint`} className="text-secondary">
          Required so staff know who the order is for.
        </p>
        {nameError && (
          <p id={`${fieldId}-error`} className="font-bold text-danger" role="alert">
            Enter a first name or nickname on one line.
          </p>
        )}
      </div>
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
          type="submit"
          disabled={changed || disabled}
          className={primaryButton}
        >
          Place order
        </button>
      </div>
    </form>
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
      className="mb-5 grid gap-2 rounded-xl border border-accent bg-muted p-4"
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
      <p className={`font-bold ${inactive ? "text-danger" : "text-ink"}`}>{ORDER_STATUS_LABEL[order.status]}</p>
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

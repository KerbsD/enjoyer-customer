import type { Ref } from "react";
import type { z } from "zod";
import type { orderAttemptSchema, placementSchema, tableOrderSchema, visitOrdersSchema } from "@/schemas/orders";
import type { Cart } from "@/types/cart";
import type { ApiError } from "@/api/public";

export type OrderAttempt = z.output<typeof orderAttemptSchema>;
export type TableOrder = z.output<typeof tableOrderSchema>;
export type VisitOrders = z.output<typeof visitOrdersSchema>;

type Placement = z.output<typeof placementSchema>;

export type OrderReceipt = {
  order: Placement["order"];
  ordersRemaining: number;
};

export type CheckoutActions = {
  attempt: OrderAttempt | null;
  busy: boolean;
  notice: string;
  receipt: OrderReceipt | null;
  canRetry: boolean;
  place: (cart: import("@/types/cart").Cart) => void;
  check: () => void;
  retry: () => void;
  dismiss: () => void;
  clearNotice: () => void;
};

export type OrderReviewProps = {
  cart: Cart;
  tableName: string;
  changed: boolean;
  disabled: boolean;
  heading: Ref<HTMLHeadingElement>;
  onBack: () => void;
  onPlace: () => void;
};

export type OrderConfirmationProps = {
  receipt: OrderReceipt;
  onDismiss: () => void;
  heading: Ref<HTMLHeadingElement>;
};

export type TableOrderProps = {
  sessionId: string;
  tableName: string;
  storeOpen: boolean;
  canOrder: boolean;
  endVisit: (error?: ApiError) => void;
}

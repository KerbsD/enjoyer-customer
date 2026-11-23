import type { OrderReceipt } from "@/types/orders";

export const PENDING_ORDER_KEY = "enjoyer:pending-order";

export const ORDER_STATUS_LABEL: Record<OrderReceipt["order"]["status"], string> = {
  pending_confirmation: "Waiting for staff confirmation",
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

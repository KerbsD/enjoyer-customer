import { z } from "zod";

import { cartSchema } from "@/schemas/cart";

const money = z.string().regex(/^\d+\.\d{2}$/);
const count = z.number().int().nonnegative();

export const orderAttemptSchema = z.object({
  requestId: z.uuidv4(),
  cartId: z.uuid(),
  version: count,
  total: money,
  reviewFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
});

const order = z.object({
  id: z.uuid(),
  tableSessionId: z.uuid(),
  orderNumber: z.string().min(1),
  status: z.enum([
    "pending_confirmation", "received", "preparing", "ready", "served",
    "rejected", "cancelled",
  ]),
  total: money,
});

const summary = z.object({ ordersRemaining: count });

export const placementSchema = z.object({
  order,
  cart: cartSchema.nullable(),
  summary,
});

export const tableOrderSchema = order.extend({
  createdAt: z.iso.datetime(),
  paymentStatus: z.enum(["paid", "unpaid"]),
  cancellationReason: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  items: z.array(z.object({
    id: count,
    name: z.string(),
    quantity: z.number().int().positive(),
    note: z.string(),
    lineTotal: money,
    options: z.array(z.object({
      id: count,
      name: z.string(),
      groupName: z.string(),
      priceDelta: money,
    })),
  })),
});

export const visitOrdersSchema = z.object({
  session: z.object({ id: z.uuid(), status: z.enum(["pending", "open"]) }),
  orders: z.array(tableOrderSchema),
  summary: summary.extend({ total: money, ordersUsed: count, awaitingConfirmation: z.boolean() }),
});

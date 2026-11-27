import { ApiError, publicRequest } from "@/api/public";
import {
  placementSchema,
  tableOrderSchema,
  visitOrdersSchema,
} from "@/schemas/orders";
import type { OrderAttempt } from "@/types/orders";

const invalidResponse = () =>
  new ApiError("The shop returned an unexpected order response.", 0);

export async function placeOrder(
  token: string,
  body: OrderAttempt & { resolveOnly?: true },
  signal: AbortSignal,
) {
  const result = await publicRequest<{ data?: unknown }>("/tables/orders", {
    method: "POST",
    tableToken: token,
    // Resolution never creates an order and does not need the guest's name.
    body: body.resolveOnly
      ? {
          requestId: body.requestId,
          cartId: body.cartId,
          version: body.version,
          total: body.total,
          reviewFingerprint: body.reviewFingerprint,
          resolveOnly: true,
        }
      : body,
    signal,
  });
  const parsed = placementSchema.safeParse(result.data);
  if (
    !parsed.success ||
    parsed.data.order.id !== body.requestId ||
    (parsed.data.cart && parsed.data.cart.id !== body.cartId)
  )
    throw invalidResponse();
  return parsed.data;
}

export async function getVisitOrders(
  token: string,
  sessionId: string,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ sessionId });
  const result = await publicRequest<{ data?: unknown }>(
    `/tables/orders?${query}`,
    {
      tableToken: token,
      signal,
    },
  );
  const parsed = visitOrdersSchema.safeParse(result.data);
  if (!parsed.success) throw invalidResponse();
  if (
    parsed.data.session.id !== sessionId ||
    parsed.data.orders.some((order) => order.tableSessionId !== sessionId)
  )
    throw new ApiError(
      "This table visit has ended.",
      409,
      "TABLE_SESSION_REQUIRED",
    );
  return parsed.data;
}

export async function cancelOrder(
  token: string,
  sessionId: string,
  id: string,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ sessionId });
  const result = await publicRequest<{ data?: unknown }>(
    `/tables/orders/${encodeURIComponent(id)}/cancel?${query}`,
    { method: "POST", tableToken: token, signal },
  );
  const parsed = tableOrderSchema.safeParse(result.data);
  if (
    !parsed.success ||
    parsed.data.id !== id ||
    parsed.data.tableSessionId !== sessionId ||
    parsed.data.status !== "cancelled"
  )
    throw invalidResponse();
  return parsed.data;
}

import { ApiError, publicRequest } from "@/api/public";
import { placementSchema, visitOrdersSchema } from "@/schemas/orders";
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
    body,
    signal,
  });
  const parsed = placementSchema.safeParse(result.data);
  if (!parsed.success || parsed.data.order.id !== body.requestId ||
      (parsed.data.cart && parsed.data.cart.id !== body.cartId)) throw invalidResponse();
  return parsed.data;
}

export async function getVisitOrders(token: string, sessionId: string, signal: AbortSignal) {
  const result = await publicRequest<{ data?: unknown }>("/tables/orders", {
    tableToken: token,
    signal,
  });
  const parsed = visitOrdersSchema.safeParse(result.data);
  if (!parsed.success) throw invalidResponse();
  if (parsed.data.session.id !== sessionId)
    throw new ApiError("This table visit has ended.", 409, "TABLE_SESSION_REQUIRED");
  return parsed.data;
}

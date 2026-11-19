import { ApiError, publicRequest } from "@/api/public";
import { cartSchema } from "@/schemas/cart";
import type { CartResponse, CartRevision } from "@/types/cart";

async function cartRequest(
  path: string,
  options: Parameters<typeof publicRequest>[1],
): Promise<CartResponse> {
  const result = await publicRequest<{ data?: unknown }>(path, options);
  const parsed = cartSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new ApiError("The shop returned an invalid cart. Refresh to try again.", 0);
  }
  return { success: true, currency: "PHP", data: parsed.data };
}

export const getCart = (token: string, signal?: AbortSignal) =>
  cartRequest("/tables/cart", { tableToken: token, signal });

export const addCartLine = (
  token: string,
  body: CartRevision & {
    menuItemId: number;
    quantity: number;
    note: string;
    optionIds: number[];
  },
) =>
  cartRequest("/tables/cart/items", {
    method: "POST",
    tableToken: token,
    body,
  });

export const updateCartLine = (
  token: string,
  id: number,
  body: CartRevision & {
    quantity: number;
    note: string;
    optionIds: number[];
  },
) =>
  cartRequest(`/tables/cart/items/${id}`, {
    method: "PATCH",
    tableToken: token,
    body,
  });

const revisionQuery = ({ cartId, version }: CartRevision) =>
  new URLSearchParams({ cartId, version: String(version) }).toString();

export const removeCartLine = (token: string, id: number, revision: CartRevision) =>
  cartRequest(`/tables/cart/items/${id}?${revisionQuery(revision)}`, {
    method: "DELETE",
    tableToken: token,
  });

export const clearCart = (token: string, revision: CartRevision) =>
  cartRequest(`/tables/cart?${revisionQuery(revision)}`, {
    method: "DELETE",
    tableToken: token,
  });

import type { PublicItem, Table } from "@/types/public";
import type { CheckoutActions } from "@/types/orders";
import type { z } from "zod";
import type { cartSchema } from "@/schemas/cart";

export type Cart = z.output<typeof cartSchema>;
export type CartLine = Cart["items"][number];
export type CartOption = CartLine["options"][number];
export type CartResponse = { success: true; currency: "PHP"; data: Cart };
export type CartRevision = { cartId: string; version: number };

export type CartState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Cart; sessionId: string };

export type CartActionResult = "success" | "conflict" | "unavailable" | "error";

export type SharedCartProps = {
  table: Table;
  checkout: CheckoutActions;
  state: CartState;
  busy: boolean;
  notice: string;
  needsReview: boolean;
  canReview: boolean;
  revealId: number;
  customizing: boolean;
  menuReady: boolean;
  canEdit: boolean;
  findItem: (line: CartLine) => PublicItem | undefined;
  onEdit: (item: PublicItem, line: CartLine) => void;
  onRemove: (id: number, version: number) => Promise<CartActionResult>;
  onClear: (version: number) => Promise<CartActionResult>;
  onRefresh: () => void;
  onReview: () => void;
};

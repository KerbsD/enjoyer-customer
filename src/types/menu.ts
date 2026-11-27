import type { PublicCategory, PublicItem, Table } from "@/types/public";
import type { CartCustomization } from "@/schemas/cart";
import type { CartLine, CartActionResult } from "@/types/cart";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };

export type TableState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ended"; table: Table }
  | { kind: "ready"; table: Table; sessionId: string; cartId: string };

export type ItemCustomizerProps = {
  item: PublicItem;
  line?: CartLine;
  busy: boolean;
  actionError: string;
  onSave: (value: CartCustomization) => Promise<CartActionResult>;
  onClose: () => void;
};

export type MenuCategoriesProps = {
  categories: PublicCategory[];
  canAdd: boolean;
  onSelect: (item: PublicItem) => void;
};

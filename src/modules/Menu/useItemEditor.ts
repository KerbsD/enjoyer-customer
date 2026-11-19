import { useState } from "react";

import type { PublicItem } from "@/types/public";
import type { CartLine } from "@/types/cart";

export default function useItemEditor() {
  const [editing, setEditing] = useState<{
    item: PublicItem;
    version: number;
    line?: CartLine;
  } | null>(null);
  return {
    editing,
    openItem: (item: PublicItem, version: number) =>
      setEditing({ item, version }),
    editLine: (item: PublicItem, line: CartLine, version: number) =>
      setEditing({ item, line, version }),
    closeEditor: () => setEditing(null),
  };
}

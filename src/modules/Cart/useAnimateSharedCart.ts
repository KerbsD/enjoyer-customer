import { useEffect, useRef, useState } from "react";
import type { Cart, SharedCartProps } from "@/types/cart";

export function useAnimateSharedCart({
  state,
  needsReview,
  revealId,
  customizing,
}: Pick<SharedCartProps, "state" | "needsReview" | "revealId" | "customizing">) {
  const [open, setOpen] = useState(false);
  const cart: Cart | null = state.kind === "ready" ? state.data : null;
  const lastReveal = useRef(0);

  useEffect(() => {
    // Only local actions reveal the drawer. A remote refresh must never steal
    // focus or cover an in-progress customization.
    if (customizing || (!needsReview && revealId === lastReveal.current)) return;
    const frame = requestAnimationFrame(() => {
      lastReveal.current = revealId;
      setOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [needsReview, revealId, customizing]);

  return {
    open,
    setOpen,
    cart,
  };
}

import useIntroReveal from "./useIntroReveal";
import useItemEditor from "./useItemEditor";
import usePublicMenu from "./usePublicMenu";
import useTableVisit from "./useTableVisit";
import useSharedCart from "@/modules/Cart/useSharedCart";

export function useCustomerMenu({
  mode,
  visit,
}: {
  mode: "browse" | "table";
  visit: ReturnType<typeof useTableVisit>;
}) {
  const intro = useIntroReveal();
  const { menu, store, retryPublic } = usePublicMenu();
  const { table, retryTable, startNewVisit, endVisit } = visit;
  const sessionId = table.kind === "ready" ? table.sessionId : null;
  const cartId = table.kind === "ready" ? table.cartId : null;
  const cart = useSharedCart(sessionId, cartId, endVisit, retryPublic);
  const editor = useItemEditor();
  const canAdd =
    mode === "table" &&
    table.kind === "ready" &&
    store.kind === "ready" &&
    store.data.isOpen &&
    cart.state.kind === "ready" &&
    !cart.needsReview &&
    !cart.busy;
  const findItem = (id: number) =>
    menu.kind === "ready"
      ? menu.data
          .flatMap((category) => category.items)
          .find((item) => item.id === id)
      : undefined;

  return {
    table,
    intro,
    store,
    retryPublic,
    cart,
    menu,
    editor,
    canAdd,
    findItem,
    retryTable,
    startNewVisit,
  };
}

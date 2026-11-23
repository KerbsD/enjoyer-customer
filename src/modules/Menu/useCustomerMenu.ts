import useIntroReveal from "./useIntroReveal";
import useItemEditor from "./useItemEditor";
import usePublicMenu from "./usePublicMenu";
import useTableVisit from "./useTableVisit";
import useSharedCart from "@/modules/Cart/useSharedCart";
import useCheckout from "@/modules/Order/useCheckout";
import useTableOrders from "@/modules/Order/useTableOrders";
import useVisitRealtime from "./useVisitRealtime";

export function useCustomerMenu({
  mode,
  visit,
}: {
  mode: "browse" | "table";
  visit: ReturnType<typeof useTableVisit>;
}) {
  const intro = useIntroReveal();
  const { menu, store, retryPublic, refreshMenu, refreshStore } =
    usePublicMenu();
  const { table, retryTable, resetVisit, endVisit, updateTable } = visit;
  const sessionId = table.kind === "ready" ? table.sessionId : null;
  const cartId = table.kind === "ready" ? table.cartId : null;
  const cart = useSharedCart(sessionId, cartId, endVisit, retryPublic);
  const orders = useTableOrders(sessionId, endVisit);
  const realtimeStatus = useVisitRealtime({
    tableId: table.kind === "ready" ? table.table.id : null,
    sessionId,
    endVisit,
    updateTable,
    refreshCart: cart.syncCart,
    refreshOrders: orders.refresh,
    refreshMenu,
    refreshStore,
  });
  const checkout = useCheckout(
    sessionId,
    cartId,
    endVisit,
    cart.refreshCart,
    cart.applyPlacementCart,
    retryPublic,
  );
  const editor = useItemEditor();
  const canAdd =
    mode === "table" &&
    table.kind === "ready" &&
    store.kind === "ready" &&
    store.data.isOpen &&
    cart.state.kind === "ready" &&
    !cart.needsReview &&
    !cart.busy &&
    !checkout.busy &&
    !checkout.attempt;
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
    checkout,
    orders,
    realtimeStatus,
    menu,
    editor,
    canAdd,
    findItem,
    retryTable,
    resetVisit,
  };
}

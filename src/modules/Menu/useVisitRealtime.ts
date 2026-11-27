import { useEffect, useState } from "react";

import { API_URL, ApiError, resolveTable } from "@/api/public";
import { watchRealtime } from "@/api/realtime";
import { tableTokenFromHash } from "@/lib/table-token";
import { tableRealtimeSchema } from "@/schemas/realtime";
import type { Table } from "@/types/public";

type Refresh = () => Promise<boolean | undefined>;

export default function useVisitRealtime({
  tableId, sessionId, endVisit, updateTable, refreshCart, refreshOrders,
  refreshMenu, refreshStore,
}: {
  tableId: number | null;
  sessionId: string | null;
  endVisit: (error?: ApiError) => void;
  updateTable: (sessionId: string, table: Table) => void;
  refreshCart: Refresh;
  refreshOrders: Refresh;
  refreshMenu: Refresh;
  refreshStore: Refresh;
}) {
  const [status, setStatus] = useState<"live" | "polling" | "reconnecting" | "connecting">("connecting");

  useEffect(() => {
    const token = tableTokenFromHash(window.location.hash);
    if (!token || !sessionId || tableId === null) return;
    const controller = new AbortController();
    const active = () => !controller.signal.aborted &&
      tableTokenFromHash(window.location.hash) === token;
    const finish = (error?: ApiError) => {
      if (!active()) return;
      controller.abort();
      endVisit(error);
    };
    const refreshTable = async () => {
      try {
        const { data } = await resolveTable(token, controller.signal);
        if (!active()) return false;
        if (data.id !== tableId) {
          finish();
          return false;
        }
        updateTable(sessionId, data);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === "INVALID_TABLE_QR") finish(error);
        return false;
      }
    };
    const query = new URLSearchParams({ sessionId });
    watchRealtime({
      url: `${API_URL}/tables/realtime?${query}`,
      headers: () => ({ "X-Table-Token": token }),
      signal: controller.signal,
      onStatus: (value) => { if (active()) setStatus(value); },
      onAccessEnded: ({ status, code, message }) => {
        finish(new ApiError(message ?? "This table visit is no longer available.", status, code));
      },
      validateState: (payload) => {
        const state = tableRealtimeSchema.parse(payload);
        if (state.scope.tableId !== tableId || state.scope.sessionId !== sessionId) {
          throw new Error("Unexpected realtime scope");
        }
        return state;
      },
      onChange: async (_state, changed) => {
        if (!active()) throw new Error("Visit no longer active");
        const updates: Promise<boolean | undefined>[] = [];
        if (changed.includes("cart") || changed.includes("menu")) updates.push(refreshCart());
        if (changed.includes("orders") || changed.includes("tables")) updates.push(refreshOrders());
        if (changed.includes("tables")) updates.push(refreshTable());
        if (changed.includes("menu")) updates.push(refreshMenu());
        if (changed.includes("store")) updates.push(refreshStore());
        const applied = await Promise.all(updates);
        if (!active() || !applied.every(Boolean))
          throw new Error("Realtime refresh incomplete");
      },
    });
    return () => controller.abort();
  }, [tableId, sessionId, endVisit, updateTable, refreshCart, refreshOrders, refreshMenu, refreshStore]);

  return status;
}

import { useCallback, useEffect, useState } from "react";

import { ApiError, openTable, resumeTable, resolveTable } from "@/api/public";
import { SESSION_KEY } from "@/constants/menu";
import { messageFor } from "@/lib/public-error";
import { tableTokenFromHash } from "@/lib/table-token";
import type { TableState } from "@/types/menu";

const VISIT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rememberedVisit(): { tableId: number; sessionId: string } | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const value: unknown = JSON.parse(stored);
    if (
      value &&
      typeof value === "object" &&
      "tableId" in value &&
      "sessionId" in value &&
      typeof value.tableId === "number" &&
      typeof value.sessionId === "string" &&
      VISIT_ID.test(value.sessionId)
    ) {
      return { tableId: value.tableId, sessionId: value.sessionId };
    }
  } catch {
    // Private browsing or blocked storage: the QR fragment still survives refresh.
  }
  return null;
}

function saveVisit(tableId: number, sessionId: string) {
  try {
    // Store only a session marker; the QR credential stays in the fragment.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ tableId, sessionId }));
  } catch {
    // The menu remains usable when browser storage is unavailable.
  }
}

export default function useTableVisit(mode: "browse" | "table") {
  const [table, setTable] = useState<TableState>({ kind: "loading" });
  const [scanVersion, setScanVersion] = useState(0);

  useEffect(() => {
    if (mode !== "table") return;
    const onHashChange = () => {
      // Even removing or invalidating the QR must clear the previous table.
      setTable({ kind: "loading" });
      setScanVersion((value) => value + 1);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [mode]);

  useEffect(() => {
    if (mode !== "table") return;
    const token = tableTokenFromHash(window.location.hash);
    if (!token) {
      let active = true;
      queueMicrotask(() => {
        if (active) setTable({ kind: "missing" });
      });
      return () => {
        active = false;
      };
    }
    const controller = new AbortController();

    const load = async () => {
      setTable({ kind: "loading" });
      try {
        const resolved = (await resolveTable(token, controller.signal)).data;
        const previous = rememberedVisit();
        if (previous?.tableId === resolved.id) {
          // Resume is one atomic, non-creating request. It returns the exact
          // remembered session or TABLE_SESSION_REQUIRED; it can never adopt a
          // session that replaced it while this page was closed.
          try {
            const resumed = (
              await resumeTable(token, previous.sessionId, controller.signal)
            ).data;
            if (resumed.session.id !== previous.sessionId) {
              if (!controller.signal.aborted)
                setTable({ kind: "ended", table: resolved });
              return;
            }
            if (!controller.signal.aborted) {
              saveVisit(resumed.table.id, resumed.session.id);
              setTable({
                kind: "ready",
                table: resumed.table,
                sessionId: resumed.session.id,
                cartId: resumed.cart.id,
              });
            }
            return;
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === "TABLE_SESSION_REQUIRED"
            ) {
              if (!controller.signal.aborted)
                setTable({ kind: "ended", table: resolved });
              return;
            }
            throw error;
          }
        }
        const opened = (await openTable(token, controller.signal)).data;
        if (!controller.signal.aborted) {
          saveVisit(opened.table.id, opened.session.id);
          setTable({
            kind: "ready",
            table: opened.table,
            sessionId: opened.session.id,
            cartId: opened.cart.id,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setTable({ kind: "error", message: messageFor(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [mode, scanVersion]);

  const retryTable = () => {
    setTable({ kind: "loading" });
    setScanVersion((value) => value + 1);
  };

  const startNewVisit = async () => {
    const hash = window.location.hash;
    const token = tableTokenFromHash(hash);
    if (!token) {
      setTable({ kind: "missing" });
      return;
    }
    setTable({ kind: "loading" });
    try {
      const opened = (await openTable(token)).data;
      if (window.location.hash !== hash) return;
      saveVisit(opened.table.id, opened.session.id);
      setTable({
        kind: "ready",
        table: opened.table,
        sessionId: opened.session.id,
        cartId: opened.cart.id,
      });
    } catch (error) {
      if (window.location.hash === hash)
        setTable({ kind: "error", message: messageFor(error) });
    }
  };

  const endVisit = useCallback((error?: ApiError) => {
    setTable((current) => {
      if (error?.code === "INVALID_TABLE_QR") {
        return { kind: "error", message: messageFor(error) };
      }
      return current.kind === "ready"
        ? { kind: "ended", table: current.table }
        : current;
    });
  }, []);

  return { table, retryTable, startNewVisit, endVisit };
}

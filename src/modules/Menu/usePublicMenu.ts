import { useCallback, useEffect, useRef, useState } from "react";

import {
  getMenu,
  getStoreStatus,
} from "@/api/public";
import type { PublicCategory, StoreStatus } from "@/types/public";
import { messageFor } from "@/lib/public-error";
import type { LoadState } from "@/types/menu";

function useResource<T>(load: (signal: AbortSignal) => Promise<{ data: T }>) {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!active.current) return false;
    active.current.abort();
    const controller = new AbortController();
    active.current = controller;
    try {
      const { data } = await load(controller.signal);
      if (controller.signal.aborted) return false;
      setState({ kind: "ready", data });
      return true;
    } catch (error) {
      if (!controller.signal.aborted)
        setState((current) => current.kind === "ready"
          ? current : { kind: "error", message: messageFor(error) });
      return false;
    }
  }, [load]);
  useEffect(() => {
    const scope = new AbortController();
    active.current = scope;
    queueMicrotask(() => { if (!scope.signal.aborted) void refresh(); });
    return () => {
      scope.abort();
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);
  return [state, refresh] as const;
}

export default function usePublicMenu() {
  const [menu, refreshMenu] = useResource<PublicCategory[]>(getMenu);
  const [store, refreshStore] = useResource<StoreStatus>(getStoreStatus);
  const retryPublic = useCallback(() => {
    void refreshMenu();
    void refreshStore();
  }, [refreshMenu, refreshStore]);
  return { menu, store, retryPublic, refreshMenu, refreshStore };
}

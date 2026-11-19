import { useEffect, useState } from "react";

import {
  getMenu,
  getStoreStatus,
} from "@/api/public";
import type { PublicCategory, StoreStatus } from "@/types/public";
import { messageFor } from "@/lib/public-error";
import type { LoadState } from "@/types/menu";

export default function usePublicMenu() {
  const [menu, setMenu] = useState<LoadState<PublicCategory[]>>({
    kind: "loading",
  });
  const [store, setStore] = useState<LoadState<StoreStatus>>({
    kind: "loading",
  });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void getMenu(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted)
          setMenu({ kind: "ready", data: result.data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setMenu({ kind: "error", message: messageFor(error) });
      },
    );
    void getStoreStatus(controller.signal).then(
      (result) => {
        if (!controller.signal.aborted)
          setStore({ kind: "ready", data: result.data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setStore({ kind: "error", message: messageFor(error) });
      },
    );
    return () => controller.abort();
  }, [reload]);

  const retryPublic = () => {
    setMenu({ kind: "loading" });
    setStore({ kind: "loading" });
    setReload((value) => value + 1);
  };

  return { menu, store, retryPublic };
}

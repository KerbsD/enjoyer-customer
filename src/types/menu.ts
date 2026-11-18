import type { Table } from "@/api/public";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };

export type TableState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ended"; table: Table }
  | { kind: "ready"; table: Table; sessionId: string };

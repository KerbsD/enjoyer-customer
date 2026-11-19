import { API_REQUEST_TIMEOUT_MS } from "@/constants/api";
import type {
  Envelope,
  OpenTable,
  PublicCategory,
  StoreStatus,
  Table,
  TableVisit,
} from "@/types/public";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function publicRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    tableToken?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    tableToken,
    signal,
    timeoutMs = API_REQUEST_TIMEOUT_MS,
  } = options;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(tableToken ? { "X-Table-Token": tableToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // Include body consumption in the timeout: a response can stall after headers.
    payload = await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "We can't reach the shop right now. Check your connection and try again.",
      0,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
  if (!response.ok) {
    const failure =
      payload && typeof payload === "object"
        ? (payload as { message?: unknown; code?: unknown })
        : {};
    throw new ApiError(
      typeof failure.message === "string"
        ? failure.message
        : "Something went wrong. Please try again.",
      response.status,
      typeof failure.code === "string" ? failure.code : undefined,
      "data" in failure ? failure.data : undefined,
    );
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("success" in payload) ||
    payload.success !== true
  ) {
    throw new ApiError(
      "The shop returned an unexpected response. Please try again.",
      0,
    );
  }
  return payload as T;
}

export const getMenu = (signal?: AbortSignal) =>
  publicRequest<Envelope<PublicCategory[]>>("/menu", { signal });
export const getStoreStatus = (signal?: AbortSignal) =>
  publicRequest<Envelope<StoreStatus>>("/store/status", { signal });
export const resolveTable = (token: string, signal?: AbortSignal) =>
  publicRequest<Envelope<Table>>("/tables/resolve", {
    method: "POST",
    body: { token },
    signal,
  });
export const openTable = (token: string, signal?: AbortSignal) =>
  publicRequest<Envelope<OpenTable>>("/tables/open", {
    method: "POST",
    body: { token },
    signal,
  });
export const resumeTable = (
  token: string,
  sessionId: string,
  signal?: AbortSignal,
) =>
  publicRequest<Envelope<TableVisit>>("/tables/resume", {
    method: "POST",
    body: { token, sessionId },
    signal,
  });

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { success: true; data: T; currency?: "PHP" };

export type PublicOption = {
  id: number;
  name: string;
  priceDelta: string;
  isAvailable: boolean;
  sortOrder: number;
};
export type PublicItem = {
  id: number;
  name: string;
  description: string;
  price: string;
  isSpicy: boolean;
  isAvailable: boolean;
  sortOrder: number;
  optionGroups: {
    id: number;
    name: string;
    minSelections: number;
    maxSelections: number;
    options: PublicOption[];
  }[];
};
export type PublicCategory = {
  id: number;
  name: string;
  sortOrder: number;
  items: PublicItem[];
};
export type Table = { id: number; name: string; orderLimit: number };
export type OpenTable = {
  table: Table;
  session: { id: string; status: "pending" | "open"; createdAt: string };
  cart: { id: string; version: number };
  created: boolean;
};
export type StoreDay = {
  date: string;
  openTime: string | null;
  closeTime: string | null;
  closed: boolean;
};
export type StoreStatus = {
  isOpen: boolean;
  configured: boolean;
  timezone: string;
  today: StoreDay;
  nextOpen: string | null;
  closesAt: string | null;
  week: StoreDay[];
};

export async function publicRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; tableToken?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", body, tableToken, signal } = options;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(tableToken ? { "X-Table-Token": tableToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("We can't reach the shop right now. Check your connection and try again.", 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const failure = payload && typeof payload === "object"
      ? payload as { message?: unknown; code?: unknown }
      : {};
    throw new ApiError(
      typeof failure.message === "string" ? failure.message : "Something went wrong. Please try again.",
      response.status,
      typeof failure.code === "string" ? failure.code : undefined,
    );
  }
  if (!payload || typeof payload !== "object" || !("success" in payload) || payload.success !== true) {
    throw new ApiError("The shop returned an unexpected response. Please try again.", response.status);
  }
  return payload as T;
}

export const getMenu = (signal?: AbortSignal) =>
  publicRequest<Envelope<PublicCategory[]>>("/menu", { signal });
export const getStoreStatus = (signal?: AbortSignal) =>
  publicRequest<Envelope<StoreStatus>>("/store/status", { signal });
export const resolveTable = (token: string, signal?: AbortSignal) =>
  publicRequest<Envelope<Table>>("/tables/resolve", {
    method: "POST", body: { token }, signal,
  });
export const openTable = (token: string, signal?: AbortSignal) =>
  publicRequest<Envelope<OpenTable>>("/tables/open", {
    method: "POST", body: { token }, signal,
  });
export const getCurrentOrdersSession = (token: string, signal?: AbortSignal) =>
  publicRequest<Envelope<{ session: { id: string } }>>("/tables/orders", {
    tableToken: token, signal,
  });

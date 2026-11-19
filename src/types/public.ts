export type Envelope<T> = { success: true; data: T; currency?: "PHP" };

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
export type TableVisit = {
  table: Table;
  session: { id: string; status: "pending" | "open"; createdAt: string };
  cart: { id: string; version: number };
};
export type OpenTable = TableVisit & { created: boolean };
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

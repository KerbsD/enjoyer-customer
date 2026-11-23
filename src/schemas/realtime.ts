import { z } from "zod";

export const tableRealtimeSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  resources: z.object({
    cart: z.string(),
    orders: z.string(),
    tables: z.string(),
    menu: z.string(),
    store: z.string(),
  }),
  scope: z.object({
    kind: z.literal("table"),
    tableId: z.number().int().positive(),
    sessionId: z.uuid(),
  }),
});

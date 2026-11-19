import { z } from "zod";

import type { PublicItem } from "@/types/public";
import { CART_MAX_QUANTITY, CART_NOTE_LIMIT } from "@/constants/cart";

const money = z.string().regex(/^\d+\.\d{2}$/);
const id = z.number().int().positive();
export const cartSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  items: z.array(z.object({
    id,
    menuItem: z.object({
      id,
      name: z.string(),
      price: money,
      isAvailable: z.boolean(),
      isHidden: z.boolean(),
    }),
    quantity: z.number().int().min(1).max(CART_MAX_QUANTITY),
    note: z.string().max(CART_NOTE_LIMIT),
    options: z.array(z.object({
      id,
      name: z.string(),
      priceDelta: money,
      isAvailable: z.boolean(),
      groupId: id,
      groupName: z.string(),
    })),
    unitPrice: money,
    lineTotal: money,
  })),
  totals: z.object({
    itemCount: z.number().int().nonnegative(),
    subtotal: money,
    total: money,
  }),
});

export const cartCustomizationFields = z.strictObject({
  quantity: z.number().int().min(1).max(CART_MAX_QUANTITY),
  note: z.string().trim().max(CART_NOTE_LIMIT),
  optionIds: z.array(z.number().int().positive()).max(50),
});

export type CartCustomizationInput = z.input<typeof cartCustomizationFields>;
export type CartCustomization = z.output<typeof cartCustomizationFields>;

export function customizationSchema(item: PublicItem) {
  return cartCustomizationFields.superRefine((value, ctx) => {
    const selected = new Set(value.optionIds);
    if (selected.size !== value.optionIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["optionIds"],
        message: "Choose each add-on only once.",
      });
    }
    const known = new Set(
      item.optionGroups.flatMap((group) =>
        group.options.map((option) => option.id),
      ),
    );
    if (value.optionIds.some((id) => !known.has(id))) {
      ctx.addIssue({
        code: "custom",
        path: ["optionIds"],
        message: "Some choices no longer belong to this item.",
      });
    }
    for (const group of item.optionGroups) {
      const chosen = group.options.filter((option) => selected.has(option.id));
      if (chosen.some((option) => !option.isAvailable)) {
        ctx.addIssue({
          code: "custom",
          path: ["optionIds"],
          message: `${group.name} has a sold-out choice.`,
        });
      }
      if (
        chosen.length < group.minSelections ||
        chosen.length > group.maxSelections
      ) {
        const rule =
          group.minSelections === group.maxSelections
            ? `Choose exactly ${group.minSelections} for ${group.name}.`
            : `Choose ${group.minSelections}–${group.maxSelections} for ${group.name}.`;
        ctx.addIssue({ code: "custom", path: ["optionIds"], message: rule });
      }
    }
  });
}

import { useRef, useState, type FormEvent } from "react";
import { customizationSchema } from "@/schemas/cart";

import type { ItemCustomizerProps } from "@/types/menu";

import { toCentavos } from "@/lib/money";

export function useItemCustomizer({
  item,
  line,
  onSave,
  onClose,
}: Pick<ItemCustomizerProps, "item" | "line" | "onSave" | "onClose">) {
  const form = useRef<HTMLFormElement>(null);
  const [quantity, setQuantity] = useState(line?.quantity ?? 1);
  const [note, setNote] = useState(line?.note ?? "");
  const [selected, setSelected] = useState<number[]>(
    line?.options
      .filter((option) =>
        item.optionGroups.some((group) =>
          group.options.some(
            (choice) => choice.id === option.id && choice.isAvailable,
          ),
        ),
      )
      .map((option) => option.id) ?? [],
  );
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);

  const toggle = (groupId: number, optionId: number, maxSelections: number) => {
    setError("");
    setSelected((current) => {
      if (current.includes(optionId))
        return current.filter((id) => id !== optionId);
      const group = item.optionGroups.find((entry) => entry.id === groupId);
      if (!group) return current;
      const other = current.filter(
        (id) => !group.options.some((option) => option.id === id),
      );
      const inGroup = current.filter((id) =>
        group.options.some((option) => option.id === id),
      );
      if (maxSelections === 1) return [...other, optionId];
      if (inGroup.length >= maxSelections) return current;
      return [...current, optionId];
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = customizationSchema(item).safeParse({
      quantity,
      note,
      optionIds: selected,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Review your choices.");
      requestAnimationFrame(() =>
        form.current
          ?.querySelector("[data-form-error]")
          ?.scrollIntoView({ block: "nearest" }),
      );
      return;
    }
    setError("");
    setAttempted(false);
    const outcome = await onSave(result.data);
    // Keep ordinary API failures in view; conflicts need a fresh cart review.
    if (outcome === "error") setAttempted(true);
    else onClose();
  };

  const choices = item.optionGroups.flatMap((group) => group.options);
  const unit =
    toCentavos(item.price) +
    selected.reduce((sum, id) => {
      const option = choices.find((candidate) => candidate.id === id);
      return sum + (option ? toCentavos(option.priceDelta) : 0);
    }, 0);

  return {
    form,
    submit,
    selected,
    toggle,
    note,
    setNote,
    quantity,
    setQuantity,
    error,
    attempted,
    unit,
  };
}

"use client";

import Modal from "@/components/Modal";
import QuantityField from "@/components/fields/QuantityField";
import TextareaField from "@/components/fields/TextareaField";
import { CART_MAX_QUANTITY, CART_NOTE_LIMIT } from "@/constants/cart";
import { fromCentavos, toCentavos } from "@/lib/money";
import { peso } from "@/lib/shop-format";

import type { ItemCustomizerProps } from "@/types/menu";

import { useItemCustomizer } from "./useItemCustomizer";

export default function ItemCustomizer({
  item,
  line,
  busy,
  onSave,
  actionError,
  onClose,
}: ItemCustomizerProps) {
  const {
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
  } = useItemCustomizer({ item, line, onSave, onClose });

  return (
    <Modal
      title={item.name}
      eyebrow="MADE YOUR WAY"
      closeLabel="Close customization"
      onClose={onClose}
      returnFocusId="cart-trigger"
    >
      <form ref={form} onSubmit={(event) => void submit(event)}>
        {item.description && (
          <p className="mt-3.5 mb-6.25 text-sm leading-normal text-secondary">
            {item.description}
          </p>
        )}
        <p className="mt-3 mb-4.5 text-[13px] leading-normal text-secondary">
          Choose your options, then tap {line ? "Update item" : "Add to cart"}{" "}
          below to save.
        </p>
        {item.optionGroups.map((group) => (
          <fieldset
            className="mt-4 border-t border-line pt-4.25 pb-1"
            key={group.id}
          >
            <legend className="float-left w-full text-base font-extrabold">
              {group.name}{" "}
              <span className="mt-0.75 mb-2.5 block text-xs font-normal text-secondary">
                {group.minSelections === group.maxSelections
                  ? `Choose ${group.minSelections}`
                  : `Choose ${group.minSelections}–${group.maxSelections}`}
              </span>
            </legend>
            {group.options.map((option) => (
              <label
                className={`flex cursor-pointer items-center gap-2.5 border-b border-line px-0.5 py-3 text-sm ${option.isAvailable ? "" : "text-[#69645c]"}`}
                key={option.id}
              >
                <input
                  type="checkbox"
                  className="size-4.5 shrink-0 accent-[#a57600]"
                  checked={selected.includes(option.id)}
                  disabled={!option.isAvailable || busy}
                  onChange={() =>
                    toggle(group.id, option.id, group.maxSelections)
                  }
                />
                <span className="flex-1">
                  {option.name}
                  {!option.isAvailable && <small> · Sold out</small>}
                </span>
                <span className="font-mono text-xs whitespace-nowrap">
                  {toCentavos(option.priceDelta) === 0
                    ? "Included"
                    : `+${peso(option.priceDelta)}`}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <TextareaField
          label="Note for this item"
          hint={`Optional · max ${CART_NOTE_LIMIT}`}
          maxLength={CART_NOTE_LIMIT}
          value={note}
          disabled={busy}
          rows={3}
          placeholder="Allergies or requests? Tell us here."
          onChange={(event) => setNote(event.target.value)}
        />
        <QuantityField
          label="Quantity"
          value={quantity}
          min={1}
          max={CART_MAX_QUANTITY}
          disabled={busy}
          onChange={setQuantity}
        />
        {(error || (attempted && actionError)) && (
          <p
             data-form-error
             className="text-[13px] font-bold text-[#a02f16]"
            role="alert"
          >
            {error ||
              actionError ||
              "Could not save this item. Please try again."}
          </p>
        )}
        <button
          type="submit"
          className="flex w-full items-center justify-between gap-3 rounded-lg bg-accent px-4.25 py-3.75 font-extrabold disabled:cursor-not-allowed disabled:opacity-55"
          disabled={busy || !item.isAvailable}
        >
          <span>{busy ? "Saving…" : line ? "Update item" : "Add to cart"}</span>
          <strong className="font-mono">
            {peso(fromCentavos(unit * quantity))}
          </strong>
        </button>
      </form>
    </Modal>
  );
}

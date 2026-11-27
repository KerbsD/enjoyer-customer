"use client";

import Modal from "@/components/Modal";
import { primaryButton } from "@/components/button-styles";
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
      closeLabel="Close customization"
      onClose={onClose}
      returnFocusId="cart-trigger"
    >
      <form ref={form} onSubmit={(event) => void submit(event)}>
        {item.description && (
          <p className="mt-1 mb-4 text-sm leading-normal text-secondary">
            {item.description}
          </p>
        )}
        {item.optionGroups.map((group) => (
          <fieldset
            className="mt-4 border-t border-line pt-2"
            key={group.id}
          >
            <legend className="float-left w-full text-base font-extrabold">
              {group.name}{" "}
              <span className="mt-0.5 mb-1 block text-sm font-normal text-secondary">
                {group.minSelections === group.maxSelections
                  ? `Choose ${group.minSelections}`
                  : `Choose ${group.minSelections}–${group.maxSelections}`}
              </span>
            </legend>
            {group.options.map((option) => (
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded px-1 py-2 text-sm has-checked:bg-muted ${option.isAvailable ? "" : "text-secondary"}`}
                key={option.id}
              >
                <input
                  type={group.minSelections === 1 && group.maxSelections === 1 ? "radio" : "checkbox"}
                  name={`option-group-${group.id}`}
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
          placeholder="Special requests? Tell us here."
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
          className={`${primaryButton} mt-2 w-full flex-wrap`}
          disabled={busy || !item.isAvailable}
        >
          <span>{busy ? "Saving…" : line ? "Update item" : "Add to cart"}</span>
          <span aria-hidden="true">·</span>
          <strong className="font-mono">
            {peso(fromCentavos(unit * quantity))}
          </strong>
        </button>
      </form>
    </Modal>
  );
}

"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  title: string;
  eyebrow?: string;
  closeLabel: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  returnFocusId?: string;
};

export default function Modal({
  title,
  eyebrow,
  closeLabel,
  className = "",
  onClose,
  children,
  returnFocusId,
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      // The native return target may have been removed while saving.
      const target = previousFocus instanceof HTMLElement &&
        previousFocus.isConnected && !previousFocus.matches(":disabled")
        ? previousFocus
        : returnFocusId ? document.getElementById(returnFocusId) : null;
      target?.focus({ preventScroll: true });
    };
  }, [returnFocusId]);

  return (
    <dialog
      ref={dialog}
      className={`m-auto max-h-[90dvh] w-[min(520px,calc(100%-24px))] max-w-none overflow-hidden rounded-2xl border border-line bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/35 max-[600px]:mt-auto max-[600px]:mb-0 max-[600px]:w-full max-[600px]:rounded-b-none ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="max-h-[calc(90dvh-2px)] overflow-y-auto overscroll-contain px-6 pt-5 pb-[max(24px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <p className="mb-1.75 text-[11px] font-extrabold tracking-[0.17em] text-[#805800]">
                {eyebrow}
              </p>
            )}
            <h2
              className="text-[clamp(24px,5vw,32px)] leading-tight font-extrabold tracking-tight wrap-anywhere"
              id={titleId}
            >
              {title}
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-muted"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

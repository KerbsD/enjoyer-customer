"use client";

import { gsap, useGSAP } from "@/lib/gsap";
import { useId, useRef, type ReactNode } from "react";

import { prefersReducedMotion } from "@/lib/motion";

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
  const surface = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const titleId = useId();

  const { contextSafe } = useGSAP(
    () => {
      const element = dialog.current;
      const content = surface.current;
      const previousFocus = document.activeElement;
      element?.showModal();
      closeButton.current?.focus({ preventScroll: true });
      closing.current = false;
      if (content && !prefersReducedMotion()) {
        gsap.fromTo(
          content,
          { y: 22, scale: 0.98, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.35,
            ease: "power3.out",
            clearProps: "transform,opacity",
          },
        );
      }
      // React may replay effects in development; cleanup must not notify the
      // parent or the editor will disappear before it can be used.
      return () => {
        element?.close();
        // The native return target may have been removed while saving.
        const target = previousFocus instanceof HTMLElement &&
          previousFocus.isConnected && !previousFocus.matches(":disabled")
          ? previousFocus
          : returnFocusId ? document.getElementById(returnFocusId) : null;
        target?.focus({ preventScroll: true });
      };
    },
    { scope: dialog },
  );

  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    if (!surface.current || prefersReducedMotion()) {
      onClose();
      return;
    }
    contextSafe(() => {
      gsap.to(surface.current, {
        y: 12,
        scale: 0.99,
        autoAlpha: 0,
        duration: 0.17,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: onClose,
      });
    })();
  };

  return (
    <dialog
      ref={dialog}
      className={`m-auto max-h-[min(90dvh,850px)] w-[min(580px,calc(100%-24px))] max-w-none rounded-xl border border-line bg-paper p-0 text-ink shadow-[0_20px_80px_#0005] backdrop:bg-ink/75 max-[600px]:mt-auto max-[600px]:mb-0 max-[600px]:h-[min(92dvh,850px)] max-[600px]:max-h-none max-[600px]:w-full max-[600px]:rounded-b-none ${className}`.trim()}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div
        ref={surface}
        className="max-h-[min(90dvh,850px)] overflow-y-auto p-6.5 max-[600px]:max-h-[92dvh] max-[600px]:px-4.5 max-[600px]:pt-6 max-[600px]:pb-[max(22px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            {eyebrow && (
              <p className="mb-1.75 text-[11px] font-extrabold tracking-[0.17em] text-[#805800]">
                {eyebrow}
              </p>
            )}
            <h2
              className="m-0 text-[clamp(25px,5vw,38px)] leading-[1.1] font-bold tracking-[-0.06em]"
              id={titleId}
            >
              {title}
            </h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="size-9.5 shrink-0 rounded-lg border border-line bg-transparent"
            aria-label={closeLabel}
            onClick={requestClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

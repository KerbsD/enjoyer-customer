"use client";

import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";

import { prefersReducedMotion } from "@/lib/motion";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  onClosed?: () => void;
  labelledBy: string;
  children: ReactNode;
};

export default function Drawer({
  open,
  onClose,
  onClosed,
  labelledBy,
  children,
}: DrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const animation = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const element = dialog.current;
    const surface = panel.current;
    if (!element || !surface) return;
    animation.current?.kill();

    if (open) {
      const wasClosed = !element.open;
      if (wasClosed) {
        gsap.set(surface, { xPercent: 100 });
        element.showModal();
      }
      if (prefersReducedMotion()) {
        gsap.set(surface, { xPercent: 0 });
      } else {
        animation.current = gsap.to(surface, {
          xPercent: 0,
          duration: 0.35,
          ease: "power3.out",
          overwrite: "auto",
        });
      }
    } else if (element.open) {
      if (prefersReducedMotion()) {
        element.close();
      } else {
        animation.current = gsap.to(surface, {
          xPercent: 100,
          duration: 0.35,
          ease: "power2.in",
          overwrite: "auto",
          onComplete: () => {
            element.close();
          },
        });
      }
    }

    return () => {
      animation.current?.kill();
    };
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    const surface = panel.current;
    return () => {
      animation.current?.kill();
      element?.close();
      if (surface) gsap.set(surface, { clearProps: "transform" });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClosed}
      aria-labelledby={labelledBy}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-110 border-0 bg-transparent p-0 text-ink backdrop:bg-ink/65"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        data-drawer-surface
        className="flex h-full flex-col overflow-y-auto bg-paper shadow-2xl"
      >
        {children}
      </div>
    </dialog>
  );
}

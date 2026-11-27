"use client";

import { useEffect, useRef, type ReactNode } from "react";

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

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open === open) return;
    if (open) element.showModal();
    else element.close();
  }, [open]);

  useEffect(() => {
    const element = dialog.current;
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClosed}
      aria-labelledby={labelledBy}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[calc(100%-32px)] max-w-110 overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-ink/20 max-[360px]:w-full"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain border-l border-line bg-paper">
        {children}
      </div>
    </dialog>
  );
}

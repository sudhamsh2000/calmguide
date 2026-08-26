"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.34)] p-4 backdrop-blur-[3px] dark:bg-[rgba(8,12,20,0.56)]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-[380px] overflow-hidden rounded-[2rem] border border-slate-300/85 bg-background shadow-[0_22px_54px_rgba(15,23,42,0.16),0_2px_10px_rgba(15,23,42,0.06)] dark:border-[#31445f] dark:bg-surface dark:shadow-[0_30px_80px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.03)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-5 dark:border-white/[0.06]">
          <h2 id="confirm-dialog-title" className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-foreground-muted">{message}</p>
        </div>
        <div className="bg-slate-50/55 px-6 py-5 dark:bg-transparent">
          <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="outline-button focus-ring flex-1 h-11 rounded-xl px-4 text-sm font-medium text-foreground transition-all hover:text-foreground active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`focus-ring flex-1 h-11 rounded-xl px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,37,42,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(23,37,42,0.16)] active:translate-y-0 active:scale-[0.98] ${
              variant === "danger"
                ? "bg-error hover:bg-error/90 dark:hover:bg-error/85"
                : "bg-primary hover:bg-primary-dark"
            }`}
          >
            {confirmLabel}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

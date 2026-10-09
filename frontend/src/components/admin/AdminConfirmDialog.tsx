"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";

interface AdminConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button destructive (e.g. hard delete) vs. neutral (e.g. archive). */
  destructive?: boolean;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Nothing like this existed before Phase 6D — needed for archive/draft-delete confirmation and reusable by future admin modules. */
export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  isSubmitting,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-dialog-title"
        aria-describedby="admin-confirm-dialog-description"
        className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg"
      >
        <h2 id="admin-confirm-dialog-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        <p id="admin-confirm-dialog-description" className="mt-2 text-sm text-text-secondary">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "primary" : "secondary"}
            size="sm"
            className={destructive ? "bg-error hover:bg-error/90" : undefined}
            onClick={onConfirm}
            isLoading={isSubmitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

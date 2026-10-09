"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AdminRowActionItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Shown as a title tooltip on a disabled item so the admin sees why, not just that, an action is unavailable. */
  disabledReason?: string;
  destructive?: boolean;
}

interface AdminRowActionsMenuProps {
  items: AdminRowActionItem[];
  label?: string;
}

/** Minimal row-actions dropdown — no popover library exists in this project, so this is built directly rather than adding a dependency. */
export function AdminRowActionsMenu({ items, label = "Actions" }: AdminRowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg hover:text-text"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.disabledReason : undefined}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm",
                item.disabled
                  ? "cursor-not-allowed text-text-secondary/60"
                  : item.destructive
                    ? "text-error hover:bg-error/10"
                    : "text-text hover:bg-bg"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

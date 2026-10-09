"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
}

/** Single-open-at-a-time accordion. Generic — not Contact-specific. */
export function Accordion({ items, defaultOpenId, className }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null);

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `accordion-panel-${item.id}`;
        const buttonId = `accordion-button-${item.id}`;
        return (
          <div key={item.id} className="rounded-md border border-border bg-surface">
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-text"
            >
              {item.question}
              <ChevronDown
                aria-hidden
                className={cn("h-4 w-4 shrink-0 text-primary transition-transform", isOpen ? "rotate-180" : undefined)}
              />
            </button>
            {isOpen ? (
              <p
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="px-4 pb-3.5 text-sm text-text-secondary"
              >
                {item.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

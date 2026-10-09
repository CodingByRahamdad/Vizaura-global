"use client";

import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { Input } from "@/components/ui/Input";

interface SearchFieldProps {
  placeholder?: string;
  ariaLabel?: string;
  onSubmit?: (query: string) => void;
  className?: string;
}

export function SearchField({
  placeholder = "Search products...",
  ariaLabel = "Search products",
  onSubmit,
  className,
}: SearchFieldProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "").trim();
    onSubmit?.(query);
  }

  return (
    <form role="search" onSubmit={handleSubmit} className={className}>
      <Input
        type="search"
        name="q"
        leftIcon={<Search className="h-4 w-4" aria-hidden />}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </form>
  );
}

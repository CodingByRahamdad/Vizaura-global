"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

interface AdminSearchInputProps {
  basePath: string;
  placeholder?: string;
  /**
   * Opt-in only — omitted, this is byte-for-byte the original submit-based
   * behavior (matching ShopSearchForm), which every other admin list page
   * using this component keeps relying on. Pass a value (e.g. 500) to
   * additionally fire a search after typing settles, without waiting for
   * Enter/submit.
   */
  debounceMs?: number;
}

export function AdminSearchInput({ basePath, placeholder = "Search...", debounceMs }: AdminSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get("search") ?? "";

  function pushSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("search", q);
    else params.delete("search");
    params.delete("page");
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    pushSearch(String(formData.get("search") ?? "").trim());
  }

  if (debounceMs === undefined) {
    return (
      <form role="search" onSubmit={handleSubmit} className="w-full max-w-xs">
        <Input
          type="search"
          name="search"
          defaultValue={currentValue}
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </form>
    );
  }

  return (
    <DebouncedSearchInput
      placeholder={placeholder}
      debounceMs={debounceMs}
      currentValue={currentValue}
      pushSearch={pushSearch}
    />
  );
}

interface DebouncedSearchInputProps {
  placeholder: string;
  debounceMs: number;
  currentValue: string;
  pushSearch: (q: string) => void;
}

function DebouncedSearchInput({ placeholder, debounceMs, currentValue, pushSearch }: DebouncedSearchInputProps) {
  const [draft, setDraft] = useState(currentValue);
  const debounced = useDebouncedValue(draft, debounceMs);
  // Tracks the last value this component itself pushed to the URL, so a
  // navigation elsewhere (e.g. a filter/pagination change) that resets
  // `currentValue` back to the same string doesn't re-trigger a push loop.
  const lastPushed = useRef(currentValue);

  useEffect(() => {
    // The URL changed from outside this input (filters cleared, page nav) —
    // resync the draft so it doesn't silently fight the real query param.
    if (currentValue !== lastPushed.current) {
      setDraft(currentValue);
      lastPushed.current = currentValue;
    }
  }, [currentValue]);

  useEffect(() => {
    if (debounced === lastPushed.current) return;
    lastPushed.current = debounced;
    pushSearch(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <form
      role="search"
      className="w-full max-w-xs"
      onSubmit={(event) => {
        event.preventDefault();
        lastPushed.current = draft.trim();
        pushSearch(draft.trim());
      }}
    >
      <Input
        type="search"
        name="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        leftIcon={<Search className="h-4 w-4" aria-hidden />}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </form>
  );
}

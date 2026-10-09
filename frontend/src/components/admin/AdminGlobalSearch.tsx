"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchAdmin } from "@/lib/api/admin/search";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { AdminSearchResults } from "@/lib/types/admin-search";
import { cn } from "@/lib/utils/cn";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

type ResultGroup = {
  label: string;
  items: { id: string; title: string; subtitle: string; href: string }[];
};

function toGroups(results: AdminSearchResults["results"]): ResultGroup[] {
  const groups: ResultGroup[] = [];
  if (results.products) {
    groups.push({
      label: "Products",
      items: results.products.map((p) => ({ id: p.id, title: p.name, subtitle: p.slug, href: `/admin/products/${p.id}` })),
    });
  }
  if (results.orders) {
    groups.push({
      label: "Orders",
      items: results.orders.map((o) => ({
        id: o.id,
        title: o.orderNumber,
        subtitle: `${o.status}${o.customerEmail ? ` · ${o.customerEmail}` : ""}`,
        href: `/admin/orders/${o.id}`,
      })),
    });
  }
  if (results.customers) {
    groups.push({
      label: "Customers",
      items: results.customers.map((c) => ({ id: c.id, title: c.name, subtitle: c.email, href: `/admin/customers/${c.id}` })),
    });
  }
  if (results.users) {
    groups.push({
      label: "Staff Users",
      items: results.users.map((u) => ({ id: u.id, title: u.name, subtitle: u.email, href: `/admin/users/${u.id}` })),
    });
  }
  if (results.categories) {
    groups.push({
      label: "Categories",
      items: results.categories.map((c) => ({ id: c.id, title: c.name, subtitle: c.slug, href: `/admin/categories/${c.id}` })),
    });
  }
  return groups.filter((group) => group.items.length > 0);
}

/// Replaces the old disabled search <input>. Debounced, hits the real
/// GET /admin/search endpoint (which itself fans out to each domain's own
/// existing list/search logic, permission-filtered server-side) — no
/// hardcoded results at any point.
interface AdminGlobalSearchProps {
  className?: string;
}

export function AdminGlobalSearch({ className }: AdminGlobalSearchProps = {}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  // All synchronous state resets (clearing results for a too-short query)
  // happen in the input's own onChange handler below, not here — this
  // effect only ever sets state from inside the async .then/.catch/.finally
  // below, after the debounced value settles (react-hooks/set-state-in-effect).
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    let cancelled = false;
    searchAdmin(trimmed)
      .then((result) => {
        if (cancelled) return;
        setGroups(toGroups(result.results));
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setGroups(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const trimmedQuery = query.trim();
  const showPanel = open && trimmedQuery.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={rootRef} className={cn("relative flex-1 max-w-md", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (value.trim().length < MIN_QUERY_LENGTH) {
            setGroups(null);
            setError(false);
            setLoading(false);
          } else {
            setLoading(true);
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products, orders, customers…"
        aria-label="Search admin records"
        className="w-full rounded-full border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-secondary/70 focus:border-primary focus:outline-none"
      />
      {showPanel ? (
        <div className="absolute z-40 mt-2 w-full max-w-lg rounded-lg border border-border bg-surface shadow-lg">
          <div className="max-h-96 overflow-y-auto py-2">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">Searching…</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-error">Search failed. Please try again.</p>
            ) : !groups || groups.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">
                No results found for &quot;{trimmedQuery}&quot;.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="py-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-text-secondary/70">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="block px-4 py-2 text-sm hover:bg-bg"
                    >
                      <p className="truncate font-medium text-text">{item.title}</p>
                      <p className="truncate text-xs text-text-secondary">{item.subtitle}</p>
                    </Link>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

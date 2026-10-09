"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaginationMeta } from "@/lib/types/catalog";

interface AdminPaginationProps {
  pagination: PaginationMeta;
  /** e.g. "/admin/products" — generalized from ShopPagination's hardcoded /products. */
  basePath: string;
}

function getVisiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}

export function AdminPagination({ pagination, basePath }: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { page, totalPages } = pagination;

  if (totalPages <= 1) return null;

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goToPage(page - 1)}
        aria-label="Previous page"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-primary-light/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      {visiblePages.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-text-secondary">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            aria-current={entry === page ? "page" : undefined}
            onClick={() => goToPage(entry)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors",
              entry === page ? "bg-primary text-white" : "text-text hover:bg-primary-light/30"
            )}
          >
            {entry}
          </button>
        )
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goToPage(page + 1)}
        aria-label="Next page"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-primary-light/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}

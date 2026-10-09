"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";

export interface AdminFilterOption {
  label: string;
  value: string;
}

export interface AdminFilterDef {
  /** Query param name, e.g. "status" or "category". */
  param: string;
  label: string;
  options: AdminFilterOption[];
  /** First option's value, e.g. "" for "All" or a specific status — see caller for the default policy. */
  allValue?: string;
}

interface AdminFiltersProps {
  basePath: string;
  filters: AdminFilterDef[];
}

export function AdminFilters({ basePath, filters }: AdminFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(param: string, value: string, allValue: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === allValue) params.delete(param);
    else params.set(param, value);
    params.delete("page");
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter) => (
        <label key={filter.param} className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="sr-only">{filter.label}</span>
          <Select
            aria-label={filter.label}
            className="h-9 w-auto min-w-[9rem]"
            value={searchParams.get(filter.param) ?? filter.allValue ?? ""}
            onChange={(event) => handleChange(filter.param, event.target.value, filter.allValue)}
            options={filter.options}
          />
        </label>
      ))}
    </div>
  );
}

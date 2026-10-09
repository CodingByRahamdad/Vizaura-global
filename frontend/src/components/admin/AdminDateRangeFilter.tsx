"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";

interface AdminDateRangeFilterProps {
  basePath: string;
  fromParam?: string;
  toParam?: string;
}

/**
 * A browser date input reports a *valid* date while the year is still being
 * typed ("2" -> 0002-09-25), so committing every change would push a bogus
 * range into the URL and re-render mid-keystroke. Only commit a cleared value
 * or a complete date with a plausible year (a picker selection is always one).
 */
function isCommittable(value: string): boolean {
  if (value === "") return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}

interface DateFieldProps {
  label: string;
  ariaLabel: string;
  urlValue: string;
  min?: string;
  max?: string;
  onCommit: (value: string) => void;
}

function DateField({ label, ariaLabel, urlValue, min, max, onCommit }: DateFieldProps) {
  // Local draft so typing is never interrupted by the URL round trip; resynced
  // (render-time, per the React docs) when the URL value changes externally,
  // e.g. browser back/forward.
  const [draft, setDraft] = useState(urlValue);
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue);
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue);
    setDraft(urlValue);
  }

  return (
    <label className="flex items-center gap-2">
      <span>{label}</span>
      <Input
        type="date"
        className="h-9 w-auto"
        aria-label={ariaLabel}
        value={draft}
        min={min}
        max={max}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (isCommittable(next)) onCommit(next);
        }}
      />
    </label>
  );
}

/** Writes YYYY-MM-DD values to the URL; the backend enforces the range (a date-only "to" is inclusive of that day). */
export function AdminDateRangeFilter({ basePath, fromParam = "dateFrom", toParam = "dateTo" }: AdminDateRangeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function commit(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const from = searchParams.get(fromParam) ?? "";
  const to = searchParams.get(toParam) ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
      <DateField
        label="From"
        ariaLabel="Order date from"
        urlValue={from}
        max={to || undefined}
        onCommit={(value) => commit(fromParam, value)}
      />
      <DateField
        label="To"
        ariaLabel="Order date to"
        urlValue={to}
        min={from || undefined}
        onCommit={(value) => commit(toParam, value)}
      />
    </div>
  );
}

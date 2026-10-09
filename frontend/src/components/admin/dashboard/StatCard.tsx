import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatCardProps {
  icon: ReactNode;
  iconClassName: string;
  label: string;
  value: string;
  /** null renders "—" — never a fabricated percentage when there's no prior-period baseline. */
  trendPct?: number | null;
  trendLabel?: string;
}

export function StatCard({ icon, iconClassName, label, value, trendPct, trendLabel }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg ${iconClassName}`}>{icon}</div>
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      {trendPct !== undefined ? (
        <p className="mt-2 flex items-center gap-1 text-xs">
          {trendPct === null ? (
            <span className="text-text-secondary">No data for the previous period yet</span>
          ) : (
            <>
              <span
                className={`flex items-center gap-0.5 font-medium ${trendPct >= 0 ? "text-success" : "text-error"}`}
              >
                {trendPct >= 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                {Math.abs(trendPct).toFixed(1)}%
              </span>
              <span className="text-text-secondary">{trendLabel ?? "vs. previous period"}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

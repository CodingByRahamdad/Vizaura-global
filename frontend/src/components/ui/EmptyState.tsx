import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      {icon ? <div className="text-text-secondary">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {action}
    </div>
  );
}

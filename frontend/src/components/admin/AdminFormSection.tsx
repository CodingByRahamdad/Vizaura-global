import type { ReactNode } from "react";

interface AdminFormSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminFormSection({ title, description, actions, children }: AdminFormSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text">{title}</h2>
          {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

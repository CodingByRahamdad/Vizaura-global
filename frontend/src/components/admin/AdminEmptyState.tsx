import type { ReactNode } from "react";
import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function AdminEmptyState({
  title = "Nothing here yet",
  description = "No records match the current filters.",
  action,
}: AdminEmptyStateProps) {
  return (
    <EmptyState
      icon={<PackageSearch className="h-8 w-8" aria-hidden />}
      title={title}
      description={description}
      action={action}
    />
  );
}

import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "warning",
};

export function ProductStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{status}</Badge>;
}

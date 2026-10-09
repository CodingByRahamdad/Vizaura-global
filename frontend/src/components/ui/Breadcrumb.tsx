import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-text-secondary">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-primary-dark">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-text">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

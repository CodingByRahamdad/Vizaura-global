import { UtilityBar } from "@/components/layout/Header/UtilityBar";
import { MainBar } from "@/components/layout/Header/MainBar";
import type { CategoryResponse } from "@/lib/types/catalog";

interface HeaderProps {
  categories: CategoryResponse[];
}

export function Header({ categories }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30">
      <UtilityBar />
      <MainBar categories={categories} />
    </header>
  );
}

import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header/Header";
import { Footer } from "@/components/layout/Footer/Footer";
import { getCategories } from "@/lib/api/catalog";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  // Categories power navigation on every storefront page — degrade to an
  // empty menu rather than crash the layout if the catalog API is down.
  const categories = await getCategories().catch(() => []);

  return (
    <>
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

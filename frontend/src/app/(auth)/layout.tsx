import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header/Header";
import { Footer } from "@/components/layout/Footer/Footer";
import { getCategories } from "@/lib/api/catalog";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const categories = await getCategories().catch(() => []);

  return (
    <>
      <Header categories={categories} />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}

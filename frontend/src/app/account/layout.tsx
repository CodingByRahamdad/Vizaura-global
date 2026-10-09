import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header/Header";
import { Footer } from "@/components/layout/Footer/Footer";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { getCategories } from "@/lib/api/catalog";
import { getServerSession } from "@/lib/api/auth-server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // UX/navigation guard only — the backend remains the real authorization
  // boundary for every account endpoint a later phase adds (see
  // docs/CURRENT_TASK.md). No expired-session refresh attempted here; the
  // client-side AuthProvider's own bootstrap can still recover the session
  // after this redirect if the cookie was merely stale, not absent.
  const session = await getServerSession();
  if (!session) redirect("/login");

  const categories = await getCategories().catch(() => []);

  return (
    <>
      <Header categories={categories} />
      <main className="flex-1">
        <Container>
          <Section className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
            <AccountSidebar />
            <div>{children}</div>
          </Section>
        </Container>
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CartHero } from "@/components/cart/CartHero";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Your Cart — VIZAURA GLOBAL",
  description: "Review the items in your shopping cart.",
};

export default function CartPage() {
  return (
    <>
      <CartHero />
      <Container>
        <Section>
          <CartView />
        </Section>
      </Container>
    </>
  );
}

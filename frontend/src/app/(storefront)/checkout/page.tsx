import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = {
  title: "Checkout — VIZAURA GLOBAL",
  description: "Complete your order.",
};

export default function CheckoutPage() {
  return (
    <Container>
      <Section>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
          Checkout
        </p>
        <h1 className="mb-6 font-serif text-3xl font-semibold text-text md:text-4xl">
          Checkout
        </h1>
        <CheckoutView />
      </Section>
    </Container>
  );
}

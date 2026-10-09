import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { ContactHero } from "@/components/contact/ContactHero";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactInfoCard } from "@/components/contact/ContactInfoCard";
import { FAQSection } from "@/components/contact/FAQSection";
import { OfficeMapCard } from "@/components/contact/OfficeMapCard";

export default function ContactPage() {
  return (
    <>
      <ContactHero />

      <Section>
        <Container>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <ContactForm />
            <ContactInfoCard />
          </div>
        </Container>
      </Section>

      <Section as="div" id="faq" className="bg-cream py-10 md:py-14">
        <Container>
          <div className="grid gap-8 lg:grid-cols-2">
            <FAQSection />
            <OfficeMapCard />
          </div>
        </Container>
      </Section>
    </>
  );
}

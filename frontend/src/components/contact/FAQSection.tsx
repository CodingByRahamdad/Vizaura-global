import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { FAQ_ITEMS } from "@/lib/constants/contact-content";

export function FAQSection() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">Quick Answers</p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-text md:text-3xl">Frequently Asked Questions</h2>
      <p className="mt-1 max-w-md text-sm text-text-secondary">
        Find answers to the most common questions. If you don&apos;t see your question here, feel free to
        contact us directly.
      </p>

      <Accordion items={FAQ_ITEMS} className="mt-5" />

      <Link
        href="/contact#faq"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View More FAQs
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

import { Award, Leaf, Sprout } from "lucide-react";
import { Card } from "@/components/ui/Card";

const VALUES = [
  {
    icon: Leaf,
    title: "Ethically Sourced",
    description: "Every ingredient is sourced with care for the land and the people who tend it.",
  },
  {
    icon: Sprout,
    title: "Lab-Tested Purity",
    description: "No fillers, no shortcuts — just pure, natural ingredients you can trust.",
  },
  {
    icon: Award,
    title: "Small-Batch Care",
    description: "Crafted in small batches so quality never gets lost to scale.",
  },
];

/**
 * Replaces the reference's "What Our Customers Say" testimonial band. No
 * Reviews backend exists (see docs/MODULE_STATUS.md — NOT STARTED across
 * every column), so attributing invented quotes to fictitious named
 * customers with fake avatars would present fabricated content as genuine
 * to real site visitors. This section keeps the same 3-card visual rhythm
 * with honest, unattributed brand-value copy instead.
 */
export function BrandValues() {
  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
          Why Vizaura
        </p>
        <h2 className="font-serif text-2xl font-semibold text-text">Purity You Can Trust</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {VALUES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="flex flex-col gap-3">
            <Icon className="h-6 w-6 text-primary" aria-hidden />
            <p className="font-semibold text-text">{title}</p>
            <p className="text-sm text-text-secondary">{description}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

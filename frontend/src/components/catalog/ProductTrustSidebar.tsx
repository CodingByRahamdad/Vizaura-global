import { Shield } from "lucide-react";
import { Card } from "@/components/ui/Card";

const TRUST_POINTS = [
  { title: "Premium Quality", description: "Sourced from the finest natural origins" },
  { title: "Authentic & Pure", description: "No additives, no fillers" },
  { title: "Better Energy & Stamina", description: "Support your active lifestyle" },
  { title: "Trusted Worldwide", description: "Loved by 50,000+ customers" },
];

export function ProductTrustSidebar() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 font-serif text-lg font-semibold text-text">Why Choose VIZAURA GLOBAL?</h3>
        <div className="flex flex-col gap-4">
          {TRUST_POINTS.map((point) => (
            <div key={point.title} className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-text">{point.title}</p>
                <p className="text-xs text-text-secondary">{point.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="bg-primary-light/30">
        <h3 className="mb-1 font-serif text-lg font-semibold text-text">Ancient Wisdom. Modern Wellness.</h3>
        <p className="text-sm text-text-secondary">
          Experience the power of nature&apos;s own wellness traditions, delivered with modern quality and care.
        </p>
      </Card>
    </div>
  );
}

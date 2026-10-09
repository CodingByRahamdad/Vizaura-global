import { Headset, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/ui/Container";

const ITEMS = [
  { icon: Truck, title: "Free Shipping", subtitle: "On orders above 10,000 PKR / 300 AED" },
  { icon: ShieldCheck, title: "Secure Payments", subtitle: "100% secure checkout" },
  { icon: RotateCcw, title: "Easy Returns", subtitle: "Hassle-free returns" },
  { icon: Headset, title: "24/7 Support", subtitle: "We're here to help" },
];

export function TrustBadges() {
  return (
    <Container className="my-8 md:my-10">
      <div className="rounded-lg bg-primary-light/20 px-4 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {ITEMS.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
              <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-text">{title}</p>
                <p className="text-xs text-text-secondary">{subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

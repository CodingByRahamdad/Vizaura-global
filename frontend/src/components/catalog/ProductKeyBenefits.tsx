import { Check, Leaf } from "lucide-react";

interface ProductKeyBenefitsProps {
  benefits: string[];
}

export function ProductKeyBenefits({ benefits }: ProductKeyBenefitsProps) {
  if (benefits.length === 0) return null;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4 rounded-lg bg-primary-light/30 p-5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Leaf className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <div>
        <h3 className="mb-3 font-serif text-lg font-semibold text-text">Key Benefits</h3>
        <ul className="flex flex-col gap-2">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

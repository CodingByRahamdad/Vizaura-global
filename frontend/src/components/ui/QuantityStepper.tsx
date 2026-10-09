import { Minus, Plus } from "lucide-react";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  label = "Quantity",
}: QuantityStepperProps) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="inline-flex items-center rounded-md border border-border" role="group" aria-label={label}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-9 w-9 items-center justify-center text-text transition-colors hover:bg-primary-light/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-8 text-center text-sm font-medium text-text" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || atMax}
        onClick={() => onChange(max !== undefined ? Math.min(value + 1, max) : value + 1)}
        className="flex h-9 w-9 items-center justify-center text-text transition-colors hover:bg-primary-light/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

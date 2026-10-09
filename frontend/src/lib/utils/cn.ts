import { twMerge } from "tailwind-merge";

type ClassValue = string | number | null | undefined | false | ClassValue[];

function flatten(input: ClassValue, out: string[]) {
  if (!input) return;
  if (Array.isArray(input)) {
    for (const item of input) flatten(item, out);
    return;
  }
  out.push(String(input));
}

/**
 * Joins conditional class names, skipping falsy values, then resolves
 * conflicting Tailwind utilities (e.g. a component's own "py-10" vs a
 * caller's "py-0") so the last one specified wins — plain string
 * concatenation left both classes in the DOM simultaneously with the
 * winner decided by Tailwind's build-time CSS order, not override intent.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  flatten(inputs, out);
  return twMerge(out.join(" "));
}

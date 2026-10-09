let counter = 0;

export function uniqueEmail(): string {
  counter += 1;
  return `test.user.${Date.now()}.${counter}@example.com`;
}

export const VALID_PASSWORD = "Correct-Horse-Battery-Staple-9";

export function registerPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: "Test",
    lastName: "User",
    email: uniqueEmail(),
    password: VALID_PASSWORD,
    captchaToken: "test-token",
    ...overrides,
  };
}

let catalogCounter = 0;

export function uniqueSlug(prefix = "item"): string {
  catalogCounter += 1;
  return `${prefix}-${Date.now()}-${catalogCounter}`;
}

export function uniqueSku(prefix = "SKU"): string {
  catalogCounter += 1;
  return `${prefix}-${Date.now()}-${catalogCounter}`;
}

export function categoryPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const slug = uniqueSlug("category");
  return {
    name: `Category ${slug}`,
    slug,
    ...overrides,
  };
}

export function productPayload(overrides: Partial<Record<string, unknown>> = {}) {
  const slug = uniqueSlug("product");
  return {
    name: `Product ${slug}`,
    slug,
    defaultVariant: { sku: uniqueSku(), title: "Default" },
    ...overrides,
  };
}

export function pricePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    amount: 499900,
    ...overrides,
  };
}

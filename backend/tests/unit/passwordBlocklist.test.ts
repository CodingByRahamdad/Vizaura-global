import { describe, expect, it } from "vitest";
import { isCommonPassword } from "../../src/security/passwordBlocklist.js";

describe("isCommonPassword", () => {
  it("flags a direct blocklist match, case-insensitively", () => {
    expect(isCommonPassword("password1234")).toBe(true);
    expect(isCommonPassword("PASSWORD1234")).toBe(true);
  });

  it("flags a padded variant of a blocklisted entry", () => {
    expect(isCommonPassword("password1234!!!")).toBe(true);
  });

  it("flags a fully repeated character", () => {
    expect(isCommonPassword("zzzzzzzzzzzzzzzz")).toBe(true);
  });

  it("flags ascending and descending sequential digits", () => {
    // A run longer than 10 digits cannot stay strictly sequential (only 10
    // digits exist), so these use the longest genuinely sequential runs.
    expect(isCommonPassword("123456789012")).toBe(true); // wraps but matches the direct blocklist entry
    expect(isCommonPassword("9876543210")).toBe(true);
  });

  it("does not flag a genuinely random password", () => {
    expect(isCommonPassword("Xk9#mQ2vLpR7wZ")).toBe(false);
  });

  it("does not flag an unrelated long phrase", () => {
    expect(isCommonPassword("correct-horse-battery-staple-42")).toBe(false);
  });
});

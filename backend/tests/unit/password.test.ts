import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  verifyDummyPassword,
  DUMMY_PASSWORD_HASH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "../../src/security/password.js";

describe("password policy", () => {
  it("rejects passwords shorter than the minimum", () => {
    const violation = validatePasswordPolicy("a".repeat(PASSWORD_MIN_LENGTH - 1));
    expect(violation?.code).toBe("too_short");
  });

  it("rejects passwords longer than the maximum", () => {
    const violation = validatePasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1));
    expect(violation?.code).toBe("too_long");
  });

  it("accepts a password at exactly the minimum length", () => {
    const password = "a".repeat(PASSWORD_MIN_LENGTH - 2) + "9Z"; // avoid repeated-char rule
    expect(validatePasswordPolicy(password)).toBeNull();
  });

  it("rejects common passwords", () => {
    const violation = validatePasswordPolicy("password1234");
    expect(violation?.code).toBe("common_password");
  });

  it("rejects padded variants of common passwords", () => {
    const violation = validatePasswordPolicy("Password1234!!");
    expect(violation?.code).toBe("common_password");
  });

  it("rejects a single repeated character", () => {
    const violation = validatePasswordPolicy("aaaaaaaaaaaaaaaa");
    expect(violation?.code).toBe("common_password");
  });

  it("rejects sequential digit runs", () => {
    const violation = validatePasswordPolicy("123456789012");
    expect(violation?.code).toBe("common_password");
  });

  it("accepts a genuinely random long password", () => {
    expect(validatePasswordPolicy("Tr0ub4dor&Zebra-Kite-42")).toBeNull();
  });
});

describe("argon2id hashing", () => {
  it("produces a hash that verifies against the original password", async () => {
    const hashed = await hashPassword("Correct-Horse-Battery-9");
    expect(hashed).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hashed, "Correct-Horse-Battery-9")).resolves.toBe(true);
  });

  it("rejects an incorrect password against a real hash", async () => {
    const hashed = await hashPassword("Correct-Horse-Battery-9");
    await expect(verifyPassword(hashed, "wrong-password-entirely")).resolves.toBe(false);
  });

  it("normalizes NFKC before hashing so equivalent forms match", async () => {
    // "é" as a single codepoint vs "e" + combining acute accent.
    const nfc = "café-Battery-Horse-99";
    const nfd = nfc.normalize("NFD");
    const hashed = await hashPassword(nfc);
    await expect(verifyPassword(hashed, nfd)).resolves.toBe(true);
  });
});

describe("dummy password verification (timing-safety)", () => {
  it("runs a real Argon2id verification without throwing", async () => {
    await expect(verifyDummyPassword("anything at all")).resolves.toBeUndefined();
  });

  it("the dummy hash is a validly-encoded argon2id hash", async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, "wrong")).resolves.toBe(false);
  });
});

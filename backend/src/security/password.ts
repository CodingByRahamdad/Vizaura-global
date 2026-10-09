import { hash, verify, Algorithm } from "@node-rs/argon2";
import { isCommonPassword } from "./passwordBlocklist.js";

// Approved parameters (docs/AUTH_SECURITY.md): OWASP baseline for Argon2id.
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
  saltLength: 16,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordPolicyViolation {
  code: "too_short" | "too_long" | "common_password";
  message: string;
}

/// Transport-layer length checks belong in the zod schema; this re-validates
/// length defensively and adds the checks that need application logic
/// (the common-password blocklist), since password rules are a security
/// control, not just a shape constraint.
export function validatePasswordPolicy(password: string): PasswordPolicyViolation | null {
  const normalised = password.normalize("NFKC");

  if (normalised.length < PASSWORD_MIN_LENGTH) {
    return { code: "too_short", message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (normalised.length > PASSWORD_MAX_LENGTH) {
    return { code: "too_long", message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  if (isCommonPassword(normalised)) {
    return { code: "common_password", message: "This password is too common. Please choose another." };
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const normalised = password.normalize("NFKC");
  return hash(normalised, ARGON2_OPTIONS);
}

export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
  const normalised = password.normalize("NFKC");
  return verify(hashedPassword, normalised, ARGON2_OPTIONS);
}

/// A fixed, precomputed hash used to run a real Argon2id verification against
/// unknown emails at login, so response timing does not reveal whether an
/// account exists. Precomputed (not hashed per-call) so its own cost doesn't
/// become a second timing signal.
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$VaGw9j30WlzL8uAn0X2yRQ$T+z2nQ3suqptd8Xtv9wfT/+cBNl43eLrFJgPVN7i+d0";

export async function verifyDummyPassword(password: string): Promise<void> {
  try {
    await verifyPassword(DUMMY_PASSWORD_HASH, password);
  } catch {
    // The dummy hash exists only to consume comparable CPU time; a
    // verification failure here is expected and must never surface.
  }
}

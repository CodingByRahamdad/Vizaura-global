import { randomBytes, createHash, randomUUID } from "node:crypto";

/// Generates a cryptographically random 256-bit token, base64url-encoded for
/// transport (in a cookie or email link). The raw value is never stored;
/// callers persist only `hashToken(raw)`.
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/// SHA-256 hex digest. Used for refresh tokens and single-use
/// verification/reset tokens alike — the raw value is never written to
/// PostgreSQL, only this hash (stored in a `CHAR(64)` column).
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function newSessionFamilyId(): string {
  return randomUUID();
}

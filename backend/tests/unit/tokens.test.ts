import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashToken, newSessionFamilyId } from "../../src/security/tokens.js";

describe("generateOpaqueToken", () => {
  it("produces distinct tokens across calls", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
  });

  it("encodes 256 bits (32 bytes) as base64url", () => {
    const token = generateOpaqueToken();
    // base64url of 32 bytes is 43 chars (no padding).
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces a 64-character lowercase hex digest (fits CHAR(64))", () => {
    const digest = hashToken("anything");
    expect(digest).toHaveLength(64);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different tokens hash to different digests", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("never stores the raw token: the digest does not contain the input", () => {
    const token = "super-secret-raw-refresh-token-value";
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("newSessionFamilyId", () => {
  it("produces a valid UUID", () => {
    const id = newSessionFamilyId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("produces distinct ids across calls", () => {
    expect(newSessionFamilyId()).not.toBe(newSessionFamilyId());
  });
});

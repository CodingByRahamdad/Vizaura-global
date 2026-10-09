import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NoopCaptchaVerifier } from "../../src/security/captcha/noop.provider.js";
import { TurnstileCaptchaVerifier } from "../../src/security/captcha/turnstile.provider.js";
import { env } from "../../src/config/env.js";

describe("NoopCaptchaVerifier", () => {
  it("always succeeds (development/test only)", async () => {
    const verifier = new NoopCaptchaVerifier();
    await expect(verifier.verify("any-token")).resolves.toEqual({ success: true });
  });
});

describe("TurnstileCaptchaVerifier", () => {
  const originalFetch = global.fetch;
  const originalSecret = env.captcha.turnstileSecretKey;

  beforeEach(() => {
    (env.captcha as { turnstileSecretKey?: string }).turnstileSecretKey = "test-secret-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (env.captcha as { turnstileSecretKey?: string }).turnstileSecretKey = originalSecret;
    vi.restoreAllMocks();
  });

  it("succeeds when Cloudflare reports success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    const verifier = new TurnstileCaptchaVerifier();
    await expect(verifier.verify("good-token")).resolves.toEqual({ success: true });
  });

  it("fails (not unavailable) when Cloudflare reports failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }) as unknown as typeof fetch;

    const verifier = new TurnstileCaptchaVerifier();
    const result = await verifier.verify("bad-token");
    expect(result.success).toBe(false);
    expect(result.unavailable).toBeFalsy();
  });

  it("fails CLOSED (unavailable) on a non-2xx response, after one retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const verifier = new TurnstileCaptchaVerifier();
    const result = await verifier.verify("token");
    expect(result.unavailable).toBe(true);
    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2); // one retry
  });

  it("fails CLOSED (unavailable) when the network call throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const verifier = new TurnstileCaptchaVerifier();
    const result = await verifier.verify("token");
    expect(result.unavailable).toBe(true);
    expect(result.success).toBe(false);
  });

  it("does not verify an empty token", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const verifier = new TurnstileCaptchaVerifier();
    const result = await verifier.verify("");
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws if TURNSTILE_SECRET_KEY is not configured", async () => {
    (env.captcha as { turnstileSecretKey?: string }).turnstileSecretKey = undefined;
    const verifier = new TurnstileCaptchaVerifier();
    await expect(verifier.verify("token")).rejects.toThrow(/TURNSTILE_SECRET_KEY/);
  });
});

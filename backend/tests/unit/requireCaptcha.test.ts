import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextFunction, Request, Response } from "express";

const verifyMock = vi.fn();

vi.mock("../../src/security/captcha/index.js", () => ({
  getCaptchaVerifier: () => ({ verify: verifyMock }),
}));

// Imported after the mock so requireCaptcha resolves the mocked verifier.
const { requireCaptcha } = await import("../../src/middleware/requireCaptcha.js");

function mockReq(body: Record<string, unknown>): Request {
  return { body, ip: "127.0.0.1" } as unknown as Request;
}

describe("requireCaptcha middleware", () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it("calls next() with no error when verification succeeds", async () => {
    verifyMock.mockResolvedValue({ success: true });
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha()(mockReq({ captchaToken: "good" }), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects with AUTH_CAPTCHA_REQUIRED when no token is present", async () => {
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha()(mockReq({}), {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].code).toBe("AUTH_CAPTCHA_REQUIRED");
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("rejects with AUTH_CAPTCHA_FAILED when verification returns success:false", async () => {
    verifyMock.mockResolvedValue({ success: false });
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha()(mockReq({ captchaToken: "bad" }), {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].code).toBe("AUTH_CAPTCHA_FAILED");
  });

  it("FAILS CLOSED with CAPTCHA_UNAVAILABLE when the provider is unreachable", async () => {
    verifyMock.mockResolvedValue({ success: false, unavailable: true });
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha()(mockReq({ captchaToken: "token" }), {} as Response, next);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0][0].code).toBe("CAPTCHA_UNAVAILABLE");
  });

  it("skips verification entirely when `when` returns false (conditional login CAPTCHA)", async () => {
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha({ when: () => false })(mockReq({}), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("enforces verification when `when` returns true", async () => {
    verifyMock.mockResolvedValue({ success: true });
    const next = vi.fn() as unknown as NextFunction;
    await requireCaptcha({ when: () => true })(mockReq({ captchaToken: "token" }), {} as Response, next);
    expect(verifyMock).toHaveBeenCalledWith("token", "127.0.0.1");
  });
});

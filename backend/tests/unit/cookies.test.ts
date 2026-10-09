import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  setAccessCookie,
  setRefreshCookie,
  clearAuthCookies,
  readAccessCookie,
  readRefreshCookie,
} from "../../src/security/cookies.js";

function mockResponse() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;
}

describe("cookie names (development/test environment)", () => {
  it("uses unprefixed names outside production", () => {
    expect(ACCESS_COOKIE_NAME).toBe("vz_at");
    expect(REFRESH_COOKIE_NAME).toBe("vz_rt");
  });
});

describe("setAccessCookie", () => {
  it("sets HttpOnly, SameSite=Lax, Path=/, no Domain, ~15 minute maxAge", () => {
    const res = mockResponse();
    setAccessCookie(res, "the-access-token");

    expect(res.cookie).toHaveBeenCalledWith(
      "vz_at",
      "the-access-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60 * 1000,
      }),
    );
    const [, , options] = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options).not.toHaveProperty("domain");
  });
});

describe("setRefreshCookie", () => {
  it("scopes the refresh cookie to /api/v1/auth with a 30-day maxAge", () => {
    const res = mockResponse();
    setRefreshCookie(res, "the-refresh-token");

    expect(res.cookie).toHaveBeenCalledWith(
      "vz_rt",
      "the-refresh-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/v1/auth",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      }),
    );
  });
});

describe("clearAuthCookies", () => {
  it("clears both cookies with matching attributes", () => {
    const res = mockResponse();
    clearAuthCookies(res);

    expect(res.clearCookie).toHaveBeenCalledWith("vz_at", expect.objectContaining({ path: "/" }));
    expect(res.clearCookie).toHaveBeenCalledWith(
      "vz_rt",
      expect.objectContaining({ path: "/api/v1/auth" }),
    );
  });
});

describe("reading cookies from a request", () => {
  it("reads the access and refresh cookie values", () => {
    const req = { cookies: { vz_at: "access-value", vz_rt: "refresh-value" } } as unknown as Parameters<
      typeof readAccessCookie
    >[0];
    expect(readAccessCookie(req)).toBe("access-value");
    expect(readRefreshCookie(req)).toBe("refresh-value");
  });

  it("returns undefined when cookies are absent", () => {
    const req = { cookies: {} } as unknown as Parameters<typeof readAccessCookie>[0];
    expect(readAccessCookie(req)).toBeUndefined();
    expect(readRefreshCookie(req)).toBeUndefined();
  });
});

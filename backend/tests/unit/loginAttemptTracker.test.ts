import { describe, expect, it } from "vitest";
import {
  recordLoginFailure,
  clearLoginFailures,
  isCaptchaRequiredForLogin,
} from "../../src/security/loginAttemptTracker.js";

describe("login attempt tracker", () => {
  const email = () => `tracker-${Math.random()}@example.com`;
  const ip = "203.0.113.1";

  it("does not require CAPTCHA before any failures", () => {
    expect(isCaptchaRequiredForLogin(email(), ip)).toBe(false);
  });

  it("does not require CAPTCHA after 1 or 2 failures", () => {
    const e = email();
    recordLoginFailure(e, ip);
    expect(isCaptchaRequiredForLogin(e, ip)).toBe(false);
    recordLoginFailure(e, ip);
    expect(isCaptchaRequiredForLogin(e, ip)).toBe(false);
  });

  it("requires CAPTCHA starting at the 3rd failure", () => {
    const e = email();
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    expect(isCaptchaRequiredForLogin(e, ip)).toBe(true);
  });

  it("clearing failures (a successful login) resets the requirement", () => {
    const e = email();
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    expect(isCaptchaRequiredForLogin(e, ip)).toBe(true);

    clearLoginFailures(e, ip);
    expect(isCaptchaRequiredForLogin(e, ip)).toBe(false);
  });

  it("tracks failures independently per email+IP pair", () => {
    const e = email();
    recordLoginFailure(e, "203.0.113.1");
    recordLoginFailure(e, "203.0.113.1");
    recordLoginFailure(e, "203.0.113.1");
    expect(isCaptchaRequiredForLogin(e, "203.0.113.2")).toBe(false);
  });

  it("is case-insensitive on email", () => {
    const e = `Mixed.Case.${Math.random()}@Example.com`;
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    recordLoginFailure(e, ip);
    expect(isCaptchaRequiredForLogin(e.toLowerCase(), ip)).toBe(true);
  });
});

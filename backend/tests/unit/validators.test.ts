import { describe, expect, it } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../../src/modules/auth/auth.validators.js";

describe("registerSchema", () => {
  const valid = {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "Ada.Lovelace@Example.com",
    password: "Correct-Horse-Battery-9",
    captchaToken: "token",
  };

  it("accepts a valid payload", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("normalizes email to trimmed lowercase", () => {
    const result = registerSchema.parse({ ...valid, email: "  Ada.Lovelace@Example.com  " });
    expect(result.email).toBe("ada.lovelace@example.com");
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a password shorter than the policy minimum", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects a missing captchaToken", () => {
    const { captchaToken, ...rest } = valid;
    void captchaToken;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an empty firstName", () => {
    expect(registerSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false);
  });

  it("accepts an optional phone number", () => {
    expect(registerSchema.safeParse({ ...valid, phone: "+92 300 1234567" }).success).toBe(true);
  });
});

describe("loginSchema", () => {
  it("accepts a payload with captchaToken", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
      captchaToken: "t",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing captchaToken", () => {
    expect(loginSchema.safeParse({ email: "user@example.com", password: "anything" }).success).toBe(false);
  });

  it("rejects a missing password", () => {
    expect(
      loginSchema.safeParse({ email: "user@example.com", captchaToken: "t" }).success,
    ).toBe(false);
  });
});

describe("forgotPasswordSchema / resetPasswordSchema", () => {
  it("forgotPassword requires email and captchaToken", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "user@example.com", captchaToken: "t" }).success,
    ).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(false);
  });

  it("resetPassword requires a policy-valid newPassword", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      newPassword: "short",
      captchaToken: "t",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts current + new password + captchaToken", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "whatever-current",
      newPassword: "Correct-Horse-Battery-9",
      captchaToken: "t",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing captchaToken", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "whatever-current",
      newPassword: "Correct-Horse-Battery-9",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a new password below the policy minimum", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "whatever-current",
      newPassword: "short",
      captchaToken: "t",
    });
    expect(result.success).toBe(false);
  });
});

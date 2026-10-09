import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "../../security/password.js";

// Transport-layer validation only (shape, type, length, format). Business
// rules (uniqueness, common-password check, token validity, current-password
// correctness) live in auth.service.ts. See docs/AUTH_SECURITY.md.

// Trim/lowercase BEFORE format validation — z.email() rejects surrounding
// whitespace outright, so normalizing has to happen first, not after.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(255));
const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const name = z.string().trim().min(1).max(100);
const captchaToken = z.string().min(1).max(4096);

export const registerSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  password,
  phone: z.string().trim().min(3).max(32).optional(),
  captchaToken,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  captchaToken,
});

export const refreshSchema = z.object({}).optional();

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(512),
});

export const forgotPasswordSchema = z.object({
  email,
  captchaToken,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: password,
  captchaToken,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: password,
  captchaToken,
});

export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newEmail: email,
  captchaToken,
});

// Self-service profile update — deliberately excludes email/password/
// status/role, which stay behind their own dedicated, verified flows.
export const updateProfileSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    phone: z.string().trim().min(3).max(32).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided." });

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

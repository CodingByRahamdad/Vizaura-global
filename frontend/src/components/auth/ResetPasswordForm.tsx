"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/api/auth";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

interface ResetPasswordFormProps {
  token: string | undefined;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  if (!token) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Invalid Reset Link</h2>
        <p className="text-sm text-text-secondary">
          This password reset link is missing or invalid. Please request a new one.
        </p>
        <Button href="/forgot-password">Request New Link</Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Password Reset</h2>
        <p className="text-sm text-text-secondary">
          Your password has been reset. Please sign in with your new password.
        </p>
        <Button href="/login">Sign In</Button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      // token is guaranteed defined here — the missing-token branch returns early above.
      await resetPassword({ token: token as string, newPassword: password, captchaToken });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && CAPTCHA_ERROR_CODES.has(err.code ?? "")) {
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
        setError(
          err.code === "CAPTCHA_UNAVAILABLE"
            ? "CAPTCHA verification is temporarily unavailable. Please try again."
            : "CAPTCHA verification failed. Please complete the checkbox again."
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-text">New Password</h2>
        <p className="text-sm text-text-secondary">
          Enter and confirm your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        <FormField
          label="New Password"
          htmlFor="password"
          required
          error={
            password.length > 0 && password.length < 8
              ? "Password must be at least 8 characters."
              : undefined
          }
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </FormField>
        <FormField label="Confirm Password" htmlFor="confirm-password" required>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </FormField>

        <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full"
        >
          Reset Password
        </Button>
      </form>
    </div>
  );
}

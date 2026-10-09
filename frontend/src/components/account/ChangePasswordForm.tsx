"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { changePassword } from "@/lib/api/auth";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

const CHANGE_PASSWORD_ERROR_MESSAGES: Partial<Record<string, string>> = {
  AUTH_INVALID_CREDENTIALS: "Your current password is incorrect.",
  AUTH_PASSWORD_REUSED: "Your new password must be different from your current password.",
};

export function ChangePasswordForm() {
  const { refreshSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, captchaToken });
      await refreshSession();
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCaptchaToken(null);
    } catch (err) {
      if (err instanceof ApiError && CAPTCHA_ERROR_CODES.has(err.code ?? "")) {
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
        setError(
          err.code === "CAPTCHA_UNAVAILABLE"
            ? "CAPTCHA verification is temporarily unavailable. Please try again."
            : "CAPTCHA verification failed. Please complete the checkbox again."
        );
      } else if (err instanceof ApiError) {
        setError(CHANGE_PASSWORD_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-4">
        <p className="text-sm font-medium text-success">Your password has been changed.</p>
        <Button size="sm" variant="outline" className="w-fit" onClick={() => setSuccess(false)}>
          Change Again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      <FormField label="Current Password" htmlFor="currentPassword" required>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </FormField>

      <FormField
        label="New Password"
        htmlFor="newPassword"
        required
        error={
          newPassword.length > 0 && newPassword.length < 8
            ? "Password must be at least 8 characters."
            : undefined
        }
      >
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </FormField>

      <FormField label="Confirm New Password" htmlFor="confirmNewPassword" required>
        <PasswordInput
          id="confirmNewPassword"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </FormField>

      <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

      <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} className="w-fit">
        Change Password
      </Button>
    </form>
  );
}

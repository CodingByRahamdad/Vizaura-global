"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { changeEmail } from "@/lib/api/auth";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

const CHANGE_EMAIL_ERROR_MESSAGES: Partial<Record<string, string>> = {
  AUTH_INVALID_CREDENTIALS: "Your current password is incorrect.",
  AUTH_EMAIL_ALREADY_IN_USE: "An account with this email already exists.",
  AUTH_EMAIL_UNCHANGED: "That is already your current email address.",
};

interface ChangeEmailFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChangeEmailForm({ onSuccess, onCancel }: ChangeEmailFormProps) {
  const { refreshSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changeEmail({ currentPassword, newEmail, captchaToken });
      await refreshSession();
      setSuccess(true);
      setCurrentPassword("");
      setNewEmail("");
      setCaptchaToken(null);
      onSuccess?.();
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
        setError(CHANGE_EMAIL_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
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
        <p className="text-sm font-medium text-success">Your email address has been updated.</p>
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

      <FormField label="New Email Address" htmlFor="newEmail" required>
        <Input
          id="newEmail"
          type="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </FormField>

      <FormField label="Current Password" htmlFor="currentEmailChangePassword" required>
        <PasswordInput
          id="currentEmailChangePassword"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </FormField>

      <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} className="w-fit">
          Change Email
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="w-fit" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

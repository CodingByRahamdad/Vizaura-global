"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/api/auth";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
      const result = await forgotPassword({ email, captchaToken });
      // The backend always returns the same generic message regardless of
      // whether the email exists (anti-enumeration) — shown verbatim.
      setMessage(result.message);
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

  if (message) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Check Your Email</h2>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-text">Reset Password</h2>
        <p className="text-sm text-text-secondary">
          We&apos;ll email you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}

        <FormField label="Email Address" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
          />
        </FormField>

        <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full"
        >
          Send Reset Link
        </Button>
      </form>
    </div>
  );
}

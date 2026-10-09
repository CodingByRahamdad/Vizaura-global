"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Recaptcha, type RecaptchaHandle } from "@/components/ui/Recaptcha";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { getMe, register } from "@/lib/api/auth";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

export function RegisterForm() {
  const router = useRouter();
  const { setSession } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<RecaptchaHandle>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!agreed) {
      setError("Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ firstName, lastName, email, password, captchaToken });

      // The backend intentionally returns an identical-shaped success response
      // whether or not the email was already registered (anti-enumeration —
      // see docs/CURRENT_TASK.md), so the only way to tell them apart is to
      // check whether a real session was actually created.
      const session = await getMe().catch(() => null);
      if (session) {
        setSession(session);
        router.push("/account");
      } else {
        setInfo(
          "If this email isn't already registered, your account has been created — check your inbox to verify it, then sign in."
        );
      }
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
        <h2 className="font-serif text-2xl font-semibold text-text">Create Your Account</h2>
        <p className="text-sm text-text-secondary">
          Join us and start your journey to better health and wellness.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {info}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="First Name" htmlFor="firstName" required>
            <Input
              id="firstName"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </FormField>
          <FormField label="Last Name" htmlFor="lastName" required>
            <Input
              id="lastName"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </FormField>
        </div>
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
        <FormField
          label="Password"
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
            placeholder="Create a password"
          />
        </FormField>

        <Checkbox
          id="terms"
          label="I agree to the Terms & Conditions and Privacy Policy."
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full"
        >
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  );
}

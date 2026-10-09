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
import { login } from "@/lib/api/auth";
import { hasAdminAccess } from "@/lib/authorization";

const CAPTCHA_ERROR_CODES = new Set(["AUTH_CAPTCHA_FAILED", "AUTH_CAPTCHA_REQUIRED", "CAPTCHA_UNAVAILABLE"]);

interface LoginFormProps {
  redirectTo?: string;
}

/** Same-origin relative path only — guards against an open redirect via a crafted ?redirect= value. */
function isSafeRedirect(path: string | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter();
  const { setSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      const session = await login({ email, password, captchaToken });
      setSession(session);
      // An explicit ?redirect= (cart/wishlist/checkout "sign in to continue"
      // flows) always wins. Otherwise send admin-capable accounts straight
      // to the admin area instead of the customer account — see LoginForm's
      // own bug history: this used to hardcode "/account" for everyone.
      router.push(
        isSafeRedirect(redirectTo) ? redirectTo : hasAdminAccess(session) ? "/admin/dashboard" : "/account"
      );
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
        <h2 className="font-serif text-2xl font-semibold text-text">Welcome Back</h2>
        <p className="text-sm text-text-secondary">
          Enter your details to sign in to your account.
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
            placeholder="Enter your email"
          />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </FormField>

        <div className="flex items-center justify-between">
          <Checkbox id="remember" label="Remember me" />
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Recaptcha ref={recaptchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          className="w-full"
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

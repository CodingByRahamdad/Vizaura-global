"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { verifyEmail, resendVerification } from "@/lib/api/auth";

interface VerifyEmailPanelProps {
  token: string | undefined;
}

type VerifyState = "loading" | "success" | "invalid" | "error";

export function VerifyEmailPanel({ token }: VerifyEmailPanelProps) {
  const { status, refreshSession } = useAuth();
  const [state, setState] = useState<VerifyState>("loading");
  const [attempt, setAttempt] = useState(0);
  const hasRun = useRef<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (!token) return;

    // One-shot per token+attempt. React Strict Mode double-invokes effects in
    // dev (mount -> cleanup -> mount); the second invoke hits this guard and
    // returns early, so the first invoke's in-flight request is the only one
    // that will ever resolve. It must therefore NOT be cancelled on cleanup —
    // doing so left the panel stuck on "Verifying Your Email..." forever even
    // though the backend had already returned { verified: true }. The token is
    // single-use, so re-issuing the call instead of keeping this one is not an
    // option either.
    const runKey = `${token}::${attempt}`;
    if (hasRun.current === runKey) return;
    hasRun.current = runKey;

    setState("loading");
    verifyEmail(token)
      .then(async () => {
        await refreshSession();
        setState("success");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.code === "AUTH_INVALID_VERIFICATION_TOKEN") {
          setState("invalid");
        } else {
          setState("error");
        }
      });
  }, [token, attempt, refreshSession]);

  async function handleResend() {
    setResendState("sending");
    try {
      await resendVerification();
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Invalid Verification Link</h2>
        <p className="text-sm text-text-secondary">
          This verification link is missing or invalid. Please request a new one from your account.
        </p>
        <Button href="/login">Log In</Button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Verifying Your Email…</h2>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Email Verified</h2>
        <p className="text-sm text-text-secondary">
          Your email is verified. You can now check out and track your orders.
        </p>
        <Button href="/account">Continue to Your Account</Button>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-2xl font-semibold text-text">Link Expired or Already Used</h2>
        <p className="text-sm text-text-secondary">
          This verification link is no longer valid. Please request a new one.
        </p>
        {status === "authenticated" ? (
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => void handleResend()}
              disabled={resendState === "sending" || resendState === "sent"}
              isLoading={resendState === "sending"}
            >
              {resendState === "sent" ? "Verification Email Sent" : "Resend Verification Email"}
            </Button>
            {resendState === "error" ? (
              <p role="alert" className="text-sm text-error">
                Couldn&apos;t send a new verification email. Please try again.
              </p>
            ) : null}
          </div>
        ) : (
          <Button href="/login">Log In to Resend</Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl font-semibold text-text">Something Went Wrong</h2>
      <p className="text-sm text-text-secondary">
        We couldn&apos;t verify your email right now. Please try again.
      </p>
      <Button
        onClick={() => setAttempt((n) => n + 1)}
      >
        Try Again
      </Button>
    </div>
  );
}

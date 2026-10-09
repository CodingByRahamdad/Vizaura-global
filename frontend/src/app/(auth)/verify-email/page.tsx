import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/AuthSplit";
import { VerifyEmailPanel } from "@/components/auth/VerifyEmailPanel";

export const metadata: Metadata = {
  title: "Verify Email — VIZAURA GLOBAL",
  description: "Verify your VIZAURA GLOBAL account email address.",
};

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <AuthSplit
      eyebrow="Account Verification"
      title="Verify Your Email"
      description="Confirm your email address to unlock checkout and order tracking."
    >
      <VerifyEmailPanel token={token} />
    </AuthSplit>
  );
}

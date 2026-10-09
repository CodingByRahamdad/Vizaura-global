import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/AuthSplit";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password — VIZAURA GLOBAL",
  description: "Set a new password for your VIZAURA GLOBAL account.",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <AuthSplit
      eyebrow="Account Recovery"
      title="Set a New Password"
      description="Choose a new password to secure your account."
    >
      <ResetPasswordForm token={token} />
    </AuthSplit>
  );
}

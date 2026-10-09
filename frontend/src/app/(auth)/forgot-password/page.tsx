import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/AuthSplit";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password — VIZAURA GLOBAL",
  description: "Reset your VIZAURA GLOBAL account password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthSplit
      eyebrow="Account Recovery"
      title="Forgot Your Password?"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <ForgotPasswordForm />
    </AuthSplit>
  );
}

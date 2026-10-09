import type { Metadata } from "next";
import { AuthSplit } from "@/components/layout/AuthSplit";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Create Account — VIZAURA GLOBAL",
  description: "Create a VIZAURA GLOBAL account.",
};

export default function RegisterPage() {
  return (
    <AuthSplit
      eyebrow="Create an Account"
      title="Join Vizaura Global"
      description="Be the first to know about new products, exclusive offers and health tips."
    >
      <RegisterForm />
    </AuthSplit>
  );
}

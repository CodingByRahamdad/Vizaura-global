import type { Metadata } from "next";
import { Truck, Heart, Star, UserCircle } from "lucide-react";
import { AuthSplit } from "@/components/layout/AuthSplit";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In — VIZAURA GLOBAL",
  description: "Sign in to your VIZAURA GLOBAL account.",
};

const LOGIN_FEATURES = [
  { icon: Truck, label: "Track Orders" },
  { icon: Heart, label: "Save Favorites" },
  { icon: Star, label: "Exclusive Offers" },
  { icon: UserCircle, label: "Manage Profile" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const redirect = typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <AuthSplit
      eyebrow="Welcome Back"
      title="Sign In to Your Account"
      description="Access your orders, save your favorites, get personalized recommendations, and enjoy a smoother shopping experience."
      features={LOGIN_FEATURES}
    >
      <LoginForm redirectTo={redirect} />
    </AuthSplit>
  );
}

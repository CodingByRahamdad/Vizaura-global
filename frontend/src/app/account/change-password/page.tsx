import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div>
      <h1 className="mb-2 font-serif text-2xl font-semibold text-text">Change Password</h1>
      <p className="mb-6 text-text-secondary">
        Use a strong password you don&apos;t use anywhere else.
      </p>
      <ChangePasswordForm />
    </div>
  );
}

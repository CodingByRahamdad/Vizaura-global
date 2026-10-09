"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChangeEmailForm } from "@/components/account/ChangeEmailForm";
import { ApiError } from "@/lib/api";
import { updateProfile } from "@/lib/api/auth";
import type { PublicUser } from "@/lib/types/auth";

interface AdminProfileFormProps {
  user: PublicUser;
}

/// Edits exactly the real User columns the backend's PATCH /auth/me accepts
/// (firstName/lastName/phone) — never email/password/status/role, which stay
/// behind their own dedicated, verified flows. No separate/disconnected
/// profile data structure: this is the same account GET /auth/me returns.
export function AdminProfileForm({ user }: AdminProfileFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
      });
      setSuccess(true);
      // Re-renders the server-fetched session (navbar greeting, profile
      // dropdown) so the update is visible immediately, not just on this form.
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First Name" htmlFor="firstName" required>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={100}
            />
          </FormField>
          <FormField label="Last Name" htmlFor="lastName" required>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={100}
            />
          </FormField>
        </div>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" value={user.email} disabled />
        </FormField>

        {error ? <p className="text-sm text-error">{error}</p> : null}
        {success ? <p className="text-sm text-accent-green">Profile updated.</p> : null}

        <div>
          <Button type="submit" isLoading={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-4">
        {isChangingEmail ? (
          <ChangeEmailForm
            onSuccess={() => {
              setIsChangingEmail(false);
              router.refresh();
            }}
            onCancel={() => setIsChangingEmail(false)}
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setIsChangingEmail(true)}>
            Change Email
          </Button>
        )}
      </div>
    </div>
  );
}

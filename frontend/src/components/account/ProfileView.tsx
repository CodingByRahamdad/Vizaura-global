"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(iso));
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text">{value}</span>
    </div>
  );
}

export function ProfileView() {
  const { status, user, refreshSession } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  if (status === "loading" || !user) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  function startEditing() {
    setFirstName(user!.firstName);
    setLastName(user!.lastName);
    setPhone(user!.phone ?? "");
    setError(null);
    setIsEditing(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined });
      await refreshSession();
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isEditing) {
    return (
      <Card>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <h2 className="font-serif text-lg text-text">Edit Profile</h2>
          {error ? <p className="text-sm text-error">{error}</p> : null}
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
          <div className="flex gap-3">
            <Button type="submit" isLoading={isSaving}>
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Field label="Full Name" value={`${user.firstName} ${user.lastName}`} />
        <Field label="Email" value={user.email} />
        <Field label="Phone" value={user.phone ?? "Not provided"} />
        <Field
          label="Email Verification"
          value={
            <Badge variant={user.emailVerified ? "success" : "warning"}>
              {user.emailVerified ? "Verified" : "Not Verified"}
            </Badge>
          }
        />
        <Field label="Member Since" value={formatDate(user.createdAt)} />
      </Card>
      <Button type="button" onClick={startEditing} className="self-start">
        Edit Profile
      </Button>
    </div>
  );
}

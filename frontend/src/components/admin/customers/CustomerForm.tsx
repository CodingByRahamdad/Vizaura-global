"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AdminFormSection } from "@/components/admin/AdminFormSection";
import { ApiError } from "@/lib/api";
import { createCustomer, updateCustomer } from "@/lib/api/admin/customers";
import { ADMIN_CUSTOMERS_ERROR_MESSAGES, type AdminCustomerDetail } from "@/lib/types/admin-customers";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: AdminCustomerDetail;
}

/**
 * Admin-created-customer (Phase 6M), extended with edit mode (Admin
 * Orders/Customers fixes phase) — same local-state-per-field, submit ->
 * client API call -> redirect pattern ProductForm already establishes.
 * Always assigns the customer role on create — there is no role field
 * anywhere in this form, so there is no way to create a super_admin
 * through it.
 */
export function CustomerForm({ mode, customer }: CustomerFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [addressLine1, setAddressLine1] = useState(customer?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(customer?.addressLine2 ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [region, setRegion] = useState(customer?.region ?? "");
  const [postalCode, setPostalCode] = useState(customer?.postalCode ?? "");
  const [countryCode, setCountryCode] = useState(customer?.countryCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if ((addressLine1.trim() || city.trim() || countryCode.trim()) && !(addressLine1.trim() && city.trim() && countryCode.trim())) {
      setError("Address line 1, city, and country code are required together when providing an address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const addressFields = {
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        region: region.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined,
      };

      if (mode === "create") {
        const created = await createCustomer({
          firstName,
          lastName,
          email,
          password,
          phone: phone || undefined,
          ...addressFields,
        });
        router.push(`/admin/customers/${created.id}`);
      } else {
        await updateCustomer(customer!.id, {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          ...addressFields,
        });
        router.push(`/admin/customers/${customer!.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ADMIN_CUSTOMERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message)
          : "Couldn't save this customer. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {error}
        </p>
      ) : null}

      <AdminFormSection title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First Name" htmlFor="firstName" required>
            <Input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label="Last Name" htmlFor="lastName" required>
            <Input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Email Address" htmlFor="email" required>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>

        <FormField label="Phone (optional)" htmlFor="phone">
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>

        {mode === "create" ? (
          <FormField
            label="Password"
            htmlFor="password"
            required
            error={password.length > 0 && password.length < 8 ? "Password must be at least 8 characters." : undefined}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
        ) : null}
      </AdminFormSection>

      <AdminFormSection title="Address" description="Optional — address line 1, city, and country code are required together if provided.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Address line 1" htmlFor="addressLine1">
            <Input id="addressLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} maxLength={255} />
          </FormField>
          <FormField label="Address line 2" htmlFor="addressLine2">
            <Input id="addressLine2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} maxLength={255} />
          </FormField>
          <FormField label="City" htmlFor="city">
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
          </FormField>
          <FormField label="Region/State" htmlFor="region">
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={100} />
          </FormField>
          <FormField label="Postal code" htmlFor="postalCode">
            <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={20} />
          </FormField>
          <FormField label="Country code (2 letters)" htmlFor="countryCode">
            <Input id="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} maxLength={2} />
          </FormField>
        </div>
      </AdminFormSection>

      {mode === "create" ? (
        <p className="text-xs text-text-secondary">
          This creates a regular customer account (never an administrator). The account is created active and
          verified immediately — no verification email is sent.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "Create Customer" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

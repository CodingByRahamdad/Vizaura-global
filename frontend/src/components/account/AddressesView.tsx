"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyAddresses, upsertBillingAddress, upsertShippingAddress } from "@/lib/api/addresses";
import { ApiError } from "@/lib/api";
import type { AddressesView as AddressesData, AddressView, UpsertAddressPayload } from "@/lib/types/addresses";

type AddressType = "billing" | "shipping";

const EMPTY_FORM: UpsertAddressPayload = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "",
};

function toForm(address: AddressView | null): UpsertAddressPayload {
  if (!address) return EMPTY_FORM;
  return {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    region: address.region ?? "",
    postalCode: address.postalCode ?? "",
    countryCode: address.countryCode,
  };
}

function AddressDisplay({ address }: { address: AddressView }) {
  return (
    <div className="text-sm text-text">
      <p className="font-medium">{address.fullName}</p>
      <p>{address.line1}</p>
      {address.line2 ? <p>{address.line2}</p> : null}
      <p>
        {address.city}
        {address.region ? `, ${address.region}` : ""} {address.postalCode ?? ""}
      </p>
      <p>{address.countryCode}</p>
      <p className="mt-1 text-text-secondary">{address.phone}</p>
    </div>
  );
}

function AddressForm({
  initial,
  onCancel,
  onSave,
  isSaving,
}: {
  initial: UpsertAddressPayload;
  onCancel: () => void;
  onSave: (payload: UpsertAddressPayload) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof UpsertAddressPayload>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.countryCode.trim().length !== 2) {
      setError("Country code must be 2 letters (e.g. PK).");
      return;
    }
    setError(null);
    try {
      await onSave({
        ...form,
        countryCode: form.countryCode.trim().toUpperCase(),
        line2: form.line2?.trim() || undefined,
        region: form.region?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this address. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Full Name" htmlFor="fullName" required className="sm:col-span-2">
          <Input id="fullName" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
        </FormField>
        <FormField label="Phone" htmlFor="phone" required>
          <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
        </FormField>
        <FormField label="Country Code" htmlFor="countryCode" required>
          <Input
            id="countryCode"
            maxLength={2}
            placeholder="PK"
            value={form.countryCode}
            onChange={(e) => update("countryCode", e.target.value.toUpperCase())}
            required
          />
        </FormField>
        <FormField label="Address Line 1" htmlFor="line1" required className="sm:col-span-2">
          <Input id="line1" value={form.line1} onChange={(e) => update("line1", e.target.value)} required />
        </FormField>
        <FormField label="Address Line 2" htmlFor="line2" className="sm:col-span-2">
          <Input id="line2" value={form.line2 ?? ""} onChange={(e) => update("line2", e.target.value)} />
        </FormField>
        <FormField label="City" htmlFor="city" required>
          <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} required />
        </FormField>
        <FormField label="Region / Province" htmlFor="region">
          <Input id="region" value={form.region ?? ""} onChange={(e) => update("region", e.target.value)} />
        </FormField>
        <FormField label="Postal Code" htmlFor="postalCode">
          <Input id="postalCode" value={form.postalCode ?? ""} onChange={(e) => update("postalCode", e.target.value)} />
        </FormField>
      </div>
      <div className="flex gap-3">
        <Button type="submit" isLoading={isSaving}>
          Save Address
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddressSection({
  title,
  address,
  isSaving,
  onSave,
}: {
  title: string;
  address: AddressView | null;
  isSaving: boolean;
  onSave: (payload: UpsertAddressPayload) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Card>
      <h2 className="mb-4 font-serif text-lg text-text">{title}</h2>
      {isEditing ? (
        <AddressForm
          initial={toForm(address)}
          isSaving={isSaving}
          onCancel={() => setIsEditing(false)}
          onSave={async (payload) => {
            await onSave(payload);
            setIsEditing(false);
          }}
        />
      ) : address ? (
        <div className="flex flex-col gap-4">
          <AddressDisplay address={address} />
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        </div>
      ) : (
        <EmptyState
          icon={<MapPin className="h-6 w-6" aria-hidden />}
          title={`No ${title.toLowerCase()} saved`}
          description={`Add your ${title.toLowerCase()} so it's ready to use at checkout.`}
          action={
            <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
              Add Address
            </Button>
          }
        />
      )}
    </Card>
  );
}

export function AddressesView() {
  const [addresses, setAddresses] = useState<AddressesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<AddressType | null>(null);

  // No synchronous setState before the fetch (react-hooks/set-state-in-effect)
  // — mirrors AccountDashboard.tsx's fetchOrders/load split.
  const fetchAddresses = useCallback(() => {
    getMyAddresses()
      .then((data) => {
        setAddresses(data);
        setError(null);
      })
      .catch(() => setError("Couldn't load your saved addresses."));
  }, []);

  useEffect(fetchAddresses, [fetchAddresses]);

  async function handleSave(type: AddressType, payload: UpsertAddressPayload) {
    setIsSaving(type);
    try {
      const updated = type === "billing" ? await upsertBillingAddress(payload) : await upsertShippingAddress(payload);
      setAddresses((prev) => (prev ? { ...prev, [type]: updated } : prev));
    } finally {
      setIsSaving(null);
    }
  }

  if (error && !addresses) {
    return <ErrorState message={error} onRetry={fetchAddresses} />;
  }

  if (!addresses) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AddressSection
        title="Billing Address"
        address={addresses.billing}
        isSaving={isSaving === "billing"}
        onSave={(payload) => handleSave("billing", payload)}
      />
      <AddressSection
        title="Shipping Address"
        address={addresses.shipping}
        isSaving={isSaving === "shipping"}
        onSave={(payload) => handleSave("shipping", payload)}
      />
    </div>
  );
}

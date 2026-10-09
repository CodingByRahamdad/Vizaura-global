"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { updateCustomerStatus } from "@/lib/api/admin/customers";
import { ADMIN_CUSTOMERS_ERROR_MESSAGES } from "@/lib/types/admin-customers";
import type { UserStatus } from "@/lib/types/admin-users";

interface CustomerStatusActionsProps {
  customerId: string;
  status: UserStatus;
  canManage: boolean;
}

/**
 * Same suspend/reactivate semantics as UserStatusActions
 * (components/admin/users/UserStatusActions.tsx), a separate component only
 * because it calls the customers:*-gated endpoint instead of users:*. No
 * self-protection branch needed here — a super_admin account is unreachable
 * through this customer-scoped surface in the first place (404 server-side).
 */
export function CustomerStatusActions({ customerId, status, canManage }: CustomerStatusActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;
  const target: UserStatus | null = status === "SUSPENDED" ? "ACTIVE" : status === "DEACTIVATED" ? null : "SUSPENDED";
  if (!target) return null;
  const isSuspending = target === "SUSPENDED";

  async function confirm() {
    if (!target || (target !== "ACTIVE" && target !== "SUSPENDED")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCustomerStatus(customerId, target);
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (ADMIN_CUSTOMERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message)
          : "Couldn't update this account's status. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? (
        <p role="alert" className="max-w-xs text-right text-sm text-error">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className={isSuspending ? "text-error" : undefined}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {isSuspending ? "Mark inactive" : "Mark active"}
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title={isSuspending ? "Mark this account inactive?" : "Mark this account active?"}
        description={
          isSuspending
            ? "This immediately ends the account's active session and blocks sign-in until marked active again."
            : "This allows the account to sign in again."
        }
        confirmLabel={isSuspending ? "Mark inactive" : "Mark active"}
        destructive={isSuspending}
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

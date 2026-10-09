"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { updateUserStatus } from "@/lib/api/admin/users";
import { ADMIN_USERS_ERROR_MESSAGES, type UserStatus } from "@/lib/types/admin-users";

interface UserStatusActionsProps {
  userId: string;
  status: UserStatus;
  canManage: boolean;
}

/**
 * Suspend is offered from ACTIVE or PENDING_VERIFICATION; Reactivate only
 * from SUSPENDED — mirrors users.service.ts's SUSPENDABLE_FROM exactly.
 * DEACTIVATED offers no action (no account-deletion feature exists). Self-
 * suspension and suspending the last active super_admin are both rejected
 * server-side (409); this component is never rendered for the caller's own
 * account (see the detail page).
 */
export function UserStatusActions({ userId, status, canManage }: UserStatusActionsProps) {
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
      await updateUserStatus(userId, target);
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? (ADMIN_USERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message) : "Couldn't update this account's status. Please try again.");
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
        {isSuspending ? "Suspend account" : "Reactivate account"}
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title={isSuspending ? "Suspend this account?" : "Reactivate this account?"}
        description={
          isSuspending
            ? "This immediately ends the account's active session and blocks sign-in until reactivated."
            : "This allows the account to sign in again."
        }
        confirmLabel={isSuspending ? "Suspend" : "Reactivate"}
        destructive={isSuspending}
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

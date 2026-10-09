"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { updateUserRole } from "@/lib/api/admin/users";
import { ADMIN_USERS_ERROR_MESSAGES, type RoleKey } from "@/lib/types/admin-users";

interface UserRoleActionsProps {
  userId: string;
  currentRole: RoleKey | null;
  canAssign: boolean;
}

/**
 * Only one action is ever offered — promote a customer, or demote a
 * super_admin — since exactly two roles exist. Self-modification and
 * demoting the last super_admin are both rejected server-side (409); this
 * button is simply never rendered at all for the caller's own account (see
 * the detail page), so the self case is UX-invisible rather than merely
 * disabled.
 */
export function UserRoleActions({ userId, currentRole, canAssign }: UserRoleActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canAssign || !currentRole) return null;

  const target: RoleKey = currentRole === "super_admin" ? "customer" : "super_admin";
  const isPromotion = target === "super_admin";

  async function confirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      await updateUserRole(userId, target);
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? (ADMIN_USERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message) : "Couldn't change this account's role. Please try again.");
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
        className={!isPromotion ? "text-error" : undefined}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {isPromotion ? "Promote to Super Admin" : "Demote to Customer"}
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title={isPromotion ? "Promote this account to Super Admin?" : "Demote this account to Customer?"}
        description={
          isPromotion
            ? "This grants every administrative permission the store has."
            : "This immediately removes every administrative permission from this account."
        }
        confirmLabel={isPromotion ? "Promote" : "Demote"}
        destructive={!isPromotion}
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

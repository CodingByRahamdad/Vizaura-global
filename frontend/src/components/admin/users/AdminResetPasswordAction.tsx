"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ApiError } from "@/lib/api";
import { initiateUserPasswordReset } from "@/lib/api/admin/users";
import { ADMIN_USERS_ERROR_MESSAGES } from "@/lib/types/admin-users";

interface AdminResetPasswordActionProps {
  userId: string;
  canManage: boolean;
}

/**
 * Triggers the same forgotPassword email flow a self-service click would —
 * no password is ever generated, seen, or set here. No page data changes on
 * success, so no router.refresh(); a success banner replaces the button.
 */
export function AdminResetPasswordAction({ userId, canManage }: AdminResetPasswordActionProps) {
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function confirm() {
    setIsSubmitting(true);
    setError(null);
    try {
      await initiateUserPasswordReset(userId);
      setConfirming(false);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? (ADMIN_USERS_ERROR_MESSAGES[err.code ?? ""] ?? err.message) : "Couldn't send a reset email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return <p className="text-sm text-success">Password reset email sent.</p>;
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
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Send password reset email
      </Button>

      <AdminConfirmDialog
        open={confirming}
        title="Send a password reset email?"
        description="The account holder will receive an email with a link to set a new password. No password is set here."
        confirmLabel="Send"
        isSubmitting={isSubmitting}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

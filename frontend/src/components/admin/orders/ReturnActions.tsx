"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { approveReturn, receiveReturn, refundReturn, rejectReturn } from "@/lib/api/admin/returns";
import type { AdminOrderReturn } from "@/lib/types/admin-orders";
import { RETURNS_ERROR_MESSAGES } from "@/lib/types/admin-orders";

type ReturnActionKind = "approve" | "reject" | "receive" | "refund";

interface ReturnActionsProps {
  returnRecord: AdminOrderReturn;
  canUpdate: boolean;
}

const NEXT_ACTIONS: Partial<Record<AdminOrderReturn["status"], { kind: ReturnActionKind; label: string }[]>> = {
  REQUESTED: [
    { kind: "approve", label: "Approve" },
    { kind: "reject", label: "Reject" },
  ],
  APPROVED: [{ kind: "receive", label: "Mark received" }],
  RECEIVED: [{ kind: "refund", label: "Refund" }],
};

/** Buttons are a display-only read of the return's status; the backend owns the REQUESTED→APPROVED/REJECTED→RECEIVED→REFUNDED state machine. */
export function ReturnActions({ returnRecord, canUpdate }: ReturnActionsProps) {
  const router = useRouter();
  const [target, setTarget] = useState<ReturnActionKind | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUpdate) return null;

  const options = NEXT_ACTIONS[returnRecord.status] ?? [];
  if (options.length === 0) return null;

  function close() {
    setTarget(null);
    setRejectionReason("");
    setError(null);
  }

  async function confirm() {
    if (!target) return;
    setIsSubmitting(true);
    setError(null);
    try {
      switch (target) {
        case "approve":
          await approveReturn(returnRecord.id);
          break;
        case "reject":
          await rejectReturn(returnRecord.id, rejectionReason.trim());
          break;
        case "receive":
          await receiveReturn(returnRecord.id);
          break;
        case "refund":
          await refundReturn(returnRecord.id);
          break;
      }
      close();
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(RETURNS_ERROR_MESSAGES[err.code ?? ""] ?? err.message);
        if (err.status === 409 || err.status === 422) router.refresh();
      } else {
        setError("Couldn't complete this action. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const titles: Record<ReturnActionKind, string> = {
    approve: "Approve this return?",
    reject: "Reject this return?",
    receive: "Mark this return as received?",
    refund: "Refund this return?",
  };

  const descriptions: Record<ReturnActionKind, string> = {
    approve: "The customer can then send the item back.",
    reject: "The customer will see the reason you provide below.",
    receive: "This restocks inventory for the returned item(s).",
    refund: "This refunds the customer via the order's payment.",
  };

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {options.map((action) => (
        <Button
          key={action.kind}
          size="sm"
          variant={action.kind === "reject" ? "outline" : "primary"}
          className={action.kind === "reject" ? "border-error text-error" : undefined}
          onClick={() => {
            setError(null);
            setTarget(action.kind);
          }}
        >
          {action.label}
        </Button>
      ))}

      {target ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="return-dialog-title" className="w-full max-w-md rounded-lg bg-surface p-6 shadow-lg">
            <h2 id="return-dialog-title" className="text-lg font-semibold text-text">
              {titles[target]}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">{descriptions[target]}</p>

            {target === "reject" ? (
              <>
                <label className="mt-4 block text-sm font-medium text-text" htmlFor="return-rejection-reason">
                  Reason
                </label>
                <textarea
                  id="return-rejection-reason"
                  value={rejectionReason}
                  maxLength={255}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm text-text"
                />
              </>
            ) : null}

            {error ? (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={close} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                size="sm"
                variant={target === "reject" ? "primary" : "secondary"}
                className={target === "reject" ? "bg-error hover:bg-error/90" : undefined}
                onClick={confirm}
                isLoading={isSubmitting}
                disabled={target === "reject" && rejectionReason.trim().length === 0}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

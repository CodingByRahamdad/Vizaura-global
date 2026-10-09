import type { Payment } from "../../generated/prisma/client.js";
import type { PaymentWithTransactions } from "./payments.repository.js";

export interface PaymentSummaryView {
  id: string;
  orderId: string;
  provider: string;
  method: string;
  status: string;
  amount: number;
  currencyCode: string;
  createdAt: string;
}

export interface PaymentTransactionView {
  id: string;
  type: string;
  status: string;
  amount: number;
  providerReference: string | null;
  createdAt: string;
}

export interface PaymentDetailView extends PaymentSummaryView {
  providerPaymentId: string | null;
  paidAt: string | null;
  transactions: PaymentTransactionView[];
}

export function toPaymentSummaryView(payment: Payment): PaymentSummaryView {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    currencyCode: payment.currencyCode,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function toPaymentDetailView(payment: PaymentWithTransactions): PaymentDetailView {
  return {
    ...toPaymentSummaryView(payment),
    providerPaymentId: payment.providerPaymentId,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    transactions: payment.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount,
      providerReference: t.providerReference,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

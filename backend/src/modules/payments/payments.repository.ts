import type {
  OrderPaymentStatus,
  Payment,
  PaymentTransaction,
  PaymentTransactionType,
  Prisma,
  PrismaClient,
} from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";
import { isUniqueConstraintViolation } from "./prismaErrors.js";

export type PaymentWithTransactions = Payment & { transactions: PaymentTransaction[] };

const paymentWithTransactionsInclude = {
  transactions: { orderBy: { createdAt: "asc" as const } },
};

export interface AdminPaymentFilters {
  status?: OrderPaymentStatus;
  provider?: string;
  orderId?: string;
}

const listOrderBy: Prisma.PaymentOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export class PaymentsRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findById(id: string): Promise<PaymentWithTransactions | null> {
    return this.prisma.payment.findUnique({ where: { id }, include: paymentWithTransactionsInclude });
  }

  async findByOrderId(orderId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({ where: { orderId }, orderBy: listOrderBy });
  }

  /// The one Payment row (if any) currently AUTHORIZED/PAID for an order —
  /// backs the same invariant the hand-added partial unique index enforces
  /// at the DB level (payments_orderId_active_unique).
  async findActiveByOrderId(orderId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({ where: { orderId, status: { in: ["AUTHORIZED", "PAID"] } } });
  }

  async findByProviderPaymentId(provider: string, providerPaymentId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({ where: { provider, providerPaymentId } });
  }

  async listAdmin(
    filters: AdminPaymentFilters,
    skip: number,
    take: number,
  ): Promise<{ payments: Payment[]; total: number }> {
    const where: Prisma.PaymentWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.provider) where.provider = filters.provider;
    if (filters.orderId) where.orderId = filters.orderId;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({ where, orderBy: listOrderBy, skip, take }),
      this.prisma.payment.count({ where }),
    ]);
    return { payments, total };
  }

  /// Guarded UPDATE — same template as OrdersRepository.transitionStatus.
  /// Returns `null` on 0 rows (a concurrent request already moved this
  /// payment away from expectedCurrentStatus); the caller decides what that
  /// means (re-fetch-and-compare for a webhook, 409 for an HTTP caller).
  async updateStatus(
    paymentId: string,
    expectedCurrentStatus: OrderPaymentStatus,
    newStatus: OrderPaymentStatus,
    extra: { providerPaymentId?: string; paidAt?: Date } = {},
  ): Promise<PaymentWithTransactions | null> {
    return this.prisma.$transaction(async (tx) => {
      const guarded = await tx.$queryRaw<{ id: string }[]>`
        UPDATE payments SET
          status = ${newStatus}::"OrderPaymentStatus",
          "providerPaymentId" = COALESCE(${extra.providerPaymentId ?? null}, "providerPaymentId"),
          "paidAt" = COALESCE(${extra.paidAt ?? null}, "paidAt"),
          "updatedAt" = now()
        WHERE id = ${paymentId}::uuid AND status = ${expectedCurrentStatus}::"OrderPaymentStatus"
        RETURNING id
      `;
      if (guarded.length === 0) return null;
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentWithTransactionsInclude });
    });
  }

  async createTransaction(params: {
    paymentId: string;
    type: PaymentTransactionType;
    status: OrderPaymentStatus;
    amount: number;
    providerReference?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<PaymentTransaction> {
    return this.prisma.paymentTransaction.create({
      data: {
        paymentId: params.paymentId,
        type: params.type,
        status: params.status,
        amount: params.amount,
        providerReference: params.providerReference,
        metadata: params.metadata,
      },
    });
  }

  /// The unique constraint on (provider, eventId) IS the webhook-idempotency
  /// mechanism — a caught unique-violation on this insert (narrowed to P2002
  /// on `eventId`, see prismaErrors.ts) means a duplicate delivery, not an
  /// error; anything else propagates. Used only for the early-return paths
  /// (unmatched payment / mismatched order) in processWebhook, where there is
  /// no further state to keep atomic with the event record — see
  /// applyWebhookEvent for the path that does mutate Payment state.
  async recordWebhookEventStandalone(provider: string, eventId: string): Promise<void> {
    try {
      await this.prisma.paymentWebhookEvent.create({ data: { provider, eventId } });
    } catch (error) {
      if (isUniqueConstraintViolation(error, "eventId")) return;
      throw error;
    }
  }

  /// Records the webhook event AND applies its resulting Payment status
  /// change in one transaction, so a crash between the two can never leave
  /// the event marked "received" while the status change it represents was
  /// never applied (a retry with the same eventId would otherwise silently
  /// no-op forever against recordWebhookEventStandalone's idempotency check,
  /// permanently losing the update). A duplicate-eventId insert aborts the
  /// whole transaction — nothing else here can have applied either.
  async applyWebhookEvent(params: {
    provider: string;
    eventId: string;
    paymentId: string;
    expectedCurrentStatus: OrderPaymentStatus;
    newStatus: OrderPaymentStatus;
    providerPaymentId?: string;
    paidAt?: Date;
    transaction: {
      type: PaymentTransactionType;
      status: OrderPaymentStatus;
      amount: number;
      providerReference?: string;
      metadata?: Prisma.InputJsonValue;
    };
  }): Promise<
    | { kind: "duplicate" }
    | { kind: "lost-race" }
    | { kind: "applied"; payment: PaymentWithTransactions }
  > {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.create({ data: { provider: params.provider, eventId: params.eventId } });

        const guarded = await tx.$queryRaw<{ id: string }[]>`
          UPDATE payments SET
            status = ${params.newStatus}::"OrderPaymentStatus",
            "providerPaymentId" = COALESCE(${params.providerPaymentId ?? null}, "providerPaymentId"),
            "paidAt" = COALESCE(${params.paidAt ?? null}, "paidAt"),
            "updatedAt" = now()
          WHERE id = ${params.paymentId}::uuid AND status = ${params.expectedCurrentStatus}::"OrderPaymentStatus"
          RETURNING id
        `;
        if (guarded.length === 0) return { kind: "lost-race" as const };

        await tx.paymentTransaction.create({
          data: {
            paymentId: params.paymentId,
            type: params.transaction.type,
            status: params.transaction.status,
            amount: params.transaction.amount,
            providerReference: params.transaction.providerReference,
            metadata: params.transaction.metadata,
          },
        });

        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: params.paymentId },
          include: paymentWithTransactionsInclude,
        });
        return { kind: "applied" as const, payment };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error, "eventId")) return { kind: "duplicate" };
      throw error;
    }
  }

  /// Locks the Payment row for the duration of the refund decision + provider
  /// call + write, serializing concurrent refund requests against the same
  /// payment so only the lock-winner ever calls the provider or writes a
  /// REFUND transaction — closes the race where two concurrent requests could
  /// both read the same "remaining" amount, both pass the over-refund check,
  /// and both call the provider before either write landed.
  async refundLocked(
    paymentId: string,
    amountOverride: number | undefined,
    callProvider: (
      payment: PaymentWithTransactions,
      requestedAmount: number,
    ) => Promise<{ status: OrderPaymentStatus; providerReference?: string }>,
    metadata?: Prisma.InputJsonValue,
  ): Promise<
    | { kind: "not-found" }
    | { kind: "already-refunded"; payment: PaymentWithTransactions }
    | { kind: "invalid-status"; payment: PaymentWithTransactions }
    | { kind: "exceeds-captured"; payment: PaymentWithTransactions }
    | { kind: "applied"; payment: PaymentWithTransactions; newStatus: OrderPaymentStatus }
  > {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) return { kind: "not-found" as const };

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: paymentWithTransactionsInclude,
      });

      if (payment.status === "REFUNDED") return { kind: "already-refunded" as const, payment };
      if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
        return { kind: "invalid-status" as const, payment };
      }

      const refundedSoFar = payment.transactions
        .filter((t) => t.type === "REFUND")
        .reduce((sum, t) => sum + t.amount, 0);
      const remaining = payment.amount - refundedSoFar;
      const requestedAmount = amountOverride ?? remaining;
      if (requestedAmount > remaining) return { kind: "exceeds-captured" as const, payment };

      const result = await callProvider(payment, requestedAmount);

      const newStatus: OrderPaymentStatus =
        refundedSoFar + requestedAmount >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";

      await tx.$executeRaw`
        UPDATE payments SET status = ${newStatus}::"OrderPaymentStatus", "updatedAt" = now()
        WHERE id = ${paymentId}::uuid
      `;
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          type: "REFUND",
          status: result.status,
          amount: requestedAmount,
          providerReference: result.providerReference,
          metadata,
        },
      });

      const updated = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: paymentWithTransactionsInclude,
      });
      return { kind: "applied" as const, payment: updated, newStatus };
    });
  }
}

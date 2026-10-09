-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('AUTHORIZATION', 'CAPTURE', 'REFUND', 'VOID');

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "method" VARCHAR(32) NOT NULL,
    "status" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "providerPaymentId" VARCHAR(255),
    "idempotencyKey" VARCHAR(255) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "type" "PaymentTransactionType" NOT NULL,
    "status" "OrderPaymentStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "providerReference" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "eventId" VARCHAR(255) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_paymentId_idx" ON "payment_transactions"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_provider_eventId_key" ON "payment_webhook_events"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-added (Prisma has no partial-index syntax) — same judgment call as
-- cart_items_quantity_positive: only one Payment per Order may be
-- AUTHORIZED/PAID at a time, enforced at the database level as
-- defense-in-depth alongside the service-layer guarded-update logic
-- (payments.repository.ts). PENDING/FAILED/CANCELLED attempts are
-- unconstrained, so a customer can retry payment after a failed attempt.
CREATE UNIQUE INDEX "payments_orderId_active_unique" ON "payments" ("orderId") WHERE "status" IN ('AUTHORIZED', 'PAID');

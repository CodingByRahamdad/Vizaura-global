-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('BILLING', 'SHIPPING');

-- CreateEnum
CREATE TYPE "customer_notification_type" AS ENUM ('ORDER_STATUS_CHANGED', 'PROMOTION');

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "address_type" NOT NULL,
    "fullName" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "line1" VARCHAR(255) NOT NULL,
    "line2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "region" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "countryCode" CHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "customer_notification_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "entityType" VARCHAR(50),
    "entityId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "addresses_userId_type_key" ON "addresses"("userId", "type");

-- CreateIndex
CREATE INDEX "customer_notifications_userId_createdAt_idx" ON "customer_notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_notifications_userId_isRead_idx" ON "customer_notifications"("userId", "isRead");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

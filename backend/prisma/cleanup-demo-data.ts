import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// One-off maintenance script: wipes demo data before go-live. Deletes every
// Order (and its Return/Payment/Shipment dependents) and every User except
// the super_admin account(s) — including any orders the super_admin itself
// placed. Never wired into db:seed/migrate/install; run explicitly.
//
// Dry run by default (prints counts only). Pass --confirm to actually delete.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const confirmed = process.argv.includes("--confirm");

  const superAdminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  if (!superAdminRole) {
    console.error('The "super_admin" role does not exist — run `npm run db:seed` first.');
    process.exitCode = 1;
    return;
  }

  const superAdminUserRoles = await prisma.userRole.findMany({
    where: { roleId: superAdminRole.id },
    select: { userId: true },
  });
  const superAdminUserIds = superAdminUserRoles.map((userRole) => userRole.userId);
  if (superAdminUserIds.length === 0) {
    console.error("No super_admin user found — refusing to proceed (would delete every user).");
    process.exitCode = 1;
    return;
  }

  const [orderCount, returnCount, paymentCount, shipmentCount, userCount] = await Promise.all([
    prisma.order.count(),
    prisma.return.count(),
    prisma.payment.count(),
    prisma.shipment.count(),
    prisma.user.count({ where: { id: { notIn: superAdminUserIds } } }),
  ]);

  console.log("Cleanup target counts:");
  console.log(`  Orders:   ${orderCount}`);
  console.log(`  Returns:  ${returnCount}`);
  console.log(`  Payments: ${paymentCount}`);
  console.log(`  Shipments:${shipmentCount}`);
  console.log(`  Users (excluding ${superAdminUserIds.length} super_admin): ${userCount}`);

  if (!confirmed) {
    console.log("\nDry run only — no data was deleted. Re-run with --confirm to execute.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Return and Payment/Shipment use onDelete: Restrict on their orderId FK,
    // so they must be deleted explicitly before the Order rows themselves.
    // ReturnItem/PaymentTransaction/OrderItem/OrderAddress/OrderStatusHistory
    // are Cascade and are removed automatically.
    await tx.return.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.shipment.deleteMany({});
    await tx.order.deleteMany({});

    // Order.userId and Return.requestedByUserId are Restrict, so users can
    // only be deleted after the above. Every other relation into User is
    // Cascade or SetNull (Session, tokens, UserRole, Cart, Wishlist, Address,
    // NotificationRead, CustomerNotification cascade; AuditLog.userId,
    // Review.userId, StockMovement.createdByUserId are set null).
    await tx.user.deleteMany({ where: { id: { notIn: superAdminUserIds } } });
  });

  const [remainingOrders, remainingReturns, remainingPayments, remainingShipments, remainingUsers] =
    await Promise.all([
      prisma.order.count(),
      prisma.return.count(),
      prisma.payment.count(),
      prisma.shipment.count(),
      prisma.user.count(),
    ]);

  console.log("\nDone. Remaining counts:");
  console.log(`  Orders:   ${remainingOrders}`);
  console.log(`  Returns:  ${remainingReturns}`);
  console.log(`  Payments: ${remainingPayments}`);
  console.log(`  Shipments:${remainingShipments}`);
  console.log(`  Users:    ${remainingUsers} (should equal the ${superAdminUserIds.length} super_admin account(s))`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

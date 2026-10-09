import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

/// Every checkout call needs a real, market-scoped ShippingMethod as of
/// Phase 4M — created directly via Prisma, baseRate 0 so every existing
/// amount assertion in this file stays valid.
let defaultShippingMethodId: string;

beforeEach(async () => {
  const market = await testPrisma().market.findUniqueOrThrow({ where: { code: "PK" } });
  const method = await testPrisma().shippingMethod.create({
    data: { marketId: market.id, name: "Standard PK", baseRate: 0 },
  });
  defaultShippingMethodId = method.id;
});

async function asRole(key: string) {
  const { cookieHeader, payload } = await registerUser(app);
  const role = await testPrisma().role.findUniqueOrThrow({ where: { key } });
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().userRole.create({ data: { userId: user.id, roleId: role.id } });
  return { cookieHeader, userId: user.id };
}

// Phase 6E collapsed the seeded role set to super_admin/customer.
// asProductManager/asInventoryManager/asOrderManager are setup-only helpers
// here -> super_admin. asCustomerSupport was used for its exact
// "orders:read+update, no orders:cancel" property (see the 403 test below)
// -> re-expressed as an ad-hoc role. Two boundary tests further down need a
// caller with NO orders permission at all, or orders:read only — those call
// asPermissions(...) directly rather than through one of these wrappers,
// since the wrappers themselves are also used for unrelated setup.
const asProductManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asInventoryManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asOrderManager = () => asRole("super_admin");
const asCustomerSupport = () =>
  asPermissions(app, ["orders:read", "orders:update"]).then((cookieHeader) => ({ cookieHeader }));

async function asCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  return { cookieHeader, userId: user.id };
}

async function asVerifiedCustomer() {
  const { cookieHeader, userId } = await asCustomer();
  await testPrisma().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return { cookieHeader, userId };
}

async function createActiveProduct(cookieHeader: string): Promise<{ productId: string; variantId: string }> {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ status: "ACTIVE", markets: [{ marketCode: "PK", isAvailable: true, isVisible: true }] }));
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

async function setPrice(productId: string, variantId: string, amount = 499900) {
  const cookieHeader = await asProductManager();
  await request(app)
    .put(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(pricePayload({ amount }));
}

async function setStock(productId: string, variantId: string, onHand: number) {
  const cookieHeader = await asInventoryManager();
  await request(app)
    .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ marketCode: "PK", onHand });
}

async function setupPurchasableVariant(onHand = 10): Promise<{ productId: string; variantId: string }> {
  const productCookie = await asProductManager();
  const { productId, variantId } = await createActiveProduct(productCookie);
  await setPrice(productId, variantId);
  await setStock(productId, variantId, onHand);
  return { productId, variantId };
}

async function addToCart(cookieHeader: string, variantId: string, quantity = 1) {
  return request(app)
    .post("/api/v1/cart/items?market=PK")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ variantId, quantity });
}

function validCheckoutBody() {
  return {
    billingAddress: {
      fullName: "Jane Doe",
      phone: "+923001234567",
      line1: "House 20, Street 5",
      city: "Lahore",
      countryCode: "PK",
    },
    paymentMethod: "COD",
    shippingMethodId: defaultShippingMethodId,
  };
}

/// Places a real order through Checkout (Phase 4I) — Orders never creates
/// its own order rows, only reads/transitions what Checkout already
/// produced, so every Orders test starts from a genuine checkout.
async function placeOrder(
  cookieHeader: string,
  quantity = 1,
  onHand = 10,
): Promise<{ orderId: string; variantId: string; productId: string }> {
  const { productId, variantId } = await setupPurchasableVariant(onHand);
  await addToCart(cookieHeader, variantId, quantity);
  const res = await request(app)
    .post("/api/v1/checkout?market=PK")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .set("Idempotency-Key", randomUUID())
    .send(validCheckoutBody());
  expect(res.status).toBe(201);
  return { orderId: res.body.data.id as string, variantId, productId };
}

function patchStatus(orderId: string, cookieHeader: string, status: string, reason?: string) {
  return request(app)
    .patch(`/api/v1/admin/orders/${orderId}/status`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ status, ...(reason ? { reason } : {}) });
}

// -- CREATION REGRESSION ------------------------------------------------------

describe("Orders creation regression", () => {
  it("a Checkout-created order is correctly readable via GET /orders/:id", async () => {
    const { cookieHeader, userId } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(cookieHeader, 2);

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.paymentStatus).toBe("PENDING");
    expect(res.body.data.marketCode).toBe("PK");
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].variantId).toBe(variantId);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.shippingAddress.city).toBe("Lahore");
    expect(res.body.data.statusHistory).toEqual([]);

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.userId).toBe(userId);
  });
});

// -- RETRIEVAL ----------------------------------------------------------------

describe("Order retrieval", () => {
  it("returns a customer's own order", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
  });

  it("hides another customer's order as not found", async () => {
    const { cookieHeader: ownerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(ownerCookie);
    const { cookieHeader: otherCookie } = await asVerifiedCustomer();

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Cookie", otherCookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORDERS_NOT_FOUND");
  });

  it("returns 404 for a nonexistent order", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await request(app).get(`/api/v1/orders/${randomUUID()}`).set("Cookie", cookieHeader);
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated retrieval", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const res = await request(app).get(`/api/v1/orders/${orderId}`);
    expect(res.status).toBe(401);
  });

  it("lets staff with orders:read view any customer's order via the admin route", async () => {
    const { cookieHeader: ownerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(ownerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(orderId);
  });

  it("blocks staff without orders:read from the admin route entirely", async () => {
    const { cookieHeader: ownerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(ownerCookie);
    const staffCookie = await asPermissions(app, ["products:read"]);

    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", staffCookie);
    expect(res.status).toBe(403);
  });
});

// -- LISTING --------------------------------------------------------------------

describe("Order listing", () => {
  it("returns an empty list when the customer has no orders", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await request(app).get("/api/v1/orders").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.pagination.total).toBe(0);
  });

  it("paginates multiple orders deterministically, newest first", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    await placeOrder(cookieHeader);
    await placeOrder(cookieHeader);
    await placeOrder(cookieHeader);

    const res = await request(app).get("/api/v1/orders?limit=2&page=1").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.pagination.total).toBe(3);
    expect(res.body.meta.pagination.totalPages).toBe(2);

    const page2 = await request(app).get("/api/v1/orders?limit=2&page=2").set("Cookie", cookieHeader);
    expect(page2.body.data).toHaveLength(1);
  });

  it("filters the customer's own list by status", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    await placeOrder(cookieHeader);
    const { cookieHeader: staffCookie } = await asOrderManager();
    await patchStatus(orderId, staffCookie, "CONFIRMED");

    const res = await request(app).get("/api/v1/orders?status=CONFIRMED").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(orderId);
  });

  it("does not leak another customer's orders into a customer's own list", async () => {
    const { cookieHeader: a } = await asVerifiedCustomer();
    const { cookieHeader: b } = await asVerifiedCustomer();
    await placeOrder(a);
    await placeOrder(b);

    const res = await request(app).get("/api/v1/orders").set("Cookie", a);
    expect(res.body.data).toHaveLength(1);
  });

  it("filters the admin list by status/market/customer/orderNumber", async () => {
    const { cookieHeader: customerCookie, userId } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const orderNumber = (await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } })).orderNumber;

    const byStatus = await request(app).get("/api/v1/admin/orders?status=PENDING").set("Cookie", staffCookie);
    expect(byStatus.status).toBe(200);
    expect(byStatus.body.data.some((o: { id: string }) => o.id === orderId)).toBe(true);

    const byMarket = await request(app).get("/api/v1/admin/orders?market=PK").set("Cookie", staffCookie);
    expect(byMarket.body.data.some((o: { id: string }) => o.id === orderId)).toBe(true);

    const byCustomer = await request(app).get(`/api/v1/admin/orders?customer=${userId}`).set("Cookie", staffCookie);
    expect(byCustomer.body.data).toHaveLength(1);
    expect(byCustomer.body.data[0].id).toBe(orderId);

    const byOrderNumber = await request(app)
      .get(`/api/v1/admin/orders?orderNumber=${orderNumber}`)
      .set("Cookie", staffCookie);
    expect(byOrderNumber.body.data).toHaveLength(1);

    const byUnknownMarket = await request(app).get("/api/v1/admin/orders?market=ZZ").set("Cookie", staffCookie);
    expect(byUnknownMarket.status).toBe(200);
    expect(byUnknownMarket.body.data).toEqual([]);
  });

  it("rejects an unauthenticated admin list request", async () => {
    const res = await request(app).get("/api/v1/admin/orders");
    expect(res.status).toBe(401);
  });

  it("resolves the first item's product primary image as thumbnailUrl", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, productId } = await placeOrder(cookieHeader);
    await testPrisma().productMedia.createMany({
      data: [
        { productId, url: "https://example.com/secondary.jpg", position: 1, isPrimary: false },
        { productId, url: "https://example.com/primary.jpg", position: 0, isPrimary: true },
      ],
    });

    const res = await request(app).get("/api/v1/orders").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    const row = res.body.data.find((o: { id: string }) => o.id === orderId);
    expect(row.thumbnailUrl).toBe("https://example.com/primary.jpg");
  });

  it("returns thumbnailUrl: null when the product has no media", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);

    const res = await request(app).get("/api/v1/orders").set("Cookie", cookieHeader);
    const row = res.body.data.find((o: { id: string }) => o.id === orderId);
    expect(row.thumbnailUrl).toBeNull();
  });
});

// -- STATUS TRANSITIONS ---------------------------------------------------------

describe("Order status transitions", () => {
  it("walks the full valid lifecycle PENDING -> ... -> COMPLETED, recording history and decrementing stock only at completion", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(customerCookie, 3, 10);
    const { cookieHeader: staffCookie, userId: staffId } = await asOrderManager();

    const stockBefore = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stockBefore.onHand).toBe(10);
    expect(stockBefore.reserved).toBe(3);

    const transitions = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"];
    for (const status of transitions) {
      const res = await patchStatus(orderId, staffCookie, status, "moving order along");
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("COMPLETED");

    const history = await testPrisma().orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    expect(history).toHaveLength(5);
    expect(history[0]!.previousStatus).toBe("PENDING");
    expect(history[0]!.newStatus).toBe("CONFIRMED");
    expect(history[0]!.changedByUserId).toBe(staffId);
    expect(history[4]!.newStatus).toBe("COMPLETED");

    const stockAfter = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stockAfter.reserved).toBe(0);
    expect(stockAfter.onHand).toBe(7); // decremented by the ordered quantity

    const movement = await testPrisma().stockMovement.findFirst({
      where: { stockId: stockAfter.id, type: "ADJUSTMENT" },
      orderBy: { createdAt: "desc" },
    });
    expect(movement).not.toBeNull();
    expect(movement!.quantityDelta).toBe(-3);
  });

  it("releases the reservation without decrementing stock on cancellation", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(customerCookie, 4, 10);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await patchStatus(orderId, staffCookie, "CANCELLED", "customer changed their mind");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CANCELLED");

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
    expect(stock.onHand).toBe(10); // unchanged
  });

  it("rejects an invalid transition", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await patchStatus(orderId, staffCookie, "SHIPPED");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORDERS_INVALID_STATUS_TRANSITION");
  });

  it("rejects any transition attempted from a terminal state", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    await patchStatus(orderId, staffCookie, "CANCELLED");
    const res = await patchStatus(orderId, staffCookie, "CONFIRMED");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORDERS_TERMINAL_STATE");
  });

  it("lets customer_support move an order forward but not cancel it", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const { cookieHeader: supportCookie } = await asCustomerSupport();

    const forward = await patchStatus(orderId, supportCookie, "CONFIRMED");
    expect(forward.status).toBe(200);

    const cancel = await patchStatus(orderId, supportCookie, "CANCELLED");
    expect(cancel.status).toBe(403);
  });

  it("blocks a caller with only orders:read from any transition", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const readOnlyCookie = await asPermissions(app, ["orders:read"]);

    const res = await patchStatus(orderId, readOnlyCookie, "CONFIRMED");
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated status update", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const res = await request(app).patch(`/api/v1/admin/orders/${orderId}/status`).set(csrfHeaders()).send({ status: "CONFIRMED" });
    expect(res.status).toBe(401);
  });
});

// -- CONCURRENCY -----------------------------------------------------------------

describe("Order status concurrency", () => {
  it("survives two concurrent transitions racing on the same order: exactly one wins", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const [a, b] = await Promise.all([
      patchStatus(orderId, staffCookie, "CONFIRMED"),
      patchStatus(orderId, staffCookie, "CONFIRMED"),
    ]);

    // Exactly one request wins (200); the loser's exact error code depends
    // on true interleaving, not just correctness: if its own status read
    // happened before the winner's guarded UPDATE committed, it loses that
    // UPDATE itself (409 ORDERS_STATUS_CONFLICT — the case the guarded
    // UPDATE exists for); if Promise.all didn't produce genuine DB-level
    // overlap and the loser's read only happens after the winner fully
    // committed, it instead sees the now-CONFIRMED order and gets a
    // legitimate 422 ORDERS_INVALID_STATUS_TRANSITION. Both are correct
    // outcomes of "this request did not win" — the property that actually
    // matters (verified below) is a single winner, a single history row,
    // and the correct final state.
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(winner.status).toBe(200);
    expect([409, 422]).toContain(loser.status);
    expect([undefined, "ORDERS_STATUS_CONFLICT", "ORDERS_INVALID_STATUS_TRANSITION"]).toContain(loser.body.error?.code);

    const history = await testPrisma().orderStatusHistory.findMany({ where: { orderId } });
    expect(history).toHaveLength(1);

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CONFIRMED");
  });

  /// Phase 4M audit (docs/CURRENT_TASK.md): the only prior concurrency test
  /// races CONFIRMED, a transition with zero inventory involvement. These
  /// two close the actual gap the audit found — racing the one transition
  /// that calls the non-idempotent InventoryRepository.adjust() (COMPLETED)
  /// and the one that calls release() (CANCELLED), verifying the guarded
  /// UPDATE genuinely prevents adjust() from ever running twice under real
  /// concurrent requests, not just as a code-reading claim.
  it("survives two concurrent DELIVERED->COMPLETED transitions on the same order: adjust() runs exactly once", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(customerCookie, 3, 10);
    const { cookieHeader: staffCookie } = await asOrderManager();

    for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
      const res = await patchStatus(orderId, staffCookie, status);
      expect(res.status).toBe(200);
    }

    const [a, b] = await Promise.all([
      patchStatus(orderId, staffCookie, "COMPLETED"),
      patchStatus(orderId, staffCookie, "COMPLETED"),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("COMPLETED");

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
    expect(stock.onHand).toBe(7); // decremented by 3 exactly once, not twice

    const adjustments = await testPrisma().stockMovement.findMany({ where: { stockId: stock.id, type: "ADJUSTMENT" } });
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]!.quantityDelta).toBe(-3);
  });

  it("survives two concurrent CANCELLED transitions on the same order: release() runs exactly once", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(customerCookie, 4, 10);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const [a, b] = await Promise.all([
      patchStatus(orderId, staffCookie, "CANCELLED"),
      patchStatus(orderId, staffCookie, "CANCELLED"),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0); // released exactly once, not double-released into negative
    expect(stock.onHand).toBe(10); // untouched
  });
});

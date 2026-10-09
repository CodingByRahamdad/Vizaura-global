import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

// Phase 6F — Admin Orders. Covers the staff-only admin projections
// (customer / payments / shipment / returns), the new search + shipmentStatus
// filters, admin authorization boundaries, status transitions, and
// market/historical-price integrity. Orders are always created through a real
// Checkout, never inserted directly.

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

type MarketCode = "PK" | "AE";

const MARKET_CONFIG: Record<MarketCode, { currency: string; country: string; phone: string; city: string }> = {
  PK: { currency: "PKR", country: "PK", phone: "+923001234567", city: "Lahore" },
  AE: { currency: "AED", country: "AE", phone: "+971501234567", city: "Dubai" },
};

async function asSuperAdmin(): Promise<string> {
  return asRole(app, "super_admin");
}

async function asVerifiedCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { cookieHeader, userId: user.id, email: payload.email as string, user };
}

async function placeOrder(
  customerCookie: string,
  opts: { market?: MarketCode; amount?: number; quantity?: number } = {},
): Promise<{ orderId: string; productId: string; variantId: string }> {
  const market = opts.market ?? "PK";
  const cfg = MARKET_CONFIG[market];
  const adminCookie = await asSuperAdmin();

  const marketRow = await testPrisma().market.findUniqueOrThrow({ where: { code: market } });
  const method = await testPrisma().shippingMethod.create({
    data: { marketId: marketRow.id, name: `Standard ${market}`, baseRate: 0 },
  });

  const created = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(productPayload({ status: "ACTIVE", markets: [{ marketCode: market, isAvailable: true, isVisible: true }] }));
  const productId = created.body.data.id as string;
  const variantId = created.body.data.variants[0].id as string;

  await request(app)
    .put(`/api/v1/products/${productId}/variants/${variantId}/prices/${market}`)
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(pricePayload({ amount: opts.amount ?? 250000 }));
  await request(app)
    .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send({ marketCode: market, onHand: 10 });

  await request(app)
    .post(`/api/v1/cart/items?market=${market}`)
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .send({ variantId, quantity: opts.quantity ?? 2 });

  const res = await request(app)
    .post(`/api/v1/checkout?market=${market}`)
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .set("Idempotency-Key", randomUUID())
    .send({
      billingAddress: {
        fullName: "Jane Doe",
        phone: cfg.phone,
        line1: "House 20, Street 5",
        city: cfg.city,
        countryCode: cfg.country,
      },
      paymentMethod: "COD",
      shippingMethodId: method.id,
    });
  expect(res.status).toBe(201);
  return { orderId: res.body.data.id as string, productId, variantId };
}

/// Sets up a sellable product/variant (ACTIVE, priced, stocked) for a
/// market, for use with POST /admin/orders — same steps placeOrder()
/// already runs for a storefront checkout, minus the cart/checkout calls.
async function setUpSellableVariant(
  adminCookie: string,
  market: MarketCode = "PK",
  amount = 250000,
): Promise<{ productId: string; variantId: string }> {
  const created = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(productPayload({ status: "ACTIVE", markets: [{ marketCode: market, isAvailable: true, isVisible: true }] }));
  const productId = created.body.data.id as string;
  const variantId = created.body.data.variants[0].id as string;

  await request(app)
    .put(`/api/v1/products/${productId}/variants/${variantId}/prices/${market}`)
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(pricePayload({ amount }));
  await request(app)
    .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send({ marketCode: market, onHand: 10 });

  return { productId, variantId };
}

/// resetTestData TRUNCATEs shipping_methods every test (it's treated as
/// test-created fixture data, not kept seeded reference data — see
/// tests/helpers/db.ts) — so createAdminOrder's required "Manual" method
/// (shipping-methods.repository.ts#findManualMethodByMarket) must be
/// created fresh per test, same as placeOrder() already creates its own
/// public shipping method.
async function setUpManualShippingMethod(market: MarketCode = "PK"): Promise<void> {
  const marketRow = await testPrisma().market.findUniqueOrThrow({ where: { code: market } });
  await testPrisma().shippingMethod.create({
    data: { marketId: marketRow.id, name: "Manual", baseRate: 0, isPublic: false },
  });
}

function createAdminOrderPayload(overrides: Record<string, unknown> = {}) {
  const cfg = MARKET_CONFIG.PK;
  return {
    market: "PK",
    paymentMethod: "CASH",
    billingAddress: {
      fullName: "Walk-in Customer",
      phone: cfg.phone,
      line1: "House 1, Street 1",
      city: cfg.city,
      countryCode: cfg.country,
    },
    lines: [],
    ...overrides,
  };
}

function patchStatus(orderId: string, cookieHeader: string, status: string, reason?: string) {
  return request(app)
    .patch(`/api/v1/admin/orders/${orderId}/status`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ status, ...(reason ? { reason } : {}) });
}

// -- AUTHORIZATION -----------------------------------------------------------

describe("Admin orders — authorization", () => {
  it("rejects unauthenticated list, detail, and status requests with 401", async () => {
    const id = randomUUID();
    expect((await request(app).get("/api/v1/admin/orders")).status).toBe(401);
    expect((await request(app).get(`/api/v1/admin/orders/${id}`)).status).toBe(401);
    const patch = await request(app).patch(`/api/v1/admin/orders/${id}/status`).set(csrfHeaders()).send({ status: "CONFIRMED" });
    expect(patch.status).toBe(401);
  });

  it("forbids a customer from the admin list, detail (even their own order), and status endpoints", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);

    expect((await request(app).get("/api/v1/admin/orders").set("Cookie", cookieHeader)).status).toBe(403);
    expect((await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", cookieHeader)).status).toBe(403);
    expect((await patchStatus(orderId, cookieHeader, "CONFIRMED")).status).toBe(403);
  });

  it("does not let a customer read another customer's order through the customer endpoint (IDOR)", async () => {
    const { cookieHeader: ownerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(ownerCookie);
    const { cookieHeader: otherCookie } = await asVerifiedCustomer();

    const res = await request(app).get(`/api/v1/orders/${orderId}`).set("Cookie", otherCookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORDERS_NOT_FOUND");
  });

  it("still lets the customer list only their own orders", async () => {
    const { cookieHeader: aCookie } = await asVerifiedCustomer();
    const { cookieHeader: bCookie } = await asVerifiedCustomer();
    const { orderId: aOrder } = await placeOrder(aCookie);
    await placeOrder(bCookie);

    const res = await request(app).get("/api/v1/orders").set("Cookie", aCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { id: string }) => o.id)).toEqual([aOrder]);
    // Customer shape is unchanged — no staff-only fields leak into it.
    expect(res.body.data[0].customer).toBeUndefined();
  });

  it("returns 404 for an unknown order and 400 for a malformed id", async () => {
    const admin = await asSuperAdmin();
    expect((await request(app).get(`/api/v1/admin/orders/${randomUUID()}`).set("Cookie", admin)).status).toBe(404);
    expect((await request(app).get("/api/v1/admin/orders/not-a-uuid").set("Cookie", admin)).status).toBe(400);
    expect((await patchStatus(randomUUID(), admin, "CONFIRMED")).status).toBe(404);
  });
});

// -- LIST --------------------------------------------------------------------

describe("Admin orders — list", () => {
  it("lets super_admin list orders with customer identity and shipment status", async () => {
    const { cookieHeader, userId, email } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    const res = await request(app).get("/api/v1/admin/orders").set("Cookie", admin);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(1);
    const row = res.body.data[0];
    expect(row.id).toBe(orderId);
    expect(row.customer.id).toBe(userId);
    expect(row.customer.email).toBe(email);
    expect(typeof row.customer.name).toBe("string");
    expect(row.shipmentStatus).toBe("PENDING");
    expect(row.customer.passwordHash).toBeUndefined();
  });

  it("searches by order number, customer email, and returns nothing for a non-match", async () => {
    const { cookieHeader, email } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const { cookieHeader: otherCookie } = await asVerifiedCustomer();
    await placeOrder(otherCookie);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });

    const byEmail = await request(app)
      .get("/api/v1/admin/orders")
      .query({ search: email.toUpperCase() })
      .set("Cookie", admin);
    expect(byEmail.body.data.map((o: { id: string }) => o.id)).toEqual([orderId]);

    const byNumber = await request(app)
      .get("/api/v1/admin/orders")
      .query({ search: order.orderNumber.slice(0, -1).toLowerCase() })
      .set("Cookie", admin);
    expect(byNumber.body.data.some((o: { id: string }) => o.id === orderId)).toBe(true);

    const none = await request(app).get("/api/v1/admin/orders").query({ search: "zz-no-match-zz" }).set("Cookie", admin);
    expect(none.body.data).toEqual([]);
    expect(none.body.meta.pagination.total).toBe(0);
  });

  it("filters by status, paymentStatus, shipmentStatus and market on the server", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId: pkOrder } = await placeOrder(cookieHeader, { market: "PK" });
    const { orderId: aeOrder } = await placeOrder(cookieHeader, { market: "AE" });
    const admin = await asSuperAdmin();
    expect((await patchStatus(pkOrder, admin, "CONFIRMED")).status).toBe(200);

    const ids = async (q: Record<string, string>) =>
      (await request(app).get("/api/v1/admin/orders").query(q).set("Cookie", admin)).body.data.map(
        (o: { id: string }) => o.id,
      );

    expect(await ids({ status: "CONFIRMED" })).toEqual([pkOrder]);
    expect(await ids({ status: "PENDING" })).toEqual([aeOrder]);
    expect(await ids({ market: "ae" })).toEqual([aeOrder]);
    expect((await ids({ paymentStatus: "PENDING" })).sort()).toEqual([pkOrder, aeOrder].sort());
    expect(await ids({ paymentStatus: "PAID" })).toEqual([]);
    expect((await ids({ shipmentStatus: "PENDING" })).sort()).toEqual([pkOrder, aeOrder].sort());
    expect(await ids({ shipmentStatus: "DELIVERED" })).toEqual([]);
  });

  it("treats a date-only dateTo as inclusive of that whole day", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    const day = order.placedAt.toISOString().slice(0, 10);

    const res = await request(app)
      .get("/api/v1/admin/orders")
      .query({ dateFrom: day, dateTo: day })
      .set("Cookie", admin);
    expect(res.body.data.map((o: { id: string }) => o.id)).toEqual([orderId]);

    const before = await request(app).get("/api/v1/admin/orders").query({ dateTo: "2000-01-01" }).set("Cookie", admin);
    expect(before.body.data).toEqual([]);
  });

  it("rejects invalid query parameters with 400", async () => {
    const admin = await asSuperAdmin();
    const get = (q: Record<string, string>) => request(app).get("/api/v1/admin/orders").query(q).set("Cookie", admin);
    expect((await get({ status: "BOGUS" })).status).toBe(400);
    expect((await get({ shipmentStatus: "BOGUS" })).status).toBe(400);
    expect((await get({ dateTo: "not-a-date" })).status).toBe(400);
    expect((await get({ page: "0" })).status).toBe(400);
  });
});

// -- DETAIL ------------------------------------------------------------------

describe("Admin orders — detail", () => {
  it("returns customer, items, payments, shipment and returns without sensitive fields", async () => {
    const { cookieHeader, userId } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(cookieHeader, { quantity: 2, amount: 250000 });
    const admin = await asSuperAdmin();

    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.customer.id).toBe(userId);
    expect(d.items).toHaveLength(1);
    expect(d.items[0].variantId).toBe(variantId);
    expect(d.items[0].unitAmount).toBe(250000);
    expect(d.items[0].lineTotal).toBe(500000);
    expect(d.payments).toHaveLength(1);
    expect(d.payments[0]).toMatchObject({ provider: "COD", method: "COD", status: "PENDING", amount: d.totalAmount });
    expect(d.payments[0].idempotencyKey).toBeUndefined();
    expect(d.shipment).toMatchObject({ status: "PENDING", shippingMethodName: "Standard PK" });
    expect(d.returns).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/passwordHash|idempotencyKey|metadata/);
  });

  it("shows a return once one has been requested", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    await testPrisma().return.create({
      data: {
        orderId,
        requestedByUserId: order.userId,
        reason: "Damaged",
        items: { create: [{ orderItemId: order.items[0].id, quantity: 1 }] },
      },
    });

    const res = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin);
    expect(res.body.data.returns).toHaveLength(1);
    expect(res.body.data.returns[0]).toMatchObject({ status: "REQUESTED", reason: "Damaged" });
  });

  it("treats a caller holding only orders:read as allowed and one without orders:read as forbidden", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);

    const readOnly = await asPermissions(app, ["orders:read"]);
    expect((await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", readOnly)).status).toBe(200);

    const noOrders = await asPermissions(app, ["products:read"]);
    expect((await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", noOrders)).status).toBe(403);
  });
});

// -- STATUS TRANSITIONS ------------------------------------------------------

describe("Admin orders — status transitions", () => {
  it("applies a valid transition, appends history, and records an audit entry with the previous status", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    const res = await patchStatus(orderId, admin, "CONFIRMED", "Verified by phone");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CONFIRMED");

    const detail = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin);
    expect(detail.body.data.status).toBe("CONFIRMED");
    expect(detail.body.data.statusHistory).toHaveLength(1);
    expect(detail.body.data.statusHistory[0]).toMatchObject({
      previousStatus: "PENDING",
      newStatus: "CONFIRMED",
      reason: "Verified by phone",
    });
    expect(detail.body.data.statusHistory[0].changedByUserId).toBeTruthy();

    const logs = await testPrisma().auditLog.findMany({
      where: { entityType: "Order", entityId: orderId, action: "UPDATE_ORDER_STATUS" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].before).toMatchObject({ status: "PENDING" });
    expect(logs[0].after).toMatchObject({ status: "CONFIRMED", reason: "Verified by phone" });
  });

  it("rejects an invalid transition with 422 and leaves status/history untouched", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    const res = await patchStatus(orderId, admin, "DELIVERED");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORDERS_INVALID_STATUS_TRANSITION");

    const detail = await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin);
    expect(detail.body.data.status).toBe("PENDING");
    expect(detail.body.data.statusHistory).toEqual([]);
    const logs = await testPrisma().auditLog.count({ where: { entityId: orderId, action: "UPDATE_ORDER_STATUS" } });
    expect(logs).toBe(0);
  });

  it("rejects any move out of a terminal state with 422", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    expect((await patchStatus(orderId, admin, "CANCELLED")).status).toBe(200);

    const res = await patchStatus(orderId, admin, "CONFIRMED");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORDERS_TERMINAL_STATE");
  });

  it("requires orders:cancel specifically to cancel", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const updateOnly = await asPermissions(app, ["orders:read", "orders:update"]);

    expect((await patchStatus(orderId, updateOnly, "CANCELLED")).status).toBe(403);
    expect((await patchStatus(orderId, updateOnly, "CONFIRMED")).status).toBe(200);
  });
});

// -- CUSTOMER NOTIFICATIONS ON STATUS CHANGE ---------------------------------

describe("Admin orders — customer notification on status change", () => {
  it("creates exactly one CustomerNotification for the owning customer on a valid transition", async () => {
    const { cookieHeader, userId } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    expect((await patchStatus(orderId, admin, "CONFIRMED")).status).toBe(200);

    const notifications = await testPrisma().customerNotification.findMany({ where: { userId } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "ORDER_STATUS_CHANGED", isRead: false });
    expect(notifications[0].message).toContain("Confirmed");
  });

  it("does not double-fire when a second transition attempt on the same status fails", async () => {
    const { cookieHeader, userId } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    expect((await patchStatus(orderId, admin, "CONFIRMED")).status).toBe(200);
    // Re-sending the same target status is now an invalid transition (CONFIRMED -> CONFIRMED
    // isn't in the transition map) and must not create a second notification.
    expect((await patchStatus(orderId, admin, "CONFIRMED")).status).toBe(422);

    const notifications = await testPrisma().customerNotification.findMany({ where: { userId } });
    expect(notifications).toHaveLength(1);
  });

  it("fires again (one row each) on a second, later legal transition", async () => {
    const { cookieHeader, userId } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    expect((await patchStatus(orderId, admin, "CONFIRMED")).status).toBe(200);
    expect((await patchStatus(orderId, admin, "PROCESSING")).status).toBe(200);

    const notifications = await testPrisma().customerNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    expect(notifications).toHaveLength(2);
    expect(notifications[1].message).toContain("Processing");
  });
});

// -- MARKET + HISTORICAL INTEGRITY -------------------------------------------

describe("Admin orders — market and historical data", () => {
  it("keeps a PK order PK/PKR and an AE order AE/AED", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId: pk } = await placeOrder(cookieHeader, { market: "PK" });
    const { orderId: ae } = await placeOrder(cookieHeader, { market: "AE" });
    const admin = await asSuperAdmin();

    const pkRes = await request(app).get(`/api/v1/admin/orders/${pk}`).set("Cookie", admin);
    const aeRes = await request(app).get(`/api/v1/admin/orders/${ae}`).set("Cookie", admin);
    expect(pkRes.body.data).toMatchObject({ marketCode: "PK", currencyCode: "PKR" });
    expect(pkRes.body.data.items[0].currencyCode).toBe("PKR");
    expect(aeRes.body.data).toMatchObject({ marketCode: "AE", currencyCode: "AED" });
    expect(aeRes.body.data.items[0].currencyCode).toBe("AED");
  });

  it("does not recalculate historical totals when the catalog price or product name changes later", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, productId, variantId } = await placeOrder(cookieHeader, { quantity: 2, amount: 250000 });
    const admin = await asSuperAdmin();

    const before = (await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin)).body.data;

    await request(app)
      .put(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(pricePayload({ amount: 999900 }));
    await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ name: "Renamed Later" });

    const after = (await request(app).get(`/api/v1/admin/orders/${orderId}`).set("Cookie", admin)).body.data;
    expect(after.totalAmount).toBe(before.totalAmount);
    expect(after.subtotalAmount).toBe(before.subtotalAmount);
    expect(after.items[0].unitAmount).toBe(250000);
    expect(after.items[0].lineTotal).toBe(500000);
    expect(after.items[0].productName).toBe(before.items[0].productName);
    expect(after.items[0].productName).not.toBe("Renamed Later");
  });
});

describe("Admin orders — create (offline/custom, existing customer and guest)", () => {
  it("rejects a caller without orders:create", async () => {
    const cookieHeader = await asPermissions(app, ["orders:read"]);
    const res = await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(createAdminOrderPayload({ guestEmail: "walkin@example.com" }));
    expect(res.status).toBe(403);
  });

  it("rejects a body with neither userId nor guestEmail", async () => {
    const admin = await asSuperAdmin();
    const { variantId, productId } = await setUpSellableVariant(admin);
    const res = await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(createAdminOrderPayload({ lines: [{ productId, variantId, quantity: 1 }] }));
    expect(res.status).toBe(400);
  });

  it("rejects a body with both userId and guestEmail", async () => {
    const admin = await asSuperAdmin();
    const { userId } = await asVerifiedCustomer();
    const { variantId, productId } = await setUpSellableVariant(admin);
    const res = await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(createAdminOrderPayload({ userId, guestEmail: "both@example.com", lines: [{ productId, variantId, quantity: 1 }] }));
    expect(res.status).toBe(400);
  });

  it("creates an order for an existing customer and shows it as non-guest", async () => {
    const admin = await asSuperAdmin();
    const { userId, email } = await asVerifiedCustomer();
    const { variantId, productId } = await setUpSellableVariant(admin);
    await setUpManualShippingMethod();

    const res = await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(createAdminOrderPayload({ userId, lines: [{ productId, variantId, quantity: 1 }] }));
    expect(res.status).toBe(201);
    expect(res.body.data.customer.isGuest).toBe(false);
    expect(res.body.data.customer.id).toBe(userId);
    expect(res.body.data.customer.email).toBe(email);

    const listed = await request(app).get("/api/v1/admin/orders").set("Cookie", admin);
    const row = listed.body.data.find((o: { id: string }) => o.id === res.body.data.id);
    expect(row.customer.isGuest).toBe(false);
  });

  it("creates a guest/no-account order with no User row, and displays it correctly on list and detail", async () => {
    const admin = await asSuperAdmin();
    const { variantId, productId } = await setUpSellableVariant(admin);
    await setUpManualShippingMethod();
    const guestEmail = "walkin-guest@example.com";

    const res = await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(
        createAdminOrderPayload({
          guestEmail,
          lines: [{ productId, variantId, quantity: 1 }],
          billingAddress: {
            fullName: "Walk-in Guest",
            phone: "+923001234567",
            line1: "House 1, Street 1",
            city: "Lahore",
            countryCode: "PK",
          },
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body.data.customer.isGuest).toBe(true);
    expect(res.body.data.customer.id).toBeNull();
    expect(res.body.data.customer.email).toBe(guestEmail);
    expect(res.body.data.customer.name).toBe("Walk-in Guest");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(order.userId).toBeNull();
    expect(order.guestEmail).toBe(guestEmail);

    const detail = await request(app).get(`/api/v1/admin/orders/${res.body.data.id}`).set("Cookie", admin);
    expect(detail.body.data.customer.isGuest).toBe(true);
    expect(detail.body.data.customer.email).toBe(guestEmail);

    const listed = await request(app).get("/api/v1/admin/orders").set("Cookie", admin);
    const row = listed.body.data.find((o: { id: string }) => o.id === res.body.data.id);
    expect(row.customer.isGuest).toBe(true);
    expect(row.customer.name).toBe("Walk-in Guest");
  });

  it("finds a guest order by its guest email via the admin search filter", async () => {
    const admin = await asSuperAdmin();
    const { variantId, productId } = await setUpSellableVariant(admin);
    await setUpManualShippingMethod();
    const guestEmail = `findme-${randomUUID()}@example.com`;

    await request(app)
      .post("/api/v1/admin/orders")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send(createAdminOrderPayload({ guestEmail, lines: [{ productId, variantId, quantity: 1 }] }));

    const res = await request(app).get("/api/v1/admin/orders").query({ search: guestEmail }).set("Cookie", admin);
    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { customer: { email: string } }) => o.customer.email === guestEmail)).toBe(true);
  });
});

// -- ADMIN ORDER EDIT ---------------------------------------------------------

function editOrder(orderId: string, cookieHeader: string, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/v1/admin/orders/${orderId}`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(body);
}

function deleteOrder(orderId: string, cookieHeader: string) {
  return request(app).delete(`/api/v1/admin/orders/${orderId}`).set(csrfHeaders()).set("Cookie", cookieHeader);
}

describe("Admin order edit", () => {
  it("adjusts an existing line's quantity and price, recomputing totals and the inventory reservation", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(cookieHeader, { amount: 250000, quantity: 2 });
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const itemId = order.items[0].id;

    const res = await editOrder(orderId, admin, { items: [{ id: itemId, quantity: 4, unitAmountOverride: 200000 }] });
    expect(res.status).toBe(200);
    const updatedItem = res.body.data.items.find((i: { id: string }) => i.id === itemId);
    expect(updatedItem.quantity).toBe(4);
    expect(updatedItem.unitAmount).toBe(200000);
    expect(updatedItem.lineTotal).toBe(800000);
    expect(res.body.data.subtotalAmount).toBe(800000);
    expect(res.body.data.totalAmount).toBe(800000);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(4);
  });

  it("adds a new line for a variant not already on the order, reserving its stock", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const { productId: productId2, variantId: variantId2 } = await setUpSellableVariant(admin, "PK", 100000);

    const res = await editOrder(orderId, admin, {
      items: [{ productId: productId2, variantId: variantId2, quantity: 3 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId: variantId2 } });
    expect(stock.reserved).toBe(3);
  });

  it("rejects adding a line for a variant that already has a line on the order", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, productId, variantId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    const res = await editOrder(orderId, admin, { items: [{ productId, variantId, quantity: 1 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ORDERS_DUPLICATE_LINE_VARIANT");
  });

  it("removes a line, releasing its inventory reservation", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const itemId = order.items[0].id;

    const res = await editOrder(orderId, admin, { items: [{ id: itemId, remove: true }] });
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.subtotalAmount).toBe(0);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
  });

  it("edits billing/shipping addresses independently", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();

    const res = await editOrder(orderId, admin, {
      billingAddress: { fullName: "New Billing Name", phone: "+923009999999", line1: "New Line 1", city: "Lahore", countryCode: "PK" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.billingAddress.fullName).toBe("New Billing Name");
    expect(res.body.data.shippingAddress.fullName).not.toBe("New Billing Name");
  });

  it("rejects an edit once the payment has moved past PENDING", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, payments: true } });

    await request(app).patch(`/api/v1/admin/payments/${order.payments[0].id}/mark-paid`).set(csrfHeaders()).set("Cookie", admin);

    const res = await editOrder(orderId, admin, { items: [{ id: order.items[0].id, quantity: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_EDITABLE");
  });

  it("rejects an edit once the shipment has moved past PENDING", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, shipment: true } });

    await request(app)
      .patch(`/api/v1/admin/shipments/${order.shipment!.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ status: "PROCESSING" });

    const res = await editOrder(orderId, admin, { items: [{ id: order.items[0].id, quantity: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_EDITABLE");
  });

  it("rejects an edit once a return exists on the order", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

    await testPrisma().return.create({
      data: { orderId, status: "REQUESTED", requestedByUserId: order.userId! },
    });

    const res = await editOrder(orderId, admin, { items: [{ id: order.items[0].id, quantity: 5 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_EDITABLE");
  });

  it("rejects an edit from a caller without orders:update", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const readOnly = await asPermissions(app, ["orders:read"]);

    const res = await editOrder(orderId, readOnly, { billingAddress: { fullName: "X", phone: "1", line1: "1", city: "1", countryCode: "PK" } });
    expect(res.status).toBe(403);
  });
});

// -- ADMIN ORDER DELETE --------------------------------------------------------

describe("Admin order delete", () => {
  it("hard-deletes a fully-pending order and releases its inventory reservation", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, variantId } = await placeOrder(cookieHeader, { quantity: 2 });
    const admin = await asSuperAdmin();

    const res = await deleteOrder(orderId, admin);
    expect(res.status).toBe(204);

    expect(await testPrisma().order.findUnique({ where: { id: orderId } })).toBeNull();
    expect(await testPrisma().orderItem.findMany({ where: { orderId } })).toHaveLength(0);
    expect(await testPrisma().orderAddress.findMany({ where: { orderId } })).toHaveLength(0);
    expect(await testPrisma().payment.findMany({ where: { orderId } })).toHaveLength(0);
    expect(await testPrisma().shipment.findMany({ where: { orderId } })).toHaveLength(0);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
  });

  it("rejects deleting an order once the payment has moved past PENDING", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });

    await request(app).patch(`/api/v1/admin/payments/${order.payments[0].id}/mark-paid`).set(csrfHeaders()).set("Cookie", admin);

    const res = await deleteOrder(orderId, admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_DELETABLE");
    expect(await testPrisma().order.findUnique({ where: { id: orderId } })).not.toBeNull();
  });

  it("rejects deleting an order once the shipment has moved past PENDING", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId }, include: { shipment: true } });

    await request(app)
      .patch(`/api/v1/admin/shipments/${order.shipment!.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ status: "PROCESSING" });

    const res = await deleteOrder(orderId, admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_DELETABLE");
  });

  it("rejects deleting an order once a return exists", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const admin = await asSuperAdmin();
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });

    await testPrisma().return.create({
      data: { orderId, status: "REQUESTED", requestedByUserId: order.userId! },
    });

    const res = await deleteOrder(orderId, admin);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDERS_NOT_DELETABLE");
  });

  it("rejects delete from a caller without orders:delete", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(cookieHeader);
    const updateOnly = await asPermissions(app, ["orders:read", "orders:update"]);

    const res = await deleteOrder(orderId, updateOnly);
    expect(res.status).toBe(403);
    expect(await testPrisma().order.findUnique({ where: { id: orderId } })).not.toBeNull();
  });
});

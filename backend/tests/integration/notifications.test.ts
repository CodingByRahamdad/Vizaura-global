import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";
import { categoryPayload, pricePayload, productPayload } from "../helpers/factories.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

type MarketCode = "PK";
const MARKET_CFG = { currency: "PKR", country: "PK", phone: "+923001234567", city: "Lahore" };

function createAdminOrderPayload(overrides: Record<string, unknown> = {}) {
  return {
    market: "PK",
    guestEmail: "walkin@example.com",
    paymentMethod: "CASH",
    billingAddress: {
      fullName: "Walk-in Customer",
      phone: MARKET_CFG.phone,
      line1: "House 1, Street 1",
      city: MARKET_CFG.city,
      countryCode: MARKET_CFG.country,
    },
    lines: [],
    ...overrides,
  };
}

/// Sets up a sellable product/variant (ACTIVE, priced, stocked) for a
/// market — same steps orders.admin.test.ts's setUpSellableVariant runs,
/// needed since POST /admin/orders requires at least one real line.
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

/// Mirrors orders.admin.test.ts's setUpManualShippingMethod — resetTestData
/// TRUNCATEs shipping_methods every test, so createAdminOrder's required
/// "Manual" method must be created fresh per test.
async function setUpManualShippingMethod(market: MarketCode = "PK"): Promise<void> {
  const marketRow = await testPrisma().market.findUniqueOrThrow({ where: { code: market } });
  await testPrisma().shippingMethod.create({
    data: { marketId: marketRow.id, name: "Manual", baseRate: 0, isPublic: false },
  });
}

/// Creates a real order via POST /admin/orders (PENDING, CASH) — the
/// simplest real path to a cancellable order, same helper pattern
/// orders.admin.test.ts already established for this endpoint.
async function createOrder(adminCookie: string): Promise<string> {
  await setUpManualShippingMethod();
  const { productId, variantId } = await setUpSellableVariant(adminCookie);
  const res = await request(app)
    .post("/api/v1/admin/orders")
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(createAdminOrderPayload({ lines: [{ productId, variantId, quantity: 1 }] }));
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function cancelOrder(orderId: string, cookieHeader: string) {
  return request(app)
    .patch(`/api/v1/admin/orders/${orderId}/status`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ status: "CANCELLED" });
}

describe("Notifications", () => {
  describe("Order cancellation", () => {
    it("creates exactly one ORDER_CANCELLED notification, visible to an orders:read holder", async () => {
      const adminCookie = await asSuperAdmin();
      const orderId = await createOrder(adminCookie);

      const cancel = await cancelOrder(orderId, adminCookie);
      expect(cancel.status).toBe(200);

      const list = await request(app).get("/api/v1/admin/notifications").set("Cookie", adminCookie);
      expect(list.status).toBe(200);
      const matches = list.body.data.filter(
        (n: { type: string; entityId: string }) => n.type === "ORDER_CANCELLED" && n.entityId === orderId,
      );
      expect(matches).toHaveLength(1);
    });

    it("never double-fires when cancellation is attempted twice (blocked by the state machine)", async () => {
      const adminCookie = await asSuperAdmin();
      const orderId = await createOrder(adminCookie);

      const first = await cancelOrder(orderId, adminCookie);
      expect(first.status).toBe(200);

      // CANCELLED is terminal — a second attempt is rejected by the
      // transition table, never reaching the notifyAdmins call again.
      const second = await cancelOrder(orderId, adminCookie);
      expect(second.status).toBe(422);

      const list = await request(app).get("/api/v1/admin/notifications").set("Cookie", adminCookie);
      const matches = list.body.data.filter(
        (n: { type: string; entityId: string }) => n.type === "ORDER_CANCELLED" && n.entityId === orderId,
      );
      expect(matches).toHaveLength(1);
    });

    it("does not notify on a non-cancelling status transition", async () => {
      const adminCookie = await asSuperAdmin();
      const orderId = await createOrder(adminCookie);

      const confirm = await request(app)
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "CONFIRMED" });
      expect(confirm.status).toBe(200);

      const list = await request(app).get("/api/v1/admin/notifications").set("Cookie", adminCookie);
      const matches = list.body.data.filter(
        (n: { type: string; entityId: string }) => n.type === "ORDER_CANCELLED" && n.entityId === orderId,
      );
      expect(matches).toHaveLength(0);
    });
  });

  describe("Promotion-created visibility (allowlist fix)", () => {
    it("is visible to a promotions:read holder", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Notify Me" });
      expect(create.status).toBe(201);
      const promotionId = create.body.data.id as string;

      const cookieHeader = await asPermissions(app, ["promotions:read", "notifications:read"]);
      const list = await request(app).get("/api/v1/admin/notifications").set("Cookie", cookieHeader);
      expect(list.status).toBe(200);
      const matches = list.body.data.filter(
        (n: { type: string; entityId: string }) => n.type === "PROMOTION_CREATED" && n.entityId === promotionId,
      );
      expect(matches).toHaveLength(1);
    });

    it("stays invisible to a caller with none of the allowlisted domain permissions", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Hidden From Me" });
      const promotionId = create.body.data.id as string;

      const cookieHeader = await asPermissions(app, ["audit:read", "notifications:read"]);
      const list = await request(app).get("/api/v1/admin/notifications").set("Cookie", cookieHeader);
      expect(list.status).toBe(200);
      expect(list.body.data.some((n: { entityId: string }) => n.entityId === promotionId)).toBe(false);
    });
  });

  describe("GET /api/v1/admin/notifications", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/admin/notifications");
      expect(res.status).toBe(401);
    });

    it("orders newest first and respects limit", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/categories")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send(categoryPayload());
      await request(app)
        .post("/api/v1/categories")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send(categoryPayload());

      const res = await request(app).get("/api/v1/admin/notifications?limit=1").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
      expect(res.body.meta.nextCursor).toBe(1);
    });
  });

  describe("PATCH /api/v1/admin/notifications/:id/read and /read-all", () => {
    it("marks a single notification read, and it persists on a fresh list call", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/categories")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send(categoryPayload());

      const before = await request(app).get("/api/v1/admin/notifications?limit=1").set("Cookie", adminCookie);
      const id = before.body.data[0].id as string;
      expect(before.body.data[0].read).toBe(false);

      const markRead = await request(app)
        .patch(`/api/v1/admin/notifications/${id}/read`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie);
      expect(markRead.status).toBe(204);

      const after = await request(app).get("/api/v1/admin/notifications?limit=1").set("Cookie", adminCookie);
      expect(after.body.data[0].read).toBe(true);
    });

    it("mark-all-read clears unreadCount to 0", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/categories")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send(categoryPayload());

      const markAll = await request(app)
        .patch("/api/v1/admin/notifications/read-all")
        .set(csrfHeaders())
        .set("Cookie", adminCookie);
      expect(markAll.status).toBe(204);

      const count = await request(app).get("/api/v1/admin/notifications/unread-count").set("Cookie", adminCookie);
      expect(count.body.data.count).toBe(0);
    });
  });

  describe("Duplicate prevention", () => {
    it("never creates two rows for the same (type, entityId) pair", async () => {
      const adminCookie = await asSuperAdmin();
      const created = await request(app)
        .post("/api/v1/products")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send(productPayload());
      const productId = created.body.data.id as string;

      const rows = await testPrisma().notification.findMany({
        where: { type: "PRODUCT_CREATED", entityId: productId },
      });
      expect(rows).toHaveLength(1);
    });
  });
});

import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asRole as asSeededRole, asPermissions } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function asRole(key: string) {
  const cookieHeader = await asSeededRole(app, key);
  return { cookieHeader };
}

// Phase 6E collapsed the seeded role set to super_admin/customer — setup-only
// actors (never the subject of a permission-boundary assertion in this file)
// now resolve to super_admin. `asCustomerSupport` was used specifically for
// its "shipping:read but not shipping:update" property (see the 403 tests
// below) — re-expressed as an ad-hoc role holding exactly that permission,
// since customer_support itself no longer exists.
const asOrderManager = () => asRole("super_admin");
const asStoreManager = () => asRole("super_admin");
const asCustomerSupport = () =>
  asPermissions(app, ["shipping:read"]).then((cookieHeader) => ({ cookieHeader }));
const asProductManager = () => asSeededRole(app, "super_admin");
const asInventoryManager = () => asSeededRole(app, "super_admin");

async function asVerifiedCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { cookieHeader, userId: user.id };
}

async function createShippingMethod(cookieHeader: string, overrides: Partial<Record<string, unknown>> = {}) {
  return request(app)
    .post("/api/v1/admin/shipping/methods")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ marketCode: "PK", name: "Standard", baseRate: 30000, ...overrides });
}

async function setupPurchasableVariant(onHand = 10): Promise<{ productId: string; variantId: string }> {
  const productCookie = await asProductManager();
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", productCookie)
    .send(productPayload({ status: "ACTIVE", markets: [{ marketCode: "PK", isAvailable: true, isVisible: true }] }));
  const productId = res.body.data.id as string;
  const variantId = res.body.data.variants[0].id as string;

  await request(app)
    .put(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
    .set(csrfHeaders())
    .set("Cookie", productCookie)
    .send(pricePayload({ amount: 499900 }));

  const inventoryCookie = await asInventoryManager();
  await request(app)
    .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", inventoryCookie)
    .send({ marketCode: "PK", onHand });

  return { productId, variantId };
}

async function addToCart(cookieHeader: string, variantId: string, quantity = 1) {
  return request(app)
    .post("/api/v1/cart/items?market=PK")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ variantId, quantity });
}

/// Places a real order (and, transitively, its Shipment row) through
/// Checkout — Shipping never creates its own rows outside that path.
async function placeOrder(
  cookieHeader: string,
  shippingMethodId: string,
  quantity = 1,
  onHand = 10,
): Promise<{ orderId: string; variantId: string }> {
  const { variantId } = await setupPurchasableVariant(onHand);
  await addToCart(cookieHeader, variantId, quantity);
  const res = await request(app)
    .post("/api/v1/checkout?market=PK")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .set("Idempotency-Key", randomUUID())
    .send({
      billingAddress: {
        fullName: "Jane Doe",
        phone: "+923001234567",
        line1: "House 20, Street 5",
        city: "Lahore",
        countryCode: "PK",
      },
      paymentMethod: "COD",
      shippingMethodId,
    });
  expect(res.status).toBe(201);
  return { orderId: res.body.data.id as string, variantId };
}

function patchShipment(shipmentId: string, cookieHeader: string, body: Record<string, unknown>) {
  return request(app)
    .patch(`/api/v1/admin/shipments/${shipmentId}`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(body);
}

// -- SHIPPING METHODS ---------------------------------------------------------

describe("Shipping methods", () => {
  it("lets staff with shipping:update create a method, and it appears in the public list", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const created = await createShippingMethod(staffCookie, { name: "Express", baseRate: 50000 });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Express");
    expect(created.body.data.isActive).toBe(true);

    const publicList = await request(app).get("/api/v1/shipping/methods?market=PK");
    expect(publicList.status).toBe(200);
    expect(publicList.body.data.map((m: { id: string }) => m.id)).toContain(created.body.data.id);
  });

  it("rejects method creation from a caller without shipping:update", async () => {
    const { cookieHeader: supportCookie } = await asCustomerSupport(); // shipping:read only
    const res = await createShippingMethod(supportCookie);
    expect(res.status).toBe(403);
  });

  it("rejects method creation for an unknown/inactive market", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const res = await createShippingMethod(staffCookie, { marketCode: "ZZ" });
    expect(res.status).toBe(404);
  });

  it("archives a method (isActive=false) rather than hard-deleting, and it drops out of the public list", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const created = await createShippingMethod(staffCookie);
    const methodId = created.body.data.id as string;

    const del = await request(app)
      .delete(`/api/v1/admin/shipping/methods/${methodId}`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(del.status).toBe(204);

    const row = await testPrisma().shippingMethod.findUniqueOrThrow({ where: { id: methodId } });
    expect(row.isActive).toBe(false); // still exists — archived, not deleted

    const publicList = await request(app).get("/api/v1/shipping/methods?market=PK");
    expect(publicList.body.data.map((m: { id: string }) => m.id)).not.toContain(methodId);
  });

  it("lets staff with only shipping:read list admin methods but not create one", async () => {
    const { cookieHeader: supportCookie } = await asCustomerSupport();
    const list = await request(app)
      .get("/api/v1/admin/shipping/methods")
      .set("Cookie", supportCookie);
    expect(list.status).toBe(200);

    const create = await createShippingMethod(supportCookie);
    expect(create.status).toBe(403);
  });
});

// -- CHECKOUT SHIPPING COST + SHIPMENT CREATION --------------------------------

describe("Checkout shipping cost + Shipment creation", () => {
  it("charges baseRate when the order subtotal is below the free-shipping threshold", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie, { baseRate: 30000, freeShippingThreshold: 1000000 });
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();

    const { orderId } = await placeOrder(customerCookie, method.body.data.id, 1); // subtotal 499900 < threshold
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.shippingAmount).toBe(30000);
    expect(order.totalAmount).toBe(order.subtotalAmount + 30000);
  });

  it("charges 0 once the order subtotal reaches the free-shipping threshold", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie, { baseRate: 30000, freeShippingThreshold: 400000 });
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();

    const { orderId } = await placeOrder(customerCookie, method.body.data.id, 1); // subtotal 499900 >= threshold
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.shippingAmount).toBe(0);
    expect(order.totalAmount).toBe(order.subtotalAmount);
  });

  it("rejects checkout with a shippingMethodId from another market", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const aeMethod = await createShippingMethod(staffCookie, { marketCode: "AE" });
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { variantId } = await setupPurchasableVariant();
    await addToCart(customerCookie, variantId, 1);

    const res = await request(app)
      .post("/api/v1/checkout?market=PK")
      .set(csrfHeaders())
      .set("Cookie", customerCookie)
      .set("Idempotency-Key", randomUUID())
      .send({
        billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
        paymentMethod: "COD",
        shippingMethodId: aeMethod.body.data.id,
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPPING_METHOD_UNSUPPORTED");
  });

  it("creates a PENDING Shipment row in the same transaction as the Order", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();

    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });
    expect(shipment.status).toBe("PENDING");
    expect(shipment.shippingMethodId).toBe(method.body.data.id);

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.shipmentStatus).toBe("PENDING"); // Order.shipmentStatus default, unchanged by creation
  });
});

// -- SHIPMENT RETRIEVAL --------------------------------------------------------

describe("Shipment retrieval", () => {
  it("returns the shipment to the owning customer via GET /orders/:orderId/shipment", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);

    const res = await request(app).get(`/api/v1/orders/${orderId}/shipment`).set("Cookie", customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.orderId).toBe(orderId);
  });

  it("hides another customer's shipment as not found", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(owner, method.body.data.id);
    const { cookieHeader: other } = await asVerifiedCustomer();

    const res = await request(app).get(`/api/v1/orders/${orderId}/shipment`).set("Cookie", other);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SHIPMENT_NOT_FOUND");
  });

  it("lets staff with shipping:read view any order's shipment", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const { cookieHeader: adminCookie } = await asOrderManager();

    const res = await request(app).get(`/api/v1/orders/${orderId}/shipment`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated retrieval", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);

    const res = await request(app).get(`/api/v1/orders/${orderId}/shipment`);
    expect(res.status).toBe(401);
  });
});

// -- SHIPMENT STATUS TRANSITIONS ------------------------------------------------

describe("Shipment status transitions", () => {
  it("walks PENDING -> PROCESSING -> SHIPPED -> IN_TRANSIT -> DELIVERED, updating Order.shipmentStatus each time", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    for (const status of ["PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"]) {
      const res = await patchShipment(shipment.id, staffCookie, { status, trackingNumber: "TRK-1", carrier: "Local Courier" });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);

      const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.shipmentStatus).toBe(status);
      expect(order.status).toBe("PENDING"); // Order.status is never touched by Shipping
    }

    const updated = await testPrisma().shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(updated.trackingNumber).toBe("TRK-1");
    expect(updated.shippedAt).not.toBeNull();
    expect(updated.deliveredAt).not.toBeNull();
  });

  it("rejects an invalid transition", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    const res = await patchShipment(shipment.id, staffCookie, { status: "DELIVERED" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_INVALID_STATUS_TRANSITION");
  });

  it("allows CANCELLED only from PENDING/PROCESSING, not after dispatch", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    await patchShipment(shipment.id, staffCookie, { status: "PROCESSING" });
    await patchShipment(shipment.id, staffCookie, { status: "SHIPPED" });

    const res = await patchShipment(shipment.id, staffCookie, { status: "CANCELLED" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_INVALID_STATUS_TRANSITION");
  });

  it("rejects a shipment update once the parent Order is cancelled", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    const { cookieHeader: orderManagerCookie } = await asOrderManager();
    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", orderManagerCookie)
      .send({ status: "CANCELLED" });

    const res = await patchShipment(shipment.id, staffCookie, { status: "PROCESSING" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_ORDER_NOT_SHIPPABLE");
  });

  it("allows ITEM_RETURNED/ITEM_LOST on a dispatched shipment once the parent Order is cancelled", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    await patchShipment(shipment.id, staffCookie, { status: "PROCESSING" });
    await patchShipment(shipment.id, staffCookie, { status: "SHIPPED" });

    const { cookieHeader: orderManagerCookie } = await asOrderManager();
    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", orderManagerCookie)
      .send({ status: "CANCELLED" });

    const res = await patchShipment(shipment.id, staffCookie, { status: "ITEM_RETURNED" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ITEM_RETURNED");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.shipmentStatus).toBe("ITEM_RETURNED");
  });

  it("rejects ITEM_RETURNED/ITEM_LOST on a non-cancelled order", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    await patchShipment(shipment.id, staffCookie, { status: "PROCESSING" });
    await patchShipment(shipment.id, staffCookie, { status: "SHIPPED" });

    const res = await patchShipment(shipment.id, staffCookie, { status: "ITEM_LOST" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_ITEM_OUTCOME_REQUIRES_CANCELLED_ORDER");
  });

  it("rejects ITEM_RETURNED on a cancelled order whose shipment never dispatched (not a valid transition from PENDING)", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    const { cookieHeader: orderManagerCookie } = await asOrderManager();
    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", orderManagerCookie)
      .send({ status: "CANCELLED" });

    const res = await patchShipment(shipment.id, staffCookie, { status: "ITEM_RETURNED" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_INVALID_STATUS_TRANSITION");
  });

  it("still rejects every shipment update on a COMPLETED order, including ITEM_RETURNED/ITEM_LOST", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    await patchShipment(shipment.id, staffCookie, { status: "PROCESSING" });
    await patchShipment(shipment.id, staffCookie, { status: "SHIPPED" });

    const { cookieHeader: orderManagerCookie } = await asOrderManager();
    for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]) {
      await request(app)
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set(csrfHeaders())
        .set("Cookie", orderManagerCookie)
        .send({ status });
    }

    const res = await patchShipment(shipment.id, staffCookie, { status: "ITEM_RETURNED" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SHIPMENT_ORDER_NOT_SHIPPABLE");
  });

  it("rejects updates from a caller without shipping:update", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    const { cookieHeader: supportCookie } = await asCustomerSupport(); // shipping:read only
    const res = await patchShipment(shipment.id, supportCookie, { status: "PROCESSING" });
    expect(res.status).toBe(403);
  });

  it("survives two concurrent identical transitions on the same shipment: exactly one wins", async () => {
    const { cookieHeader: staffCookie } = await asStoreManager();
    const method = await createShippingMethod(staffCookie);
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeOrder(customerCookie, method.body.data.id);
    const shipment = await testPrisma().shipment.findUniqueOrThrow({ where: { orderId } });

    const [a, b] = await Promise.all([
      patchShipment(shipment.id, staffCookie, { status: "PROCESSING" }),
      patchShipment(shipment.id, staffCookie, { status: "PROCESSING" }),
    ]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(winner.status).toBe(200);
    expect([409, 422]).toContain(loser.status);

    const updated = await testPrisma().shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    expect(updated.status).toBe("PROCESSING");
  });
});

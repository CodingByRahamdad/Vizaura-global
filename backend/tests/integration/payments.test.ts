import { randomUUID, createHmac } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { env } from "../../src/config/env.js";
import { asPermissions } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

/// Every checkout call needs a real, market-scoped ShippingMethod as of
/// Phase 4M — created directly via Prisma, baseRate 0 so every existing
/// amount assertion in this file (unrelated to shipping) stays valid.
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
// asOrderManager is setup-only here (needs full payments access to actually
// mark-paid/refund) -> super_admin. asStoreManager/asCustomerSupport were
// used specifically for their "payments:read only, no update/refund"
// property in the 403 boundary tests below -> re-expressed as an ad-hoc
// role holding exactly that one permission.
const asProductManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asInventoryManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asOrderManager = () => asRole("super_admin");
const asStoreManager = () =>
  asPermissions(app, ["payments:read"]).then((cookieHeader) => ({ cookieHeader }));
const asCustomerSupport = () =>
  asPermissions(app, ["payments:read"]).then((cookieHeader) => ({ cookieHeader }));

async function asVerifiedCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { cookieHeader, userId: user.id };
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

/// Places a real order (and, transitively, its Payment row) through
/// Checkout — Payments never creates its own rows outside that path.
async function placeOrder(
  cookieHeader: string,
  paymentMethod: "COD" | "MOCK" = "COD",
  quantity = 1,
  onHand = 10,
): Promise<{ orderId: string; variantId: string; paymentId: string }> {
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
      paymentMethod,
      shippingMethodId: defaultShippingMethodId,
    });
  expect(res.status).toBe(201);
  const orderId = res.body.data.id as string;
  const payment = await testPrisma().payment.findFirstOrThrow({ where: { orderId } });
  return { orderId, variantId, paymentId: payment.id };
}

function signMockWebhook(payload: Record<string, unknown>): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", env.payments.mockWebhookSecret).update(body).digest("hex");
  return { body, signature };
}

function postWebhook(body: string, signature?: string) {
  const req = request(app).post("/api/v1/webhooks/payments/mock").set("Content-Type", "application/json");
  if (signature !== undefined) req.set("X-Webhook-Signature", signature);
  return req.send(body);
}

async function setMockProviderPaymentId(paymentId: string, providerPaymentId: string) {
  await testPrisma().payment.update({ where: { id: paymentId }, data: { providerPaymentId } });
}

function mockPayEventPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventId: randomUUID(),
    providerPaymentId: randomUUID(),
    type: "CAPTURE",
    status: "PAID",
    amount: 499900,
    currencyCode: "PKR",
    ...overrides,
  };
}

// -- CHECKOUT -> PAYMENT CREATION ------------------------------------------

describe("Checkout creates a Payment row", () => {
  it("creates a PENDING COD payment in the same transaction as the order", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(cookieHeader);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.orderId).toBe(orderId);
    expect(payment.provider).toBe("COD");
    expect(payment.status).toBe("PENDING");
    expect(payment.amount).toBe(499900);
  });

  it("idempotent checkout replay does not create a second Payment row", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { variantId } = await setupPurchasableVariant();
    await addToCart(cookieHeader, variantId, 1);
    const key = randomUUID();
    const body = {
      billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
      paymentMethod: "COD",
      shippingMethodId: defaultShippingMethodId,
    };

    const first = await request(app)
      .post("/api/v1/checkout?market=PK")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/checkout?market=PK")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .set("Idempotency-Key", key)
      .send(body);
    expect(second.status).toBe(200);

    const payments = await testPrisma().payment.findMany({ where: { orderId: first.body.data.id } });
    expect(payments).toHaveLength(1);
  });

  it("survives two concurrent checkouts with the identical Idempotency-Key: exactly one Payment row", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { variantId } = await setupPurchasableVariant();
    await addToCart(cookieHeader, variantId, 1);
    const key = randomUUID();
    const body = {
      billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
      paymentMethod: "COD",
      shippingMethodId: defaultShippingMethodId,
    };
    const send = () =>
      request(app).post("/api/v1/checkout?market=PK").set(csrfHeaders()).set("Cookie", cookieHeader).set("Idempotency-Key", key).send(body);

    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 201]);

    const orderId = (a.status === 201 ? a : b).body.data.id as string;
    const payments = await testPrisma().payment.findMany({ where: { orderId } });
    expect(payments).toHaveLength(1);
  });
});

// -- RETRIEVAL --------------------------------------------------------------

describe("Payment retrieval", () => {
  it("returns the payment to its owning customer", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(cookieHeader);
    const res = await request(app).get(`/api/v1/payments/${paymentId}`).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(paymentId);
    expect(res.body.data.transactions).toEqual([]);
  });

  it("hides another customer's payment as not found", async () => {
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(owner);
    const { cookieHeader: other } = await asVerifiedCustomer();

    const res = await request(app).get(`/api/v1/payments/${paymentId}`).set("Cookie", other);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PAYMENTS_NOT_FOUND");
  });

  it("lets staff with payments:read view any payment", async () => {
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(owner);
    const { cookieHeader: staff } = await asOrderManager();

    const res = await request(app).get(`/api/v1/payments/${paymentId}`).set("Cookie", staff);
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated retrieval", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(cookieHeader);
    const res = await request(app).get(`/api/v1/payments/${paymentId}`);
    expect(res.status).toBe(401);
  });
});

// -- MARK PAID / MARK FAILED (COD staff actions) -----------------------------

describe("COD mark-paid / mark-failed", () => {
  it("payments:update staff can mark a COD payment paid, and Order.paymentStatus follows", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAID");
    expect(res.body.data.transactions).toHaveLength(1);
    expect(res.body.data.transactions[0].type).toBe("CAPTURE");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.status).toBe("PENDING"); // Order.status is never touched by Payments
  });

  it("payments:update staff can mark a COD payment failed", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-failed`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ reason: "card declined" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("FAILED");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("FAILED");
    expect(order.status).toBe("PENDING"); // no auto-cancel, no inventory release
  });

  it("rejects mark-paid from a payments:read-only role", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: storeManagerCookie } = await asStoreManager();

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", storeManagerCookie);
    expect(res.status).toBe(403);
  });

  it("rejects mark-paid from customer_support (payments:read only)", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: supportCookie } = await asCustomerSupport();

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", supportCookie);
    expect(res.status).toBe(403);
  });

  it("rejects mark-paid against a MOCK payment", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const { cookieHeader: staffCookie } = await asOrderManager();

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_STAFF_ACTION_UNSUPPORTED");
  });

  it("rejects mark-paid once the order has been cancelled, even though the payment is still PENDING", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ status: "CANCELLED" });

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_ORDER_NOT_PAYABLE");

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PENDING"); // unaffected — the guard rejected before any write
  });

  it("rejects mark-failed once the order has been cancelled", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie);
    const { cookieHeader: staffCookie } = await asOrderManager();

    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ status: "CANCELLED" });

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-failed`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ reason: "too late" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_ORDER_NOT_PAYABLE");
  });
});

// -- WEBHOOK ------------------------------------------------------------------

describe("Payments webhook (MOCK provider)", () => {
  it("processes a correctly-signed PAID event end to end", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const { body, signature } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const res = await postWebhook(body, signature);
    expect(res.status).toBe(200);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PAID");
    expect(payment.paidAt).not.toBeNull();

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PAID");

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.type).toBe("CAPTURE");

    const events = await testPrisma().paymentWebhookEvent.findMany({ where: { provider: "MOCK" } });
    expect(events).toHaveLength(1);
  });

  it("rejects a missing signature", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const { body } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const res = await postWebhook(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENTS_WEBHOOK_SIGNATURE_INVALID");

    const events = await testPrisma().paymentWebhookEvent.findMany({});
    expect(events).toHaveLength(0);
  });

  it("rejects a wrong signature", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const { body } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const res = await postWebhook(body, "0".repeat(64));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PAYMENTS_WEBHOOK_SIGNATURE_INVALID");
  });

  it("treats a duplicate webhook delivery (same eventId) as a no-op", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const payload = mockPayEventPayload({ providerPaymentId });
    const first = signMockWebhook(payload);
    const firstRes = await postWebhook(first.body, first.signature);
    expect(firstRes.status).toBe(200);

    const second = signMockWebhook(payload); // identical eventId
    const secondRes = await postWebhook(second.body, second.signature);
    expect(secondRes.status).toBe(200);

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId } });
    expect(transactions).toHaveLength(1);
  });

  it("rejects a webhook for an order that is no longer payable (CANCELLED)", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const { cookieHeader: staffCookie } = await asOrderManager();
    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ status: "CANCELLED" });

    const { body, signature } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const res = await postWebhook(body, signature);
    expect(res.status).toBe(200); // still 200 — recorded, just not applied

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
  });

  it("rejects a webhook with a mismatched amount", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const { body, signature } = signMockWebhook(mockPayEventPayload({ providerPaymentId, amount: 1 }));
    const res = await postWebhook(body, signature);
    expect(res.status).toBe(200);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PENDING");
  });

  it("survives a success+failure race for the same payment: exactly one wins", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);

    const paid = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const failed = signMockWebhook(
      mockPayEventPayload({ providerPaymentId, eventId: randomUUID(), type: "AUTHORIZATION", status: "FAILED" }),
    );

    const [a, b] = await Promise.all([postWebhook(paid.body, paid.signature), postWebhook(failed.body, failed.signature)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(["PAID", "FAILED"]).toContain(payment.status);

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId } });
    expect(transactions).toHaveLength(1); // only the guarded winner's event was recorded
  });
});

// -- REFUND -------------------------------------------------------------------

describe("Refunds", () => {
  async function payViaWebhook(paymentId: string) {
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);
    const { body, signature } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    const res = await postWebhook(body, signature);
    expect(res.status).toBe(200);
  }

  it("refunds a paid payment in full, updating Order.paymentStatus", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie, "MOCK");
    await payViaWebhook(paymentId);

    const { cookieHeader: staffCookie } = await asOrderManager();
    const res = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REFUNDED");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("REFUNDED");

    // Phase 4P: a standalone (non-Return) gateway refund is tagged
    // GATEWAY_REFUND with no returnId — distinguishable from a Return-driven
    // refund without parsing providerReference (see returns.test.ts).
    const refundTx = await testPrisma().paymentTransaction.findFirstOrThrow({ where: { paymentId, type: "REFUND" } });
    expect(refundTx.metadata).toMatchObject({ source: "GATEWAY_REFUND", returnId: null });
  });

  it("is idempotent: a repeat refund request against an already-refunded payment is a no-op", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    await payViaWebhook(paymentId);

    const { cookieHeader: staffCookie } = await asOrderManager();
    const first = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(csrfHeaders()).set("Cookie", staffCookie).send({});
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set(csrfHeaders()).set("Cookie", staffCookie).send({});
    expect(second.status).toBe(200);
    expect(second.body.data.status).toBe("REFUNDED");

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactions).toHaveLength(1);
  });

  it("rejects a refund amount exceeding the captured amount", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    await payViaWebhook(paymentId);

    const { cookieHeader: staffCookie } = await asOrderManager();
    const res = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ amount: 999999999 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_REFUND_EXCEEDS_CAPTURED");
  });

  it("rejects a refund from a caller without payments:refund", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    await payViaWebhook(paymentId);

    const res = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(csrfHeaders())
      .set("Cookie", customerCookie)
      .send({});
    expect(res.status).toBe(403);
  });

  it("serializes concurrent partial-refund requests: total refunded never exceeds the captured amount", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    await payViaWebhook(paymentId); // payment.amount = 499900

    const { cookieHeader: staffCookie } = await asOrderManager();
    const requestAmount = 300000; // two concurrent requests for this amount sum to 600000 > 499900
    const send = () =>
      request(app)
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set(csrfHeaders())
        .set("Cookie", staffCookie)
        .send({ amount: requestAmount });

    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    // The lock serializes the two requests: the first to acquire it succeeds
    // against the full remaining amount; the second re-reads the now-reduced
    // remaining amount and is rejected as exceeding it — never both accepted.
    expect(statuses).toEqual([200, 422]);

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.amount).toBe(requestAmount);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PARTIALLY_REFUNDED");

    const totalRefunded = transactions.reduce((sum, t) => sum + t.amount, 0);
    expect(totalRefunded).toBeLessThanOrEqual(payment.amount);
  });
});

// -- COD REFUND ATTESTATION (Phase 4O) ----------------------------------------

describe("COD refund attestation (mark-refunded)", () => {
  async function payCodPayment(paymentId: string, staffCookie: string) {
    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(res.status).toBe(200);
  }

  it("payments:refund staff can attest a COD refund, updating Order.paymentStatus", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, paymentId } = await placeOrder(customerCookie, "COD");
    const { cookieHeader: staffCookie } = await asOrderManager();
    await payCodPayment(paymentId, staffCookie);

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ reference: "cash-receipt-001" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REFUNDED");
    const refundTx = res.body.data.transactions.find((t: { type: string }) => t.type === "REFUND");
    expect(refundTx.providerReference).toBe("cash-receipt-001");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("REFUNDED");

    // Phase 4P: a standalone (non-Return) COD attestation is tagged
    // COD_ATTESTATION with no returnId.
    const dbTx = await testPrisma().paymentTransaction.findFirstOrThrow({ where: { paymentId, type: "REFUND" } });
    expect(dbTx.metadata).toMatchObject({ source: "COD_ATTESTATION", returnId: null });
  });

  it("falls back to a staff-identifying reference when none is supplied", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "COD");
    const { cookieHeader: staffCookie, userId: staffId } = await asOrderManager();
    await payCodPayment(paymentId, staffCookie);

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({});
    expect(res.status).toBe(200);
    const refundTx = res.body.data.transactions.find((t: { type: string }) => t.type === "REFUND");
    expect(refundTx.providerReference).toBe(`staff:${staffId}`);
  });

  it("rejects mark-refunded against a MOCK payment — no attestation path for a real provider", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "MOCK");
    const providerPaymentId = randomUUID();
    await setMockProviderPaymentId(paymentId, providerPaymentId);
    const { body, signature } = signMockWebhook(mockPayEventPayload({ providerPaymentId }));
    await postWebhook(body, signature);

    const { cookieHeader: staffCookie } = await asOrderManager();
    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_STAFF_ACTION_UNSUPPORTED");
  });

  it("rejects mark-refunded from a caller without payments:refund", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "COD");
    const { cookieHeader: staffCookie } = await asOrderManager();
    await payCodPayment(paymentId, staffCookie);

    const { cookieHeader: storeManagerCookie } = await asStoreManager();
    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", storeManagerCookie);
    expect(res.status).toBe(403);
  });

  it("rejects an attested amount exceeding the captured amount", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "COD");
    const { cookieHeader: staffCookie } = await asOrderManager();
    await payCodPayment(paymentId, staffCookie);

    const res = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ amount: 999999999 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PAYMENTS_REFUND_EXCEEDS_CAPTURED");
  });

  it("serializes concurrent mark-refunded requests: total refunded never exceeds the captured amount", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { paymentId } = await placeOrder(customerCookie, "COD");
    const { cookieHeader: staffCookie } = await asOrderManager();
    await payCodPayment(paymentId, staffCookie); // payment.amount = 499900

    const requestAmount = 300000;
    const send = () =>
      request(app)
        .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
        .set(csrfHeaders())
        .set("Cookie", staffCookie)
        .send({ amount: requestAmount });

    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 422]);

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactions).toHaveLength(1);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PARTIALLY_REFUNDED");
  });
});

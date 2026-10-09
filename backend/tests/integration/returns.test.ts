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
// asCustomerSupport was used for its "returns:read only" property (see the
// 403 test below) -> re-expressed as an ad-hoc role.
const asProductManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asInventoryManager = () => asRole("super_admin").then((r) => r.cookieHeader);
const asOrderManager = () => asRole("super_admin");
const asCustomerSupport = () =>
  asPermissions(app, ["returns:read"]).then((cookieHeader) => ({ cookieHeader }));

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

function patchStatus(orderId: string, cookieHeader: string, status: string) {
  return request(app)
    .patch(`/api/v1/admin/orders/${orderId}/status`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ status });
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

/// Places an order and walks it through the full lifecycle to COMPLETED —
/// the only Order.status a return can be filed against this phase (see
/// docs/modules/RETURNS.md). By COMPLETED, the reservation is fully
/// released and onHand fully decremented, exactly the precondition
/// Returns' own restock logic depends on.
///
/// paymentMethod defaults to "COD" (mark-paid). As of Phase 4O, a COD
/// return's refund step succeeds too — ReturnsService.refund() branches a
/// COD payment to PaymentsService.markRefunded() (a staff attestation, no
/// provider call) instead of the provider-calling refund() MOCK/a real
/// gateway use — see docs/modules/PAYMENTS.md.
async function placeCompletedOrder(
  customerCookie: string,
  quantity = 3,
  onHand = 10,
  paymentMethod: "COD" | "MOCK" = "COD",
): Promise<{ orderId: string; variantId: string; orderItemId: string; paymentId: string }> {
  const { variantId } = await setupPurchasableVariant(onHand);
  await addToCart(customerCookie, variantId, quantity);
  const checkoutRes = await request(app)
    .post("/api/v1/checkout?market=PK")
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .set("Idempotency-Key", randomUUID())
    .send({
      billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
      paymentMethod,
      shippingMethodId: defaultShippingMethodId,
    });
  expect(checkoutRes.status).toBe(201);
  const orderId = checkoutRes.body.data.id as string;

  const { cookieHeader: staffCookie } = await asOrderManager();
  const payment = await testPrisma().payment.findFirstOrThrow({ where: { orderId } });

  if (paymentMethod === "COD") {
    const markPaid = await request(app)
      .patch(`/api/v1/admin/payments/${payment.id}/mark-paid`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie);
    expect(markPaid.status).toBe(200);
  } else {
    const providerPaymentId = randomUUID();
    await testPrisma().payment.update({ where: { id: payment.id }, data: { providerPaymentId } });
    const { body, signature } = signMockWebhook({
      eventId: randomUUID(),
      providerPaymentId,
      type: "CAPTURE",
      status: "PAID",
      amount: payment.amount,
      currencyCode: payment.currencyCode,
    });
    const webhookRes = await postWebhook(body, signature);
    expect(webhookRes.status).toBe(200);
  }

  for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]) {
    const res = await patchStatus(orderId, staffCookie, status);
    expect(res.status).toBe(200);
  }

  const orderItem = await testPrisma().orderItem.findFirstOrThrow({ where: { orderId } });
  return { orderId, variantId, orderItemId: orderItem.id, paymentId: payment.id };
}

/// Two-line variant of placeCompletedOrder, for Part D's "a partial return
/// on one line leaves an untouched second line still fully returnable"
/// invariant — needs two distinct OrderItems, which the single-line helper
/// above can't produce.
async function placeCompletedOrderWithTwoItems(
  customerCookie: string,
  quantityA = 2,
  quantityB = 2,
): Promise<{ orderId: string; orderItemIdA: string; orderItemIdB: string }> {
  const { variantId: variantIdA } = await setupPurchasableVariant(10);
  const { variantId: variantIdB } = await setupPurchasableVariant(10);
  await addToCart(customerCookie, variantIdA, quantityA);
  await addToCart(customerCookie, variantIdB, quantityB);
  const checkoutRes = await request(app)
    .post("/api/v1/checkout?market=PK")
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .set("Idempotency-Key", randomUUID())
    .send({
      billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
      paymentMethod: "COD",
      shippingMethodId: defaultShippingMethodId,
    });
  expect(checkoutRes.status).toBe(201);
  const orderId = checkoutRes.body.data.id as string;

  const { cookieHeader: staffCookie } = await asOrderManager();
  const payment = await testPrisma().payment.findFirstOrThrow({ where: { orderId } });
  const markPaid = await request(app)
    .patch(`/api/v1/admin/payments/${payment.id}/mark-paid`)
    .set(csrfHeaders())
    .set("Cookie", staffCookie);
  expect(markPaid.status).toBe(200);

  for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]) {
    const res = await patchStatus(orderId, staffCookie, status);
    expect(res.status).toBe(200);
  }

  const items = await testPrisma().orderItem.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  return { orderId, orderItemIdA: items[0]!.id, orderItemIdB: items[1]!.id };
}

function createReturn(orderId: string, cookieHeader: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/v1/orders/${orderId}/returns`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(body);
}

function patchReturn(returnId: string, action: string, cookieHeader: string, body: Record<string, unknown> = {}) {
  return request(app)
    .patch(`/api/v1/admin/returns/${returnId}/${action}`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(body);
}

// -- ELIGIBILITY / CREATION ----------------------------------------------------

describe("Return creation", () => {
  it("rejects a return request against an order that is not COMPLETED", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { variantId } = await setupPurchasableVariant();
    await addToCart(customerCookie, variantId, 1);
    const checkoutRes = await request(app)
      .post("/api/v1/checkout?market=PK")
      .set(csrfHeaders())
      .set("Cookie", customerCookie)
      .set("Idempotency-Key", randomUUID())
      .send({
        billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
        paymentMethod: "COD",
        shippingMethodId: defaultShippingMethodId,
      });
    const orderId = checkoutRes.body.data.id as string;
    const orderItem = await testPrisma().orderItem.findFirstOrThrow({ where: { orderId } });

    const res = await createReturn(orderId, customerCookie, { items: [{ orderItemId: orderItem.id, quantity: 1 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RETURNS_ORDER_NOT_RETURNABLE");
  });

  it("creates a REQUESTED return for a COMPLETED order", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);

    const res = await createReturn(orderId, customerCookie, { reason: "changed my mind", items: [{ orderItemId, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("REQUESTED");
    expect(res.body.data.items).toHaveLength(1);
  });

  it("rejects a return quantity exceeding what remains returnable", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);

    const res = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 4 }] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RETURNS_QUANTITY_EXCEEDS_AVAILABLE");
  });

  it("rejects an orderItemId that doesn't belong to the order", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId } = await placeCompletedOrder(customerCookie, 3);

    const res = await createReturn(orderId, customerCookie, { items: [{ orderItemId: randomUUID(), quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RETURNS_VALIDATION_ERROR");
  });

  it("rejects a second open return while one is already open on the same order", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);

    const first = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    expect(first.status).toBe(201);

    const second = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("RETURNS_ALREADY_OPEN");
  });

  it("hides another customer's order from a return-creation attempt", async () => {
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(owner, 3);
    const { cookieHeader: other } = await asVerifiedCustomer();

    const res = await createReturn(orderId, other, { items: [{ orderItemId, quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("RETURNS_NOT_FOUND");
  });

  it("allows a second, later partial return against the same order once the first is REFUNDED", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3, 10, "MOCK");
    const { cookieHeader: staffCookie } = await asOrderManager();

    const first = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const firstId = first.body.data.id as string;
    await patchReturn(firstId, "approve", staffCookie);
    await patchReturn(firstId, "receive", staffCookie);
    const refunded = await patchReturn(firstId, "refund", staffCookie);
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.status).toBe("REFUNDED");

    const second = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 2 }] });
    expect(second.status).toBe(201);
  });

  // Part D (Phase 4P) invariant matrix: multiple sequential partial returns
  // that together exactly exhaust an item's quantity, then a further
  // over-return attempt is rejected — the per-item remaining-quantity check
  // (sumReturnedQuantities), not Order.status, is what actually gates this.
  it("rejects a further return once sequential partial returns have exactly exhausted the item's quantity", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3, 10, "MOCK");
    const { cookieHeader: staffCookie } = await asOrderManager();

    const first = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 2 }] });
    expect(first.status).toBe(201);
    const firstId = first.body.data.id as string;
    await patchReturn(firstId, "approve", staffCookie);
    await patchReturn(firstId, "receive", staffCookie);
    await patchReturn(firstId, "refund", staffCookie);

    const second = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    expect(second.status).toBe(201); // exactly exhausts remaining quantity (3 - 2 = 1)
    const secondId = second.body.data.id as string;
    await patchReturn(secondId, "approve", staffCookie);
    await patchReturn(secondId, "receive", staffCookie);
    await patchReturn(secondId, "refund", staffCookie);

    const third = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    expect(third.status).toBe(422);
    expect(third.body.error.code).toBe("RETURNS_QUANTITY_EXCEEDS_AVAILABLE");
  });

  // Part D: a partial return against one line must not affect a second,
  // untouched line's returnability — Order.status alone is never enough to
  // decide this; per-item accounting on ReturnItem/OrderItem is authoritative.
  it("leaves an untouched second line fully returnable after a partial return on the first", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemIdA, orderItemIdB } = await placeCompletedOrderWithTwoItems(customerCookie, 2, 2);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const returnA = await createReturn(orderId, customerCookie, { items: [{ orderItemId: orderItemIdA, quantity: 1 }] });
    expect(returnA.status).toBe(201);
    const returnAId = returnA.body.data.id as string;
    await patchReturn(returnAId, "approve", staffCookie);
    await patchReturn(returnAId, "receive", staffCookie);
    await patchReturn(returnAId, "refund", staffCookie);

    // Line B was never touched — its full original quantity must still be returnable.
    const returnB = await createReturn(orderId, customerCookie, { items: [{ orderItemId: orderItemIdB, quantity: 2 }] });
    expect(returnB.status).toBe(201);
  });
});

// -- FULL LIFECYCLE -------------------------------------------------------------

describe("Return lifecycle", () => {
  it("walks REQUESTED -> APPROVED -> RECEIVED -> REFUNDED, restocking inventory and advancing Order.status", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId, variantId } = await placeCompletedOrder(customerCookie, 3, 10, "MOCK");
    const { cookieHeader: staffCookie, userId: staffId } = await asOrderManager();

    const stockAfterComplete = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stockAfterComplete.onHand).toBe(7); // 10 - 3 decremented at COMPLETED

    const created = await createReturn(orderId, customerCookie, { reason: "wrong size", items: [{ orderItemId, quantity: 2 }] });
    expect(created.status).toBe(201);
    const returnId = created.body.data.id as string;

    const approved = await patchReturn(returnId, "approve", staffCookie);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");
    expect(approved.body.data.reviewedByUserId).toBe(staffId);

    const received = await patchReturn(returnId, "receive", staffCookie);
    expect(received.status).toBe(200);
    expect(received.body.data.status).toBe("RECEIVED");

    const stockAfterReceive = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stockAfterReceive.onHand).toBe(9); // 7 + 2 restocked

    const movements = await testPrisma().stockMovement.findMany({ where: { stockId: stockAfterReceive.id, type: "ADJUSTMENT" } });
    expect(movements.filter((m) => m.quantityDelta === 2)).toHaveLength(1);

    const orderAfterReceive = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderAfterReceive.status).toBe("RETURNED");

    const refunded = await patchReturn(returnId, "refund", staffCookie);
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.status).toBe("REFUNDED");
    expect(refunded.body.data.refundAmount).toBe(499900 * 2);

    const orderAfterRefund = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(orderAfterRefund.status).toBe("REFUNDED");
    expect(orderAfterRefund.paymentStatus).toBe("PARTIALLY_REFUNDED"); // 2 of 3 units refunded

    const payment = await testPrisma().payment.findFirstOrThrow({ where: { orderId } });
    expect(payment.status).toBe("PARTIALLY_REFUNDED");
    const refundTx = await testPrisma().paymentTransaction.findFirstOrThrow({ where: { paymentId: payment.id, type: "REFUND" } });
    expect(refundTx.metadata).toMatchObject({ source: "GATEWAY_REFUND", returnId });
  });

  it("rejects with a required rejectionReason, leaving Order/Payment untouched", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;

    const missingReason = await patchReturn(returnId, "reject", staffCookie, {});
    expect(missingReason.status).toBe(400);

    const rejected = await patchReturn(returnId, "reject", staffCookie, { rejectionReason: "item not eligible" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(rejected.body.data.rejectionReason).toBe("item not eligible");

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("COMPLETED"); // untouched
  });

  it("rejects an invalid transition (e.g. receive before approve)", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;

    const res = await patchReturn(returnId, "receive", staffCookie);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("RETURNS_INVALID_STATUS_TRANSITION");
  });

  // Phase 4O: COD's refund() previously always 422'd (no provider to call);
  // ReturnsService.refund() now branches a COD payment to
  // PaymentsService.markRefunded() (a staff attestation, not a second
  // refund implementation — docs/modules/PAYMENTS.md) so a COD return can
  // actually complete.
  it("completes REQUESTED -> ... -> REFUNDED for a COD order via staff refund attestation", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId, paymentId } = await placeCompletedOrder(customerCookie, 2, 10, "COD");
    const { cookieHeader: staffCookie, userId: staffId } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;
    await patchReturn(returnId, "approve", staffCookie);
    await patchReturn(returnId, "receive", staffCookie);

    const refunded = await patchReturn(returnId, "refund", staffCookie);
    expect(refunded.status).toBe(200);
    expect(refunded.body.data.status).toBe("REFUNDED");
    expect(refunded.body.data.refundAmount).toBe(499900);

    const payment = await testPrisma().payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe("PARTIALLY_REFUNDED");
    const refundTx = await testPrisma().paymentTransaction.findFirstOrThrow({ where: { paymentId, type: "REFUND" } });
    expect(refundTx.providerReference).toBe(`staff:${staffId}`);
    expect(refundTx.metadata).toMatchObject({ source: "COD_ATTESTATION", returnId });

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("REFUNDED");
  });

  // Phase 4O defect fix: ReturnsService.refund() claims RECEIVED->REFUNDED
  // before calling Payments, so a failure there must revert the claim
  // rather than leave the Return permanently, falsely reporting REFUNDED
  // with no money actually moved (see docs/modules/RETURNS.md).
  it("reverts the Return to RECEIVED (not stuck REFUNDED) when the underlying Payments call fails, and the failure is retryable", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId, paymentId } = await placeCompletedOrder(customerCookie, 3, 10, "COD");
    const { cookieHeader: staffCookie } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;
    await patchReturn(returnId, "approve", staffCookie);
    await patchReturn(returnId, "receive", staffCookie);
    // Return's refundAmount for 1 unit = 499900; order total = 1499700.

    // Deplete most of the payment's remaining refundable headroom directly
    // (not through Returns) so the Return's own refund attempt genuinely
    // exceeds what's left — a real, reproducible Payments-layer failure,
    // not a mock.
    const precede = await request(app)
      .patch(`/api/v1/admin/payments/${paymentId}/mark-refunded`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ amount: 1100000, reference: "unrelated-manual-adjustment" });
    expect(precede.status).toBe(200);

    const failed = await patchReturn(returnId, "refund", staffCookie);
    expect(failed.status).toBe(422);
    expect(failed.body.error.code).toBe("PAYMENTS_REFUND_EXCEEDS_CAPTURED");

    const returnAfterFailure = await testPrisma().return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnAfterFailure.status).toBe("RECEIVED"); // reverted, not stuck REFUNDED

    const transactionsAfterFailure = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactionsAfterFailure).toHaveLength(1); // only the precede refund — the failed attempt created nothing

    // Retrying under the same (still-insufficient) conditions fails the
    // same clean way again — the Return stays recoverable, never stuck.
    const retry = await patchReturn(returnId, "refund", staffCookie);
    expect(retry.status).toBe(422);
    expect(retry.body.error.code).toBe("PAYMENTS_REFUND_EXCEEDS_CAPTURED");
    const returnAfterRetry = await testPrisma().return.findUniqueOrThrow({ where: { id: returnId } });
    expect(returnAfterRetry.status).toBe("RECEIVED");
    const transactionsAfterRetry = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactionsAfterRetry).toHaveLength(1); // still no second (duplicate or partial) transaction

    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("RETURNED"); // unaffected by the refund failure/revert — set at receive(), not refund()
  });
});

// -- RETRIEVAL / RBAC -----------------------------------------------------------

describe("Return retrieval and RBAC", () => {
  it("returns own return to the requesting customer", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);
    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;

    const res = await request(app).get(`/api/v1/returns/${returnId}`).set("Cookie", customerCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(returnId);
  });

  it("hides another customer's return", async () => {
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(owner, 3);
    const created = await createReturn(orderId, owner, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;
    const { cookieHeader: other } = await asVerifiedCustomer();

    const res = await request(app).get(`/api/v1/returns/${returnId}`).set("Cookie", other);
    expect(res.status).toBe(404);
  });

  it("lets staff with returns:read view any return but not approve it", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);
    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;
    const { cookieHeader: supportCookie } = await asCustomerSupport(); // returns:read only

    const view = await request(app).get(`/api/v1/returns/${returnId}`).set("Cookie", supportCookie);
    expect(view.status).toBe(200);

    const approve = await patchReturn(returnId, "approve", supportCookie);
    expect(approve.status).toBe(403);
  });

  it("rejects unauthenticated retrieval", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);
    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });

    const res = await request(app).get(`/api/v1/returns/${created.body.data.id}`);
    expect(res.status).toBe(401);
  });
});

// -- CONCURRENCY -----------------------------------------------------------------

describe("Return concurrency", () => {
  it("survives two concurrent duplicate return-creation attempts: exactly one succeeds", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId } = await placeCompletedOrder(customerCookie, 3);

    const [a, b] = await Promise.all([
      createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] }),
      createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const returns = await testPrisma().return.findMany({ where: { orderId } });
    expect(returns).toHaveLength(1);
  });

  it("survives two concurrent receive() requests: restocks exactly once", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId, variantId } = await placeCompletedOrder(customerCookie, 3);
    const { cookieHeader: staffCookie } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 2 }] });
    const returnId = created.body.data.id as string;
    await patchReturn(returnId, "approve", staffCookie);

    const [a, b] = await Promise.all([patchReturn(returnId, "receive", staffCookie), patchReturn(returnId, "receive", staffCookie)]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(winner.status).toBe(200);
    expect([409, 422]).toContain(loser.status);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    const movements = await testPrisma().stockMovement.findMany({ where: { stockId: stock.id, type: "ADJUSTMENT", quantityDelta: 2 } });
    expect(movements).toHaveLength(1); // restocked exactly once, not twice
  });

  it("survives two concurrent refund() requests: refunds exactly once", async () => {
    const { cookieHeader: customerCookie } = await asVerifiedCustomer();
    const { orderId, orderItemId, paymentId } = await placeCompletedOrder(customerCookie, 3, 10, "MOCK");
    const { cookieHeader: staffCookie } = await asOrderManager();

    const created = await createReturn(orderId, customerCookie, { items: [{ orderItemId, quantity: 1 }] });
    const returnId = created.body.data.id as string;
    await patchReturn(returnId, "approve", staffCookie);
    await patchReturn(returnId, "receive", staffCookie);

    const [a, b] = await Promise.all([patchReturn(returnId, "refund", staffCookie), patchReturn(returnId, "refund", staffCookie)]);
    const winner = a.status === 200 ? a : b;
    const loser = a.status === 200 ? b : a;
    expect(winner.status).toBe(200);
    expect([409, 422]).toContain(loser.status);

    const transactions = await testPrisma().paymentTransaction.findMany({ where: { paymentId, type: "REFUND" } });
    expect(transactions).toHaveLength(1); // refunded exactly once, not twice
  });
});

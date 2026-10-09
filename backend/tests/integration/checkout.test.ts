import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

/// Every checkout call needs a real, market-scoped ShippingMethod as of
/// Phase 4M — created directly via Prisma (not the admin API) to keep every
/// other test in this file focused on what it's actually testing.
/// baseRate: 0 so `validCheckoutBody()`'s many existing totalAmount
/// assertions (== subtotal) stay valid without individually threading a
/// shipping cost through them; see shipping.test.ts for real-rate coverage.
async function createShippingMethod(marketCode = "PK", overrides: Partial<Record<string, unknown>> = {}): Promise<string> {
  const market = await testPrisma().market.findUniqueOrThrow({ where: { code: marketCode } });
  const method = await testPrisma().shippingMethod.create({
    data: { marketId: market.id, name: `Standard ${marketCode}`, baseRate: 0, ...overrides },
  });
  return method.id;
}

let defaultShippingMethodId: string;

beforeEach(async () => {
  defaultShippingMethodId = await createShippingMethod("PK");
});

async function asRole(key: string) {
  const { cookieHeader, payload } = await registerUser(app);
  const role = await testPrisma().role.findUniqueOrThrow({ where: { key } });
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().userRole.create({ data: { userId: user.id, roleId: role.id } });
  return cookieHeader;
}

// Phase 6E collapsed the seeded role set to super_admin/customer — both
// are setup-only helpers here (create products / set up stock).
const asProductManager = () => asRole("super_admin");
const asInventoryManager = () => asRole("super_admin");

async function asCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  return { cookieHeader, userId: user.id };
}

/// Checkout requires a verified email (RBAC.md's own documented intended
/// use of requireVerifiedEmail: "order placement"). Bypasses the full
/// verify-email token flow — tests elsewhere (auth.login.test.ts) already
/// establish this direct-DB-update shortcut as the accepted convention.
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
    .send(
      productPayload({
        status: "ACTIVE",
        markets: [
          { marketCode: "PK", isAvailable: true, isVisible: true },
          { marketCode: "AE", isAvailable: true, isVisible: true },
        ],
      }),
    );
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

async function setPrice(productId: string, variantId: string, marketCode = "PK", amount = 499900) {
  const cookieHeader = await asProductManager();
  await request(app)
    .put(`/api/v1/products/${productId}/variants/${variantId}/prices/${marketCode}`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(pricePayload({ amount, currencyCode: marketCode === "AE" ? "AED" : undefined }));
}

async function setStock(productId: string, variantId: string, onHand: number, marketCode = "PK") {
  const cookieHeader = await asInventoryManager();
  await request(app)
    .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ marketCode, onHand });
}

async function setupPurchasableVariant(onHand = 10): Promise<{ productId: string; variantId: string }> {
  const productCookie = await asProductManager();
  const { productId, variantId } = await createActiveProduct(productCookie);
  await setPrice(productId, variantId);
  await setStock(productId, variantId, onHand);
  return { productId, variantId };
}

async function addToCart(cookieHeader: string, variantId: string, quantity = 1, marketCode = "PK") {
  return request(app)
    .post(`/api/v1/cart/items?market=${marketCode}`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ variantId, quantity });
}

function checkoutUrl(marketCode = "PK") {
  return `/api/v1/checkout?market=${marketCode}`;
}

function validCheckoutBody(overrides: Partial<Record<string, unknown>> = {}) {
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
    ...overrides,
  };
}

async function checkoutRequest(
  cookieHeader: string,
  body: Record<string, unknown>,
  idempotencyKey = randomUUID(),
  marketCode = "PK",
) {
  return request(app)
    .post(checkoutUrl(marketCode))
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .set("Idempotency-Key", idempotencyKey)
    .send(body);
}

// -- AUTH / OWNERSHIP -------------------------------------------------------

describe("Checkout auth and preconditions", () => {
  it("rejects an unauthenticated checkout", async () => {
    const res = await request(app)
      .post(checkoutUrl())
      .set(csrfHeaders())
      .set("Idempotency-Key", randomUUID())
      .send(validCheckoutBody());
    expect(res.status).toBe(401);
  });

  it("rejects an unverified customer", async () => {
    const { cookieHeader } = await asCustomer();
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED");
  });

  it("rejects a missing Idempotency-Key header", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await request(app)
      .post(checkoutUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(validCheckoutBody());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CHECKOUT_VALIDATION_ERROR");
  });

  it("rejects an unknown market code", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await checkoutRequest(cookieHeader, validCheckoutBody(), randomUUID(), "ZZ");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects checkout when the customer has no cart in this market", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHECKOUT_CART_NOT_FOUND");
  });
});

describe("Checkout request validation", () => {
  it("rejects checkout on an empty (but existing) cart", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    await request(app).get("/api/v1/cart?market=PK").set("Cookie", cookieHeader);

    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CHECKOUT_CART_EMPTY");
  });

  it("rejects a missing required shipping address field", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId);

    const res = await checkoutRequest(
      cookieHeader,
      validCheckoutBody({ billingAddress: { fullName: "Jane Doe" } }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported payment method", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId);

    const res = await checkoutRequest(cookieHeader, validCheckoutBody({ paymentMethod: "CREDIT_CARD" }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CHECKOUT_PAYMENT_METHOD_UNSUPPORTED");
  });

  it("rejects a submitted coupon code rather than silently ignoring it", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId);

    const res = await checkoutRequest(cookieHeader, validCheckoutBody({ couponCode: "WELCOME10" }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CHECKOUT_COUPON_UNSUPPORTED");
  });
});

// -- RE-VALIDATION AT CHECKOUT TIME ------------------------------------------

describe("Checkout re-validates catalog/price/inventory state, never trusts the cart", () => {
  it("rejects checkout if the variant was deactivated after being added to the cart", async () => {
    const { productId, variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId);

    const productCookie = await asProductManager();
    await request(app)
      .patch(`/api/v1/products/${productId}/variants/${variantId}`)
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send({ status: "INACTIVE" });

    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_VARIANT_UNAVAILABLE");
  });

  it("rejects checkout if the price was removed after being added to the cart", async () => {
    const { productId, variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId);

    const productCookie = await asProductManager();
    await request(app)
      .delete(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
      .set(csrfHeaders())
      .set("Cookie", productCookie);

    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_PRICE_UNAVAILABLE");
  });

  it("rejects checkout if stock dropped below the cart quantity", async () => {
    const { productId, variantId } = await setupPurchasableVariant(2);
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 2);

    const inventoryCookie = await asInventoryManager();
    await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/stock/PK/adjust`)
      .set(csrfHeaders())
      .set("Cookie", inventoryCookie)
      .send({ delta: -1, reason: "test" });

    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CART_INSUFFICIENT_STOCK");

    // Failed checkout must leave no partial reservation.
    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
  });
});

// -- HAPPY PATH ---------------------------------------------------------------

describe("Successful checkout", () => {
  it("creates an order, converts and clears the cart, and reserves (not decrements) stock", async () => {
    const { variantId } = await setupPurchasableVariant(10);
    const { cookieHeader, userId } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 3);

    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
    expect(order.marketCode).toBe("PK");
    expect(order.currencyCode).toBe("PKR");
    expect(order.status).toBe("PENDING");
    expect(order.paymentMethod).toBe("COD");
    expect(order.paymentStatus).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].variantId).toBe(variantId);
    expect(order.items[0].quantity).toBe(3);
    expect(order.items[0].unitAmount).toBe(499900);
    expect(order.items[0].lineTotal).toBe(1499700);
    expect(order.subtotalAmount).toBe(1499700);
    expect(order.discountAmount).toBe(0);
    expect(order.shippingAmount).toBe(0);
    expect(order.taxAmount).toBe(0);
    expect(order.totalAmount).toBe(1499700);
    expect(order.shippingAddress.city).toBe("Lahore");

    const dbOrder = await testPrisma().order.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.userId).toBe(userId);

    const cart = await testPrisma().cart.findFirstOrThrow({ where: { userId } });
    expect(cart.status).toBe("CONVERTED");
    const items = await testPrisma().cartItem.findMany({ where: { cartId: cart.id } });
    expect(items).toHaveLength(0);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.onHand).toBe(10);
    expect(stock.reserved).toBe(3);

    const reservation = await testPrisma().stockReservation.findFirstOrThrow({ where: { stockId: stock.id } });
    expect(reservation.status).toBe("ACTIVE");
    expect(reservation.quantity).toBe(3);
  });

  it("never trusts client-submitted totals — only shippingAddress/paymentMethod/shippingMethodId/couponCode are read", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);

    const res = await checkoutRequest(
      cookieHeader,
      validCheckoutBody({ subtotalAmount: 1, totalAmount: 1, grandTotal: 1 }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(499900);
  });

  it("allows a customer to shop again in the same market after checkout (cart reactivation)", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader, userId } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    await checkoutRequest(cookieHeader, validCheckoutBody());

    const cartBefore = await testPrisma().cart.findFirstOrThrow({ where: { userId } });
    expect(cartBefore.status).toBe("CONVERTED");

    const res = await request(app).get("/api/v1/cart?market=PK").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.items).toEqual([]);

    // Same underlying row is reused, not a second row — the schema still
    // only allows one Cart per (userId, marketId) ever.
    const cartsForUser = await testPrisma().cart.findMany({ where: { userId } });
    expect(cartsForUser).toHaveLength(1);
    expect(cartsForUser[0]!.id).toBe(cartBefore.id);
    expect(cartsForUser[0]!.status).toBe("ACTIVE");
  });
});

// -- IDEMPOTENCY --------------------------------------------------------------

describe("Checkout idempotency", () => {
  it("replays the same order on a retry with the same Idempotency-Key, without a second reservation", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    const key = randomUUID();

    const first = await checkoutRequest(cookieHeader, validCheckoutBody(), key);
    expect(first.status).toBe(201);

    const second = await checkoutRequest(cookieHeader, validCheckoutBody(), key);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);

    const orders = await testPrisma().order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(1);
  });

  it("rejects a replay attempt from a different user for the same key", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader: cookieA } = await asVerifiedCustomer();
    await addToCart(cookieA, variantId, 1);
    const key = randomUUID();
    const first = await checkoutRequest(cookieA, validCheckoutBody(), key);
    expect(first.status).toBe(201);

    const { cookieHeader: cookieB } = await asVerifiedCustomer();
    const res = await checkoutRequest(cookieB, validCheckoutBody(), key);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CHECKOUT_VALIDATION_ERROR");
  });
});

// -- CONCURRENCY --------------------------------------------------------------

describe("Checkout concurrency", () => {
  it("survives two concurrent checkout attempts on the same cart: exactly one succeeds, the loser's reservation is released", async () => {
    const { variantId } = await setupPurchasableVariant(10);
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 4);

    const [a, b] = await Promise.all([
      checkoutRequest(cookieHeader, validCheckoutBody(), randomUUID()),
      checkoutRequest(cookieHeader, validCheckoutBody(), randomUUID()),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = a.status === 409 ? a : b;
    expect(failed.body.error.code).toBe("CHECKOUT_CART_ALREADY_CONVERTED");

    const orders = await testPrisma().order.findMany({});
    expect(orders).toHaveLength(1);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(4); // only the winner's reservation remains
  });

  it("survives two concurrent checkout requests with the identical Idempotency-Key: exactly one order is created", async () => {
    const { variantId } = await setupPurchasableVariant(10);
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 2);
    const key = randomUUID();

    const [a, b] = await Promise.all([
      checkoutRequest(cookieHeader, validCheckoutBody(), key),
      checkoutRequest(cookieHeader, validCheckoutBody(), key),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 201]);

    const orders = await testPrisma().order.findMany({ where: { idempotencyKey: key } });
    expect(orders).toHaveLength(1);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(2);
  });
});

// -- DATA INTEGRITY -----------------------------------------------------------

describe("Checkout data integrity", () => {
  it("enforces orderNumber uniqueness at the database level", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader, userId } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: res.body.data.id } });
    const market = await testPrisma().market.findUniqueOrThrow({ where: { code: "PK" } });

    await expect(
      testPrisma().order.create({
        data: {
          orderNumber: order.orderNumber,
          userId,
          marketId: market.id,
          currencyCode: "PKR",
          paymentMethod: "COD",
          subtotalAmount: 100,
          totalAmount: 100,
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces idempotencyKey uniqueness at the database level", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader, userId } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    const order = await testPrisma().order.findUniqueOrThrow({ where: { id: res.body.data.id } });
    const market = await testPrisma().market.findUniqueOrThrow({ where: { code: "PK" } });

    await expect(
      testPrisma().order.create({
        data: {
          orderNumber: "ORD-9999-999999",
          userId,
          marketId: market.id,
          currencyCode: "PKR",
          paymentMethod: "COD",
          subtotalAmount: 100,
          totalAmount: 100,
          idempotencyKey: order.idempotencyKey,
        },
      }),
    ).rejects.toThrow();
  });

  it("restricts deleting an Order that still has a Payment (Phase 4K)", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    const orderId = res.body.data.id as string;

    await expect(testPrisma().order.delete({ where: { id: orderId } })).rejects.toThrow();
  });

  it("cascades OrderItem/OrderAddress deletion when the Order is deleted", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    const res = await checkoutRequest(cookieHeader, validCheckoutBody());
    const orderId = res.body.data.id as string;

    // Order.delete is Restrict-blocked while a Payment or Shipment row
    // exists (Phase 4K, Phase 4M) — delete both first (their own FKs are
    // Restrict too, but neither has dependents blocking its own removal) to
    // still exercise OrderItem/OrderAddress's actual cascade configuration.
    await testPrisma().payment.deleteMany({ where: { orderId } });
    await testPrisma().shipment.deleteMany({ where: { orderId } });
    await testPrisma().order.delete({ where: { id: orderId } });
    const items = await testPrisma().orderItem.findMany({ where: { orderId } });
    const address = await testPrisma().orderAddress.findFirst({ where: { orderId } });
    expect(items).toHaveLength(0);
    expect(address).toBeNull();
  });

  it("restricts deleting a user who has placed an order", async () => {
    const { variantId } = await setupPurchasableVariant();
    const { cookieHeader, userId } = await asVerifiedCustomer();
    await addToCart(cookieHeader, variantId, 1);
    await checkoutRequest(cookieHeader, validCheckoutBody());

    await expect(testPrisma().user.delete({ where: { id: userId } })).rejects.toThrow();
  });
});

import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function asRole(key: string) {
  const { cookieHeader, payload } = await registerUser(app);
  const role = await testPrisma().role.findUniqueOrThrow({ where: { key } });
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().userRole.create({ data: { userId: user.id, roleId: role.id } });
  return cookieHeader;
}

// Phase 6E collapsed the seeded role set to super_admin/customer — both
// are setup-only helpers here.
const asProductManager = () => asRole("super_admin");
const asInventoryManager = () => asRole("super_admin");

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

/// Creates an ACTIVE product with a price + stock configured in PK, ready to
/// be added to a cart.
async function setupPurchasableVariant(onHand = 10): Promise<{ productId: string; variantId: string }> {
  const productCookie = await asProductManager();
  const { productId, variantId } = await createActiveProduct(productCookie);
  await setPrice(productId, variantId);
  await setStock(productId, variantId, onHand);
  return { productId, variantId };
}

function cartUrl(marketCode = "PK") {
  return `/api/v1/cart?market=${marketCode}`;
}

function itemsUrl(marketCode = "PK") {
  return `/api/v1/cart/items?market=${marketCode}`;
}

function itemUrl(itemId: string, marketCode = "PK") {
  return `/api/v1/cart/items/${itemId}?market=${marketCode}`;
}

async function asCustomer() {
  const { cookieHeader } = await registerUser(app);
  return cookieHeader;
}

// -- AUTH / OWNERSHIP -------------------------------------------------------

describe("Cart auth and ownership", () => {
  it("rejects an unauthenticated GET /cart", async () => {
    const res = await request(app).get(cartUrl());
    expect(res.status).toBe(401);
  });

  it("allows an authenticated customer (no permissions) to use their cart", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("keeps carts isolated between two different customers", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieA = await asCustomer();
    const cookieB = await asCustomer();

    await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieA)
      .send({ variantId, quantity: 1 });

    const cartB = await request(app).get(cartUrl()).set("Cookie", cookieB);
    expect(cartB.body.data.items).toEqual([]);

    const cartA = await request(app).get(cartUrl()).set("Cookie", cookieA);
    expect(cartA.body.data.items).toHaveLength(1);
  });

  it("a customer cannot update or remove another customer's cart item", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieA = await asCustomer();
    const cookieB = await asCustomer();

    const added = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieA)
      .send({ variantId, quantity: 1 });
    const itemId = added.body.data.items[0].id as string;

    const patchRes = await request(app)
      .patch(itemUrl(itemId))
      .set(csrfHeaders())
      .set("Cookie", cookieB)
      .send({ quantity: 2 });
    expect(patchRes.status).toBe(404);
    expect(patchRes.body.error.code).toBe("CART_ITEM_NOT_FOUND");

    const deleteRes = await request(app).delete(itemUrl(itemId)).set(csrfHeaders()).set("Cookie", cookieB);
    expect(deleteRes.status).toBe(404);

    const cartA = await request(app).get(cartUrl()).set("Cookie", cookieA);
    expect(cartA.body.data.items).toHaveLength(1);
  });
});

// -- CART / ITEM OPERATIONS ---------------------------------------------------

describe("GET /api/v1/cart", () => {
  it("creates an empty cart on first access", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.marketCode).toBe("PK");
    expect(res.body.data.currencyCode).toBe("PKR");
    expect(res.body.data.status).toBe("ACTIVE");
    expect(res.body.data.subtotalAmount).toBe(0);
    expect(res.body.data.itemCount).toBe(0);
  });

  it("rejects an unknown market code", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(cartUrl("ZZ")).set("Cookie", cookieHeader);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a deactivated market", async () => {
    const cookieHeader = await asCustomer();
    await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: false } });
    try {
      const res = await request(app).get(cartUrl("AE")).set("Cookie", cookieHeader);
      expect(res.status).toBe(404);
    } finally {
      await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: true } });
    }
  });
});

describe("POST /api/v1/cart/items", () => {
  it("adds a variant to the cart with the server-computed price", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();

    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    const item = res.body.data.items[0];
    expect(item.variantId).toBe(variantId);
    expect(item.quantity).toBe(2);
    expect(item.unitAmount).toBe(499900);
    expect(item.lineTotal).toBe(999800);
    expect(item.isAvailable).toBe(true);
    expect(item.isInStock).toBe(true);
    expect(res.body.data.subtotalAmount).toBe(999800);
    expect(res.body.data.itemCount).toBe(2);
  });

  it("never trusts a client-supplied price — only variantId/quantity are accepted", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();

    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1, unitAmount: 1, price: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].unitAmount).toBe(499900);
  });

  it("increments an existing line rather than duplicating it (duplicate add)", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();

    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(3);

    const rows = await testPrisma().cartItem.findMany({ where: { variantId } });
    expect(rows).toHaveLength(1);
  });

  it("rejects zero quantity", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects a negative quantity", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: -1 });
    expect(res.status).toBe(400);
  });

  it("rejects a nonexistent variant", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a variant belonging to a non-ACTIVE (draft) product", async () => {
    const productCookie = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "DRAFT" }));
    const variantId = created.body.data.variants[0].id as string;

    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_VARIANT_UNAVAILABLE");
  });

  it("rejects a product not available in the requested market", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    await request(app)
      .put(`/api/v1/products/${productId}/markets/PK`)
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send({ isAvailable: false });
    await setPrice(productId, variantId);
    await setStock(productId, variantId, 10);

    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_VARIANT_UNAVAILABLE");
  });

  it("rejects a variant with no price configured for the requested market", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    await setStock(productId, variantId, 10);

    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CART_PRICE_UNAVAILABLE");
  });

  it("rejects a quantity exceeding available stock", async () => {
    const { variantId } = await setupPurchasableVariant(2);
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CART_INSUFFICIENT_STOCK");
  });

  it("rejects a variant with no stock record at all in this market", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    await setPrice(productId, variantId);

    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CART_INSUFFICIENT_STOCK");
  });

  it("uses the correct market-specific price (PK vs AE are independent)", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    await setPrice(productId, variantId, "PK", 499900);
    await setPrice(productId, variantId, "AE", 14900);
    await setStock(productId, variantId, 10, "PK");
    await setStock(productId, variantId, 10, "AE");

    const cookieHeader = await asCustomer();
    const pkRes = await request(app)
      .post(itemsUrl("PK"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    const aeRes = await request(app)
      .post(itemsUrl("AE"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });

    expect(pkRes.body.data.items[0].unitAmount).toBe(499900);
    expect(pkRes.body.data.currencyCode).toBe("PKR");
    expect(aeRes.body.data.items[0].unitAmount).toBe(14900);
    expect(aeRes.body.data.currencyCode).toBe("AED");
  });

  it("keeps a PK cart and an AE cart for the same customer fully isolated", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    await setPrice(productId, variantId, "PK");
    await setPrice(productId, variantId, "AE", 14900);
    await setStock(productId, variantId, 10, "PK");
    await setStock(productId, variantId, 10, "AE");

    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl("PK")).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });

    const aeCart = await request(app).get(cartUrl("AE")).set("Cookie", cookieHeader);
    expect(aeCart.body.data.items).toEqual([]);

    const pkCart = await request(app).get(cartUrl("PK")).set("Cookie", cookieHeader);
    expect(pkCart.body.data.items).toHaveLength(1);
  });
});

describe("PATCH /api/v1/cart/items/:itemId", () => {
  it("sets the quantity to an absolute value", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    const added = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    const itemId = added.body.data.items[0].id as string;

    const res = await request(app)
      .patch(itemUrl(itemId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it("rejects zero/negative quantity", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    const added = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    const itemId = added.body.data.items[0].id as string;

    const zeroRes = await request(app).patch(itemUrl(itemId)).set(csrfHeaders()).set("Cookie", cookieHeader).send({ quantity: 0 });
    expect(zeroRes.status).toBe(400);
    const negRes = await request(app).patch(itemUrl(itemId)).set(csrfHeaders()).set("Cookie", cookieHeader).send({ quantity: -1 });
    expect(negRes.status).toBe(400);
  });

  it("rejects a quantity exceeding available stock", async () => {
    const { variantId } = await setupPurchasableVariant(2);
    const cookieHeader = await asCustomer();
    const added = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    const itemId = added.body.data.items[0].id as string;

    const res = await request(app).patch(itemUrl(itemId)).set(csrfHeaders()).set("Cookie", cookieHeader).send({ quantity: 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CART_INSUFFICIENT_STOCK");
  });

  it("404s for a nonexistent item", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .patch(itemUrl("00000000-0000-0000-0000-000000000000"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CART_ITEM_NOT_FOUND");
  });
});

describe("DELETE /api/v1/cart/items/:itemId", () => {
  it("removes an item", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    const added = await request(app)
      .post(itemsUrl())
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ variantId, quantity: 1 });
    const itemId = added.body.data.items[0].id as string;

    const res = await request(app).delete(itemUrl(itemId)).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const cart = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(cart.body.data.items).toEqual([]);
  });

  it("404s for a nonexistent item", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .delete(itemUrl("00000000-0000-0000-0000-000000000000"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CART_ITEM_NOT_FOUND");
  });
});

describe("DELETE /api/v1/cart", () => {
  it("clears every item but keeps the cart", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });

    const res = await request(app).delete(cartUrl()).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const cart = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(cart.body.data.items).toEqual([]);
    expect(cart.body.data.status).toBe("ACTIVE");
  });

  it("is idempotent when the customer has no cart yet in this market", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).delete(cartUrl()).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);
  });
});

// -- STALE ITEM VISIBILITY (non-destructive) ---------------------------------

describe("Cart reflects live catalog/pricing/inventory state without deleting items", () => {
  it("flags an item unavailable (but keeps it) once its price is removed", async () => {
    const { productId, variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });

    const productCookie = await asProductManager();
    await request(app)
      .delete(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
      .set(csrfHeaders())
      .set("Cookie", productCookie);

    const cart = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(cart.body.data.items).toHaveLength(1);
    expect(cart.body.data.items[0].isAvailable).toBe(false);
    expect(cart.body.data.items[0].unitAmount).toBeNull();
    expect(cart.body.data.subtotalAmount).toBe(0);
  });

  it("flags an item out of stock (but keeps it) once stock is reduced below quantity", async () => {
    const { productId, variantId } = await setupPurchasableVariant(5);
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 5 });

    const inventoryCookie = await asInventoryManager();
    await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/stock/PK/adjust`)
      .set(csrfHeaders())
      .set("Cookie", inventoryCookie)
      .send({ delta: -4, reason: "test" });

    const cart = await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    expect(cart.body.data.items[0].isInStock).toBe(false);
    // Still priced/available — quantity vs. stock is a separate signal.
    expect(cart.body.data.items[0].isAvailable).toBe(true);
  });
});

// -- CONCURRENCY --------------------------------------------------------------

describe("Cart concurrency", () => {
  it("survives two simultaneous first-adds of the same variant with exactly one line and both quantities counted", async () => {
    const { variantId } = await setupPurchasableVariant(50);
    const cookieHeader = await asCustomer();

    const [a, b] = await Promise.all([
      request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 2 }),
      request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 3 }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const rows = await testPrisma().cartItem.findMany({ where: { variantId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.quantity).toBe(5);
  });

  it("survives two simultaneous first-accesses to the cart (get-or-create) with exactly one cart row", async () => {
    const cookieHeader = await asCustomer();

    const [a, b] = await Promise.all([
      request(app).get(cartUrl()).set("Cookie", cookieHeader),
      request(app).get(cartUrl()).set("Cookie", cookieHeader),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.id).toBe(b.body.data.id);

    const user = await testPrisma().user.findFirstOrThrow();
    const carts = await testPrisma().cart.findMany({ where: { userId: user.id } });
    expect(carts).toHaveLength(1);
  });
});

// -- DATA INTEGRITY -----------------------------------------------------------

describe("Cart data integrity", () => {
  it("enforces (cartId, variantId) uniqueness at the database level", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });
    const cart = await testPrisma().cart.findFirstOrThrow();

    await expect(
      testPrisma().cartItem.create({ data: { cartId: cart.id, variantId, quantity: 1 } }),
    ).rejects.toThrow();
  });

  it("enforces (userId, marketId) uniqueness at the database level", async () => {
    const cookieHeader = await asCustomer();
    await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    const cart = await testPrisma().cart.findFirstOrThrow();

    await expect(
      testPrisma().cart.create({ data: { userId: cart.userId, marketId: cart.marketId } }),
    ).rejects.toThrow();
  });

  it("rejects a non-positive quantity at the database level (CHECK constraint)", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    await request(app).get(cartUrl()).set("Cookie", cookieHeader);
    const cart = await testPrisma().cart.findFirstOrThrow();

    await expect(
      testPrisma().cartItem.create({ data: { cartId: cart.id, variantId, quantity: 0 } }),
    ).rejects.toThrow();
  });

  it("cascades cart item deletion when the cart is deleted, and cart deletion when the user is deleted", async () => {
    const { variantId } = await setupPurchasableVariant();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl()).set(csrfHeaders()).set("Cookie", cookieHeader).send({ variantId, quantity: 1 });
    const cart = await testPrisma().cart.findFirstOrThrow();

    await testPrisma().user.delete({ where: { id: cart.userId } });
    const carts = await testPrisma().cart.findMany({ where: { id: cart.id } });
    const items = await testPrisma().cartItem.findMany({ where: { cartId: cart.id } });
    expect(carts).toHaveLength(0);
    expect(items).toHaveLength(0);
  });
});

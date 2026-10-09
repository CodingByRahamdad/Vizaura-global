import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { productPayload } from "../helpers/factories.js";
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

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asProductManager = () => asRole("super_admin");

async function asCustomer() {
  const { cookieHeader } = await registerUser(app);
  return cookieHeader;
}

async function createActiveProduct(): Promise<string> {
  const cookieHeader = await asProductManager();
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ status: "ACTIVE" }));
  return res.body.data.id as string;
}

const wishlistUrl = "/api/v1/wishlist";
const itemsUrl = "/api/v1/wishlist/items";
const itemUrl = (productId: string) => `/api/v1/wishlist/items/${productId}`;

// -- AUTH / OWNERSHIP -------------------------------------------------------

describe("Wishlist auth and ownership", () => {
  it("rejects an unauthenticated GET /wishlist", async () => {
    const res = await request(app).get(wishlistUrl);
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated POST /wishlist/items", async () => {
    const res = await request(app).post(itemsUrl).set(csrfHeaders()).send({ productId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated DELETE /wishlist/items/:productId", async () => {
    const res = await request(app).delete(itemUrl("00000000-0000-0000-0000-000000000000")).set(csrfHeaders());
    expect(res.status).toBe(401);
  });

  it("allows an authenticated customer (no permissions) to use their wishlist", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("keeps wishlists isolated between two different customers", async () => {
    const productId = await createActiveProduct();
    const cookieA = await asCustomer();
    const cookieB = await asCustomer();

    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieA).send({ productId });

    const wishlistB = await request(app).get(wishlistUrl).set("Cookie", cookieB);
    expect(wishlistB.body.data.items).toEqual([]);

    const wishlistA = await request(app).get(wishlistUrl).set("Cookie", cookieA);
    expect(wishlistA.body.data.items).toHaveLength(1);
  });

  it("a customer cannot remove another customer's wishlist item", async () => {
    const productId = await createActiveProduct();
    const cookieA = await asCustomer();
    const cookieB = await asCustomer();

    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieA).send({ productId });

    const deleteRes = await request(app).delete(itemUrl(productId)).set(csrfHeaders()).set("Cookie", cookieB);
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error.code).toBe("WISHLIST_ITEM_NOT_FOUND");

    const wishlistA = await request(app).get(wishlistUrl).set("Cookie", cookieA);
    expect(wishlistA.body.data.items).toHaveLength(1);
  });
});

// -- WISHLIST / ITEM OPERATIONS ----------------------------------------------

describe("GET /api/v1/wishlist", () => {
  it("creates an empty wishlist on first access", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.itemCount).toBe(0);
    expect(res.body.data.items).toEqual([]);
  });
});

describe("POST /api/v1/wishlist/items", () => {
  it("adds a product to the wishlist", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();

    const res = await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    const item = res.body.data.items[0];
    expect(item.productId).toBe(productId);
    expect(item.isAvailable).toBe(true);
    expect(item.hasMultipleVariants).toBe(false);
    expect(item.defaultVariantId).not.toBeNull();
    expect(res.body.data.itemCount).toBe(1);
  });

  it("is idempotent on a duplicate add — exactly one row, no error", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();

    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });
    const res = await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);

    const rows = await testPrisma().wishlistItem.findMany({ where: { productId } });
    expect(rows).toHaveLength(1);
  });

  it("rejects a nonexistent product", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .post(itemsUrl)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ productId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a non-ACTIVE (draft) product", async () => {
    const productCookie = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "DRAFT" }));
    const productId = created.body.data.id as string;

    const cookieHeader = await asCustomer();
    const res = await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("WISHLIST_PRODUCT_UNAVAILABLE");
  });

  it("rejects a malformed productId", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/v1/wishlist/items/:productId", () => {
  it("removes a product from the wishlist", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });

    const res = await request(app).delete(itemUrl(productId)).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const wishlist = await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    expect(wishlist.body.data.items).toEqual([]);
  });

  it("404s for a product not in the wishlist", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    const res = await request(app).delete(itemUrl(productId)).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("WISHLIST_ITEM_NOT_FOUND");
  });
});

// -- STALE ITEM VISIBILITY (non-destructive) ---------------------------------

describe("Wishlist reflects live catalog state without deleting items", () => {
  it("keeps the item but flags it unavailable once the product goes DRAFT", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });

    await testPrisma().product.update({ where: { id: productId }, data: { status: "DRAFT" } });

    const wishlist = await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    expect(wishlist.body.data.items).toHaveLength(1);
    expect(wishlist.body.data.items[0].isAvailable).toBe(false);
  });

  it("keeps the item but flags it unavailable once the product is soft-deleted", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });

    await testPrisma().product.update({ where: { id: productId }, data: { deletedAt: new Date() } });

    const wishlist = await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    expect(wishlist.body.data.items).toHaveLength(1);
    expect(wishlist.body.data.items[0].isAvailable).toBe(false);
  });
});

// -- CONCURRENCY --------------------------------------------------------------

describe("Wishlist concurrency", () => {
  it("survives two simultaneous first-adds of the same product with exactly one row", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();

    const [a, b] = await Promise.all([
      request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId }),
      request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId }),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const rows = await testPrisma().wishlistItem.findMany({ where: { productId } });
    expect(rows).toHaveLength(1);
  });

  it("survives two simultaneous first-accesses to the wishlist (get-or-create) with exactly one row", async () => {
    const cookieHeader = await asCustomer();

    const [a, b] = await Promise.all([
      request(app).get(wishlistUrl).set("Cookie", cookieHeader),
      request(app).get(wishlistUrl).set("Cookie", cookieHeader),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.id).toBe(b.body.data.id);

    const user = await testPrisma().user.findFirstOrThrow();
    const wishlists = await testPrisma().wishlist.findMany({ where: { userId: user.id } });
    expect(wishlists).toHaveLength(1);
  });
});

// -- DATA INTEGRITY -----------------------------------------------------------

describe("Wishlist data integrity", () => {
  it("enforces (wishlistId, productId) uniqueness at the database level", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });
    const wishlist = await testPrisma().wishlist.findFirstOrThrow();

    await expect(
      testPrisma().wishlistItem.create({ data: { wishlistId: wishlist.id, productId } }),
    ).rejects.toThrow();
  });

  it("enforces userId uniqueness at the database level (one wishlist per user)", async () => {
    const cookieHeader = await asCustomer();
    await request(app).get(wishlistUrl).set("Cookie", cookieHeader);
    const wishlist = await testPrisma().wishlist.findFirstOrThrow();

    await expect(testPrisma().wishlist.create({ data: { userId: wishlist.userId } })).rejects.toThrow();
  });

  it("cascades wishlist item deletion when the wishlist is deleted, and wishlist deletion when the user is deleted", async () => {
    const productId = await createActiveProduct();
    const cookieHeader = await asCustomer();
    await request(app).post(itemsUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send({ productId });
    const wishlist = await testPrisma().wishlist.findFirstOrThrow();

    await testPrisma().user.delete({ where: { id: wishlist.userId } });
    const wishlists = await testPrisma().wishlist.findMany({ where: { id: wishlist.id } });
    const items = await testPrisma().wishlistItem.findMany({ where: { wishlistId: wishlist.id } });
    expect(wishlists).toHaveLength(0);
    expect(items).toHaveLength(0);
  });
});

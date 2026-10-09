import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { categoryPayload, pricePayload, productPayload, uniqueSku } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asRole, asPermissions } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

/// Phase 6E collapsed the seeded role set to super_admin/customer — both
/// aliases below now resolve to the same super_admin cookie (kept as two
/// names purely so call sites reading "asInventoryManager()" still read as
/// intent, not because they differ any more).
const asProductManager = () => asRole(app, "super_admin");
const asInventoryManager = () => asRole(app, "super_admin");

async function createCategory(cookieHeader: string) {
  const res = await request(app)
    .post("/api/v1/categories")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(categoryPayload());
  return res.body.data.id as string;
}

describe("POST /api/v1/products", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/products").set(csrfHeaders()).send(productPayload());
    expect(res.status).toBe(401);
  });

  it("rejects a caller without products:create", async () => {
    const { cookieHeader } = await registerUser(app);
    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());
    expect(res.status).toBe(403);
  });

  it("creates a product with a default variant and category association", async () => {
    const cookieHeader = await asProductManager();
    const categoryId = await createCategory(cookieHeader);
    const payload = productPayload({ categoryIds: [categoryId] });

    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(payload.slug);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0].sku).toBe(payload.defaultVariant.sku);
    expect(res.body.data.variants[0].isDefault).toBe(true);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].id).toBe(categoryId);
  });

  it("creates a product with zero variants when defaultVariant is omitted", async () => {
    const cookieHeader = await asProductManager();
    const payload = productPayload({ defaultVariant: undefined });

    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.variants).toHaveLength(0);
  });

  it("rejects a duplicate slug", async () => {
    const cookieHeader = await asProductManager();
    const payload = productPayload();
    await request(app).post("/api/v1/products").set(csrfHeaders()).set("Cookie", cookieHeader).send(payload);

    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ slug: payload.slug }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_SLUG_CONFLICT");
  });

  it("rejects a duplicate SKU", async () => {
    const cookieHeader = await asProductManager();
    const sku = uniqueSku();
    await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ defaultVariant: { sku, title: "Default" } }));

    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ defaultVariant: { sku, title: "Default" } }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_SKU_CONFLICT");
  });

  it("rejects an unknown category id", async () => {
    const cookieHeader = await asProductManager();
    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ categoryIds: ["00000000-0000-0000-0000-000000000000"] }));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });
});

describe("GET /api/v1/products", () => {
  it("excludes DRAFT products from the public listing but includes them for products:read", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const publicRes = await request(app).get("/api/v1/products").query({ limit: 100 });
    expect(publicRes.body.data.map((p: { id: string }) => p.id)).not.toContain(created.body.data.id);

    const adminRes = await request(app)
      .get("/api/v1/products")
      .query({ limit: 100 })
      .set("Cookie", cookieHeader);
    expect(adminRes.body.data.map((p: { id: string }) => p.id)).toContain(created.body.data.id);
  });

  it("excludes an inactive ACTIVE product from the public listing but includes it for products:read", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));

    await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isActive: false });

    const publicRes = await request(app).get("/api/v1/products").query({ limit: 100 });
    expect(publicRes.body.data.map((p: { id: string }) => p.id)).not.toContain(created.body.data.id);

    const adminRes = await request(app)
      .get("/api/v1/products")
      .query({ limit: 100, include: "admin" })
      .set("Cookie", cookieHeader);
    expect(adminRes.body.data.map((p: { id: string }) => p.id)).toContain(created.body.data.id);
  });
});

describe("GET /api/v1/products/:id", () => {
  it("404s a DRAFT product for the public", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app).get(`/api/v1/products/${created.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it("returns an ACTIVE product publicly", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));

    const res = await request(app).get(`/api/v1/products/${created.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it("404s an inactive ACTIVE product for the public but returns it for products:read", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));

    await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isActive: false });

    const publicRes = await request(app).get(`/api/v1/products/${created.body.data.id}`);
    expect(publicRes.status).toBe(404);

    const adminRes = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
  });
});

describe("PATCH /api/v1/products/:id", () => {
  it("updates core fields for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ status: "ACTIVE" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ACTIVE");
  });

  it("round-trips benefits/ingredients/certifications/storageInstructions/shelfLife", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({
        benefits: ["Boosts Energy & Stamina", "Supports Brain Function"],
        ingredients: ["Himalayan Shilajit Extract"],
        certifications: ["ISO 22000", "Lab Tested"],
        storageInstructions: "Store in a cool, dry place away from direct sunlight.",
        shelfLife: "24 months from manufacture date",
      });
    expect(res.status).toBe(200);
    expect(res.body.data.benefits).toEqual(["Boosts Energy & Stamina", "Supports Brain Function"]);
    expect(res.body.data.ingredients).toEqual(["Himalayan Shilajit Extract"]);
    expect(res.body.data.certifications).toEqual(["ISO 22000", "Lab Tested"]);
    expect(res.body.data.storageInstructions).toBe("Store in a cool, dry place away from direct sunlight.");
    expect(res.body.data.shelfLife).toBe("24 months from manufacture date");

    const getRes = await request(app)
      .get(`/api/v1/products/slug/${created.body.data.slug}`)
      .set("Cookie", cookieHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.benefits).toEqual(["Boosts Energy & Stamina", "Supports Brain Function"]);
    expect(getRes.body.data.ingredients).toEqual(["Himalayan Shilajit Extract"]);
  });

  it("defaults new content fields to empty for an existing product that never set them", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    expect(created.body.data.benefits).toEqual([]);
    expect(created.body.data.ingredients).toEqual([]);
    expect(created.body.data.certifications).toEqual([]);
    expect(created.body.data.storageInstructions).toBeNull();
    expect(created.body.data.shelfLife).toBeNull();
  });

  it("toggles isActive and persists the change", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());
    expect(created.body.data.isActive).toBe(true);

    const deactivated = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.isActive).toBe(false);

    const getRes = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set("Cookie", cookieHeader);
    expect(getRes.body.data.isActive).toBe(false);

    const reactivated = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isActive: true });
    expect(reactivated.body.data.isActive).toBe(true);
  });

  it("rejects an isActive toggle from a caller without products:update", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const noPermissionCookie = await asPermissions(app, ["products:read"]);
    const res = await request(app)
      .patch(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", noPermissionCookie)
      .send({ isActive: false });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/products/:id", () => {
  it("soft deletes a DRAFT product for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app)
      .delete(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set("Cookie", cookieHeader);
    expect(getRes.status).toBe(404);
  });

  it("rejects deleting an ACTIVE product — archive is the correct removal path", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));

    const res = await request(app)
      .delete(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_PRODUCT_NOT_DELETABLE");

    const getRes = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set("Cookie", cookieHeader);
    expect(getRes.status).toBe(200);
  });

  it("hard deletes an ARCHIVED product for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ARCHIVED" }));

    const res = await request(app)
      .delete(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/v1/products/${created.body.data.id}`)
      .set("Cookie", cookieHeader);
    expect(getRes.status).toBe(404);
  });

  it("hard delete cascades and removes a review for the deleted product", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ARCHIVED" }));
    const productId = created.body.data.id as string;

    const prisma = testPrisma();
    const review = await prisma.review.create({
      data: {
        productId,
        rating: 5,
        body: "Great product.",
        authorName: "Test Reviewer",
        source: "ADMIN",
      },
    });

    const res = await request(app)
      .delete(`/api/v1/products/${productId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const stillExists = await prisma.review.findUnique({ where: { id: review.id } });
    expect(stillExists).toBeNull();
  });

  it("rejects an unauthenticated request", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app).delete(`/api/v1/products/${created.body.data.id}`).set(csrfHeaders());
    expect(res.status).toBe(401);
  });

  it("rejects a caller without products:delete", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const noPermissionCookie = await asPermissions(app, ["products:read"]);
    const res = await request(app)
      .delete(`/api/v1/products/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", noPermissionCookie);
    expect(res.status).toBe(403);
  });

  it("404s an unknown product id", async () => {
    const cookieHeader = await asProductManager();
    const res = await request(app)
      .delete("/api/v1/products/00000000-0000-0000-0000-000000000000")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/products?include=card", () => {
  async function createCardReadyProduct(
    cookieHeader: string,
    marketCode: "PK" | "AE",
    price: { amount: number; saleAmount?: number },
    onHand: number,
  ) {
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;
    const variantId = created.body.data.variants[0].id as string;

    await request(app)
      .put(`/api/v1/products/${productId}/markets/${marketCode}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });

    await request(app)
      .put(`/api/v1/products/${productId}/variants/${variantId}/prices/${marketCode}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload(price));

    const inventoryCookie = await asInventoryManager();
    await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
      .set(csrfHeaders())
      .set("Cookie", inventoryCookie)
      .send({ marketCode, onHand });

    return { productId, variantId };
  }

  it("returns card-ready data (price, stock, image, rating) for a market-visible product", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createCardReadyProduct(
      cookieHeader,
      "PK",
      { amount: 499900, saleAmount: 399900 },
      12,
    );
    await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://example.com/card.jpg", isPrimary: true });

    const res = await request(app).get("/api/v1/products").query({ market: "PK", include: "card", limit: 100 });
    expect(res.status).toBe(200);

    const card = res.body.data.find((p: { id: string }) => p.id === productId);
    expect(card).toBeDefined();
    expect(card.defaultVariantId).toBe(variantId);
    expect(card.imageUrl).toBe("https://example.com/card.jpg");
    expect(card.price).toMatchObject({ marketCode: "PK", currencyCode: "PKR", amount: 399900, isOnSale: true });
    expect(card.stock).toEqual({ marketCode: "PK", status: "IN_STOCK", lowStockQuantity: null });
    expect(card.reviewCount).toBe(0);
    expect(card.rating).toBeNull();

    // No admin-only field leaks through — same public-safe shapes the
    // single-variant price/stock endpoints already return.
    expect(card.price).not.toHaveProperty("id");
    expect(card.price).not.toHaveProperty("isActive");
    expect(card.price).not.toHaveProperty("saleAmount");
    expect(card.stock).not.toHaveProperty("onHand");
    expect(card.stock).not.toHaveProperty("reserved");
  });

  it("keeps market isolation — a PK-only product's card never appears when listing AE", async () => {
    const cookieHeader = await asProductManager();
    const { productId } = await createCardReadyProduct(cookieHeader, "PK", { amount: 100000 }, 5);

    const aeRes = await request(app).get("/api/v1/products").query({ market: "AE", include: "card", limit: 100 });
    expect(aeRes.body.data.map((p: { id: string }) => p.id)).not.toContain(productId);
  });

  it("resolves independent price/stock per market for a dual-market product", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;
    const variantId = created.body.data.variants[0].id as string;
    const inventoryCookie = await asInventoryManager();

    for (const [marketCode, amount, onHand] of [
      ["PK", 250000, 40],
      ["AE", 6000, 10],
    ] as const) {
      await request(app)
        .put(`/api/v1/products/${productId}/markets/${marketCode}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ isAvailable: true, isVisible: true });
      await request(app)
        .put(`/api/v1/products/${productId}/variants/${variantId}/prices/${marketCode}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send(pricePayload({ amount }));
      await request(app)
        .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
        .set(csrfHeaders())
        .set("Cookie", inventoryCookie)
        .send({ marketCode, onHand });
    }

    const pkRes = await request(app).get("/api/v1/products").query({ market: "PK", include: "card", limit: 100 });
    const pkCard = pkRes.body.data.find((p: { id: string }) => p.id === productId);
    expect(pkCard.price).toMatchObject({ marketCode: "PK", currencyCode: "PKR", amount: 250000 });

    const aeRes = await request(app).get("/api/v1/products").query({ market: "AE", include: "card", limit: 100 });
    const aeCard = aeRes.body.data.find((p: { id: string }) => p.id === productId);
    expect(aeCard.price).toMatchObject({ marketCode: "AE", currencyCode: "AED", amount: 6000 });
  });

  it("resolves card data correctly across different page sizes", async () => {
    const cookieHeader = await asProductManager();
    for (let i = 0; i < 3; i += 1) {
      await createCardReadyProduct(cookieHeader, "PK", { amount: 100000 + i }, 5);
    }

    // The repository/service resolve card data via a fixed number of
    // batched queries regardless of `limit` (see products.repository.ts::
    // listForCards + products.service.ts::listWithCards) — exercised here
    // via query-plan-independent request/pagination correctness; the actual
    // fixed-query-count claim is verified via Prisma query logging in
    // manual verification (see docs/CURRENT_TASK.md).
    const resSmall = await request(app).get("/api/v1/products").query({ market: "PK", include: "card", limit: 2 });
    const resLarge = await request(app).get("/api/v1/products").query({ market: "PK", include: "card", limit: 50 });
    expect(resSmall.status).toBe(200);
    expect(resLarge.status).toBe(200);
    expect(resSmall.body.data).toHaveLength(2);
    expect(resLarge.body.data.length).toBeGreaterThanOrEqual(3);
    for (const card of resLarge.body.data) {
      expect(card).toHaveProperty("price");
      expect(card).toHaveProperty("stock");
    }
  });
});

describe("GET /api/v1/products?include=admin", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/products").query({ include: "admin", limit: 100 });
    expect(res.status).toBe(401);
  });

  it("rejects a caller without products:read", async () => {
    const { cookieHeader } = await registerUser(app);
    const res = await request(app)
      .get("/api/v1/products")
      .query({ include: "admin", limit: 100 })
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
  });

  it("returns raw price/stock for both markets regardless of any market param, with null for an unset market", async () => {
    const cookieHeader = await asProductManager();
    const categoryId = await createCategory(cookieHeader);
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE", categoryIds: [categoryId] }));
    const productId = created.body.data.id as string;
    const variantId = created.body.data.variants[0].id as string;

    await request(app)
      .put(`/api/v1/products/${productId}/markets/PK`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });
    await request(app)
      .put(`/api/v1/products/${productId}/markets/AE`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: false, isVisible: false });
    await request(app)
      .put(`/api/v1/products/${productId}/variants/${variantId}/prices/PK`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: 250000 }));

    const inventoryCookie = await asInventoryManager();
    await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
      .set(csrfHeaders())
      .set("Cookie", inventoryCookie)
      .send({ marketCode: "PK", onHand: 7 });

    // Passing market=AE must not filter which products/markets come back —
    // admin always sees both markets regardless of this param.
    const res = await request(app)
      .get("/api/v1/products")
      .query({ include: "admin", market: "AE", limit: 100 })
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(200);

    const row = res.body.data.find((p: { id: string }) => p.id === productId);
    expect(row).toBeDefined();
    expect(row.variantCount).toBe(1);
    expect(row.categories).toEqual([{ id: categoryId, name: expect.any(String) }]);

    const pk = row.markets.find((m: { code: string }) => m.code === "PK");
    const ae = row.markets.find((m: { code: string }) => m.code === "AE");
    expect(pk.isAvailable).toBe(true);
    expect(pk.price.amount).toBe(250000);
    expect(pk.stock.onHand).toBe(7);
    expect(pk.stock.available).toBe(7);
    expect(ae.isAvailable).toBe(false);
    expect(ae.price).toBeNull();
    expect(ae.stock).toBeNull();
  });

  it("supports search/category/status/pagination filters like include=card", async () => {
    const cookieHeader = await asProductManager();
    await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "DRAFT" }));

    const res = await request(app)
      .get("/api/v1/products")
      .query({ include: "admin", status: "DRAFT", limit: 1 })
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe("DRAFT");
    expect(res.body.meta.pagination).toBeDefined();
  });
});

describe("GET /api/v1/products - admin/no-market listing is unchanged", () => {
  it("still returns plain summaries (no include param)", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));

    const res = await request(app).get("/api/v1/products").query({ limit: 100 });
    const summary = res.body.data.find((p: { id: string }) => p.id === created.body.data.id);
    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty("price");
    expect(summary).not.toHaveProperty("stock");
    expect(summary).not.toHaveProperty("imageUrl");
  });
});

describe("PUT /api/v1/products/:id/categories", () => {
  it("replaces the product's category associations", async () => {
    const cookieHeader = await asProductManager();
    const categoryId = await createCategory(cookieHeader);
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app)
      .put(`/api/v1/products/${created.body.data.id}/categories`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ categoryIds: [categoryId] });
    expect(res.status).toBe(200);
    expect(res.body.data.categories).toHaveLength(1);
    expect(res.body.data.categories[0].id).toBe(categoryId);
  });
});

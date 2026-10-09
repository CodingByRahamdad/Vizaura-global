import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { pricePayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions } from "../helpers/roles.js";

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
/// Has products:read only, no pricing:* — used for the 403 RBAC case.
const asInventoryManager = () => asPermissions(app, ["products:read"]);

async function createActiveProduct(cookieHeader: string): Promise<{ productId: string; variantId: string }> {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ status: "ACTIVE" }));
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

function priceUrl(productId: string, variantId: string, marketCode = "PK") {
  return `/api/v1/products/${productId}/variants/${variantId}/prices/${marketCode}`;
}

describe("PUT /api/v1/products/:productId/variants/:variantId/prices/:marketCode", () => {
  it("sets a valid price", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());

    expect(res.status).toBe(200);
    expect(res.body.data.marketCode).toBe("PK");
    expect(res.body.data.currencyCode).toBe("PKR");
    expect(res.body.data.amount).toBe(499900);
    expect(res.body.data.isActive).toBe(true);
  });

  it("upserts — a second PUT for the same variant+market overwrites, not duplicates", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: 100000 }));

    const res = await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: 200000 }));

    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(200000);

    const rows = await testPrisma().variantPrice.findMany({ where: { variantId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amount).toBe(200000);
  });

  it("rejects a negative amount", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: -1 }));
    expect(res.status).toBe(400);
  });

  it("rejects an unknown market code", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, variantId, "ZZ"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a deactivated market", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: false } });
    try {
      const res = await request(app)
        .put(priceUrl(productId, variantId, "AE"))
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send(pricePayload());
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
    } finally {
      await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: true } });
    }
  });

  it("rejects a currency that doesn't match the market's configured currency", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, variantId, "PK"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ currencyCode: "AED" }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRICING_CURRENCY_MISMATCH");
  });

  it("rejects a sale amount that is not below the regular amount", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: 100000, saleAmount: 100000 }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PRICING_INVALID_SALE_AMOUNT");
  });

  it("rejects a nonexistent variant", async () => {
    const cookieHeader = await asProductManager();
    const { productId } = await createActiveProduct(cookieHeader);

    const res = await request(app)
      .put(priceUrl(productId, "00000000-0000-0000-0000-000000000000"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  // -- RBAC ------------------------------------------------------------

  it("rejects an unauthenticated write", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app).put(priceUrl(productId, variantId)).set(csrfHeaders()).send(pricePayload());
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated caller without pricing:update", async () => {
    const managerCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(managerCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  // -- Concurrency -------------------------------------------------------

  it("survives two simultaneous upserts for the same variant+market with exactly one row", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const [a, b] = await Promise.all([
      request(app)
        .put(priceUrl(productId, variantId))
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send(pricePayload({ amount: 111100 })),
      request(app)
        .put(priceUrl(productId, variantId))
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send(pricePayload({ amount: 222200 })),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const rows = await testPrisma().variantPrice.findMany({ where: { variantId } });
    expect(rows).toHaveLength(1);
    expect([111100, 222200]).toContain(rows[0]!.amount);
  });
});

describe("DELETE /api/v1/products/:productId/variants/:variantId/prices/:marketCode", () => {
  it("deactivates a price, and public reads then 404", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);
    await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());

    const del = await request(app).delete(priceUrl(productId, variantId)).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(del.status).toBe(204);

    const publicRead = await request(app).get(priceUrl(productId, variantId));
    expect(publicRead.status).toBe(404);
    expect(publicRead.body.error.code).toBe("PRICING_NOT_FOUND");

    const adminRead = await request(app).get(priceUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(adminRead.status).toBe(200);
    expect(adminRead.body.data.isActive).toBe(false);
  });

  it("is idempotent for an already-deactivated or nonexistent price", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app).delete(priceUrl(productId, variantId)).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);
  });
});

describe("GET /api/v1/products/:productId/variants/:variantId/prices/:marketCode", () => {
  it("public caller sees the effective-price shape only", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);
    await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ amount: 500000, saleAmount: 400000 }));

    const res = await request(app).get(priceUrl(productId, variantId));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      marketCode: "PK",
      currencyCode: "PKR",
      amount: 400000,
      isOnSale: true,
      saleEndsAt: null,
      compareAtAmount: 500000,
    });
    expect(res.body.data.id).toBeUndefined();
    expect(res.body.data.isActive).toBeUndefined();
  });

  it("admin (pricing:read) sees the full record", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);
    await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());

    const res = await request(app).get(priceUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.isActive).toBe(true);
  });

  it("returns 404 for a missing price", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);

    const res = await request(app).get(priceUrl(productId, variantId));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRICING_NOT_FOUND");
  });

  it("keeps markets isolated — a PK price is not visible when reading AE", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);
    await request(app)
      .put(priceUrl(productId, variantId, "PK"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());

    const res = await request(app).get(priceUrl(productId, variantId, "AE"));
    expect(res.status).toBe(404);
  });

  it("rejects public access to a variant of a non-ACTIVE product, mirroring Catalog's visibility rule", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "DRAFT" }));
    const productId = created.body.data.id as string;
    const variantId = created.body.data.variants[0].id as string;
    await request(app)
      .put(priceUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());

    const publicRes = await request(app).get(priceUrl(productId, variantId));
    expect(publicRes.status).toBe(404);
    expect(publicRes.body.error.code).toBe("CATALOG_NOT_FOUND");

    const adminRes = await request(app).get(priceUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
  });
});

describe("GET /api/v1/products/:productId/variants/:variantId/prices", () => {
  it("lists only active prices for a public caller, full list for admin", async () => {
    const cookieHeader = await asProductManager();
    const { productId, variantId } = await createActiveProduct(cookieHeader);
    await request(app)
      .put(priceUrl(productId, variantId, "PK"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload());
    await request(app)
      .put(priceUrl(productId, variantId, "AE"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(pricePayload({ currencyCode: "AED", amount: 14900 }));
    await request(app).delete(priceUrl(productId, variantId, "AE")).set(csrfHeaders()).set("Cookie", cookieHeader);

    const publicRes = await request(app).get(`/api/v1/products/${productId}/variants/${variantId}/prices`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data).toHaveLength(1);
    expect(publicRes.body.data[0].marketCode).toBe("PK");

    const adminRes = await request(app)
      .get(`/api/v1/products/${productId}/variants/${variantId}/prices`)
      .set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(2);
  });
});

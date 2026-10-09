import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asProductManager = () => asRole(app, "super_admin");

describe("PUT /api/v1/products/:id/markets/:marketCode", () => {
  it("rejects an unknown market code", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    const res = await request(app)
      .put(`/api/v1/products/${created.body.data.id}/markets/ZZ`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("makes a product visible in one seeded market only", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;

    const upsertRes = await request(app)
      .put(`/api/v1/products/${productId}/markets/PK`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });
    expect(upsertRes.status).toBe(200);
    expect(upsertRes.body.data.markets).toHaveLength(1);
    expect(upsertRes.body.data.markets[0].code).toBe("PK");

    const visibleInPk = await request(app).get("/api/v1/products").query({ market: "PK", limit: 100 });
    expect(visibleInPk.body.data.map((p: { id: string }) => p.id)).toContain(productId);

    const hiddenInAe = await request(app).get("/api/v1/products").query({ market: "AE", limit: 100 });
    expect(hiddenInAe.body.data.map((p: { id: string }) => p.id)).not.toContain(productId);
  });

  it("excludes a product marked not visible in the requested market", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;

    await request(app)
      .put(`/api/v1/products/${productId}/markets/AE`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: false });

    const res = await request(app).get("/api/v1/products").query({ market: "AE", limit: 100 });
    expect(res.body.data.map((p: { id: string }) => p.id)).not.toContain(productId);
  });

  it("rejects associating a product with a deactivated market", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload());

    await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: false } });
    try {
      const res = await request(app)
        .put(`/api/v1/products/${created.body.data.id}/markets/AE`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ isAvailable: true, isVisible: true });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
    } finally {
      await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: true } });
    }
  });
});

describe("GET /api/v1/products?market=", () => {
  it("rejects an unknown market code instead of silently returning an empty list", async () => {
    const res = await request(app).get("/api/v1/products").query({ market: "ZZ" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a deactivated market code", async () => {
    await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: false } });
    try {
      const res = await request(app).get("/api/v1/products").query({ market: "AE" });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
    } finally {
      await testPrisma().market.update({ where: { code: "AE" }, data: { isActive: true } });
    }
  });
});

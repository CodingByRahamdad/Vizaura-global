import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

async function createProductWithStock(
  cookieHeader: string,
  name: string,
  stocks: { marketCode: "PK" | "AE"; onHand: number }[],
) {
  const created = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ name, status: "ACTIVE" }));
  const productId = created.body.data.id as string;
  const variantId = created.body.data.variants[0].id as string;

  for (const { marketCode, onHand } of stocks) {
    await request(app)
      .post(`/api/v1/products/${productId}/variants/${variantId}/stock`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode, onHand });
  }

  return { productId, variantId };
}

describe("GET /api/v1/admin/inventory", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/inventory");
    expect(res.status).toBe(401);
  });

  it("rejects a caller without inventory:read", async () => {
    const cookieHeader = await asPermissions(app, ["products:read"]);
    const res = await request(app).get("/api/v1/admin/inventory").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
  });

  it("returns PK and AE rows independently for a dual-market product", async () => {
    const cookieHeader = await asSuperAdmin();
    const { variantId } = await createProductWithStock(cookieHeader, "Dual Market Inventory Item", [
      { marketCode: "PK", onHand: 100 },
      { marketCode: "AE", onHand: 50 },
    ]);

    const res = await request(app).get("/api/v1/admin/inventory").set("Cookie", cookieHeader).query({ limit: 100 });
    expect(res.status).toBe(200);

    const rows = res.body.data.filter((row: { variantId: string }) => row.variantId === variantId);
    expect(rows).toHaveLength(2);
    const pk = rows.find((r: { marketCode: string }) => r.marketCode === "PK");
    const ae = rows.find((r: { marketCode: string }) => r.marketCode === "AE");
    expect(pk.onHand).toBe(100);
    expect(pk.available).toBe(100);
    expect(ae.onHand).toBe(50);
    expect(ae.available).toBe(50);
  });

  it("filters by market", async () => {
    const cookieHeader = await asSuperAdmin();
    const { variantId } = await createProductWithStock(cookieHeader, "Market Filter Inventory Item", [
      { marketCode: "PK", onHand: 20 },
      { marketCode: "AE", onHand: 30 },
    ]);

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", cookieHeader)
      .query({ market: "AE", limit: 100 });
    expect(res.status).toBe(200);

    const rows = res.body.data.filter((row: { variantId: string }) => row.variantId === variantId);
    expect(rows).toHaveLength(1);
    expect(rows[0].marketCode).toBe("AE");
  });

  it("supports search by product name and SKU", async () => {
    const cookieHeader = await asSuperAdmin();
    const uniqueName = `Searchable Widget ${Date.now()}`;
    await createProductWithStock(cookieHeader, uniqueName, [{ marketCode: "PK", onHand: 5 }]);

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", cookieHeader)
      .query({ search: uniqueName, limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((row: { productName: string }) => row.productName === uniqueName)).toBe(true);
  });

  it("paginates", async () => {
    const cookieHeader = await asSuperAdmin();
    for (let i = 0; i < 3; i += 1) {
      await createProductWithStock(cookieHeader, `Pagination Inventory Item ${i}-${Date.now()}`, [
        { marketCode: "PK", onHand: 1 },
      ]);
    }

    const res = await request(app)
      .get("/api/v1/admin/inventory")
      .set("Cookie", cookieHeader)
      .query({ limit: 2, page: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.pagination.total).toBeGreaterThanOrEqual(3);
  });
});

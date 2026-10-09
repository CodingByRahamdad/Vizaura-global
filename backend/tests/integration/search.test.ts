import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asRole, asPermissions } from "../helpers/roles.js";
import { categoryPayload, productPayload } from "../helpers/factories.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function createProduct(cookieHeader: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data;
}

describe("GET /api/v1/admin/search", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/search").query({ q: "test" });
    expect(res.status).toBe(401);
  });

  it("rejects a query shorter than the minimum length", async () => {
    const cookieHeader = await asRole(app, "super_admin");
    const res = await request(app).get("/api/v1/admin/search").query({ q: "a" }).set("Cookie", cookieHeader);
    expect(res.status).toBe(400);
  });

  it("returns real product matches for a super_admin", async () => {
    const cookieHeader = await asRole(app, "super_admin");
    const marker = `Zebrawood-${Date.now()}`;
    const product = await createProduct(cookieHeader, { name: `${marker} Tonic` });

    const res = await request(app).get("/api/v1/admin/search").query({ q: marker }).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.results.products).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: product.id, name: `${marker} Tonic` })]),
    );
  });

  it("omits every result group the caller lacks permission for", async () => {
    const cookieHeader = await asPermissions(app, ["products:read"]);
    const res = await request(app).get("/api/v1/admin/search").query({ q: "anything" }).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveProperty("products");
    expect(res.body.data.results).not.toHaveProperty("orders");
    expect(res.body.data.results).not.toHaveProperty("customers");
    expect(res.body.data.results).not.toHaveProperty("users");
    expect(res.body.data.results).not.toHaveProperty("categories");
  });

  it("matches categories by name once categories:read is held", async () => {
    const cookieHeader = await asRole(app, "super_admin");
    const marker = `Driftwood-${Date.now()}`;
    const createRes = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload({ name: marker }));
    expect(createRes.status).toBe(201);

    const res = await request(app).get("/api/v1/admin/search").query({ q: marker }).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.results.categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: createRes.body.data.id, name: marker })]),
    );
  });
});

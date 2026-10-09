import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { categoryPayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asProductManager = () => asRole(app, "super_admin");

describe("POST /api/v1/categories", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/categories").set(csrfHeaders()).send(categoryPayload());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("rejects a caller without categories:create", async () => {
    const { cookieHeader } = await registerUser(app);
    const res = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("creates a category for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const payload = categoryPayload();
    const res = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(payload.slug);
    expect(res.body.data.isActive).toBe(true);
  });

  it("rejects invalid input", async () => {
    const cookieHeader = await asProductManager();
    const res = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects a duplicate slug", async () => {
    const cookieHeader = await asProductManager();
    const payload = categoryPayload();
    await request(app).post("/api/v1/categories").set(csrfHeaders()).set("Cookie", cookieHeader).send(payload);

    const res = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_SLUG_CONFLICT");
  });
});

describe("GET /api/v1/categories", () => {
  it("lists only active categories publicly, and includes inactive ones for a permitted caller", async () => {
    const cookieHeader = await asProductManager();
    const active = categoryPayload();
    const inactive = categoryPayload({ isActive: false });
    await request(app).post("/api/v1/categories").set(csrfHeaders()).set("Cookie", cookieHeader).send(active);
    await request(app).post("/api/v1/categories").set(csrfHeaders()).set("Cookie", cookieHeader).send(inactive);

    const publicRes = await request(app).get("/api/v1/categories").query({ limit: 100 });
    expect(publicRes.status).toBe(200);
    const publicSlugs = publicRes.body.data.map((c: { slug: string }) => c.slug);
    expect(publicSlugs).toContain(active.slug);
    expect(publicSlugs).not.toContain(inactive.slug);

    const adminRes = await request(app)
      .get("/api/v1/categories")
      .query({ limit: 100, includeInactive: "true" })
      .set("Cookie", cookieHeader);
    const adminSlugs = adminRes.body.data.map((c: { slug: string }) => c.slug);
    expect(adminSlugs).toContain(active.slug);
    expect(adminSlugs).toContain(inactive.slug);
  });
});

describe("GET /api/v1/categories?include=count", () => {
  it("resolves each category's real product count via a single batched request", async () => {
    const cookieHeader = await asProductManager();
    const category = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());
    const categoryId = category.body.data.id as string;

    const product = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE", categoryIds: [categoryId] }));

    await request(app)
      .put(`/api/v1/products/${product.body.data.id}/markets/PK`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });

    const res = await request(app)
      .get("/api/v1/categories")
      .query({ include: "count", market: "PK", limit: 100 });
    expect(res.status).toBe(200);
    const row = res.body.data.find((c: { id: string }) => c.id === categoryId);
    expect(row).toBeDefined();
    expect(row.productCount).toBe(1);
  });

  it("counts zero for a market where the category's products aren't visible", async () => {
    const cookieHeader = await asProductManager();
    const category = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());
    const categoryId = category.body.data.id as string;

    const product = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE", categoryIds: [categoryId] }));

    await request(app)
      .put(`/api/v1/products/${product.body.data.id}/markets/PK`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ isAvailable: true, isVisible: true });

    const res = await request(app)
      .get("/api/v1/categories")
      .query({ include: "count", market: "AE", limit: 100 });
    const row = res.body.data.find((c: { id: string }) => c.id === categoryId);
    expect(row.productCount).toBe(0);
  });
});

describe("GET /api/v1/categories/:id", () => {
  it("404s an inactive category for a caller without categories:read", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload({ isActive: false }));

    const res = await request(app).get(`/api/v1/categories/${created.body.data.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("404s an unknown category", async () => {
    const res = await request(app).get("/api/v1/categories/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/v1/categories/:id", () => {
  it("updates fields for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Renamed", isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed");
    expect(res.body.data.isActive).toBe(false);
  });
});

describe("category hierarchy cycle prevention", () => {
  it("rejects a category being set as its own parent", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());

    const res = await request(app)
      .patch(`/api/v1/categories/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ parentId: created.body.data.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CATALOG_INVALID_CATEGORY_PARENT");
  });

  it("rejects an indirect cycle (A -> B -> C, then C reparented under A)", async () => {
    const cookieHeader = await asProductManager();
    const a = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());
    const b = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload({ parentId: a.body.data.id }));
    const c = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload({ parentId: b.body.data.id }));

    const res = await request(app)
      .patch(`/api/v1/categories/${a.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ parentId: c.body.data.id });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CATALOG_INVALID_CATEGORY_PARENT");
  });
});

describe("DELETE /api/v1/categories/:id", () => {
  it("blocks deletion when the category has a child", async () => {
    const cookieHeader = await asProductManager();
    const parent = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());
    await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload({ parentId: parent.body.data.id }));

    const res = await request(app)
      .delete(`/api/v1/categories/${parent.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_CATEGORY_IN_USE");
  });

  it("deletes a leaf category for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const created = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(categoryPayload());

    const res = await request(app)
      .delete(`/api/v1/categories/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const getRes = await request(app).get(`/api/v1/categories/${created.body.data.id}`);
    expect(getRes.status).toBe(404);
  });
});

import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { categoryPayload, productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

// Phase 6G — Categories admin. Complements catalog.categories.test.ts (the
// original CRUD coverage) with the admin list contract (include=admin),
// slug/validation edge cases, clearing fields, authorization boundaries,
// delete-vs-deactivate safety and product/category relationship integrity.

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

async function createCategory(cookieHeader: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/v1/categories")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(categoryPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data as { id: string; slug: string; name: string };
}

async function createProduct(cookieHeader: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload(overrides));
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

describe("GET /api/v1/categories?include=admin", () => {
  it("rejects unauthenticated (401) and a caller without categories:read (403)", async () => {
    expect((await request(app).get("/api/v1/categories?include=admin")).status).toBe(401);

    const { cookieHeader } = await registerUser(app);
    const res = await request(app)
      .get("/api/v1/categories?include=admin&includeInactive=true")
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("returns every category (incl. inactive) with all-status productCount and childCount", async () => {
    const admin = await asSuperAdmin();
    const parent = await createCategory(admin);
    const inactive = await createCategory(admin, { isActive: false });
    await createCategory(admin, { parentId: parent.id });
    await createCategory(admin, { parentId: parent.id });

    // One ACTIVE and one DRAFT product in `parent` — the admin count must
    // include the draft (the public include=count must not).
    await createProduct(admin, { status: "ACTIVE", categoryIds: [parent.id] });
    await createProduct(admin, { status: "DRAFT", categoryIds: [parent.id] });

    const res = await request(app).get("/api/v1/categories?include=admin&includeInactive=true").set("Cookie", admin);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination.total).toBe(4);

    const byId = new Map<string, { productCount: number; childCount: number; isActive: boolean }>(
      res.body.data.map((c: { id: string }) => [c.id, c]),
    );
    expect(byId.get(parent.id)).toMatchObject({ productCount: 2, childCount: 2 });
    expect(byId.get(inactive.id)).toMatchObject({ productCount: 0, childCount: 0, isActive: false });

    const publicCount = await request(app).get("/api/v1/categories?include=count");
    const publicParent = publicCount.body.data.find((c: { id: string }) => c.id === parent.id);
    expect(publicParent.productCount).toBe(1);
  });
});

describe("Categories admin — validation and slugs", () => {
  it("rejects a name that yields no slug unless an explicit slug is given", async () => {
    const admin = await asSuperAdmin();
    const bad = await request(app).post("/api/v1/categories").set(csrfHeaders()).set("Cookie", admin).send({ name: "!!!" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("CATALOG_VALIDATION_ERROR");
    expect(await testPrisma().category.count()).toBe(0);

    const ok = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ name: "!!!", slug: "punctuation-only" });
    expect(ok.status).toBe(201);
  });

  it("rejects a malformed slug, bad image URL and negative position on create", async () => {
    const admin = await asSuperAdmin();
    const post = (body: Record<string, unknown>) =>
      request(app).post("/api/v1/categories").set(csrfHeaders()).set("Cookie", admin).send(body);
    expect((await post({ name: "X", slug: "Bad Slug!" })).status).toBe(400);
    expect((await post({ name: "X", imageUrl: "not-a-url" })).status).toBe(400);
    expect((await post({ name: "X", position: -1 })).status).toBe(400);
  });

  it("auto-derives the slug from the name when none is given", async () => {
    const admin = await asSuperAdmin();
    const res = await request(app)
      .post("/api/v1/categories")
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ name: "Herbal Teas & Tonics" });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("herbal-teas-tonics");
  });

  it("rejects a slug that another category owns, but allows re-sending a category's own slug", async () => {
    const admin = await asSuperAdmin();
    const a = await createCategory(admin);
    const b = await createCategory(admin);
    const patch = (id: string, body: Record<string, unknown>) =>
      request(app).patch(`/api/v1/categories/${id}`).set(csrfHeaders()).set("Cookie", admin).send(body);

    const conflict = await patch(b.id, { slug: a.slug });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CATALOG_SLUG_CONFLICT");

    expect((await patch(a.id, { slug: a.slug, name: "Renamed" })).status).toBe(200);
  });

  it("lets an admin clear description/imageUrl (null) and move a category back to top level", async () => {
    const admin = await asSuperAdmin();
    const parent = await createCategory(admin);
    const child = await createCategory(admin, {
      parentId: parent.id,
      description: "Some text",
      imageUrl: "https://example.com/a.png",
    });

    const res = await request(app)
      .patch(`/api/v1/categories/${child.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ description: null, imageUrl: null, parentId: null });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ description: null, imageUrl: null, parentId: null });
  });
});

describe("Categories admin — authorization", () => {
  it("lets a caller with only categories:read list but not update or delete", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    const readOnly = await asPermissions(app, ["categories:read"]);

    const list = await request(app)
      .get("/api/v1/categories?include=admin&includeInactive=true")
      .set("Cookie", readOnly);
    expect(list.status).toBe(200);

    const patch = await request(app)
      .patch(`/api/v1/categories/${cat.id}`)
      .set(csrfHeaders())
      .set("Cookie", readOnly)
      .send({ name: "Nope" });
    expect(patch.status).toBe(403);

    const del = await request(app).delete(`/api/v1/categories/${cat.id}`).set(csrfHeaders()).set("Cookie", readOnly);
    expect(del.status).toBe(403);
  });

  it("rejects unauthenticated update and delete", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    const patch = await request(app).patch(`/api/v1/categories/${cat.id}`).set(csrfHeaders()).send({ name: "X" });
    expect(patch.status).toBe(401);
    const del = await request(app).delete(`/api/v1/categories/${cat.id}`).set(csrfHeaders());
    expect(del.status).toBe(401);
  });

  it("does not let a plain customer see inactive categories via includeInactive", async () => {
    const admin = await asSuperAdmin();
    const inactive = await createCategory(admin, { isActive: false });
    const { cookieHeader } = await registerUser(app);

    const res = await request(app).get("/api/v1/categories?includeInactive=true").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === inactive.id)).toBe(false);
  });
});

describe("Categories admin — delete/archive safety and product relationships", () => {
  it("blocks deleting a category that still has products, even after the product is soft-deleted", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    const product = await createProduct(admin, { status: "DRAFT", categoryIds: [cat.id] });

    const blocked = await request(app).delete(`/api/v1/categories/${cat.id}`).set(csrfHeaders()).set("Cookie", admin);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CATALOG_CATEGORY_IN_USE");

    // Soft-delete the (DRAFT) product: the link row remains, so the guard still holds.
    const del = await request(app).delete(`/api/v1/products/${product.id}`).set(csrfHeaders()).set("Cookie", admin);
    expect(del.status).toBe(204);
    const stillBlocked = await request(app)
      .delete(`/api/v1/categories/${cat.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin);
    expect(stillBlocked.status).toBe(409);
    expect(await testPrisma().category.count({ where: { id: cat.id } })).toBe(1);
  });

  it("deactivating (the archive path) hides a category publicly but keeps product links intact", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    const product = await createProduct(admin, { status: "ACTIVE", categoryIds: [cat.id] });

    const res = await request(app)
      .patch(`/api/v1/categories/${cat.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const publicList = await request(app).get("/api/v1/categories");
    expect(publicList.body.data.some((c: { id: string }) => c.id === cat.id)).toBe(false);
    expect((await request(app).get(`/api/v1/categories/${cat.id}`)).status).toBe(404);

    const links = await testPrisma().productCategory.count({ where: { productId: product.id, categoryId: cat.id } });
    expect(links).toBe(1);
  });

  it("keeps product relationships valid across a rename and slug change, and ?category= keeps working", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    const product = await createProduct(admin, { status: "ACTIVE", categoryIds: [cat.id] });

    const res = await request(app)
      .patch(`/api/v1/categories/${cat.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ name: "Renamed Category", slug: "renamed-category" });
    expect(res.status).toBe(200);

    const detail = await request(app).get(`/api/v1/products/${product.id}`).set("Cookie", admin);
    expect(detail.body.data.categories).toEqual([{ id: cat.id, name: "Renamed Category", slug: "renamed-category" }]);

    const filtered = await request(app).get(`/api/v1/products?category=${cat.id}`).set("Cookie", admin);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.map((p: { id: string }) => p.id)).toContain(product.id);
  });

  it("makes a newly created category assignable to a product through the product API", async () => {
    const admin = await asSuperAdmin();
    const product = await createProduct(admin, { status: "ACTIVE" });
    const cat = await createCategory(admin);

    const res = await request(app)
      .put(`/api/v1/products/${product.id}/categories`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ categoryIds: [cat.id] });
    expect(res.status).toBe(200);
    expect(res.body.data.categories.map((c: { id: string }) => c.id)).toEqual([cat.id]);
  });

  it("deletes an unused category and records audit entries for create, update and delete", async () => {
    const admin = await asSuperAdmin();
    const cat = await createCategory(admin);
    await request(app)
      .patch(`/api/v1/categories/${cat.id}`)
      .set(csrfHeaders())
      .set("Cookie", admin)
      .send({ position: 3 });
    const del = await request(app).delete(`/api/v1/categories/${cat.id}`).set(csrfHeaders()).set("Cookie", admin);
    expect(del.status).toBe(204);

    const logs = await testPrisma().auditLog.findMany({
      where: { entityType: "Category", entityId: cat.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.action)).toEqual(["CREATE_CATEGORY", "UPDATE_CATEGORY", "DELETE_CATEGORY"]);
  });
});

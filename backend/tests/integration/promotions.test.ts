import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";
import { categoryPayload } from "../helpers/factories.js";
import { registerUser } from "../helpers/authFlow.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

async function createCategory(adminCookie: string): Promise<string> {
  const res = await request(app)
    .post("/api/v1/categories")
    .set(csrfHeaders())
    .set("Cookie", adminCookie)
    .send(categoryPayload());
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const hourMs = 60 * 60 * 1000;

describe("Promotions", () => {
  describe("GET /api/v1/promotions/active", () => {
    it("is public and returns {layout: null, promotions: []} with none eligible", async () => {
      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ layout: null, promotions: [] });
    });

    it("returns a SINGLE-tagged, published, in-window promotion", async () => {
      const adminCookie = await asSuperAdmin();
      const categoryId = await createCategory(adminCookie);

      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Honey Sale",
          discountPercent: 20,
          targetType: "CATEGORY",
          targetCategoryId: categoryId,
          displayLayout: "SINGLE",
          isDraft: false,
          startAt: new Date(Date.now() - hourMs).toISOString(),
          endAt: new Date(Date.now() + hourMs).toISOString(),
        });
      expect(create.status).toBe(201);
      expect(create.body.data.status).toBe("ACTIVE");

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.status).toBe(200);
      expect(res.body.data.layout).toBe("SINGLE");
      expect(res.body.data.promotions).toHaveLength(1);
      expect(res.body.data.promotions[0].title).toBe("Honey Sale");
      expect(res.body.data.promotions[0].badge).toBe("20% OFF");
      expect(res.body.data.promotions[0].ctaLink).toBe(`/products?category=${categoryId}`);
      // Public shape never leaks moderation/target-id fields.
      expect(res.body.data.promotions[0]).not.toHaveProperty("isDraft");
      expect(res.body.data.promotions[0]).not.toHaveProperty("targetCategoryId");
    });

    it("excludes a draft promotion even within its date window", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Still Draft",
          isDraft: true,
          startAt: new Date(Date.now() - hourMs).toISOString(),
          endAt: new Date(Date.now() + hourMs).toISOString(),
        });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data).toEqual({ layout: null, promotions: [] });
    });

    it("excludes a scheduled (future startAt) and an expired (past endAt) promotion", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Future", isDraft: false, startAt: new Date(Date.now() + hourMs).toISOString() });
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Past", isDraft: false, endAt: new Date(Date.now() - hourMs).toISOString() });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data).toEqual({ layout: null, promotions: [] });
    });

    it("SINGLE takes precedence over GRID when both are eligible", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Grid One", isDraft: false, displayLayout: "GRID" });
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Grid Two", isDraft: false, displayLayout: "GRID" });
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "The Single", isDraft: false, displayLayout: "SINGLE" });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data.layout).toBe("SINGLE");
      expect(res.body.data.promotions).toHaveLength(1);
      expect(res.body.data.promotions[0].title).toBe("The Single");
    });

    it("GRID with only grid1 configured: active response has grid2:null", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Grid1 Only", isDraft: false, displayLayout: "GRID" });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data.layout).toBe("GRID");
      expect(res.body.data.promotions).toHaveLength(1);
      expect(res.body.data.promotions[0].title).toBe("Grid1 Only");
      expect(res.body.data.promotions[0].grid2).toBeNull();
    });

    it("GRID with both grids configured: active response exposes both cards from the one row", async () => {
      const adminCookie = await asSuperAdmin();
      const categoryId = await createCategory(adminCookie);
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Card One",
          isDraft: false,
          displayLayout: "GRID",
          grid2Title: "Card Two",
          grid2DiscountPercent: 15,
          grid2TargetType: "CATEGORY",
          grid2TargetCategoryId: categoryId,
        });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data.layout).toBe("GRID");
      expect(res.body.data.promotions).toHaveLength(1);
      const row = res.body.data.promotions[0];
      expect(row.title).toBe("Card One");
      expect(row.grid2).toMatchObject({
        title: "Card Two",
        badge: "15% OFF",
        ctaLink: `/products?category=${categoryId}`,
      });
    });

    it("only the lowest-displayOrder eligible GRID promotion is used when several are eligible", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Second Row", isDraft: false, displayLayout: "GRID", displayOrder: 2 });
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "First Row", isDraft: false, displayLayout: "GRID", displayOrder: 1 });

      const res = await request(app).get("/api/v1/promotions/active");
      expect(res.body.data.layout).toBe("GRID");
      expect(res.body.data.promotions).toHaveLength(1);
      expect(res.body.data.promotions[0].title).toBe("First Row");
    });
  });

  describe("POST /api/v1/admin/promotions", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).post("/api/v1/admin/promotions").set(csrfHeaders()).send({ title: "X" });
      expect(res.status).toBe(401);
    });

    it("rejects a caller without promotions:create", async () => {
      const cookieHeader = await asPermissions(app, ["promotions:read"]);
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ title: "X" });
      expect(res.status).toBe(403);
    });

    it("rejects targetType PRODUCT with no targetProductId", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Bad Target", targetType: "PRODUCT" });
      expect(res.status).toBe(400);
    });

    it("rejects a nonexistent targetCategoryId", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Bad Category",
          targetType: "CATEGORY",
          targetCategoryId: "00000000-0000-7000-8000-000000000000",
        });
      expect(res.status).toBe(422);
    });

    it("rejects endAt before startAt", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Backwards Dates",
          startAt: new Date(Date.now() + hourMs).toISOString(),
          endAt: new Date(Date.now() - hourMs).toISOString(),
        });
      expect(res.status).toBe(400);
    });

    it("defaults to isDraft:true and status DRAFT", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "New Draft" });
      expect(res.status).toBe(201);
      expect(res.body.data.isDraft).toBe(true);
      expect(res.body.data.status).toBe("DRAFT");
    });
  });

  describe("PATCH /api/v1/admin/promotions/:id", () => {
    it("rejects a caller without promotions:update", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Editable" });
      const id = create.body.data.id;

      const cookieHeader = await asPermissions(app, ["promotions:read"]);
      const res = await request(app)
        .patch(`/api/v1/admin/promotions/${id}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ title: "Hacked" });
      expect(res.status).toBe(403);
    });

    it("publishes a draft (isDraft:false) and updates computed status", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Publish Me" });
      const id = create.body.data.id;
      expect(create.body.data.status).toBe("DRAFT");

      const update = await request(app)
        .patch(`/api/v1/admin/promotions/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isDraft: false });
      expect(update.status).toBe(200);
      expect(update.body.data.status).toBe("ACTIVE");
    });

    it("404s for a nonexistent promotion", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .patch("/api/v1/admin/promotions/00000000-0000-7000-8000-000000000000")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "X" });
      expect(res.status).toBe(404);
    });
  });

  describe("Grid 2 fields", () => {
    it("rejects a nonexistent grid2TargetCategoryId the same way the primary target is rejected", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Bad Grid2 Target",
          displayLayout: "GRID",
          grid2TargetType: "CATEGORY",
          grid2TargetCategoryId: "00000000-0000-7000-8000-000000000000",
        });
      expect(res.status).toBe(422);
    });

    it("rejects grid2TargetType PRODUCT with no grid2TargetProductId", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Bad Grid2 Target Type", displayLayout: "GRID", grid2TargetType: "PRODUCT" });
      expect(res.status).toBe(400);
    });

    it("persists and round-trips grid2 fields through the admin GET", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({
          title: "Round Trip Grid1",
          displayLayout: "GRID",
          grid2Title: "Round Trip Grid2",
          grid2Subtitle: "Grid 2 subtitle",
          grid2BadgeText: "New",
          grid2CtaText: "Explore",
        });
      expect(create.status).toBe(201);
      const id = create.body.data.id;

      const get = await request(app).get(`/api/v1/admin/promotions/${id}`).set("Cookie", adminCookie);
      expect(get.status).toBe(200);
      expect(get.body.data.grid2Title).toBe("Round Trip Grid2");
      expect(get.body.data.grid2Subtitle).toBe("Grid 2 subtitle");
      expect(get.body.data.grid2BadgeText).toBe("New");
      expect(get.body.data.grid2CtaText).toBe("Explore");
    });

    it("editing grid1 fields alone does not alter grid2 fields already on the row", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Original Grid1", displayLayout: "GRID", grid2Title: "Original Grid2" });
      const id = create.body.data.id;

      const update = await request(app)
        .patch(`/api/v1/admin/promotions/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Updated Grid1" });
      expect(update.status).toBe(200);
      expect(update.body.data.title).toBe("Updated Grid1");
      expect(update.body.data.grid2Title).toBe("Original Grid2");
    });

    it("editing grid2 fields alone does not alter grid1 fields already on the row", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Stays The Same", subtitle: "Grid1 subtitle", displayLayout: "GRID", grid2Title: "Original Grid2" });
      const id = create.body.data.id;

      const update = await request(app)
        .patch(`/api/v1/admin/promotions/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ grid2Title: "Updated Grid2" });
      expect(update.status).toBe(200);
      expect(update.body.data.grid2Title).toBe("Updated Grid2");
      expect(update.body.data.title).toBe("Stays The Same");
      expect(update.body.data.subtitle).toBe("Grid1 subtitle");
    });

    it("switching an existing GRID promotion to SINGLE preserves its grid2 data untouched", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Will Switch", displayLayout: "GRID", grid2Title: "Preserved Grid2" });
      const id = create.body.data.id;

      const update = await request(app)
        .patch(`/api/v1/admin/promotions/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ displayLayout: "SINGLE" });
      expect(update.status).toBe(200);
      expect(update.body.data.displayLayout).toBe("SINGLE");
      expect(update.body.data.grid2Title).toBe("Preserved Grid2");
    });
  });

  describe("DELETE /api/v1/admin/promotions/:id", () => {
    it("rejects a caller without promotions:delete", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Deletable" });
      const id = create.body.data.id;

      const cookieHeader = await asPermissions(app, ["promotions:read"]);
      const res = await request(app).delete(`/api/v1/admin/promotions/${id}`).set(csrfHeaders()).set("Cookie", cookieHeader);
      expect(res.status).toBe(403);
    });

    it("hard deletes and the row no longer appears in the admin list", async () => {
      const adminCookie = await asSuperAdmin();
      const create = await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Delete Me" });
      const id = create.body.data.id;

      const del = await request(app).delete(`/api/v1/admin/promotions/${id}`).set(csrfHeaders()).set("Cookie", adminCookie);
      expect(del.status).toBe(204);

      const getAfter = await request(app).get(`/api/v1/admin/promotions/${id}`).set("Cookie", adminCookie);
      expect(getAfter.status).toBe(404);
    });
  });

  describe("GET /api/v1/admin/promotions", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/admin/promotions");
      expect(res.status).toBe(401);
    });

    it("lists promotions with pagination meta", async () => {
      const adminCookie = await asSuperAdmin();
      await request(app)
        .post("/api/v1/admin/promotions")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ title: "Listed One" });

      const res = await request(app).get("/api/v1/admin/promotions?limit=5").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.pagination).toBeDefined();
    });
  });
});

describe("POST /api/v1/admin/promotions/broadcast", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).post("/api/v1/admin/promotions/broadcast").set(csrfHeaders()).send({
      title: "Sale",
      message: "20% off everything this weekend.",
    });
    expect(res.status).toBe(401);
  });

  it("requires promotions:update", async () => {
    const readOnly = await asPermissions(app, ["promotions:read"]);
    const res = await request(app)
      .post("/api/v1/admin/promotions/broadcast")
      .set(csrfHeaders())
      .set("Cookie", readOnly)
      .send({ title: "Sale", message: "20% off everything this weekend." });
    expect(res.status).toBe(403);
  });

  it("creates exactly one PROMOTION CustomerNotification per customer and reports the count", async () => {
    const adminCookie = await asSuperAdmin();
    await registerUser(app);
    await registerUser(app);

    const res = await request(app)
      .post("/api/v1/admin/promotions/broadcast")
      .set(csrfHeaders())
      .set("Cookie", adminCookie)
      .send({ title: "Sale", message: "20% off everything this weekend." });

    expect(res.status).toBe(200);
    expect(res.body.data.notifiedCount).toBe(2);

    const notifications = await testPrisma().customerNotification.findMany({ where: { type: "PROMOTION" } });
    expect(notifications).toHaveLength(2);
    expect(notifications.every((n) => n.title === "Sale")).toBe(true);
  });
});

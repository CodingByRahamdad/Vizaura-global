import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

async function findSeededMarketId(code: string): Promise<string> {
  const market = await testPrisma().market.findUnique({ where: { code } });
  if (!market) throw new Error(`Seeded market ${code} not found — check prisma/seed.ts`);
  return market.id;
}

describe("Markets", () => {
  describe("GET /api/v1/markets", () => {
    it("is public and lists only active markets", async () => {
      const res = await request(app).get("/api/v1/markets");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      const codes = res.body.data.map((m: { code: string }) => m.code);
      expect(codes).toContain("PK");
      expect(codes).toContain("AE");
      for (const row of res.body.data) {
        expect(row).not.toHaveProperty("isActive");
      }
    });

    it("excludes a market deactivated via the admin endpoint", async () => {
      const adminCookie = await asSuperAdmin();
      const id = await findSeededMarketId("AE");

      const toggle = await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: false });
      expect(toggle.status).toBe(200);

      const res = await request(app).get("/api/v1/markets");
      expect(res.status).toBe(200);
      expect(res.body.data.some((m: { code: string }) => m.code === "AE")).toBe(false);
      expect(res.body.data.some((m: { code: string }) => m.code === "PK")).toBe(true);
    });
  });

  describe("GET /api/v1/admin/markets", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/admin/markets");
      expect(res.status).toBe(401);
    });

    it("rejects a caller without markets:read", async () => {
      const cookieHeader = await asPermissions(app, ["orders:read"]);
      const res = await request(app).get("/api/v1/admin/markets").set("Cookie", cookieHeader);
      expect(res.status).toBe(403);
    });

    it("allows a super_admin and includes inactive markets", async () => {
      const adminCookie = await asSuperAdmin();
      const id = await findSeededMarketId("AE");
      await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: false });

      const res = await request(app).get("/api/v1/admin/markets").set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      const ae = res.body.data.find((m: { code: string }) => m.code === "AE");
      expect(ae).toBeDefined();
      expect(ae.isActive).toBe(false);
    });
  });

  describe("PATCH /api/v1/admin/markets/:id", () => {
    it("rejects a caller without markets:update", async () => {
      const cookieHeader = await asPermissions(app, ["markets:read"]);
      const id = await findSeededMarketId("PK");
      const res = await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ isActive: false });
      expect(res.status).toBe(403);
    });

    it("toggles isActive off and back on", async () => {
      const adminCookie = await asSuperAdmin();
      const id = await findSeededMarketId("PK");

      const off = await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: false });
      expect(off.status).toBe(200);
      expect(off.body.data.isActive).toBe(false);

      const on = await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: true });
      expect(on.status).toBe(200);
      expect(on.body.data.isActive).toBe(true);
    });

    it("rejects a non-boolean body", async () => {
      const adminCookie = await asSuperAdmin();
      const id = await findSeededMarketId("PK");
      const res = await request(app)
        .patch(`/api/v1/admin/markets/${id}`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: "false" });
      expect(res.status).toBe(400);
    });

    it("404s for a nonexistent market", async () => {
      const adminCookie = await asSuperAdmin();
      const res = await request(app)
        .patch("/api/v1/admin/markets/00000000-0000-7000-8000-000000000000")
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ isActive: false });
      expect(res.status).toBe(404);
    });
  });
});

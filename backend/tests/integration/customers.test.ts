import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";
import { uniqueEmail, VALID_PASSWORD } from "../helpers/factories.js";
import { capturedEmails, resetCapturedEmails } from "../helpers/fakeEmailProvider.js";

vi.mock("../../src/integrations/email/index.js", async () => {
  const { CapturingEmailProvider } = await import("../helpers/fakeEmailProvider.js");
  return { getEmailProvider: () => new CapturingEmailProvider() };
});

const app = buildTestApp();

beforeEach(resetCapturedEmails);
afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

describe("Admin customers module", () => {
  describe("GET /api/v1/admin/customers", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/admin/customers");
      expect(res.status).toBe(401);
    });

    it("rejects a caller without customers:read", async () => {
      const cookieHeader = await asPermissions(app, ["orders:read"]);
      const res = await request(app).get("/api/v1/admin/customers").set("Cookie", cookieHeader);
      expect(res.status).toBe(403);
    });

    it("never returns a super_admin account, even when one exists", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .query({ limit: 100 });
      expect(res.status).toBe(200);
      const roleKeys = res.body.data.map((row: { roleKey: string }) => row.roleKey);
      expect(roleKeys.every((key: string) => key === "customer")).toBe(true);
    });

    it("includes orderCount/totalSpent for every row, defaulting to zero/empty", async () => {
      const cookieHeader = await asSuperAdmin();
      await registerUser(app);
      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .query({ limit: 100 });
      expect(res.status).toBe(200);
      for (const row of res.body.data) {
        expect(typeof row.orderCount).toBe("number");
        expect(Array.isArray(row.totalSpent)).toBe(true);
        expect(row).not.toHaveProperty("passwordHash");
      }
    });

    it("searches by email", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const res = await request(app)
        .get("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .query({ search: payload.email });
      expect(res.status).toBe(200);
      expect(res.body.data.some((u: { email: string }) => u.email === payload.email)).toBe(true);
    });
  });

  describe("GET /api/v1/admin/customers/:id", () => {
    it("404s for a super_admin id (not just filters it from lists)", async () => {
      const cookieHeader = await asSuperAdmin();
      const prisma = testPrisma();
      const me = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: { key: "super_admin" } } } } });
      const res = await request(app).get(`/api/v1/admin/customers/${me.id}`).set("Cookie", cookieHeader);
      expect(res.status).toBe(404);
    });

    it("returns a real customer's detail with order stats", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
      const res = await request(app).get(`/api/v1/admin/customers/${customer.id}`).set("Cookie", cookieHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(payload.email);
      expect(res.body.data.orderCount).toBe(0);
      expect(res.body.data.totalSpent).toEqual([]);
      expect(res.body.data).not.toHaveProperty("passwordHash");
    });
  });

  describe("POST /api/v1/admin/customers", () => {
    it("rejects a caller without customers:create", async () => {
      const cookieHeader = await asPermissions(app, ["customers:read"]);
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "New", lastName: "Customer", email: uniqueEmail(), password: VALID_PASSWORD });
      expect(res.status).toBe(403);
    });

    it("creates a customer with the customer role, never a role field accepted", async () => {
      const cookieHeader = await asSuperAdmin();
      const email = uniqueEmail();
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({
          firstName: "New",
          lastName: "Customer",
          email,
          password: VALID_PASSWORD,
          role: "super_admin", // must be silently ignored — no such field exists on the schema
        });
      expect(res.status).toBe(201);
      expect(res.body.data.email).toBe(email);
      expect(res.body.data).not.toHaveProperty("passwordHash");

      const prisma = testPrisma();
      const created = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { roles: { include: { role: true } } },
      });
      expect(created.roles).toHaveLength(1);
      expect(created.roles[0].role.key).toBe("customer");
    });

    it("creates the account pre-verified (ACTIVE, emailVerifiedAt set) and sends no verification email", async () => {
      const cookieHeader = await asSuperAdmin();
      const email = uniqueEmail();
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Pre", lastName: "Verified", email, password: VALID_PASSWORD });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("ACTIVE");
      expect(res.body.data.emailVerified).toBe(true);

      const prisma = testPrisma();
      const created = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(created.status).toBe("ACTIVE");
      expect(created.emailVerifiedAt).not.toBeNull();
      expect(capturedEmails.find((e) => e.type === "verify" && e.to === email)).toBeUndefined();
    });

    it("accepts a full address and rejects a partial one", async () => {
      const cookieHeader = await asSuperAdmin();

      const partial = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Partial", lastName: "Address", email: uniqueEmail(), password: VALID_PASSWORD, city: "Karachi" });
      expect(partial.status).toBe(400);

      const email = uniqueEmail();
      const full = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({
          firstName: "Full",
          lastName: "Address",
          email,
          password: VALID_PASSWORD,
          addressLine1: "123 Main St",
          city: "Karachi",
          countryCode: "pk",
        });
      expect(full.status).toBe(201);

      const prisma = testPrisma();
      const created = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(created.addressLine1).toBe("123 Main St");
      expect(created.city).toBe("Karachi");
      expect(created.countryCode).toBe("PK");
    });

    it("rejects a duplicate email with a clear conflict, not a generic 500", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Dup", lastName: "Email", email: payload.email, password: VALID_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("USERS_EMAIL_ALREADY_EXISTS");
    });

    it("rejects a password below the policy minimum", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app)
        .post("/api/v1/admin/customers")
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Weak", lastName: "Pass", email: uniqueEmail(), password: "short" });
      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/customers/:id/status", () => {
    it("suspends and reactivates a customer", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });

      const suspend = await request(app)
        .patch(`/api/v1/admin/customers/${customer.id}/status`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ status: "SUSPENDED" });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data.status).toBe("SUSPENDED");

      const reactivate = await request(app)
        .patch(`/api/v1/admin/customers/${customer.id}/status`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ status: "ACTIVE" });
      expect(reactivate.status).toBe(200);
      expect(reactivate.body.data.status).toBe("ACTIVE");
    });

    it("404s when targeting a super_admin id through this customer-scoped endpoint", async () => {
      const cookieHeader = await asSuperAdmin();
      const prisma = testPrisma();
      // The role-scoping check (getExistingCustomerOrThrow) runs before the
      // self-modification guard, so this 404s even when the target happens
      // to be the caller's own id — the assertion holds either way.
      const target = await prisma.user.findFirstOrThrow({
        where: { roles: { some: { role: { key: "super_admin" } } } },
      });
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${target.id}/status`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ status: "SUSPENDED" });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/customers/:id", () => {
    it("rejects a caller without customers:update", async () => {
      const cookieHeader = await asPermissions(app, ["customers:read"]);
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customer.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Nope" });
      expect(res.status).toBe(403);
    });

    it("updates identity and address fields", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${customer.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Updated", phone: "+923001234567", addressLine1: "456 Side St", city: "Lahore", countryCode: "pk" });
      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe("Updated");
      expect(res.body.data.addressLine1).toBe("456 Side St");
      expect(res.body.data.countryCode).toBe("PK");
    });

    it("rejects a duplicate email on update", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload: existing } = await registerUser(app);
      const { payload: target } = await registerUser(app);
      const prisma = testPrisma();
      const targetUser = await prisma.user.findUniqueOrThrow({ where: { email: target.email } });

      const res = await request(app)
        .patch(`/api/v1/admin/customers/${targetUser.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ email: existing.email });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("USERS_EMAIL_ALREADY_EXISTS");
    });

    it("404s when targeting a super_admin id", async () => {
      const cookieHeader = await asSuperAdmin();
      const prisma = testPrisma();
      const target = await prisma.user.findFirstOrThrow({
        where: { roles: { some: { role: { key: "super_admin" } } } },
      });
      const res = await request(app)
        .patch(`/api/v1/admin/customers/${target.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders())
        .send({ firstName: "Nope" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/customers/:id", () => {
    it("rejects a caller without customers:delete", async () => {
      const cookieHeader = await asPermissions(app, ["customers:read", "customers:update"]);
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
      const res = await request(app)
        .delete(`/api/v1/admin/customers/${customer.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders());
      expect(res.status).toBe(403);
    });

    it("soft-deletes a customer: disappears from the list and 404s on direct lookup", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const prisma = testPrisma();
      const customer = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });

      const del = await request(app)
        .delete(`/api/v1/admin/customers/${customer.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders());
      expect(del.status).toBe(200);

      const getRes = await request(app).get(`/api/v1/admin/customers/${customer.id}`).set("Cookie", cookieHeader);
      expect(getRes.status).toBe(404);

      const row = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
      expect(row.deletedAt).not.toBeNull();
    });

    it("blocks a super_admin from deleting their own account through this endpoint", async () => {
      const cookieHeader = await asSuperAdmin();
      const prisma = testPrisma();
      const me = await prisma.user.findFirstOrThrow({ where: { roles: { some: { role: { key: "super_admin" } } } } });
      const res = await request(app)
        .delete(`/api/v1/admin/customers/${me.id}`)
        .set("Cookie", cookieHeader)
        .set(csrfHeaders());
      // getExistingCustomerOrThrow runs first and 404s (the target is a
      // super_admin, not a customer) — the self-delete guard is moot here,
      // but the account must never be deletable either way.
      expect(res.status).toBe(404);
    });
  });
});

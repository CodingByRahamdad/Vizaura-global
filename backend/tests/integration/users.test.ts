import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

describe("Admin user management", () => {
  describe("GET /api/v1/admin/users", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app).get("/api/v1/admin/users");
      expect(res.status).toBe(401);
    });

    it("rejects a caller without users:read", async () => {
      const cookieHeader = await asPermissions(app, ["orders:read"]);
      const res = await request(app).get("/api/v1/admin/users").set("Cookie", cookieHeader);
      expect(res.status).toBe(403);
    });

    it("allows a super_admin, paginates, and never returns passwordHash", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app).get("/api/v1/admin/users").set("Cookie", cookieHeader).query({ limit: 5 });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.pagination.total).toBeGreaterThanOrEqual(1);
      for (const row of res.body.data) {
        expect(row).not.toHaveProperty("passwordHash");
        expect(row).not.toHaveProperty("password");
      }
    });

    it("searches by email", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Cookie", cookieHeader)
        .query({ search: payload.email });
      expect(res.status).toBe(200);
      expect(res.body.data.some((u: { email: string }) => u.email === payload.email)).toBe(true);
    });

    it("filters by role", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Cookie", cookieHeader)
        .query({ role: "super_admin", limit: 100 });
      expect(res.status).toBe(200);
      expect(res.body.data.every((u: { roleKey: string }) => u.roleKey === "super_admin")).toBe(true);
    });

    it("filters by status", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Cookie", cookieHeader)
        .query({ status: "ACTIVE", limit: 100 });
      expect(res.status).toBe(200);
      expect(res.body.data.every((u: { status: string }) => u.status === "ACTIVE")).toBe(true);
    });
  });

  describe("GET /api/v1/admin/users/:id", () => {
    it("rejects an unauthenticated request", async () => {
      const { payload } = await registerUser(app);
      const cookieHeader = await asSuperAdmin();
      const listRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Cookie", cookieHeader)
        .query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app).get(`/api/v1/admin/users/${id}`);
      expect(res.status).toBe(401);
    });

    it("rejects a customer", async () => {
      // Registration already assigns the default "customer" role — no need to
      // (and, per the unique (userId, roleId) constraint, must not) assign it again.
      const { cookieHeader } = await registerUser(app);
      const res = await request(app).get("/api/v1/admin/users/00000000-0000-7000-8000-000000000000").set("Cookie", cookieHeader);
      expect(res.status).toBe(403);
    });

    it("returns a sanitized detail view including inherited permissions", async () => {
      const cookieHeader = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app)
        .get("/api/v1/admin/users")
        .set("Cookie", cookieHeader)
        .query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app).get(`/api/v1/admin/users/${id}`).set("Cookie", cookieHeader);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty("passwordHash");
      expect(res.body.data.role.key).toBe("customer");
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissions.length).toBe(0);
    });

    it("404s for a nonexistent user", async () => {
      const cookieHeader = await asSuperAdmin();
      const res = await request(app).get("/api/v1/admin/users/00000000-0000-7000-8000-000000000000").set("Cookie", cookieHeader);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/users/:id/role", () => {
    it("promotes a customer to super_admin and back", async () => {
      const adminCookie = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const promote = await request(app)
        .patch(`/api/v1/admin/users/${id}/role`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ role: "super_admin" });
      expect(promote.status).toBe(200);
      expect(promote.body.data.role.key).toBe("super_admin");
      expect(promote.body.data.permissions.length).toBeGreaterThan(0);

      const demote = await request(app)
        .patch(`/api/v1/admin/users/${id}/role`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ role: "customer" });
      expect(demote.status).toBe(200);
      expect(demote.body.data.role.key).toBe("customer");
    });

    it("rejects an invalid role string", async () => {
      const adminCookie = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${id}/role`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ role: "admin" });
      expect(res.status).toBe(400);
    });

    it("rejects a caller without roles:assign even if they have users:update", async () => {
      const cookieHeader = await asPermissions(app, ["users:read", "users:update"]);
      const { payload } = await registerUser(app);
      const adminCookie = await asSuperAdmin();
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${id}/role`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ role: "super_admin" });
      expect(res.status).toBe(403);
    });

    it("rejects a super_admin changing their own role", async () => {
      const adminCookie = await asSuperAdmin();
      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", adminCookie);
      const selfId = meRes.body.data.user.id;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${selfId}/role`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ role: "customer" });
      expect(res.status).toBe(409);
    });

    it("refuses to demote the last super_admin", async () => {
      // The only super_admin created in this test's transaction: itself.
      const soleAdminCookie = await asSuperAdmin();
      const secondAdminCookie = await asSuperAdmin();
      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", soleAdminCookie);
      const soleAdminId = meRes.body.data.user.id;

      // Demote every OTHER super_admin down to customer first, using the second admin.
      const secondMeRes = await request(app).get("/api/v1/auth/me").set("Cookie", secondAdminCookie);
      const secondAdminId = secondMeRes.body.data.user.id;
      const demoteSecond = await request(app)
        .patch(`/api/v1/admin/users/${secondAdminId}/role`)
        .set(csrfHeaders())
        .set("Cookie", soleAdminCookie)
        .send({ role: "customer" });
      expect(demoteSecond.status).toBe(200);

      // Now soleAdminCookie's account is the last super_admin — a different
      // super_admin session doesn't exist anymore to attempt the demotion,
      // so re-promote the second account and have IT try to demote the
      // now-sole remaining admin (itself would be self-blocked, so this
      // proves the count-based guard independent of the self-guard).
      const rePromote = await request(app)
        .patch(`/api/v1/admin/users/${secondAdminId}/role`)
        .set(csrfHeaders())
        .set("Cookie", soleAdminCookie)
        .send({ role: "super_admin" });
      expect(rePromote.status).toBe(200);

      const demoteFirst = await request(app)
        .patch(`/api/v1/admin/users/${soleAdminId}/role`)
        .set(csrfHeaders())
        .set("Cookie", secondAdminCookie)
        .send({ role: "customer" });
      expect(demoteFirst.status).toBe(200); // still 2 admins before this call, so it's a valid demotion

      // Now only secondAdminCookie's account is super_admin. Demoting it via
      // itself is self-blocked (409 for a different reason); assert the
      // last-admin guard directly via an ad-hoc caller with roles:assign only.
      const assignerCookie = await asPermissions(app, ["users:read", "roles:assign"]);
      const lastDemote = await request(app)
        .patch(`/api/v1/admin/users/${secondAdminId}/role`)
        .set(csrfHeaders())
        .set("Cookie", assignerCookie)
        .send({ role: "customer" });
      expect(lastDemote.status).toBe(409);
      expect(lastDemote.body.error.code).toBe("USERS_LAST_SUPER_ADMIN");
    });
  });

  describe("PATCH /api/v1/admin/users/:id/status", () => {
    it("suspends a user and their next authenticated request is rejected", async () => {
      const adminCookie = await asSuperAdmin();
      const { payload, cookieHeader: targetCookie } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const meBefore = await request(app).get("/api/v1/auth/me").set("Cookie", targetCookie);
      expect(meBefore.status).toBe(200);

      const suspend = await request(app)
        .patch(`/api/v1/admin/users/${id}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "SUSPENDED" });
      expect(suspend.status).toBe(200);
      expect(suspend.body.data.status).toBe("SUSPENDED");

      // 401 AUTH_SESSION_EXPIRED, not 403 AUTH_ACCOUNT_SUSPENDED: suspending
      // also revokes the session immediately (UsersService.updateStatus), so
      // the session-revoked check in authenticate.ts's resolveAuthContext
      // rejects it before the status===SUSPENDED check is ever reached —
      // a stronger, more immediate rejection than leaving the session alive.
      const meAfter = await request(app).get("/api/v1/auth/me").set("Cookie", targetCookie);
      expect(meAfter.status).toBe(401);
      expect(meAfter.body.error.code).toBe("AUTH_SESSION_EXPIRED");

      const reactivate = await request(app)
        .patch(`/api/v1/admin/users/${id}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "ACTIVE" });
      expect(reactivate.status).toBe(200);
      expect(reactivate.body.data.status).toBe("ACTIVE");
    });

    it("rejects a super_admin suspending themselves", async () => {
      const adminCookie = await asSuperAdmin();
      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", adminCookie);
      const selfId = meRes.body.data.user.id;

      const res = await request(app)
        .patch(`/api/v1/admin/users/${selfId}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "SUSPENDED" });
      expect(res.status).toBe(409);
    });

    it("refuses to suspend the last active super_admin", async () => {
      const soleAdminCookie = await asSuperAdmin();
      const secondAdminCookie = await asSuperAdmin();
      const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", soleAdminCookie);
      const soleAdminId = meRes.body.data.user.id;
      const secondMeRes = await request(app).get("/api/v1/auth/me").set("Cookie", secondAdminCookie);
      const secondAdminId = secondMeRes.body.data.user.id;

      // Suspend the second admin first — fine, one active admin remains.
      const suspendSecond = await request(app)
        .patch(`/api/v1/admin/users/${secondAdminId}/status`)
        .set(csrfHeaders())
        .set("Cookie", soleAdminCookie)
        .send({ status: "SUSPENDED" });
      expect(suspendSecond.status).toBe(200);

      // Now soleAdminCookie's account is the only ACTIVE super_admin. Assert
      // via an ad-hoc caller (so this isn't conflated with the self-guard).
      const assignerCookie = await asPermissions(app, ["users:read", "users:update"]);
      const lastSuspend = await request(app)
        .patch(`/api/v1/admin/users/${soleAdminId}/status`)
        .set(csrfHeaders())
        .set("Cookie", assignerCookie)
        .send({ status: "SUSPENDED" });
      expect(lastSuspend.status).toBe(409);
      expect(lastSuspend.body.error.code).toBe("USERS_LAST_SUPER_ADMIN");
    });

    it("rejects an unsupported transition (e.g. re-suspending an already-suspended user)", async () => {
      const adminCookie = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      await request(app)
        .patch(`/api/v1/admin/users/${id}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "SUSPENDED" });

      const res = await request(app)
        .patch(`/api/v1/admin/users/${id}/status`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send({ status: "SUSPENDED" });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/v1/admin/users/:id/reset-password", () => {
    it("initiates a reset without exposing any token/secret", async () => {
      const adminCookie = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app)
        .post(`/api/v1/admin/users/${id}/reset-password`)
        .set(csrfHeaders())
        .set("Cookie", adminCookie)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ initiated: true });
      expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    });

    it("rejects a caller without users:update", async () => {
      const cookieHeader = await asPermissions(app, ["users:read"]);
      const adminCookie = await asSuperAdmin();
      const { payload } = await registerUser(app);
      const listRes = await request(app).get("/api/v1/admin/users").set("Cookie", adminCookie).query({ search: payload.email });
      const id = listRes.body.data[0].id;

      const res = await request(app)
        .post(`/api/v1/admin/users/${id}/reset-password`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send();
      expect(res.status).toBe(403);
    });
  });
});

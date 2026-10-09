import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { authenticate } from "../../src/middleware/authenticate.js";
import { requirePermission, requireAnyPermission } from "../../src/middleware/requirePermission.js";
import { requireVerifiedEmail } from "../../src/middleware/requireVerifiedEmail.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { requestId } from "../../src/middleware/requestId.js";
import { successResponse } from "../../src/utils/apiResponse.js";
import { env } from "../../src/config/env.js";
import { RbacService } from "../../src/modules/rbac/rbac.service.js";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { createAdHocRole } from "../helpers/roles.js";

function buildProtectedTestApp() {
  const app = express();
  app.use(requestId);
  app.use(cookieParser());
  app.get("/protected/read", authenticate, requirePermission("products:read"), (_req, res) => {
    res.json(successResponse({ ok: true }));
  });
  app.get(
    "/protected/any",
    authenticate,
    requireAnyPermission(["products:delete", "orders:read"]),
    (_req, res) => {
      res.json(successResponse({ ok: true }));
    },
  );
  app.get("/protected/verified", authenticate, requireVerifiedEmail, (_req, res) => {
    res.json(successResponse({ ok: true }));
  });
  app.use(errorHandler);
  return app;
}

const mainApp = buildTestApp();
const protectedApp = buildProtectedTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

describe("authenticate + requirePermission (RBAC is backend-authoritative)", () => {
  it("rejects a request with no access token", async () => {
    const res = await request(protectedApp).get("/protected/read");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_UNAUTHORIZED");
  });

  it("rejects a malformed/garbage access token", async () => {
    const res = await request(protectedApp).get("/protected/read").set("Cookie", "vz_at=not-a-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects an expired access token", async () => {
    const expired = jwt.sign({ sub: "x", sid: "y" }, env.jwt.accessSecret, {
      algorithm: "HS256",
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: "-1s",
    });
    const res = await request(protectedApp).get("/protected/read").set("Cookie", `vz_at=${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_SESSION_EXPIRED");
  });

  it("denies access when the caller lacks the required permission (customer has none)", async () => {
    const { cookieHeader } = await registerUser(mainApp);
    const res = await request(protectedApp).get("/protected/read").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("grants access when the caller's active role holds the permission", async () => {
    const { cookieHeader, payload } = await registerUser(mainApp);
    const roleId = await createAdHocRole(["products:read"]);
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId } });

    const res = await request(protectedApp).get("/protected/read").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
  });

  it("excludes permissions from an INACTIVE role", async () => {
    const { cookieHeader, payload } = await registerUser(mainApp);
    const roleId = await createAdHocRole(["products:read"]);
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId } });

    const grantedFirst = await request(protectedApp).get("/protected/read").set("Cookie", cookieHeader);
    expect(grantedFirst.status).toBe(200);

    await testPrisma().role.update({ where: { id: roleId }, data: { isActive: false } });

    const deniedAfterDeactivation = await request(protectedApp)
      .get("/protected/read")
      .set("Cookie", cookieHeader);
    expect(deniedAfterDeactivation.status).toBe(403);
  });

  it("requireAnyPermission succeeds if at least one listed permission is held", async () => {
    const { cookieHeader, payload } = await registerUser(mainApp);
    // Deliberately holds orders:read but NOT products:delete — proves "any"
    // semantics (a single matching permission is enough), not "all".
    const roleId = await createAdHocRole(["orders:read"]);
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId } });

    const res = await request(protectedApp).get("/protected/any").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
  });

  it("rejects a suspended user mid-session even with a still-valid access token", async () => {
    const { cookieHeader, payload } = await registerUser(mainApp);
    await testPrisma().user.update({ where: { email: payload.email }, data: { status: "SUSPENDED" } });

    const res = await request(protectedApp).get("/protected/read").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_ACCOUNT_SUSPENDED");
  });

  it("rejects a revoked session immediately, even with a still-valid (unexpired) access token", async () => {
    const { cookieHeader } = await registerUser(mainApp);
    await request(mainApp).post("/api/v1/auth/logout").set(csrfHeaders()).set("Cookie", cookieHeader);

    const res = await request(protectedApp).get("/protected/read").set("Cookie", cookieHeader);
    expect(res.status).toBe(401);
  });
});

describe("requireVerifiedEmail", () => {
  it("blocks an unverified customer and allows them through after verification", async () => {
    const { cookieHeader, payload } = await registerUser(mainApp);

    const before = await request(protectedApp).get("/protected/verified").set("Cookie", cookieHeader);
    expect(before.status).toBe(403);
    expect(before.body.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED");

    await testPrisma().user.update({
      where: { email: payload.email },
      data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
    });

    // A fresh session picks up the updated verification state (authenticate
    // re-reads it from the DB on every request; no re-login needed).
    const after = await request(protectedApp).get("/protected/verified").set("Cookie", cookieHeader);
    expect(after.status).toBe(200);
  });
});

describe("system-role protection (RbacService, real repository)", () => {
  it("refuses to remove the last super_admin, allows it once another exists", async () => {
    const rbacService = new RbacService();
    const superAdminRole = await testPrisma().role.findUniqueOrThrow({ where: { key: "super_admin" } });

    const { payload: userAPayload } = await registerUser(mainApp);
    const userA = await testPrisma().user.findUniqueOrThrow({ where: { email: userAPayload.email } });
    await testPrisma().userRole.create({ data: { userId: userA.id, roleId: superAdminRole.id } });

    await expect(rbacService.canRemoveSuperAdmin(userA.id)).resolves.toBe(false);

    const { payload: userBPayload } = await registerUser(mainApp);
    const userB = await testPrisma().user.findUniqueOrThrow({ where: { email: userBPayload.email } });
    await testPrisma().userRole.create({ data: { userId: userB.id, roleId: superAdminRole.id } });

    await expect(rbacService.canRemoveSuperAdmin(userA.id)).resolves.toBe(true);
  });
});

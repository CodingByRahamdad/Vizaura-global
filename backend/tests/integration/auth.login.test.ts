import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser, loginUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

describe("POST /api/v1/auth/login", () => {
  it("logs in with correct credentials and sets fresh cookies", async () => {
    const { payload } = await registerUser(app);
    const res = await loginUser(app, payload.email, payload.password);

    expect(res.res.status).toBe(200);
    expect(res.res.body.data.user.email).toBe(payload.email);
    expect(res.cookies.vz_at).toBeDefined();
    expect(res.cookies.vz_rt).toBeDefined();
  });

  it("updates lastLoginAt on success", async () => {
    const { payload } = await registerUser(app);
    await loginUser(app, payload.email, payload.password);

    const user = await testPrisma().user.findUnique({ where: { email: payload.email } });
    expect(user?.lastLoginAt).not.toBeNull();
  });

  it("rejects an incorrect password with a generic invalid-credentials error", async () => {
    const { payload } = await registerUser(app);
    const res = await loginUser(app, payload.email, "the-wrong-password-entirely");

    expect(res.res.status).toBe(401);
    expect(res.res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("rejects an unknown email with the SAME error code as a wrong password (no enumeration)", async () => {
    const res = await loginUser(app, "definitely-not-registered@example.com", "whatever-password");
    expect(res.res.status).toBe(401);
    expect(res.res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("treats a soft-deleted account as unknown (invalid credentials, not a distinct error)", async () => {
    const { payload } = await registerUser(app);
    await testPrisma().user.update({ where: { email: payload.email }, data: { deletedAt: new Date() } });

    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(401);
    expect(res.res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("reveals SUSPENDED status only after the password was verified correct", async () => {
    const { payload } = await registerUser(app);
    await testPrisma().user.update({ where: { email: payload.email }, data: { status: "SUSPENDED" } });

    const wrongPassword = await loginUser(app, payload.email, "wrong-password-here");
    expect(wrongPassword.res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");

    const correctPassword = await loginUser(app, payload.email, payload.password);
    expect(correctPassword.res.status).toBe(403);
    expect(correctPassword.res.body.error.code).toBe("AUTH_ACCOUNT_SUSPENDED");
  });

  it("blocks a DEACTIVATED account after correct password too", async () => {
    const { payload } = await registerUser(app);
    await testPrisma().user.update({ where: { email: payload.email }, data: { status: "DEACTIVATED" } });

    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(403);
    expect(res.res.body.error.code).toBe("AUTH_ACCOUNT_SUSPENDED");
  });

  it("allows an unverified CUSTOMER to log in", async () => {
    const { payload } = await registerUser(app);
    // Registration leaves emailVerifiedAt null by design.
    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(200);
  });

  it("blocks an unverified STAFF account (non-customer role) from logging in", async () => {
    const { payload } = await registerUser(app);
    const staffRole = await testPrisma().role.findUniqueOrThrow({ where: { key: "super_admin" } });
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId: staffRole.id } });

    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(403);
    expect(res.res.body.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED");
  });

  it("allows a verified staff account to log in", async () => {
    const { payload } = await registerUser(app);
    const staffRole = await testPrisma().role.findUniqueOrThrow({ where: { key: "super_admin" } });
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId: staffRole.id } });
    await testPrisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(200);
  });

  it("requires CAPTCHA on every login attempt, including the first", async () => {
    const { payload } = await registerUser(app);

    // Correct password, but no captchaToken supplied at all.
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set(csrfHeaders())
      .send({ email: payload.email, password: payload.password });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_VALIDATION_ERROR");
  });

  it("logs in successfully on the first attempt when a captchaToken is present", async () => {
    const { payload } = await registerUser(app);

    const res = await loginUser(app, payload.email, payload.password);
    expect(res.res.status).toBe(200);
  });
});

import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerPayload, uniqueEmail } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

describe("POST /api/v1/auth/register", () => {
  it("creates a user, attaches the customer role, and auto-logs in with cookies", async () => {
    const payload = registerPayload();
    const res = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(payload.email);
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
    expect(res.body.data.roles).toContain("customer");

    const setCookie = res.get("Set-Cookie") ?? [];
    expect(setCookie.some((c) => c.startsWith("vz_at="))).toBe(true);
    expect(setCookie.some((c) => c.startsWith("vz_rt="))).toBe(true);
    // Refresh cookie must be scoped to the auth path only.
    expect(setCookie.find((c) => c.startsWith("vz_rt="))).toMatch(/Path=\/api\/v1\/auth/);
  });

  it("creates the user in PENDING_VERIFICATION status", async () => {
    const payload = registerPayload();
    await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);

    const user = await testPrisma().user.findUnique({ where: { email: payload.email } });
    expect(user?.status).toBe("PENDING_VERIFICATION");
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it("never returns the password hash or verification token", async () => {
    const payload = registerPayload();
    const res = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);
    const bodyString = JSON.stringify(res.body);
    expect(bodyString).not.toContain(payload.password);
    expect(bodyString.toLowerCase()).not.toContain("passwordhash");
    expect(bodyString.toLowerCase()).not.toContain("tokenhash");
  });

  it("returns an identical-shaped response for a duplicate email, without creating a second user or a session", async () => {
    const payload = registerPayload();
    const first = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);
    expect(second.status).toBe(201);
    expect(second.body.success).toBe(true);
    expect(second.body.data.user.email).toBe(payload.email);
    // The caller does not own this account: no session is created for them.
    expect(second.get("Set-Cookie")).toBeUndefined();

    const count = await testPrisma().user.count({ where: { email: payload.email } });
    expect(count).toBe(1);
  });

  it("rejects a password shorter than the policy minimum (transport validation)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send(registerPayload({ password: "short" }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_VALIDATION_ERROR");
  });

  it("rejects a common password (business-rule validation, after transport passes)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send(registerPayload({ password: "password1234" }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_VALIDATION_ERROR");
  });

  it("rejects a missing captchaToken", async () => {
    const payload = registerPayload();
    const { captchaToken, ...withoutCaptcha } = payload;
    void captchaToken;

    const res = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(withoutCaptcha);
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email format", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send(registerPayload({ email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("normalizes email casing/whitespace so lookups are consistent", async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send(registerPayload({ email: `  ${email.toUpperCase()}  ` }));

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe(email.toLowerCase());
  });

  it("rejects requests missing the CSRF Origin/header pair", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(registerPayload());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_VALIDATION_FAILED");
  });
});

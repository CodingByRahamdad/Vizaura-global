import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { capturedEmails, resetCapturedEmails, extractToken } from "../helpers/fakeEmailProvider.js";

vi.mock("../../src/integrations/email/index.js", async () => {
  const { CapturingEmailProvider } = await import("../helpers/fakeEmailProvider.js");
  return { getEmailProvider: () => new CapturingEmailProvider() };
});

const app = buildTestApp();

beforeEach(resetCapturedEmails);
afterEach(resetTestData);
afterAll(closeTestDb);

async function registerAndGetVerificationToken() {
  const result = await registerUser(app);
  const verifyEmail = capturedEmails.find((e) => e.type === "verify");
  return { ...result, token: extractToken(verifyEmail!.url!) };
}

describe("POST /api/v1/auth/verify-email", () => {
  it("verifies the account and promotes PENDING_VERIFICATION to ACTIVE", async () => {
    const { payload, token } = await registerAndGetVerificationToken();

    const res = await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);

    const user = await testPrisma().user.findUnique({ where: { email: payload.email } });
    expect(user?.status).toBe("ACTIVE");
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("is idempotent: verifying an already-verified account (re-click) still succeeds", async () => {
    const { token } = await registerAndGetVerificationToken();
    await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });

    const second = await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });
    expect(second.status).toBe(200);
  });

  it("rejects a token that does not exist", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify-email")
      .set(csrfHeaders())
      .send({ token: "not-a-real-token" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_INVALID_VERIFICATION_TOKEN");
  });

  it("rejects an expired token", async () => {
    const { payload, token } = await registerAndGetVerificationToken();
    void payload;
    await testPrisma().emailVerificationToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_INVALID_VERIFICATION_TOKEN");
  });

  it("never returns the raw token in the response", async () => {
    const { token } = await registerAndGetVerificationToken();
    const res = await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });
    expect(JSON.stringify(res.body)).not.toContain(token);
  });
});

describe("POST /api/v1/auth/resend-verification", () => {
  it("issues a new token that invalidates the previous one", async () => {
    const { cookieHeader, token: firstToken } = await registerAndGetVerificationToken();
    resetCapturedEmails();

    const resendRes = await request(app)
      .post("/api/v1/auth/resend-verification")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(resendRes.status).toBe(202);

    const secondEmail = capturedEmails.find((e) => e.type === "verify");
    const secondToken = extractToken(secondEmail!.url!);
    expect(secondToken).not.toBe(firstToken);

    // The old token no longer verifies.
    const oldAttempt = await request(app)
      .post("/api/v1/auth/verify-email")
      .set(csrfHeaders())
      .send({ token: firstToken });
    expect(oldAttempt.status).toBe(400);

    // The new token works.
    const newAttempt = await request(app)
      .post("/api/v1/auth/verify-email")
      .set(csrfHeaders())
      .send({ token: secondToken });
    expect(newAttempt.status).toBe(200);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/v1/auth/resend-verification").set(csrfHeaders());
    expect(res.status).toBe(401);
  });

  it("is a no-op for an already-verified account", async () => {
    const { cookieHeader, token } = await registerAndGetVerificationToken();
    await request(app).post("/api/v1/auth/verify-email").set(csrfHeaders()).send({ token });
    resetCapturedEmails();

    const res = await request(app)
      .post("/api/v1/auth/resend-verification")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(202);
    expect(capturedEmails.filter((e) => e.type === "verify")).toHaveLength(0);
  });
});

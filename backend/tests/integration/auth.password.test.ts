import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, csrfHeaders, parseSetCookies, toCookieHeader } from "../helpers/app.js";
import { registerUser, loginUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { capturedEmails, resetCapturedEmails, extractToken } from "../helpers/fakeEmailProvider.js";

vi.mock("../../src/integrations/email/index.js", async () => {
  const { CapturingEmailProvider } = await import("../helpers/fakeEmailProvider.js");
  return { getEmailProvider: () => new CapturingEmailProvider() };
});

const app = buildTestApp();
const NEW_PASSWORD = "Totally-Different-Passphrase-7";

beforeEach(resetCapturedEmails);
afterEach(resetTestData);
afterAll(closeTestDb);

async function callMe(cookieHeader: string) {
  return request(app).get("/api/v1/auth/me").set("Cookie", cookieHeader);
}

describe("POST /api/v1/auth/change-password", () => {
  it("changes the password, rejects wrong current password, and rejects reusing the same password", async () => {
    const { cookieHeader, payload } = await registerUser(app);

    const wrongCurrent = await request(app)
      .post("/api/v1/auth/change-password")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: "not-the-real-password", newPassword: NEW_PASSWORD, captchaToken: "t" });
    expect(wrongCurrent.status).toBe(401);
    expect(wrongCurrent.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");

    const sameAsOld = await request(app)
      .post("/api/v1/auth/change-password")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newPassword: payload.password, captchaToken: "t" });
    expect(sameAsOld.status).toBe(422);
    expect(sameAsOld.body.error.code).toBe("AUTH_PASSWORD_REUSED");

    const weakNew = await request(app)
      .post("/api/v1/auth/change-password")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newPassword: "password1234", captchaToken: "t" });
    expect(weakNew.status).toBe(400);

    const success = await request(app)
      .post("/api/v1/auth/change-password")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newPassword: NEW_PASSWORD, captchaToken: "t" });
    expect(success.status).toBe(200);
    expect(success.get("Set-Cookie")?.some((c) => c.startsWith("vz_at="))).toBe(true);
  });

  it("MANDATORY REGRESSION: old session dies on password change; a new session works; the old refresh token fails too", async () => {
    // 1. Register (auto-login) -> session A.
    const { cookieHeader: sessionA, payload } = await registerUser(app);
    const preChange = await callMe(sessionA);
    expect(preChange.status).toBe(200);

    // 2. Change password from session A.
    const changeRes = await request(app)
      .post("/api/v1/auth/change-password")
      .set(csrfHeaders())
      .set("Cookie", sessionA)
      .send({ currentPassword: payload.password, newPassword: NEW_PASSWORD, captchaToken: "t" });
    expect(changeRes.status).toBe(200);
    const sessionB = toCookieHeader(parseSetCookies(changeRes.get("Set-Cookie")));

    // 3. Session A (old access token) must no longer authenticate.
    const oldAccessAttempt = await callMe(sessionA);
    expect(oldAccessAttempt.status).toBe(401);

    // 4. Session A's refresh token must no longer work either.
    const oldRefreshAttempt = await request(app)
      .post("/api/v1/auth/refresh")
      .set(csrfHeaders())
      .set("Cookie", sessionA);
    expect(oldRefreshAttempt.status).toBe(401);

    // 5. New session B (issued by the password-change response) works.
    const newSessionCheck = await callMe(sessionB);
    expect(newSessionCheck.status).toBe(200);

    // 6. The user can log in again with the NEW password (old one is dead).
    const reLogin = await loginUser(app, payload.email, NEW_PASSWORD);
    expect(reLogin.res.status).toBe(200);
    const oldPasswordLogin = await loginUser(app, payload.email, payload.password);
    expect(oldPasswordLogin.res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/change-email", () => {
  it("changes the email, rejects wrong current password, rejects the same email, and rejects a duplicate email", async () => {
    const { cookieHeader, payload } = await registerUser(app);
    const other = await registerUser(app);

    const wrongCurrent = await request(app)
      .post("/api/v1/auth/change-email")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: "not-the-real-password", newEmail: "new-address@example.com", captchaToken: "t" });
    expect(wrongCurrent.status).toBe(401);
    expect(wrongCurrent.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");

    const sameEmail = await request(app)
      .post("/api/v1/auth/change-email")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newEmail: payload.email, captchaToken: "t" });
    expect(sameEmail.status).toBe(422);
    expect(sameEmail.body.error.code).toBe("AUTH_EMAIL_UNCHANGED");

    const duplicateEmail = await request(app)
      .post("/api/v1/auth/change-email")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newEmail: other.payload.email, captchaToken: "t" });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.error.code).toBe("AUTH_EMAIL_ALREADY_IN_USE");

    const newEmail = "updated-address@example.com";
    const success = await request(app)
      .post("/api/v1/auth/change-email")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ currentPassword: payload.password, newEmail, captchaToken: "t" });
    expect(success.status).toBe(200);
    expect(success.get("Set-Cookie")?.some((c) => c.startsWith("vz_at="))).toBe(true);

    const user = await testPrisma().user.findUnique({ where: { email: newEmail } });
    expect(user).not.toBeNull();
  });

  it("MANDATORY REGRESSION: old session dies on email change; a new session works; login requires the new email", async () => {
    const { cookieHeader: sessionA, payload } = await registerUser(app);
    const preChange = await callMe(sessionA);
    expect(preChange.status).toBe(200);

    const newEmail = "rotated-address@example.com";
    const changeRes = await request(app)
      .post("/api/v1/auth/change-email")
      .set(csrfHeaders())
      .set("Cookie", sessionA)
      .send({ currentPassword: payload.password, newEmail, captchaToken: "t" });
    expect(changeRes.status).toBe(200);
    const sessionB = toCookieHeader(parseSetCookies(changeRes.get("Set-Cookie")));

    const oldAccessAttempt = await callMe(sessionA);
    expect(oldAccessAttempt.status).toBe(401);

    const oldRefreshAttempt = await request(app)
      .post("/api/v1/auth/refresh")
      .set(csrfHeaders())
      .set("Cookie", sessionA);
    expect(oldRefreshAttempt.status).toBe(401);

    const newSessionCheck = await callMe(sessionB);
    expect(newSessionCheck.status).toBe(200);

    const reLogin = await loginUser(app, newEmail, payload.password);
    expect(reLogin.res.status).toBe(200);
    const oldEmailLogin = await loginUser(app, payload.email, payload.password);
    expect(oldEmailLogin.res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/forgot-password + POST /api/v1/auth/reset-password", () => {
  it("returns an identical generic response for an existing and an unknown email", async () => {
    const { payload } = await registerUser(app);

    const known = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });
    const unknown = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: "nobody-registered@example.com", captchaToken: "t" });

    expect(known.status).toBe(unknown.status);
    expect(known.body.data.message).toBe(unknown.body.data.message);
  });

  it("only sends a reset email for an account that actually exists", async () => {
    const { payload } = await registerUser(app);
    resetCapturedEmails();

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: "nobody-registered@example.com", captchaToken: "t" });
    expect(capturedEmails.filter((e) => e.type === "reset")).toHaveLength(0);

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });
    expect(capturedEmails.filter((e) => e.type === "reset")).toHaveLength(1);
  });

  it("resets the password with a valid token, invalidates it on reuse, and requires re-login (no auto-login)", async () => {
    const { payload } = await registerUser(app);
    resetCapturedEmails();

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });

    const resetEmail = capturedEmails.find((e) => e.type === "reset");
    const token = extractToken(resetEmail!.url!);

    const resetRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .set(csrfHeaders())
      .send({ token, newPassword: NEW_PASSWORD, captchaToken: "t" });
    expect(resetRes.status).toBe(200);
    expect(resetRes.get("Set-Cookie")).toBeUndefined(); // no auto-login

    // Single-use: the same token cannot be used again.
    const reuse = await request(app)
      .post("/api/v1/auth/reset-password")
      .set(csrfHeaders())
      .send({ token, newPassword: "Another-Password-9", captchaToken: "t" });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe("AUTH_INVALID_RESET_TOKEN");

    // Must sign in explicitly with the new password.
    const login = await loginUser(app, payload.email, NEW_PASSWORD);
    expect(login.res.status).toBe(200);
  });

  it("rejects an expired reset token", async () => {
    const { payload } = await registerUser(app);
    resetCapturedEmails();

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });

    const resetEmail = capturedEmails.find((e) => e.type === "reset");
    const token = extractToken(resetEmail!.url!);

    await testPrisma().passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .set(csrfHeaders())
      .send({ token, newPassword: NEW_PASSWORD, captchaToken: "t" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("AUTH_INVALID_RESET_TOKEN");
  });

  it("MANDATORY REGRESSION (reset variant): resetting the password kills the existing session", async () => {
    const { cookieHeader: sessionA, payload } = await registerUser(app);
    resetCapturedEmails();

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });
    const resetEmail = capturedEmails.find((e) => e.type === "reset");
    const token = extractToken(resetEmail!.url!);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .set(csrfHeaders())
      .send({ token, newPassword: NEW_PASSWORD, captchaToken: "t" });

    const oldSessionCheck = await callMe(sessionA);
    expect(oldSessionCheck.status).toBe(401);
  });

  it("marks the email verified after a successful reset", async () => {
    const { payload } = await registerUser(app);
    resetCapturedEmails();

    await request(app)
      .post("/api/v1/auth/forgot-password")
      .set(csrfHeaders())
      .send({ email: payload.email, captchaToken: "t" });
    const resetEmail = capturedEmails.find((e) => e.type === "reset");
    const token = extractToken(resetEmail!.url!);

    await request(app)
      .post("/api/v1/auth/reset-password")
      .set(csrfHeaders())
      .send({ token, newPassword: NEW_PASSWORD, captchaToken: "t" });

    const user = await testPrisma().user.findUnique({ where: { email: payload.email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(user?.status).toBe("ACTIVE");
  });
});

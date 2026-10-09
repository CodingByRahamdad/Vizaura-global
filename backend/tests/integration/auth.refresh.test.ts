import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders, parseSetCookies, toCookieHeader, isCookieCleared } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function doRefresh(cookieHeader: string) {
  const res = await request(app).post("/api/v1/auth/refresh").set(csrfHeaders()).set("Cookie", cookieHeader);
  return { res, cookies: parseSetCookies(res.get("Set-Cookie")) };
}

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token: issues new cookies and revokes the old session row", async () => {
    const { cookieHeader, cookies: original } = await registerUser(app);
    const { res, cookies: rotated } = await doRefresh(cookieHeader);

    expect(res.status).toBe(200);
    expect(rotated.vz_rt).toBeDefined();
    expect(rotated.vz_rt).not.toBe(original.vz_rt);
    expect(rotated.vz_at).not.toBe(original.vz_at);

    const oldSession = await testPrisma().session.findFirst({
      orderBy: { createdAt: "asc" },
    });
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(oldSession?.revokedReason).toBe("rotated");
  });

  it("keeps the same session family across rotation", async () => {
    const { cookieHeader } = await registerUser(app);
    await doRefresh(cookieHeader);

    const sessions = await testPrisma().session.findMany();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].familyId).toBe(sessions[1].familyId);
  });

  it("the new refresh token works for a subsequent rotation", async () => {
    const { cookieHeader } = await registerUser(app);
    const first = await doRefresh(cookieHeader);
    const second = await doRefresh(toCookieHeader(first.cookies));
    expect(second.res.status).toBe(200);
  });

  it("returns AUTH_REFRESH_RETRY (not reuse detection) when the just-rotated token is replayed immediately", async () => {
    const { cookieHeader } = await registerUser(app);
    await doRefresh(cookieHeader); // rotates; old token now revoked with reason "rotated"

    const replay = await doRefresh(cookieHeader); // present the OLD token again, immediately
    expect(replay.res.status).toBe(401);
    expect(replay.res.body.error.code).toBe("AUTH_REFRESH_RETRY");
  });

  it("the family survives a grace-window retry: the latest token still works afterward", async () => {
    const { cookieHeader } = await registerUser(app);
    const rotated = await doRefresh(cookieHeader);
    await doRefresh(cookieHeader); // benign replay within grace

    const stillWorks = await doRefresh(toCookieHeader(rotated.cookies));
    expect(stillWorks.res.status).toBe(200);
  });

  it("treats replay OUTSIDE the grace window as reuse: revokes the entire family", async () => {
    const { cookieHeader } = await registerUser(app);
    const rotated = await doRefresh(cookieHeader);

    // Simulate time passing: push the rotated session's revokedAt into the past.
    const oldSession = await testPrisma().session.findFirst({
      where: { revokedReason: "rotated" },
      orderBy: { createdAt: "asc" },
    });
    await testPrisma().session.update({
      where: { id: oldSession!.id },
      data: { revokedAt: new Date(Date.now() - 20_000) },
    });

    const replay = await doRefresh(cookieHeader);
    expect(replay.res.status).toBe(401);
    expect(replay.res.body.error.code).toBe("AUTH_REFRESH_REUSE_DETECTED");

    // The entire family is now dead — even the latest (legitimate) token fails.
    const latestAttempt = await doRefresh(toCookieHeader(rotated.cookies));
    expect(latestAttempt.res.status).toBe(401);

    const sessions = await testPrisma().session.findMany();
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it("clears cookies on reuse detection", async () => {
    const { cookieHeader } = await registerUser(app);
    await doRefresh(cookieHeader);
    const oldSession = await testPrisma().session.findFirst({
      where: { revokedReason: "rotated" },
    });
    await testPrisma().session.update({
      where: { id: oldSession!.id },
      data: { revokedAt: new Date(Date.now() - 20_000) },
    });

    const replay = await doRefresh(cookieHeader);
    expect(isCookieCleared(replay.res.get("Set-Cookie"), "vz_at")).toBe(true);
    expect(isCookieCleared(replay.res.get("Set-Cookie"), "vz_rt")).toBe(true);
  });

  it("rejects an expired refresh token", async () => {
    const { cookieHeader } = await registerUser(app);
    await testPrisma().session.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await doRefresh(cookieHeader);
    expect(res.res.status).toBe(401);
    expect(res.res.body.error.code).toBe("AUTH_SESSION_EXPIRED");
  });

  it("rejects when no refresh cookie is present", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").set(csrfHeaders());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_REFRESH_TOKEN");
  });

  it("rejects a refresh token that matches no session", async () => {
    const res = await doRefresh("vz_rt=not-a-real-token-at-all");
    expect(res.res.status).toBe(401);
    expect(res.res.body.error.code).toBe("AUTH_INVALID_REFRESH_TOKEN");
  });

  it("revokes the family and rejects when the user has been suspended", async () => {
    const { cookieHeader, payload } = await registerUser(app);
    await testPrisma().user.update({ where: { email: payload.email }, data: { status: "SUSPENDED" } });

    const res = await doRefresh(cookieHeader);
    expect(res.res.status).toBe(401);

    const sessions = await testPrisma().session.findMany();
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
  });

  it("concurrent refresh with the same token: exactly one request rotates successfully", async () => {
    const { cookieHeader } = await registerUser(app);

    const [a, b] = await Promise.all([doRefresh(cookieHeader), doRefresh(cookieHeader)]);
    const statuses = [a.res.status, b.res.status].sort();

    // One wins (200), the other hits the race-safe conditional update and
    // gets the retry signal rather than also minting a session.
    expect(statuses).toEqual([200, 401]);
    const loser = a.res.status === 401 ? a.res : b.res;
    expect(loser.body.error.code).toBe("AUTH_REFRESH_RETRY");

    // Only one new session was created by this rotation.
    const sessions = await testPrisma().session.findMany();
    expect(sessions).toHaveLength(2); // original + exactly one replacement
  });
});

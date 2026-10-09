import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerPayload } from "../helpers/factories.js";
import { env } from "../../src/config/env.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

describe("CORS", () => {
  it("reflects the configured frontend origin with credentials allowed", async () => {
    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", env.frontendUrl);

    expect(res.headers["access-control-allow-origin"]).toBe(env.frontendUrl);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("never reflects an arbitrary origin", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example.com");
  });

  it("responds to a CORS preflight for a mutating auth route", async () => {
    const res = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", env.frontendUrl)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", env.csrfHeaderName);

    expect(res.status).toBeLessThan(300);
    expect(res.headers["access-control-allow-methods"]).toBeDefined();
  });
});

describe("CSRF protection", () => {
  it("rejects a mutating request with no Origin/Referer at all", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set(env.csrfHeaderName, "1")
      .send({ email: "a@example.com", password: "whatever" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_VALIDATION_FAILED");
  });

  it("rejects a mutating request from a mismatched Origin", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", "https://attacker.example.com")
      .set(env.csrfHeaderName, "1")
      .send({ email: "a@example.com", password: "whatever" });
    expect(res.status).toBe(403);
  });

  it("rejects a mutating request missing the required custom header, even with a correct Origin", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", env.frontendUrl)
      .send({ email: "a@example.com", password: "whatever" });
    expect(res.status).toBe(403);
  });

  it("does not require CSRF headers on GET requests", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
  });

  it("allows a correctly-formed mutating request through", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send(registerPayload());
    expect(res.status).toBe(201);
  });
});

describe("security headers", () => {
  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets a restrictive CSP for this JSON-only API", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("does not advertise X-Powered-By", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("does not send HSTS outside production", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });

  it("attaches a per-request X-Request-Id", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("disables ETag (no cached fingerprint of API responses)", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers.etag).toBeUndefined();
  });

  it("sets Cache-Control: no-store on auth responses", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set(csrfHeaders())
      .send({ email: "nobody@example.com", password: "whatever-password" });
    expect(res.headers["cache-control"]).toContain("no-store");
  });
});

describe("body size limit", () => {
  it("rejects an oversized JSON body", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .set(csrfHeaders())
      .send({ ...registerPayload(), lastName: "x".repeat(200_000) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("standardized error envelope", () => {
  it("404s use the documented error shape", async () => {
    const res = await request(app).get("/api/v1/this-route-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "NOT_FOUND" }) }),
    );
  });
});

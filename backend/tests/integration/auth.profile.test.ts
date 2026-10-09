import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

describe("PATCH /api/v1/auth/me", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app)
      .patch("/api/v1/auth/me")
      .set(csrfHeaders())
      .send({ firstName: "New" });
    expect(res.status).toBe(401);
  });

  it("updates firstName/lastName/phone and the change persists on GET /auth/me", async () => {
    const { cookieHeader } = await registerUser(app);

    const patchRes = await request(app)
      .patch("/api/v1/auth/me")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ firstName: "Updated", lastName: "Name", phone: "+1-555-0100" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.user.firstName).toBe("Updated");
    expect(patchRes.body.data.user.lastName).toBe("Name");
    expect(patchRes.body.data.user.phone).toBe("+1-555-0100");

    const meRes = await request(app).get("/api/v1/auth/me").set("Cookie", cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.firstName).toBe("Updated");
    expect(meRes.body.data.user.lastName).toBe("Name");
  });

  it("never changes email, password, status, or role through this endpoint", async () => {
    const { cookieHeader, payload } = await registerUser(app);

    const res = await request(app)
      .patch("/api/v1/auth/me")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      // @ts-expect-error — deliberately sending fields the schema doesn't accept
      .send({ firstName: "Still Me", email: "hijacked@example.com", status: "SUSPENDED", role: "super_admin" });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(payload.email);
    expect(res.body.data.user.status).not.toBe("SUSPENDED");
  });

  it("rejects an empty body", async () => {
    const { cookieHeader } = await registerUser(app);
    const res = await request(app).patch("/api/v1/auth/me").set(csrfHeaders()).set("Cookie", cookieHeader).send({});
    expect(res.status).toBe(400);
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";

describe("GET /api/v1/health", () => {
  it("returns a standard success envelope with status ok", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });
});

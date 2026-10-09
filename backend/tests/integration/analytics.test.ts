import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

const asSuperAdmin = () => asRole(app, "super_admin");

describe("GET /api/v1/admin/analytics/dashboard", () => {
  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/v1/admin/analytics/dashboard");
    expect(res.status).toBe(401);
  });

  it("rejects a customer", async () => {
    // Registration already assigns the default "customer" role — no need to
    // (and, per the unique (userId, roleId) constraint, must not) assign it again.
    const { cookieHeader } = await registerUser(app);
    const res = await request(app).get("/api/v1/admin/analytics/dashboard").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
  });

  it("allows a super_admin and returns the full shape on an empty dataset", async () => {
    const cookieHeader = await asSuperAdmin();
    const res = await request(app).get("/api/v1/admin/analytics/dashboard").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);

    const data = res.body.data;
    expect(data.days).toBe(30);
    expect(Array.isArray(data.markets)).toBe(true);
    expect(data.markets.length).toBeGreaterThanOrEqual(2);
    for (const market of data.markets) {
      expect(market.revenue).toBe(0);
      expect(market.orderCount).toBe(0);
      expect(market.averageOrderValue).toBe(0);
      expect(market.revenueTrendPct).toBeNull();
      expect(Array.isArray(market.salesOverTime)).toBe(true);
      expect(Array.isArray(market.topProducts)).toBe(true);
    }
    expect(Array.isArray(data.orderStatusBreakdown)).toBe(true);
    expect(Array.isArray(data.lowStock)).toBe(true);
    expect(data.totalReturnedItems).toBe(0);
    expect(typeof data.productCount).toBe("number");
    expect(typeof data.customerCount).toBe("number");
    expect(Array.isArray(data.recentCustomers)).toBe(true);
  });

  it("never combines two markets' currencies into one figure", async () => {
    const cookieHeader = await asSuperAdmin();
    const res = await request(app).get("/api/v1/admin/analytics/dashboard").set("Cookie", cookieHeader);
    expect(res.status).toBe(200);

    const marketCodes = res.body.data.markets.map((m: { marketCode: string }) => m.marketCode);
    expect(new Set(marketCodes).size).toBe(marketCodes.length);
    for (const market of res.body.data.markets) {
      expect(market).not.toHaveProperty("combinedRevenue");
      expect(market).not.toHaveProperty("totalRevenue");
    }
    expect(res.body.data).not.toHaveProperty("combinedRevenue");
    expect(res.body.data).not.toHaveProperty("totalRevenue");
  });

  it("rejects an invalid days parameter", async () => {
    const cookieHeader = await asSuperAdmin();
    const res = await request(app)
      .get("/api/v1/admin/analytics/dashboard")
      .set("Cookie", cookieHeader)
      .query({ days: 9999 });
    expect(res.status).toBe(400);
  });

  it("respects a custom days window", async () => {
    const cookieHeader = await asSuperAdmin();
    const res = await request(app)
      .get("/api/v1/admin/analytics/dashboard")
      .set("Cookie", cookieHeader)
      .query({ days: 7 });
    expect(res.status).toBe(200);
    expect(res.body.data.days).toBe(7);
  });
});

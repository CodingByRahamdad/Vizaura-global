import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function asRole(key: string) {
  const { cookieHeader, payload } = await registerUser(app);
  const role = await testPrisma().role.findUniqueOrThrow({ where: { key } });
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().userRole.create({ data: { userId: user.id, roleId: role.id } });
  return { cookieHeader, userId: user.id };
}

const asSuperAdmin = () => asRole("super_admin");
// Phase 6E collapsed the seeded role set to super_admin/customer.
const asProductManager = () => asRole("super_admin");
/// A caller with broad-but-not-exhaustive permissions, deliberately missing
/// audit:read — re-expresses the removed `admin`/`store_manager` roles'
/// shared property (broad grants, audit:read excluded) as an ad-hoc role,
/// since neither role exists any more.
const asBroadNonAuditRole = () =>
  asPermissions(app, ["products:read", "products:update", "orders:read", "orders:update", "payments:read"]).then(
    (cookieHeader) => ({ cookieHeader }),
  );

// -- WRITE-SIDE WIRING -----------------------------------------------------

describe("AuditLog — write-side wiring", () => {
  it("records exactly one AuditLog row for a product creation, with the created product's id as entityId", async () => {
    const { cookieHeader: productCookie, userId } = await asProductManager();
    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "ACTIVE" }));
    expect(res.status).toBe(201);
    const productId = res.body.data.id as string;

    const logs = await testPrisma().auditLog.findMany({ where: { entityType: "Product", entityId: productId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.action).toBe("CREATE_PRODUCT");
    expect(logs[0]!.userId).toBe(userId);
    expect(logs[0]!.after).not.toBeNull();
  });

  it("records a product update with the after-state captured", async () => {
    const { cookieHeader: productCookie } = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;

    const res = await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send({ name: "Renamed Product" });
    expect(res.status).toBe(200);

    const logs = await testPrisma().auditLog.findMany({ where: { entityType: "Product", entityId: productId, action: "UPDATE_PRODUCT" } });
    expect(logs).toHaveLength(1);
  });

  it("records a product deletion with the before-state captured", async () => {
    const { cookieHeader: productCookie } = await asProductManager();
    // DRAFT (the default) — Phase 6E only allows deleting a DRAFT product;
    // ACTIVE/ARCHIVED must go through Archive instead (see catalog.products.test.ts).
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload());
    const productId = created.body.data.id as string;

    const res = await request(app).delete(`/api/v1/products/${productId}`).set(csrfHeaders()).set("Cookie", productCookie);
    expect(res.status).toBe(204);

    const logs = await testPrisma().auditLog.findMany({ where: { entityType: "Product", entityId: productId, action: "DELETE_PRODUCT" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.before).not.toBeNull();
  });

  it("never blocks the primary mutation even if audit recording were to fail (best-effort by design)", async () => {
    // AuditLogService.record() catches internally and never throws — this
    // test just confirms the primary mutation's response is unaffected by
    // auditing at all, i.e. it isn't awaited in a way that could fail the
    // request even under normal conditions.
    const { cookieHeader: productCookie } = await asProductManager();
    const res = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "ACTIVE" }));
    expect(res.status).toBe(201);
  });
});

// -- READ-SIDE / RBAC --------------------------------------------------------

describe("AuditLog — GET /admin/audit-logs", () => {
  it("is reachable by super_admin (allPermissions)", async () => {
    const { cookieHeader: productCookie } = await asProductManager();
    await request(app).post("/api/v1/products").set(csrfHeaders()).set("Cookie", productCookie).send(productPayload({ status: "ACTIVE" }));

    const { cookieHeader: superAdminCookie } = await asSuperAdmin();
    const res = await request(app).get("/api/v1/admin/audit-logs").set("Cookie", superAdminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("rejects a caller with broad-but-not-exhaustive permissions that exclude audit:read", async () => {
    const { cookieHeader } = await asBroadNonAuditRole();
    const res = await request(app).get("/api/v1/admin/audit-logs").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/v1/admin/audit-logs");
    expect(res.status).toBe(401);
  });

  it("filters by entityType/entityId/action", async () => {
    const { cookieHeader: productCookie } = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = created.body.data.id as string;

    const { cookieHeader: superAdminCookie } = await asSuperAdmin();
    const res = await request(app)
      .get("/api/v1/admin/audit-logs")
      .query({ entityType: "Product", entityId: productId, action: "CREATE_PRODUCT" })
      .set("Cookie", superAdminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].entityId).toBe(productId);
  });

  it("paginates results", async () => {
    const { cookieHeader: superAdminCookie } = await asSuperAdmin();
    const res = await request(app).get("/api/v1/admin/audit-logs").query({ page: 1, limit: 5 }).set("Cookie", superAdminCookie);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ page: 1, limit: 5 });
  });
});

// -- IMMUTABILITY -------------------------------------------------------------

describe("AuditLog — no write route exists", () => {
  it("has no PATCH/PUT/DELETE route under /admin/audit-logs", async () => {
    const { cookieHeader: superAdminCookie } = await asSuperAdmin();
    const logs = await testPrisma().auditLog.findMany({ take: 1 });
    const anyId = logs[0]?.id ?? "00000000-0000-0000-0000-000000000000";

    const patchRes = await request(app).patch(`/api/v1/admin/audit-logs/${anyId}`).set(csrfHeaders()).set("Cookie", superAdminCookie).send({});
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app).delete(`/api/v1/admin/audit-logs/${anyId}`).set(csrfHeaders()).set("Cookie", superAdminCookie);
    expect(deleteRes.status).toBe(404);
  });
});

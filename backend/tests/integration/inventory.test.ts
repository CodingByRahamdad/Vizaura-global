import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, createAdHocRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function asRole(key: string) {
  const { cookieHeader, payload } = await registerUser(app);
  const role = await testPrisma().role.findUniqueOrThrow({ where: { key } });
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().userRole.create({ data: { userId: user.id, roleId: role.id } });
  return cookieHeader;
}

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asInventoryManager = () => asRole("super_admin");
const asProductManager = () => asRole("super_admin");
/// Has products:read only, no inventory:* — used for the 403 RBAC case
/// (re-expressed as an ad-hoc role since marketing_manager no longer exists).
const asMarketingManager = () => asPermissions(app, ["products:read"]);

async function createActiveProduct(cookieHeader: string): Promise<{ productId: string; variantId: string }> {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ status: "ACTIVE" }));
  return { productId: res.body.data.id as string, variantId: res.body.data.variants[0].id as string };
}

function stockBaseUrl(productId: string, variantId: string) {
  return `/api/v1/products/${productId}/variants/${variantId}/stock`;
}

function stockUrl(productId: string, variantId: string, marketCode = "PK") {
  return `${stockBaseUrl(productId, variantId)}/${marketCode}`;
}

async function setup(onHand = 10) {
  const productCookie = await asProductManager();
  const { productId, variantId } = await createActiveProduct(productCookie);
  const cookieHeader = await asInventoryManager();
  await request(app)
    .post(stockBaseUrl(productId, variantId))
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ marketCode: "PK", onHand });
  return { productId, variantId, cookieHeader };
}

describe("POST /api/v1/products/:productId/variants/:variantId/stock", () => {
  it("creates a stock record (A)", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK", onHand: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.marketCode).toBe("PK");
    expect(res.body.data.onHand).toBe(5);
    expect(res.body.data.reserved).toBe(0);
    expect(res.body.data.available).toBe(5);
  });

  it("defaults onHand to 0 when not supplied", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK" });
    expect(res.status).toBe(201);
    expect(res.body.data.onHand).toBe(0);
  });

  it("rejects creating a duplicate stock record for the same variant+market", async () => {
    const { productId, variantId, cookieHeader } = await setup();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK", onHand: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVENTORY_ALREADY_EXISTS");
  });

  it("rejects a negative onHand (invalid quantity)", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK", onHand: -1 });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown market code", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "ZZ" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects a nonexistent variant (Catalog integration)", async () => {
    const productCookie = await asProductManager();
    const { productId } = await createActiveProduct(productCookie);
    const cookieHeader = await asInventoryManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, "00000000-0000-0000-0000-000000000000"))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });

  it("rejects an unauthenticated write", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .send({ marketCode: "PK" });
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated caller without inventory:update", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const cookieHeader = await asMarketingManager();

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("AUTH_FORBIDDEN");
  });

  it("rejects a caller whose role has been deactivated", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);
    const { cookieHeader, payload } = await registerUser(app);
    // Ad-hoc role (Phase 6E — inventory_manager no longer exists) holding
    // exactly inventory:update, then deactivated — the behavior under test
    // is "deactivated role ⇒ denied," not this specific permission set.
    const roleId = await createAdHocRole(["inventory:update"]);
    const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
    await testPrisma().userRole.create({ data: { userId: user.id, roleId } });
    await testPrisma().role.update({ where: { id: roleId }, data: { isActive: false } });

    const res = await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK" });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/products/:productId/variants/:variantId/stock/:marketCode", () => {
  it("public caller sees only an availability state (B)", async () => {
    const { productId, variantId } = await setup(3);

    const res = await request(app).get(stockUrl(productId, variantId));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ marketCode: "PK", status: "IN_STOCK", lowStockQuantity: 3 });
  });

  it("admin (inventory:read) sees the full record", async () => {
    const { productId, variantId, cookieHeader } = await setup(3);

    const res = await request(app).get(stockUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.onHand).toBe(3);
    expect(res.body.data.reserved).toBe(0);
    expect(res.body.data.available).toBe(3);
  });

  it("reports OUT_OF_STOCK once available reaches zero", async () => {
    const { productId, variantId, cookieHeader } = await setup(2);
    await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 2, reference: "order-1" });

    const res = await request(app).get(stockUrl(productId, variantId));
    expect(res.body.data.status).toBe("OUT_OF_STOCK");
  });

  it("returns 404 for a missing stock record", async () => {
    const productCookie = await asProductManager();
    const { productId, variantId } = await createActiveProduct(productCookie);

    const res = await request(app).get(stockUrl(productId, variantId));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("INVENTORY_NOT_FOUND");
  });

  it("keeps markets isolated (G) — PK stock is not visible when reading AE", async () => {
    const { productId, variantId } = await setup(5);

    const res = await request(app).get(stockUrl(productId, variantId, "AE"));
    expect(res.status).toBe(404);
  });

  it("rejects public access for a variant of a non-ACTIVE product, mirroring Catalog/Pricing visibility", async () => {
    const productCookie = await asProductManager();
    const created = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", productCookie)
      .send(productPayload({ status: "DRAFT" }));
    const productId = created.body.data.id as string;
    const variantId = created.body.data.variants[0].id as string;
    const cookieHeader = await asInventoryManager();
    await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "PK" });

    const publicRes = await request(app).get(stockUrl(productId, variantId));
    expect(publicRes.status).toBe(404);
    expect(publicRes.body.error.code).toBe("CATALOG_NOT_FOUND");

    const adminRes = await request(app).get(stockUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
  });
});

describe("GET /api/v1/products/:productId/variants/:variantId/stock", () => {
  it("lists availability across markets for public, full detail for admin", async () => {
    const { productId, variantId, cookieHeader } = await setup(5);
    await request(app)
      .post(stockBaseUrl(productId, variantId))
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ marketCode: "AE", onHand: 0 });

    const publicRes = await request(app).get(stockBaseUrl(productId, variantId));
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data).toEqual(
      expect.arrayContaining([
        { marketCode: "PK", status: "IN_STOCK", lowStockQuantity: 5 },
        { marketCode: "AE", status: "OUT_OF_STOCK", lowStockQuantity: null },
      ]),
    );

    const adminRes = await request(app).get(stockBaseUrl(productId, variantId)).set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(2);
  });
});

describe("POST .../stock/:marketCode/receive", () => {
  it("increases onHand and records a RECEIPT movement (C, H)", async () => {
    const { productId, variantId, cookieHeader } = await setup(5);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/receive`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 10, reason: "Supplier delivery" });
    expect(res.status).toBe(200);
    expect(res.body.data.onHand).toBe(15);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    const movements = await testPrisma().stockMovement.findMany({ where: { stockId: stock.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe("RECEIPT");
    expect(movements[0]!.quantityDelta).toBe(10);
    expect(movements[0]!.resultingOnHand).toBe(15);
  });

  it("rejects a zero/invalid quantity (E)", async () => {
    const { productId, variantId, cookieHeader } = await setup(5);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/receive`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 0 });
    expect(res.status).toBe(400);
  });
});

describe("POST .../stock/:marketCode/adjust", () => {
  it("applies a negative adjustment as a stock decrease, with an audited reason (D, J)", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/adjust`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ delta: -4, reason: "Damaged in warehouse" });
    expect(res.status).toBe(200);
    expect(res.body.data.onHand).toBe(6);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    const movements = await testPrisma().stockMovement.findMany({ where: { stockId: stock.id } });
    expect(movements[0]!.type).toBe("ADJUSTMENT");
    expect(movements[0]!.reason).toBe("Damaged in warehouse");
  });

  it("requires a reason", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/adjust`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ delta: -1 });
    expect(res.status).toBe(400);
  });

  it("rejects an adjustment that would make stock negative (F)", async () => {
    const { productId, variantId, cookieHeader } = await setup(5);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/adjust`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ delta: -10, reason: "Too much" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVENTORY_INSUFFICIENT_STOCK");

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.onHand).toBe(5);
  });

  it("rejects an adjustment that would drop onHand below currently reserved stock", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);
    await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 7, reference: "order-7" });

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/adjust`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ delta: -5, reason: "Correction" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVENTORY_INSUFFICIENT_STOCK");
  });
});

describe("POST .../stock/:marketCode/reserve and /release (I)", () => {
  it("reserves against available stock", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });
    expect(res.status).toBe(200);
    expect(res.body.data.reserved).toBe(4);
    expect(res.body.data.available).toBe(6);
  });

  it("is idempotent for the same reference — reserving twice does not double-reserve", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });
    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });

    expect(res.status).toBe(200);
    expect(res.body.data.reserved).toBe(4);
  });

  it("rejects a reservation exceeding available stock", async () => {
    const { productId, variantId, cookieHeader } = await setup(3);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVENTORY_INSUFFICIENT_STOCK");
  });

  it("releases a reservation, freeing available stock", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);
    await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/release`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ reference: "order-1" });
    expect(res.status).toBe(204);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(0);
  });

  it("is idempotent — releasing an unknown/already-released reference is a no-op", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/release`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ reference: "never-reserved" });
    expect(res.status).toBe(204);
  });

  it("allows reserving again under the same reference after release", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);
    await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 4, reference: "order-1" });
    await request(app)
      .post(`${stockUrl(productId, variantId)}/release`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ reference: "order-1" });

    const res = await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 6, reference: "order-1" });
    expect(res.status).toBe(200);
    expect(res.body.data.reserved).toBe(6);
  });
});

describe("Concurrency (N)", () => {
  it("initial stock 10, two simultaneous reservations of 7 each — exactly one succeeds, final state is valid", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const [a, b] = await Promise.all([
      request(app)
        .post(`${stockUrl(productId, variantId)}/reserve`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ quantity: 7, reference: "order-a" }),
      request(app)
        .post(`${stockUrl(productId, variantId)}/reserve`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ quantity: 7, reference: "order-b" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.reserved).toBe(7);
    expect(stock.onHand).toBe(10);
    expect(stock.onHand - stock.reserved).toBeGreaterThanOrEqual(0);
  });

  it("two simultaneous negative adjustments of 7 each from stock 10 — exactly one succeeds", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const [a, b] = await Promise.all([
      request(app)
        .post(`${stockUrl(productId, variantId)}/adjust`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ delta: -7, reason: "concurrent test A" }),
      request(app)
        .post(`${stockUrl(productId, variantId)}/adjust`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ delta: -7, reason: "concurrent test B" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const stock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(stock.onHand).toBe(3);
    expect(stock.onHand).toBeGreaterThanOrEqual(0);
  });
});

describe("Stock model invariant (Phase 4G-2 audit)", () => {
  it("available always equals onHand - reserved across receive/adjust/reserve/release", async () => {
    const { productId, variantId, cookieHeader } = await setup(10);

    const afterReceive = await request(app)
      .post(`${stockUrl(productId, variantId)}/receive`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 5 });
    expect(afterReceive.body.data.available).toBe(afterReceive.body.data.onHand - afterReceive.body.data.reserved);
    expect(afterReceive.body.data.available).toBe(15);

    const afterReserve = await request(app)
      .post(`${stockUrl(productId, variantId)}/reserve`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ quantity: 6, reference: "order-inv-1" });
    expect(afterReserve.body.data.available).toBe(afterReserve.body.data.onHand - afterReserve.body.data.reserved);
    expect(afterReserve.body.data.available).toBe(9);

    const afterAdjust = await request(app)
      .post(`${stockUrl(productId, variantId)}/adjust`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ delta: -3, reason: "correction" });
    expect(afterAdjust.body.data.available).toBe(afterAdjust.body.data.onHand - afterAdjust.body.data.reserved);
    expect(afterAdjust.body.data.available).toBe(6);

    await request(app)
      .post(`${stockUrl(productId, variantId)}/release`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ reference: "order-inv-1" });
    const finalStock = await testPrisma().variantStock.findFirstOrThrow({ where: { variantId } });
    expect(finalStock.onHand - finalStock.reserved).toBe(finalStock.onHand);
    expect(finalStock.reserved).toBe(0);
  });
});

describe("Pricing decoupling (Phase 4G-2 audit)", () => {
  it("never returns price/currency fields from any stock response shape", async () => {
    const { productId, variantId, cookieHeader } = await setup(5);

    const publicSingle = await request(app).get(stockUrl(productId, variantId));
    const adminSingle = await request(app).get(stockUrl(productId, variantId)).set("Cookie", cookieHeader);
    const publicList = await request(app).get(stockBaseUrl(productId, variantId));
    const adminList = await request(app).get(stockBaseUrl(productId, variantId)).set("Cookie", cookieHeader);

    for (const body of [publicSingle.body.data, adminSingle.body.data, ...publicList.body.data, ...adminList.body.data]) {
      expect(body).not.toHaveProperty("amount");
      expect(body).not.toHaveProperty("currencyCode");
      expect(body).not.toHaveProperty("saleAmount");
      expect(body).not.toHaveProperty("price");
    }
  });
});

import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asProductManager = () => asRole(app, "super_admin");

async function createProduct(cookieHeader: string) {
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload());
  return res.body.data.id as string;
}

describe("POST /api/v1/products/:productId/options", () => {
  it("creates an option with initial values", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const res = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small", "Medium", "Large"] });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Size");
  });

  it("rejects a duplicate option name on the same product", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small"] });

    const res = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Large"] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_DUPLICATE_OPTION_NAME");
  });
});

describe("DELETE /api/v1/products/:productId/options/:optionId", () => {
  it("blocks deletion when a variant uses one of the option's values", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const option = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small"] });

    const optionDetail = await testPrisma().productOptionValue.findFirstOrThrow({
      where: { optionId: option.body.data.id },
    });

    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: `SKU-${Date.now()}`, title: "Small", optionValueIds: [optionDetail.id] });

    const res = await request(app)
      .delete(`/api/v1/products/${productId}/options/${option.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_OPTION_IN_USE");
  });
});

describe("DELETE /api/v1/products/:productId/options/:optionId/values/:valueId", () => {
  it("blocks removing a value assigned to a variant", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const option = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Color", values: ["Black", "White"] });

    const values = await testPrisma().productOptionValue.findMany({ where: { optionId: option.body.data.id } });
    const blackValue = values.find((v) => v.value === "Black")!;
    const whiteValue = values.find((v) => v.value === "White")!;

    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: `SKU-${Date.now()}`, title: "Black", optionValueIds: [blackValue.id] });

    const blockedRes = await request(app)
      .delete(`/api/v1/products/${productId}/options/${option.body.data.id}/values/${blackValue.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.error.code).toBe("CATALOG_OPTION_VALUE_IN_USE");

    const allowedRes = await request(app)
      .delete(`/api/v1/products/${productId}/options/${option.body.data.id}/values/${whiteValue.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(allowedRes.status).toBe(204);
  });
});

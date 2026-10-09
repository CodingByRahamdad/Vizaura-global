import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { productPayload, uniqueSku } from "../helpers/factories.js";
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

describe("POST /api/v1/products/:productId/variants", () => {
  it("creates an additional variant", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Large" });
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(false);
  });

  it("rejects a duplicate SKU", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const sku = uniqueSku();
    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku, title: "Large" });

    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku, title: "Large Again" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_SKU_CONFLICT");
  });

  it("rejects an option value from a different product", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const otherProductId = await createProduct(cookieHeader);

    const option = await request(app)
      .post(`/api/v1/products/${otherProductId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small"] });

    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Large", optionValueIds: [option.body.data.id] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CATALOG_INVALID_OPTION_VALUE");
  });
});

describe("GET /api/v1/products/:productId/variants — visibility", () => {
  it("404s a DRAFT product's variants for the public, but shows them to products:read", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader); // DRAFT by default

    const publicRes = await request(app).get(`/api/v1/products/${productId}/variants`);
    expect(publicRes.status).toBe(404);
    expect(publicRes.body.error.code).toBe("CATALOG_NOT_FOUND");

    const adminRes = await request(app)
      .get(`/api/v1/products/${productId}/variants`)
      .set("Cookie", cookieHeader);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(1);
  });
});

describe("duplicate variant option-value combinations", () => {
  it("rejects a second variant with the exact same option-value combination, but allows a different one", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const sizeOption = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small", "Medium"] });
    const colorOption = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Color", values: ["Black"] });

    const sizeValues = await testPrisma().productOptionValue.findMany({ where: { optionId: sizeOption.body.data.id } });
    const colorValues = await testPrisma().productOptionValue.findMany({ where: { optionId: colorOption.body.data.id } });
    const small = sizeValues.find((v) => v.value === "Small")!;
    const medium = sizeValues.find((v) => v.value === "Medium")!;
    const black = colorValues.find((v) => v.value === "Black")!;

    const first = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Small Black", optionValueIds: [small.id, black.id] });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Small Black Again", optionValueIds: [small.id, black.id] });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("CATALOG_DUPLICATE_VARIANT_COMBINATION");

    const distinct = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Medium Black", optionValueIds: [medium.id, black.id] });
    expect(distinct.status).toBe(201);
  });

  it("rejects updating a variant to duplicate another variant's combination", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const sizeOption = await request(app)
      .post(`/api/v1/products/${productId}/options`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ name: "Size", values: ["Small", "Medium"] });
    const sizeValues = await testPrisma().productOptionValue.findMany({ where: { optionId: sizeOption.body.data.id } });
    const small = sizeValues.find((v) => v.value === "Small")!;
    const medium = sizeValues.find((v) => v.value === "Medium")!;

    await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Small", optionValueIds: [small.id] });
    const second = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Medium", optionValueIds: [medium.id] });

    const res = await request(app)
      .patch(`/api/v1/products/${productId}/variants/${second.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ optionValueIds: [small.id] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CATALOG_DUPLICATE_VARIANT_COMBINATION");
  });
});

describe("concurrent default-variant changes", () => {
  it("leaves exactly one default variant when two concurrent updates each promote a different variant", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const second = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Second" });
    const third = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Third" });

    const [resA, resB] = await Promise.all([
      request(app)
        .patch(`/api/v1/products/${productId}/variants/${second.body.data.id}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ isDefault: true }),
      request(app)
        .patch(`/api/v1/products/${productId}/variants/${third.body.data.id}`)
        .set(csrfHeaders())
        .set("Cookie", cookieHeader)
        .send({ isDefault: true }),
    ]);
    expect([resA.status, resB.status]).toEqual([200, 200]);

    const variants = await testPrisma().productVariant.findMany({ where: { productId, deletedAt: null } });
    const defaults = variants.filter((v) => v.isDefault);
    expect(defaults).toHaveLength(1);
  });
});

describe("DELETE /api/v1/products/:productId/variants/:variantId", () => {
  it("blocks deleting the last remaining variant", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const listRes = await request(app)
      .get(`/api/v1/products/${productId}/variants`)
      .set("Cookie", cookieHeader);
    const variantId = listRes.body.data[0].id as string;

    const res = await request(app)
      .delete(`/api/v1/products/${productId}/variants/${variantId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CATALOG_LAST_VARIANT");
  });

  it("promotes another variant to default when the default variant is removed", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const second = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Large" });

    const listBefore = await request(app)
      .get(`/api/v1/products/${productId}/variants`)
      .set("Cookie", cookieHeader);
    const defaultVariant = listBefore.body.data.find((v: { isDefault: boolean }) => v.isDefault);

    const res = await request(app)
      .delete(`/api/v1/products/${productId}/variants/${defaultVariant.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const listAfter = await request(app)
      .get(`/api/v1/products/${productId}/variants`)
      .set("Cookie", cookieHeader);
    expect(listAfter.body.data).toHaveLength(1);
    expect(listAfter.body.data[0].id).toBe(second.body.data.id);
    expect(listAfter.body.data[0].isDefault).toBe(true);
  });

  it("hard-deletes the variant row — it no longer exists at all, not just soft-deleted", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const second = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Large" });
    const variantId = second.body.data.id as string;

    const res = await request(app)
      .delete(`/api/v1/products/${productId}/variants/${variantId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const row = await testPrisma().productVariant.findUnique({ where: { id: variantId } });
    expect(row).toBeNull();
  });

  it("allows reusing a deleted variant's SKU on a new variant", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const sku = uniqueSku();
    const created = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku, title: "Large" });
    await request(app)
      .delete(`/api/v1/products/${productId}/variants/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);

    const res = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku, title: "Large Again" });
    expect(res.status).toBe(201);
  });
});

describe("variant status visibility on public read paths", () => {
  it("excludes INACTIVE variants from the public product detail and variant list, but includes them for products:read", async () => {
    const cookieHeader = await asProductManager();
    const createRes = await request(app)
      .post("/api/v1/products")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send(productPayload({ status: "ACTIVE" }));
    const productId = createRes.body.data.id as string;
    const slug = createRes.body.data.slug as string;
    const activeVariantId = createRes.body.data.variants[0].id as string;

    const secondVariant = await request(app)
      .post(`/api/v1/products/${productId}/variants`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ sku: uniqueSku(), title: "Inactive Size" });
    const inactiveVariantId = secondVariant.body.data.id as string;

    await request(app)
      .patch(`/api/v1/products/${productId}/variants/${inactiveVariantId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ status: "INACTIVE" });

    const publicDetail = await request(app).get(`/api/v1/products/slug/${slug}`);
    expect(publicDetail.status).toBe(200);
    const publicVariantIds = publicDetail.body.data.variants.map((v: { id: string }) => v.id);
    expect(publicVariantIds).toContain(activeVariantId);
    expect(publicVariantIds).not.toContain(inactiveVariantId);

    const publicVariantList = await request(app).get(`/api/v1/products/${productId}/variants`);
    expect(publicVariantList.status).toBe(200);
    const publicListIds = publicVariantList.body.data.map((v: { id: string }) => v.id);
    expect(publicListIds).toContain(activeVariantId);
    expect(publicListIds).not.toContain(inactiveVariantId);

    const adminDetail = await request(app)
      .get(`/api/v1/products/slug/${slug}`)
      .set("Cookie", cookieHeader);
    const adminVariantIds = adminDetail.body.data.variants.map((v: { id: string }) => v.id);
    expect(adminVariantIds).toContain(activeVariantId);
    expect(adminVariantIds).toContain(inactiveVariantId);

    const adminVariantList = await request(app)
      .get(`/api/v1/products/${productId}/variants`)
      .set("Cookie", cookieHeader);
    const adminListIds = adminVariantList.body.data.map((v: { id: string }) => v.id);
    expect(adminListIds).toContain(activeVariantId);
    expect(adminListIds).toContain(inactiveVariantId);
  });
});

import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";
import { PRODUCTS_UPLOAD_DIR } from "../../src/modules/catalog/mediaStorage.js";

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

describe("POST /api/v1/products/:productId/media", () => {
  it("creates a media row and rejects an invalid URL", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const invalid = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "not-a-url" });
    expect(invalid.status).toBe(400);

    const res = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://cdn.example.com/image.jpg", isPrimary: true });
    expect(res.status).toBe(201);
    expect(res.body.data.isPrimary).toBe(true);
  });

  it("keeps at most one primary media row per product", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const first = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://cdn.example.com/first.jpg", isPrimary: true });

    const second = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://cdn.example.com/second.jpg", isPrimary: true });
    expect(second.body.data.isPrimary).toBe(true);

    const firstRow = await testPrisma().productMedia.findUniqueOrThrow({ where: { id: first.body.data.id } });
    expect(firstRow.isPrimary).toBe(false);
  });
});

describe("DELETE /api/v1/products/:productId/media/:mediaId", () => {
  it("removes a media row for an authorized caller", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const created = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://cdn.example.com/image.jpg" });

    const res = await request(app)
      .delete(`/api/v1/products/${productId}/media/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);

    const row = await testPrisma().productMedia.findUnique({ where: { id: created.body.data.id } });
    expect(row).toBeNull();
  });
});

describe("POST /api/v1/products/:productId/media/upload (Phase 6M local-disk upload)", () => {
  const tinyPng = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a4944415478da6360000002000155" +
      "0f2a1d0000000049454e44ae426082",
    "hex",
  );

  it("rejects an unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/products/00000000-0000-0000-0000-000000000000/media/upload")
      .set(csrfHeaders())
      .attach("file", tinyPng, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("rejects a disallowed file type", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const res = await request(app)
      .post(`/api/v1/products/${productId}/media/upload`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", Buffer.from("not an image"), { filename: "test.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("rejects a file over the 5MB limit", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const res = await request(app)
      .post(`/api/v1/products/${productId}/media/upload`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("uploads a valid image, creates a media row with a real on-disk file, and deletes the file on removal", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);

    const uploadRes = await request(app)
      .post(`/api/v1/products/${productId}/media/upload`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", tinyPng, { filename: "photo.png", contentType: "image/png" });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.url).toMatch(/\/uploads\/products\/.+\.png$/);

    const filename = path.basename(new URL(uploadRes.body.data.url).pathname);
    const filePath = path.join(PRODUCTS_UPLOAD_DIR, filename);
    expect(fs.existsSync(filePath)).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/v1/products/${productId}/media/${uploadRes.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(deleteRes.status).toBe(204);

    // Best-effort unlink is async (fs.rm callback) — give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("never deletes the file for an externally-pasted URL media row", async () => {
    const cookieHeader = await asProductManager();
    const productId = await createProduct(cookieHeader);
    const created = await request(app)
      .post(`/api/v1/products/${productId}/media`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ url: "https://cdn.example.com/external.jpg" });

    // Nothing to assert on disk (never wrote a file for this row) — the real
    // assertion is that DELETE still succeeds cleanly for a non-local URL.
    const res = await request(app)
      .delete(`/api/v1/products/${productId}/media/${created.body.data.id}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader);
    expect(res.status).toBe(204);
  });
});

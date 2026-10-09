import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { resetTestData, closeTestDb } from "../helpers/db.js";
import { asRole } from "../helpers/roles.js";
import { CATEGORIES_UPLOAD_DIR } from "../../src/modules/catalog/mediaStorage.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

// Phase 6E collapsed the seeded role set to super_admin/customer.
const asCategoryManager = () => asRole(app, "super_admin");

describe("POST /api/v1/categories/upload-image", () => {
  const tinyPng = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a4944415478da6360000002000155" +
      "0f2a1d0000000049454e44ae426082",
    "hex",
  );

  it("rejects an unauthenticated request", async () => {
    const res = await request(app)
      .post("/api/v1/categories/upload-image")
      .set(csrfHeaders())
      .attach("file", tinyPng, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("rejects a disallowed file type", async () => {
    const cookieHeader = await asCategoryManager();
    const res = await request(app)
      .post("/api/v1/categories/upload-image")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", Buffer.from("not an image"), { filename: "test.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("rejects a file over the 5MB limit", async () => {
    const cookieHeader = await asCategoryManager();
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const res = await request(app)
      .post("/api/v1/categories/upload-image")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", oversized, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("uploads a valid image and returns its URL with a real on-disk file", async () => {
    const cookieHeader = await asCategoryManager();

    const uploadRes = await request(app)
      .post("/api/v1/categories/upload-image")
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .attach("file", tinyPng, { filename: "photo.png", contentType: "image/png" });
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.url).toMatch(/\/uploads\/categories\/.+\.png$/);

    const filename = path.basename(new URL(uploadRes.body.data.url).pathname);
    const filePath = path.join(CATEGORIES_UPLOAD_DIR, filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

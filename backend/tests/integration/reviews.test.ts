import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { productPayload } from "../helpers/factories.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";
import { asPermissions, asRole } from "../helpers/roles.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

let defaultShippingMethodId: string;

beforeEach(async () => {
  const market = await testPrisma().market.findUniqueOrThrow({ where: { code: "PK" } });
  const method = await testPrisma().shippingMethod.create({
    data: { marketId: market.id, name: "Standard PK", baseRate: 0 },
  });
  defaultShippingMethodId = method.id;
});

const asProductManager = () => asRole(app, "super_admin");
const asOrderManager = () => asRole(app, "super_admin");

async function asVerifiedCustomer() {
  const { cookieHeader, payload } = await registerUser(app);
  const user = await testPrisma().user.findUniqueOrThrow({ where: { email: payload.email } });
  await testPrisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { cookieHeader, userId: user.id };
}

async function createActiveProduct(): Promise<string> {
  const cookieHeader = await asProductManager();
  const res = await request(app)
    .post("/api/v1/products")
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send(productPayload({ status: "ACTIVE", markets: [{ marketCode: "PK", isAvailable: true, isVisible: true }] }));
  return res.body.data.id as string;
}

/// Places a single-item COD order and walks it to COMPLETED — the
/// verified-purchase-eligible status, same eligibility set Returns already
/// established (COMPLETED | RETURNED | REFUNDED).
async function placeCompletedOrder(customerCookie: string, productId?: string): Promise<{ productId: string }> {
  const resolvedProductId = productId ?? (await createActiveProduct());
  const productCookie = await asProductManager();
  const product = await request(app)
    .get(`/api/v1/products/${resolvedProductId}`)
    .set("Cookie", productCookie);
  const variantId = product.body.data.variants[0].id as string;

  await request(app)
    .put(`/api/v1/products/${resolvedProductId}/variants/${variantId}/prices/PK`)
    .set(csrfHeaders())
    .set("Cookie", productCookie)
    .send({ amount: 499900 });
  await request(app)
    .post(`/api/v1/products/${resolvedProductId}/variants/${variantId}/stock`)
    .set(csrfHeaders())
    .set("Cookie", productCookie)
    .send({ marketCode: "PK", onHand: 10 });

  await request(app)
    .post("/api/v1/cart/items?market=PK")
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .send({ variantId, quantity: 1 });

  const checkoutRes = await request(app)
    .post("/api/v1/checkout?market=PK")
    .set(csrfHeaders())
    .set("Cookie", customerCookie)
    .set("Idempotency-Key", randomUUID())
    .send({
      billingAddress: { fullName: "Jane Doe", phone: "+923001234567", line1: "House 20", city: "Lahore", countryCode: "PK" },
      paymentMethod: "COD",
      shippingMethodId: defaultShippingMethodId,
    });
  const orderId = checkoutRes.body.data.id as string;

  const staffCookie = await asOrderManager();
  const payment = await testPrisma().payment.findFirstOrThrow({ where: { orderId } });
  await request(app)
    .patch(`/api/v1/admin/payments/${payment.id}/mark-paid`)
    .set(csrfHeaders())
    .set("Cookie", staffCookie);

  for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]) {
    await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set(csrfHeaders())
      .set("Cookie", staffCookie)
      .send({ status });
  }

  return { productId: resolvedProductId };
}

function submitReview(productId: string, cookieHeader: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/v1/products/${productId}/reviews`)
    .set(csrfHeaders())
    .set("Cookie", cookieHeader)
    .send({ rating: 5, body: "A genuinely useful product, works as described.", captchaToken: "test-token", ...body });
}

function adminCreateReview(cookieHeader: string, body: Record<string, unknown>) {
  return request(app).post("/api/v1/admin/reviews").set(csrfHeaders()).set("Cookie", cookieHeader).send(body);
}

// -- CUSTOMER SUBMISSION ------------------------------------------------------

describe("POST /api/v1/products/:productId/reviews", () => {
  it("rejects an unauthenticated submission", async () => {
    const productId = await createActiveProduct();
    const res = await request(app)
      .post(`/api/v1/products/${productId}/reviews`)
      .set(csrfHeaders())
      .send({ rating: 5, body: "Great stuff, would buy again.", captchaToken: "test-token" });
    expect(res.status).toBe(401);
  });

  it("rejects a submission with no CAPTCHA token", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await submitReview(productId, cookieHeader, { captchaToken: "" });
    expect(res.status).toBe(400);
  });

  it("rejects a submission from an unverified email", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await registerUser(app);
    const res = await submitReview(productId, cookieHeader);
    expect(res.status).toBe(403);
  });

  it("creates a CUSTOMER review, not verified, when the user has no completed order for the product", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await submitReview(productId, cookieHeader, { rating: 4, title: "Pretty good", body: "Solid, did what it says on the box." });

    expect(res.status).toBe(200);
    expect(res.body.data.isVerifiedPurchase).toBe(false);

    const row = await testPrisma().review.findFirstOrThrow({ where: { productId } });
    expect(row.source).toBe("CUSTOMER");
    expect(row.isVerifiedPurchase).toBe(false);
  });

  it("marks a review verified when the user has a COMPLETED order containing the product", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { productId } = await placeCompletedOrder(cookieHeader);

    const res = await submitReview(productId, cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.isVerifiedPurchase).toBe(true);
  });

  it("does not mark a review verified for an order containing a different product", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    await placeCompletedOrder(cookieHeader);
    const otherProductId = await createActiveProduct();

    const res = await submitReview(otherProductId, cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.isVerifiedPurchase).toBe(false);
  });

  it("upserts on resubmission instead of creating a duplicate row", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();

    const first = await submitReview(productId, cookieHeader, { rating: 3, body: "It was okay at first." });
    const second = await submitReview(productId, cookieHeader, { rating: 5, body: "Updating my review — much better after a few weeks." });

    expect(first.body.data.id).toBe(second.body.data.id);
    const rows = await testPrisma().review.findMany({ where: { productId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rating).toBe(5);
  });

  it("rejects a nonexistent product", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const res = await submitReview("00000000-0000-0000-0000-000000000000", cookieHeader);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CATALOG_NOT_FOUND");
  });
});

// -- OWNERSHIP EDIT/DELETE -----------------------------------------------------

describe("PATCH/DELETE /api/v1/reviews/:id (ownership)", () => {
  it("lets the owner edit their own review", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();
    const created = await submitReview(productId, cookieHeader, { rating: 3 });
    const reviewId = created.body.data.id as string;

    const res = await request(app)
      .patch(`/api/v1/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ rating: 5, body: "Revised after using it longer — it's great." });
    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5);
  });

  it("never recomputes isVerifiedPurchase on edit", async () => {
    const { cookieHeader } = await asVerifiedCustomer();
    const { productId } = await placeCompletedOrder(cookieHeader);
    const created = await submitReview(productId, cookieHeader);
    expect(created.body.data.isVerifiedPurchase).toBe(true);

    const reviewId = created.body.data.id as string;
    const res = await request(app)
      .patch(`/api/v1/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ rating: 4 });
    expect(res.body.data.isVerifiedPurchase).toBe(true);
  });

  it("404s (never 403) when a different customer tries to edit someone else's review", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const created = await submitReview(productId, owner);
    const reviewId = created.body.data.id as string;

    const { cookieHeader: other } = await asVerifiedCustomer();
    const res = await request(app)
      .patch(`/api/v1/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", other)
      .send({ rating: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("REVIEWS_NOT_FOUND");
  });

  it("lets the owner delete their own review", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();
    const created = await submitReview(productId, cookieHeader);
    const reviewId = created.body.data.id as string;

    const res = await request(app).delete(`/api/v1/reviews/${reviewId}`).set(csrfHeaders()).set("Cookie", cookieHeader);
    expect(res.status).toBe(204);
    const row = await testPrisma().review.findUnique({ where: { id: reviewId } });
    expect(row).toBeNull();
  });

  it("404s when a different customer tries to delete someone else's review", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader: owner } = await asVerifiedCustomer();
    const created = await submitReview(productId, owner);
    const reviewId = created.body.data.id as string;

    const { cookieHeader: other } = await asVerifiedCustomer();
    const res = await request(app).delete(`/api/v1/reviews/${reviewId}`).set(csrfHeaders()).set("Cookie", other);
    expect(res.status).toBe(404);

    const row = await testPrisma().review.findUnique({ where: { id: reviewId } });
    expect(row).not.toBeNull();
  });
});

// -- ADMIN MODERATION -----------------------------------------------------------

describe("Admin reviews — permission boundaries", () => {
  it("rejects every /admin/reviews route for a customer with zero permissions", async () => {
    const productId = await createActiveProduct();
    const { cookieHeader } = await asVerifiedCustomer();

    const list = await request(app).get("/api/v1/admin/reviews").set("Cookie", cookieHeader);
    expect(list.status).toBe(403);

    const create = await adminCreateReview(cookieHeader, { productId, rating: 5, body: "x", authorName: "Test" });
    expect(create.status).toBe(403);
  });

  it("lets reviews:read list/get but 403s on write", async () => {
    const productId = await createActiveProduct();
    const readOnlyCookie = await asPermissions(app, ["reviews:read"]);

    const list = await request(app).get("/api/v1/admin/reviews").set("Cookie", readOnlyCookie);
    expect(list.status).toBe(200);

    const create = await adminCreateReview(readOnlyCookie, { productId, rating: 5, body: "x", authorName: "Test" });
    expect(create.status).toBe(403);
  });

  it("lets reviews:moderate create/update but 403s on delete", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate"]);

    const created = await adminCreateReview(moderateCookie, { productId, rating: 5, body: "Great for gifting.", authorName: "Store Team" });
    expect(created.status).toBe(201);
    const reviewId = created.body.data.id as string;

    const updated = await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", moderateCookie)
      .send({ isFeatured: true });
    expect(updated.status).toBe(200);

    const deleted = await request(app).delete(`/api/v1/admin/reviews/${reviewId}`).set(csrfHeaders()).set("Cookie", moderateCookie);
    expect(deleted.status).toBe(403);
  });

  it("lets reviews:delete delete", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate"]);
    const created = await adminCreateReview(moderateCookie, { productId, rating: 5, body: "Great for gifting.", authorName: "Store Team" });
    const reviewId = created.body.data.id as string;

    const deleteCookie = await asPermissions(app, ["reviews:delete"]);
    const res = await request(app).delete(`/api/v1/admin/reviews/${reviewId}`).set(csrfHeaders()).set("Cookie", deleteCookie);
    expect(res.status).toBe(204);
  });
});

describe("Admin-created reviews", () => {
  it("is always source=ADMIN, isVerifiedPurchase=false, even without a userId", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate", "reviews:read"]);

    const res = await adminCreateReview(moderateCookie, {
      productId,
      rating: 5,
      title: "Lovely gift box",
      body: "Quoted from a customer email, no account on file.",
      authorName: "Zainab M.",
      authorLocation: "Islamabad, PK",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe("ADMIN");
    expect(res.body.data.isVerifiedPurchase).toBe(false);
    expect(res.body.data.userId).toBeNull();

    const row = await testPrisma().review.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(row.source).toBe("ADMIN");
    expect(row.isVerifiedPurchase).toBe(false);
  });

  it("allows two different ADMIN reviews with no userId on the same product (nullable-userId uniqueness)", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate"]);

    const first = await adminCreateReview(moderateCookie, { productId, rating: 5, body: "First testimonial.", authorName: "Customer A" });
    const second = await adminCreateReview(moderateCookie, { productId, rating: 4, body: "Second testimonial.", authorName: "Customer B" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const rows = await testPrisma().review.findMany({ where: { productId, userId: null } });
    expect(rows).toHaveLength(2);
  });
});

// -- MODERATION / RATING RECALCULATION ------------------------------------------

describe("Moderation and rating recalculation", () => {
  it("reflects a new review in the public summary, and recalculates on update/delete", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate"]);

    const initial = await request(app).get(`/api/v1/products/${productId}/reviews/summary`);
    expect(initial.body.data.reviewCount).toBe(0);

    const created = await adminCreateReview(moderateCookie, { productId, rating: 4, body: "Solid everyday product.", authorName: "A. Khan" });
    const reviewId = created.body.data.id as string;

    const afterCreate = await request(app).get(`/api/v1/products/${productId}/reviews/summary`);
    expect(afterCreate.body.data.reviewCount).toBe(1);
    expect(afterCreate.body.data.averageRating).toBe(4);

    await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", moderateCookie)
      .send({ rating: 2 });
    const afterUpdate = await request(app).get(`/api/v1/products/${productId}/reviews/summary`);
    expect(afterUpdate.body.data.averageRating).toBe(2);

    const deleteCookie = await asPermissions(app, ["reviews:delete"]);
    await request(app).delete(`/api/v1/admin/reviews/${reviewId}`).set(csrfHeaders()).set("Cookie", deleteCookie);
    const afterDelete = await request(app).get(`/api/v1/products/${productId}/reviews/summary`);
    expect(afterDelete.body.data.reviewCount).toBe(0);
  });

  it("unpublishing hides a review publicly while it stays visible in the admin list", async () => {
    const productId = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate", "reviews:read"]);
    const created = await adminCreateReview(moderateCookie, { productId, rating: 5, body: "Loved it.", authorName: "R. Ali" });
    const reviewId = created.body.data.id as string;

    await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set(csrfHeaders())
      .set("Cookie", moderateCookie)
      .send({ isPublished: false });

    const publicList = await request(app).get(`/api/v1/products/${productId}/reviews`);
    expect(publicList.body.data).toHaveLength(0);

    const adminGet = await request(app).get(`/api/v1/admin/reviews/${reviewId}`).set("Cookie", moderateCookie);
    expect(adminGet.status).toBe(200);
    expect(adminGet.body.data.isPublished).toBe(false);
  });
});

// -- PRODUCT ISOLATION -----------------------------------------------------------

describe("Product isolation", () => {
  it("never shows product A's reviews under product B", async () => {
    const productA = await createActiveProduct();
    const productB = await createActiveProduct();
    const moderateCookie = await asPermissions(app, ["reviews:moderate"]);

    await adminCreateReview(moderateCookie, { productId: productA, rating: 5, body: "Only for A.", authorName: "A. Reviewer" });

    const listA = await request(app).get(`/api/v1/products/${productA}/reviews`);
    const listB = await request(app).get(`/api/v1/products/${productB}/reviews`);
    expect(listA.body.data).toHaveLength(1);
    expect(listB.body.data).toHaveLength(0);

    const summaryB = await request(app).get(`/api/v1/products/${productB}/reviews/summary`);
    expect(summaryB.body.data.reviewCount).toBe(0);
  });
});

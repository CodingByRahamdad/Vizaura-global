import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { registerUser } from "../helpers/authFlow.js";
import { resetTestData, closeTestDb, testPrisma } from "../helpers/db.js";

const app = buildTestApp();

afterEach(resetTestData);
afterAll(closeTestDb);

async function asCustomer() {
  const { cookieHeader } = await registerUser(app);
  return cookieHeader;
}

const addressesUrl = "/api/v1/addresses";
const billingUrl = "/api/v1/addresses/billing";
const shippingUrl = "/api/v1/addresses/shipping";

const sampleAddress = {
  fullName: "Ayesha Khan",
  phone: "+923001234567",
  line1: "House 12, Street 4",
  city: "Lahore",
  region: "Punjab",
  postalCode: "54000",
  countryCode: "PK",
};

describe("Addresses auth and ownership", () => {
  it("rejects an unauthenticated GET /addresses", async () => {
    const res = await request(app).get(addressesUrl);
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated PUT /addresses/billing", async () => {
    const res = await request(app).put(billingUrl).set(csrfHeaders()).send(sampleAddress);
    expect(res.status).toBe(401);
  });

  it("returns null billing/shipping for a customer with none saved", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).get(addressesUrl).set("Cookie", cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ billing: null, shipping: null });
  });

  it("keeps addresses isolated between two different customers", async () => {
    const cookieA = await asCustomer();
    const cookieB = await asCustomer();

    await request(app).put(billingUrl).set(csrfHeaders()).set("Cookie", cookieA).send(sampleAddress);

    const addressesB = await request(app).get(addressesUrl).set("Cookie", cookieB);
    expect(addressesB.body.data.billing).toBeNull();

    const addressesA = await request(app).get(addressesUrl).set("Cookie", cookieA);
    expect(addressesA.body.data.billing.fullName).toBe(sampleAddress.fullName);
  });
});

describe("PUT /api/v1/addresses/billing and /shipping", () => {
  it("saves a billing address", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app).put(billingUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send(sampleAddress);
    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe(sampleAddress.fullName);
    expect(res.body.data.countryCode).toBe("PK");

    const addresses = await request(app).get(addressesUrl).set("Cookie", cookieHeader);
    expect(addresses.body.data.billing.line1).toBe(sampleAddress.line1);
    expect(addresses.body.data.shipping).toBeNull();
  });

  it("saves billing and shipping independently", async () => {
    const cookieHeader = await asCustomer();
    await request(app).put(billingUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send(sampleAddress);
    await request(app)
      .put(shippingUrl)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ ...sampleAddress, city: "Karachi" });

    const addresses = await request(app).get(addressesUrl).set("Cookie", cookieHeader);
    expect(addresses.body.data.billing.city).toBe("Lahore");
    expect(addresses.body.data.shipping.city).toBe("Karachi");
  });

  it("overwrites rather than duplicating on a second save", async () => {
    const cookieHeader = await asCustomer();
    await request(app).put(billingUrl).set(csrfHeaders()).set("Cookie", cookieHeader).send(sampleAddress);
    await request(app)
      .put(billingUrl)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ ...sampleAddress, city: "Islamabad" });

    const addresses = await request(app).get(addressesUrl).set("Cookie", cookieHeader);
    expect(addresses.body.data.billing.city).toBe("Islamabad");

    const user = await testPrisma().user.findFirstOrThrow();
    const rows = await testPrisma().address.findMany({ where: { userId: user.id, type: "BILLING" } });
    expect(rows).toHaveLength(1);
  });

  it("rejects an invalid country code", async () => {
    const cookieHeader = await asCustomer();
    const res = await request(app)
      .put(billingUrl)
      .set(csrfHeaders())
      .set("Cookie", cookieHeader)
      .send({ ...sampleAddress, countryCode: "PAK" });
    expect(res.status).toBe(400);
  });
});

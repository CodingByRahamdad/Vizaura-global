import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, csrfHeaders } from "../helpers/app.js";
import { env } from "../../src/config/env.js";

const app = buildTestApp();

// Rate limiting is disabled by default in the test environment (see
// tests/setup/env.ts) to keep the rest of the suite from flaking on shared
// IP-keyed counters. This file explicitly re-enables it for a single,
// deterministic scenario — the underlying express-rate-limit store is a
// module-level singleton shared by every request in this process, so the
// whole scenario runs as one sequential test rather than several `it()`
// blocks that would otherwise share (and corrupt) each other's counters.
beforeAll(() => {
  (env as { rateLimitEnabled: boolean }).rateLimitEnabled = true;
});
afterAll(() => {
  (env as { rateLimitEnabled: boolean }).rateLimitEnabled = false;
});

describe("rate limiting — forgot-password (3/hour/IP)", () => {
  it("allows the configured limit, then 429s, ignores spoofed X-Forwarded-For, and never leaks account existence", async () => {
    const send = (email: string, xff?: string) => {
      const req = request(app).post("/api/v1/auth/forgot-password").set(csrfHeaders());
      if (xff) req.set("X-Forwarded-For", xff);
      return req.send({ email, captchaToken: "t" });
    };

    const first = await send("a@example.com");
    const second = await send("b@example.com");
    const third = await send("c@example.com");
    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);

    // 4th request, with a spoofed X-Forwarded-For. TRUST_PROXY_HOPS=0 (the
    // default) means Express ignores that header entirely and req.ip is
    // always the real socket address, so this cannot be used to reset or
    // dodge the per-IP counter.
    const fourth = await send("d@example.com", "203.0.113.99");

    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe("AUTH_RATE_LIMITED");
    expect(fourth.headers["retry-after"]).toBeDefined();
    expect(fourth.body.error.message).not.toMatch(/exist|found|register/i);
  });
});

import request from "supertest";
import type { Express } from "express";
import { csrfHeaders, parseSetCookies, toCookieHeader } from "./app.js";
import { registerPayload } from "./factories.js";

export async function registerUser(app: Express, overrides: Partial<Record<string, unknown>> = {}) {
  const payload = registerPayload(overrides);
  const res = await request(app).post("/api/v1/auth/register").set(csrfHeaders()).send(payload);
  const cookies = parseSetCookies(res.get("Set-Cookie"));
  return { res, payload, cookies, cookieHeader: toCookieHeader(cookies) };
}

export async function loginUser(app: Express, email: string, password: string) {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .set(csrfHeaders())
    .send({ email, password, captchaToken: "test-captcha-token" });
  const cookies = parseSetCookies(res.get("Set-Cookie"));
  return { res, cookies, cookieHeader: toCookieHeader(cookies) };
}

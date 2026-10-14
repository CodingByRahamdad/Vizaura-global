import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { notFoundHandler } from "../middleware/notFound.js";
import { requestId } from "../middleware/requestId.js";
import { securityHeaders } from "../middleware/securityHeaders.js";
import { csrfProtection } from "../middleware/csrf.js";
import { apiV1Router } from "../routes/index.js";
import { paymentsWebhookRouter } from "../modules/payments/webhooks/payments-webhook.routes.js";

export function createApp() {
  const app = express();

  // Explicit hop count only — NEVER `true`. Trusting an arbitrary number of
  // proxies lets a client spoof X-Forwarded-For and bypass every IP-keyed
  // rate limit. See docs/AUTH_SECURITY.md.
  app.set("trust proxy", env.trustProxyHops);

  // This is a JSON-only API; ETags provide no benefit and would let a shared
  // cache retain a fingerprint of authenticated/PII responses.
  app.disable("etag");

  app.use(requestId);
  app.use(securityHeaders);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Mirrors the previous fixed-string behavior: a non-matching origin
        // just gets no Access-Control-Allow-Origin header (the request still
        // reaches csrfProtection, which is the actual enforcement layer) —
        // it must never throw, which would turn every cross-origin GET into
        // a 500.
        callback(null, !origin || env.allowedOrigins.includes(origin));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", env.csrfHeaderName, "Idempotency-Key"],
      maxAge: 600,
    }),
  );
  // Mounted BEFORE express.json()/cookieParser()/csrfProtection: a payment
  // webhook needs the raw request body for HMAC signature verification (a
  // JSON-parsed-then-restringified body would not verify), and has no
  // browser Origin/CSRF header to check — it's a provider-to-server call,
  // not a browser request. authenticate() is likewise never applied here;
  // authenticity is the HMAC signature itself. See
  // docs/modules/PAYMENTS.md "Webhook security".
  app.use(
    "/api/v1/webhooks/payments",
    express.raw({ type: "application/json", limit: "100kb" }),
    paymentsWebhookRouter,
  );

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(csrfProtection);

  // Serves the local media provider's output only (integrations/media/) —
  // dev/test default, never used in production, where the Cloudinary
  // provider is required instead (env.ts refuses to boot otherwise). Public,
  // read-only, no directory listing (express.static's default). See
  // docs/modules/CATALOG.md.
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use("/api/v1", apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

import { Router } from "express";
import * as webhook from "./payments-webhook.controller.js";

// Mounted directly in app.ts — BEFORE express.json()/cookieParser()/
// csrfProtection, scoped to /api/v1/webhooks/payments and given a raw-body
// parser instead of the global JSON one (a provider signs the exact raw
// bytes it sent; a JSON-parsed-then-restringified body would not verify).
// No authenticate/csrfProtection: authentication here is the provider's
// signature, not a session or the app's own CSRF token — see
// docs/modules/PAYMENTS.md "Webhook security".
export const paymentsWebhookRouter = Router();

paymentsWebhookRouter.post("/:provider", webhook.handle);

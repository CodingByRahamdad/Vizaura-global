import { Router } from "express";
import * as checkout from "./checkout.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { checkoutBodySchema, checkoutQuerySchema } from "./checkout.validators.js";

// Mounted at "/checkout" (routes/index.ts) — a flat top-level domain, same
// posture as Cart, per API_CONTRACTS.md/PRD.
//
// `authenticate` + `requireVerifiedEmail`: ownership-only, no permission
// checks (Customer role holds none — RBAC.md). `requireVerifiedEmail` is
// RBAC.md's own already-documented intended use ("gates actions that need
// a confirmed email (order placement, review submission — not yet
// built)") — this is that placement.
export const checkoutRouter = Router();

checkoutRouter.post(
  "/",
  authenticate,
  requireVerifiedEmail,
  validate({ query: checkoutQuerySchema, body: checkoutBodySchema }),
  checkout.checkout,
);

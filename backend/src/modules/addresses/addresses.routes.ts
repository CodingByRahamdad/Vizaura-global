import { Router } from "express";
import * as addresses from "./addresses.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { upsertAddressBodySchema } from "./addresses.validators.js";

// Mounted at "/addresses" (routes/index.ts) — a flat top-level domain, same
// posture as Wishlist. Every route requires `authenticate` (never
// `optionalAuthenticate`): an address is always resolved against the
// caller's own userId, ownership-only, no permission path (Customer role
// holds no permissions — see docs/RBAC.md). Exactly one BILLING and one
// SHIPPING row per user — PUT always upserts, there is no POST/DELETE.
export const addressesRouter = Router();

addressesRouter.get("/", authenticate, addresses.getMine);

addressesRouter.put(
  "/billing",
  authenticate,
  validate({ body: upsertAddressBodySchema }),
  addresses.upsertBilling,
);

addressesRouter.put(
  "/shipping",
  authenticate,
  validate({ body: upsertAddressBodySchema }),
  addresses.upsertShipping,
);

import { Router } from "express";
import * as controller from "./search.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { globalSearchQuerySchema } from "./search.validators.js";

// Mounted at "/admin/search" (routes/index.ts). No single blanket
// permission is required here — SearchService filters each result group by
// the caller's own per-domain `*:read` permission, the same posture every
// other admin list endpoint already enforces individually.
export const adminSearchRouter = Router();

adminSearchRouter.get("/", authenticate, validate({ query: globalSearchQuerySchema }), controller.search);

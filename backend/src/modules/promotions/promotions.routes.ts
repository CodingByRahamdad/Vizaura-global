import { Router } from "express";
import * as controller from "./promotions.controller.js";

// Top-level "/promotions" prefix (see routes/index.ts) — public, unauthenticated,
// backs the homepage Promotion Section. All admin CRUD lives on
// admin.promotions.routes.ts's separate "/admin/promotions" mount, same split
// Reviews/Categories already established.
export const promotionsRouter = Router();

promotionsRouter.get("/active", controller.listActive);

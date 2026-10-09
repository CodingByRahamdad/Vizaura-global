import { Router } from "express";
import * as controller from "./contact.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireCaptcha } from "../../middleware/requireCaptcha.js";
import { contactIpLimiter } from "../../middleware/rateLimiters.js";
import { contactSchema } from "./contact.validators.js";

export const contactRouter = Router();

contactRouter.post(
  "/",
  contactIpLimiter,
  validate({ body: contactSchema }),
  requireCaptcha({ action: "contact" }),
  controller.submit,
);

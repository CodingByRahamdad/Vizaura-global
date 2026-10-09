import { Router } from "express";
import * as controller from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireCaptcha } from "../../middleware/requireCaptcha.js";
import { authenticate } from "../../middleware/authenticate.js";
import { noStore } from "../../middleware/securityHeaders.js";
import {
  loginIpLimiter,
  loginEmailLimiter,
  registerLimiter,
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
  refreshLimiter,
} from "../../middleware/rateLimiters.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  changeEmailSchema,
  updateProfileSchema,
} from "./auth.validators.js";

export const authRouter = Router();

authRouter.use(noStore);

authRouter.post(
  "/register",
  registerLimiter,
  validate({ body: registerSchema }),
  requireCaptcha({ action: "register" }),
  controller.register,
);

authRouter.post(
  "/login",
  loginIpLimiter,
  loginEmailLimiter,
  validate({ body: loginSchema }),
  requireCaptcha({ action: "login" }),
  controller.login,
);

authRouter.post("/logout", controller.logout);
authRouter.post("/logout-all", authenticate, controller.logoutAll);
authRouter.post("/refresh", refreshLimiter, controller.refresh);
authRouter.get("/me", authenticate, controller.me);
authRouter.patch("/me", authenticate, validate({ body: updateProfileSchema }), controller.updateProfile);

authRouter.post(
  "/verify-email",
  verifyEmailLimiter,
  validate({ body: verifyEmailSchema }),
  controller.verifyEmail,
);

authRouter.post(
  "/resend-verification",
  authenticate,
  resendVerificationLimiter,
  controller.resendVerification,
);

authRouter.post(
  "/forgot-password",
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  validate({ body: forgotPasswordSchema }),
  requireCaptcha({ action: "forgot_password" }),
  controller.forgotPassword,
);

authRouter.post(
  "/reset-password",
  resetPasswordLimiter,
  validate({ body: resetPasswordSchema }),
  requireCaptcha({ action: "reset_password" }),
  controller.resetPassword,
);

authRouter.post(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  requireCaptcha({ action: "change_password" }),
  controller.changePassword,
);

authRouter.post(
  "/change-email",
  authenticate,
  validate({ body: changeEmailSchema }),
  requireCaptcha({ action: "change_email" }),
  controller.changeEmail,
);

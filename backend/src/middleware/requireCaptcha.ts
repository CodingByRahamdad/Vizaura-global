import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getCaptchaVerifier } from "../security/captcha/index.js";
import { authErrors } from "../errors/AppError.js";

interface RequireCaptchaOptions {
  /// When provided, CAPTCHA is only enforced if this returns true (e.g. login
  /// only requires it after repeated failures). Omit to always require it.
  when?: (req: Request) => boolean;
  /// Expected reCAPTCHA v3 action name for this route (e.g. "login",
  /// "contact"). Ignored by providers that don't support actions.
  action?: string;
}

/// Verifies a Turnstile (or configured provider) token server-side. Runs
/// after transport validation and before any expensive work. FAILS CLOSED:
/// if the provider cannot be reached, the request is rejected — it is never
/// silently allowed through.
export function requireCaptcha(options: RequireCaptchaOptions = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (options.when && !options.when(req)) {
      next();
      return;
    }

    const token = (req.body as { captchaToken?: unknown } | undefined)?.captchaToken;
    if (typeof token !== "string" || token.length === 0) {
      next(authErrors.captchaRequired());
      return;
    }

    try {
      const result = await getCaptchaVerifier().verify(token, req.ip, { expectedAction: options.action });
      if (result.unavailable) {
        next(authErrors.captchaUnavailable());
        return;
      }
      if (!result.success) {
        next(authErrors.captchaFailed());
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

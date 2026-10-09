import { env } from "../../config/env.js";
import type { CaptchaResult, CaptchaVerifier, CaptchaVerifyOptions } from "./captcha.types.js";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

interface SiteVerifyResponse {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
}

/// Verifies a Google reCAPTCHA v2 Checkbox token server-side. The secret key
/// never leaves this process; only the public site key belongs to the
/// frontend.
///
/// v2 Checkbox is a simple pass/fail challenge, like Turnstile — Google's
/// siteverify response carries no score or action to check. A successful
/// verify() still fails this check if the hostname doesn't match this app's
/// own configured origin. Never trusts a hostname supplied by the client —
/// it comes back from Google's own response.
///
/// Fails CLOSED: any error, timeout, or non-2xx from Google is treated as
/// `unavailable`, which callers must reject rather than silently allow
/// through. One retry is attempted before giving up, same as Turnstile.
export class RecaptchaVerifier implements CaptchaVerifier {
  async verify(token: string, remoteIp?: string, _options?: CaptchaVerifyOptions): Promise<CaptchaResult> {
    if (!env.captcha.recaptchaSecretKey) {
      throw new Error("RECAPTCHA_SECRET_KEY is not configured");
    }
    if (!token) {
      return { success: false };
    }

    const attempt = async (): Promise<CaptchaResult> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.captcha.timeoutMs);

      try {
        const body = new URLSearchParams({
          secret: env.captcha.recaptchaSecretKey!,
          response: token,
        });
        if (remoteIp) body.set("remoteip", remoteIp);

        const response = await fetch(VERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          return { success: false, unavailable: true };
        }

        const payload = (await response.json()) as SiteVerifyResponse;
        return this.evaluate(payload);
      } catch {
        return { success: false, unavailable: true };
      } finally {
        clearTimeout(timeout);
      }
    };

    const first = await attempt();
    if (!first.unavailable) return first;

    // Single retry on transport failure only — a genuine verification
    // failure (`success: false` without `unavailable`) is not retried.
    return attempt();
  }

  private evaluate(payload: SiteVerifyResponse): CaptchaResult {
    if (payload.success !== true) {
      console.warn("[recaptcha] verification failed", { errorCodes: payload["error-codes"] });
      return { success: false };
    }

    if (payload.hostname) {
      const expectedHostname = new URL(env.appUrl).hostname;
      if (payload.hostname !== expectedHostname) {
        console.warn("[recaptcha] hostname mismatch", { expected: expectedHostname, received: payload.hostname });
        return { success: false };
      }
    }

    return { success: true };
  }
}

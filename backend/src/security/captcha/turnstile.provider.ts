import { env } from "../../config/env.js";
import type { CaptchaResult, CaptchaVerifier } from "./captcha.types.js";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/// Verifies a Cloudflare Turnstile token server-side. The secret key never
/// leaves this process; only the public site key belongs to the frontend.
///
/// Fails CLOSED: any error, timeout, or non-2xx from Cloudflare is treated as
/// `unavailable`, which callers must reject rather than silently allow
/// through. One retry is attempted before giving up, per docs/AUTH_SECURITY.md.
export class TurnstileCaptchaVerifier implements CaptchaVerifier {
  async verify(token: string, remoteIp?: string, _options?: { expectedAction?: string }): Promise<CaptchaResult> {
    if (!env.captcha.turnstileSecretKey) {
      throw new Error("TURNSTILE_SECRET_KEY is not configured");
    }
    if (!token) {
      return { success: false };
    }

    const attempt = async (): Promise<CaptchaResult> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.captcha.timeoutMs);

      try {
        const body = new URLSearchParams({
          secret: env.captcha.turnstileSecretKey!,
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

        const payload = (await response.json()) as { success?: boolean };
        return { success: payload.success === true };
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
}

import { env } from "../../config/env.js";
import type { CaptchaVerifier } from "./captcha.types.js";
import { RecaptchaVerifier } from "./recaptcha.provider.js";
import { TurnstileCaptchaVerifier } from "./turnstile.provider.js";
import { NoopCaptchaVerifier } from "./noop.provider.js";

export type { CaptchaResult, CaptchaVerifier, CaptchaVerifyOptions } from "./captcha.types.js";

let verifier: CaptchaVerifier | undefined;

/// Selects the provider by CAPTCHA_PROVIDER. Business/route code depends only
/// on the CaptchaVerifier interface. "turnstile" remains selectable (kept
/// dormant, not deleted) as a rollback path from the active "recaptcha"
/// provider — see docs/AUTH_SECURITY.md.
export function getCaptchaVerifier(): CaptchaVerifier {
  if (!verifier) {
    verifier =
      env.captcha.provider === "recaptcha"
        ? new RecaptchaVerifier()
        : env.captcha.provider === "turnstile"
          ? new TurnstileCaptchaVerifier()
          : new NoopCaptchaVerifier();
  }
  return verifier;
}

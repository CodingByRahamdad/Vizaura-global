import type { CaptchaResult, CaptchaVerifier } from "./captcha.types.js";

/// Always succeeds. Used only in development/test — env.ts refuses to boot
/// with this provider when NODE_ENV=production.
export class NoopCaptchaVerifier implements CaptchaVerifier {
  async verify(_token?: string, _remoteIp?: string, _options?: { expectedAction?: string }): Promise<CaptchaResult> {
    return { success: true };
  }
}

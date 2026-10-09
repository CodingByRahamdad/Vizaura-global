export interface CaptchaResult {
  success: boolean;
  /// True only when the provider itself could not be reached/timed out —
  /// distinct from a genuine verification failure, so callers can decide to
  /// fail closed specifically on unavailability.
  unavailable?: boolean;
}

export interface CaptchaVerifyOptions {
  /// Expected action/event name (e.g. "login", "contact"). Only meaningful
  /// to providers that support per-action tagging (reCAPTCHA v3); ignored by
  /// the active reCAPTCHA v2 Checkbox provider, Turnstile, and noop.
  expectedAction?: string;
}

export interface CaptchaVerifier {
  verify(token: string, remoteIp?: string, options?: CaptchaVerifyOptions): Promise<CaptchaResult>;
}

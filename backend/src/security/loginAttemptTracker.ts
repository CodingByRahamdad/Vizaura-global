// Tracks recent failed login attempts per (email + IP) so login can require
// CAPTCHA after repeated failures without requiring it on every attempt.
// In-memory, matching the rate limiter's MVP scope — see
// docs/AUTH_SECURITY.md. Not a security boundary by itself (rate limiting
// and account lockout messaging are); this only decides when to add a
// CAPTCHA challenge.

const FAILURE_THRESHOLD = 3;
const WINDOW_MS = 15 * 60 * 1000;

interface Entry {
  count: number;
  windowStart: number;
}

const failures = new Map<string, Entry>();

function key(email: string, ip: string): string {
  return `${email.toLowerCase()}::${ip}`;
}

export function recordLoginFailure(email: string, ip: string): void {
  const k = key(email, ip);
  const now = Date.now();
  const existing = failures.get(k);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    failures.set(k, { count: 1, windowStart: now });
    return;
  }
  existing.count += 1;
}

export function clearLoginFailures(email: string, ip: string): void {
  failures.delete(key(email, ip));
}

export function isCaptchaRequiredForLogin(email: string, ip: string): boolean {
  const entry = failures.get(key(email, ip));
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) return false;
  return entry.count >= FAILURE_THRESHOLD;
}

// Vitest setup file: forces test-appropriate environment values BEFORE any
// application module (which reads process.env at import time) is loaded.
process.env.NODE_ENV = "test";
process.env.CAPTCHA_PROVIDER = "noop";
process.env.EMAIL_PROVIDER = "console";
process.env.JWT_ACCESS_SECRET ??= "test-only-jwt-secret-not-for-production-32b";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.FRONTEND_URL ??= "http://localhost:3000";

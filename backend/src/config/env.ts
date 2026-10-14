import "dotenv/config";
import { z } from "zod";

// Development-only fallbacks. Production requires real values and validation
// below refuses to boot without them.
const DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me-32b";
const DEV_MOCK_WEBHOOK_SECRET = "dev-only-insecure-mock-webhook-secret";

// Used when ALLOWED_ORIGINS is unset. Exact-match only — no wildcard subdomains.
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://vizaura-global.vercel.app",
  "https://vizauraglobal.com",
  "https://www.vizauraglobal.com",
];

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    FRONTEND_URL: z.url().default("http://localhost:3000"),
    APP_URL: z.url().optional(),
    // Comma-separated list of additional origins allowed for CORS + CSRF
    // (e.g. production Vercel/custom domains), on top of FRONTEND_URL.
    ALLOWED_ORIGINS: z.string().min(1).optional(),

    DATABASE_URL: z.string().min(1).optional(),
    DATABASE_URL_TEST: z.string().min(1).optional(),

    JWT_ACCESS_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
    JWT_ACCESS_SECRET_PREVIOUS: z.string().min(1).optional(),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
    JWT_ISSUER: z.string().min(1).default("vizaura-global-api"),
    JWT_AUDIENCE: z.string().min(1).default("vizaura-global-web"),
    REFRESH_TOKEN_EXPIRES_IN: z.string().regex(/^\d+d$/).default("30d"),

    CAPTCHA_PROVIDER: z.enum(["recaptcha", "turnstile", "noop"]).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),
    CAPTCHA_TIMEOUT_MS: z.coerce.number().int().min(500).max(10000).default(2500),

    // Signs/verifies the MOCK payment provider's webhook callbacks (dev/test
    // only — MOCK is never resolvable in production, see
    // modules/payments/providers/index.ts). Kept validated the same way as
    // JWT_ACCESS_SECRET even though MOCK can't run in prod, as defense-in-depth
    // against a NODE_ENV misconfiguration.
    PAYMENTS_MOCK_WEBHOOK_SECRET: z.string().min(1).default(DEV_MOCK_WEBHOOK_SECRET),

    EMAIL_PROVIDER: z.enum(["console", "brevo"]).default("console"),
    EMAIL_FROM: z.string().min(3).default("VIZAURA GLOBAL <no-reply@vizaura.local>"),
    // Required when EMAIL_PROVIDER=brevo. Server-only — never exposed to the frontend.
    BREVO_API_KEY: z.string().min(1).optional(),
    BREVO_API_URL: z.url().optional(),
    BREVO_SENDER_EMAIL: z.string().email().optional(),
    BREVO_SENDER_NAME: z.string().min(1).optional(),

    // Admin image uploads (categories/products/promotions). "local" writes
    // to backend/uploads/ (dev/test only — does not survive Render
    // redeploys/restarts/multi-instance scaling, see
    // integrations/media/local.provider.ts); "cloudinary" is required in
    // production (enforced below).
    MEDIA_PROVIDER: z.enum(["local", "cloudinary"]).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),

    CONTACT_INFO_EMAIL: z.string().email().default("info@vizauraglobal.com"),
    CONTACT_SALES_EMAIL: z.string().email().default("sales@vizauraglobal.com"),

    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    // Intentionally unset by default: cookies are host-only, which is stronger
    // and allows the __Secure- prefix. See docs/AUTH_SECURITY.md.
    COOKIE_DOMAIN: z.string().min(1).optional(),

    // Number of trusted proxy hops in front of this app. NEVER set this to
    // `true`: a blanket trust lets clients spoof X-Forwarded-For and bypass
    // every IP-keyed rate limit.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

    CSRF_HEADER_NAME: z.string().min(1).default("x-requested-with"),
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),

    // Opt-in super_admin bootstrap — see backend/src/security/adminBootstrap.ts.
    // No-op unless BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are both
    // set, so it is safe to leave wired into every server startup.
    BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(1).optional(),
    BOOTSTRAP_ADMIN_FIRST_NAME: z.string().min(1).default("Super"),
    BOOTSTRAP_ADMIN_LAST_NAME: z.string().min(1).default("Admin"),
    SEED_ALLOW_ADMIN_BOOTSTRAP: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === "brevo") {
      if (!value.BREVO_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["BREVO_API_KEY"],
          message: "is required when EMAIL_PROVIDER=brevo",
        });
      }
      if (!value.BREVO_SENDER_EMAIL) {
        ctx.addIssue({
          code: "custom",
          path: ["BREVO_SENDER_EMAIL"],
          message: "is required when EMAIL_PROVIDER=brevo",
        });
      }
      if (!value.BREVO_SENDER_NAME) {
        ctx.addIssue({
          code: "custom",
          path: ["BREVO_SENDER_NAME"],
          message: "is required when EMAIL_PROVIDER=brevo",
        });
      }
    }

    const isProd = value.NODE_ENV === "production";
    if (!isProd) return;

    if (Buffer.byteLength(value.JWT_ACCESS_SECRET, "utf8") < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "must be at least 32 bytes in production",
      });
    }
    if (value.JWT_ACCESS_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message: "the development fallback secret must not be used in production",
      });
    }
    if (value.PAYMENTS_MOCK_WEBHOOK_SECRET === DEV_MOCK_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENTS_MOCK_WEBHOOK_SECRET"],
        message: "the development fallback secret must not be used in production",
      });
    }
    if (!value.DATABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "is required in production" });
    }
    if (!value.APP_URL) {
      ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "is required in production" });
    }
    if (value.MEDIA_PROVIDER === "local") {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_PROVIDER"],
        message: "the local media provider must not be used in production",
      });
    } else {
      if (!value.CLOUDINARY_CLOUD_NAME) {
        ctx.addIssue({
          code: "custom",
          path: ["CLOUDINARY_CLOUD_NAME"],
          message: "is required in production (the local media provider is not allowed there)",
        });
      }
      if (!value.CLOUDINARY_API_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["CLOUDINARY_API_KEY"],
          message: "is required in production (the local media provider is not allowed there)",
        });
      }
      if (!value.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["CLOUDINARY_API_SECRET"],
          message: "is required in production (the local media provider is not allowed there)",
        });
      }
    }

    const captchaProvider = value.CAPTCHA_PROVIDER ?? "recaptcha";
    if (captchaProvider === "noop") {
      ctx.addIssue({
        code: "custom",
        path: ["CAPTCHA_PROVIDER"],
        message: "the noop CAPTCHA provider must not be used in production",
      });
    }
    if (captchaProvider === "turnstile" && !value.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["TURNSTILE_SECRET_KEY"],
        message: "is required when CAPTCHA_PROVIDER=turnstile",
      });
    }
    if (captchaProvider === "recaptcha" && !value.RECAPTCHA_SECRET_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RECAPTCHA_SECRET_KEY"],
        message: "is required when CAPTCHA_PROVIDER=recaptcha",
      });
    }
    // Note: COOKIE_SAMESITE=none deliberately does NOT require COOKIE_DOMAIN.
    // COOKIE_DOMAIN only matters when the frontend and API share a parent
    // domain (subdomain cookie sharing); when they're on unrelated
    // registrable domains (e.g. a Vercel frontend + a Render backend),
    // COOKIE_DOMAIN must stay unset so the cookie remains host-only — a
    // Domain attribute cannot bridge two unrelated domains at all. CSRF
    // defense in that case comes from the Origin-header check + required
    // custom header in middleware/csrf.ts, which is independent of
    // SameSite. See docs/AUTH_SECURITY.md.
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === "production";
const isTest = raw.NODE_ENV === "test";

function refreshDays(value: string): number {
  return Number.parseInt(value.replace("d", ""), 10);
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction,
  isTest,
  port: raw.PORT,

  frontendUrl: raw.FRONTEND_URL,
  /// Origin used to build links in outbound email.
  appUrl: raw.APP_URL ?? raw.FRONTEND_URL,
  /// Origins allowed for CORS + CSRF. Always includes FRONTEND_URL; falls
  /// back to DEFAULT_ALLOWED_ORIGINS when ALLOWED_ORIGINS is unset.
  allowedOrigins: Array.from(
    new Set([
      raw.FRONTEND_URL,
      ...(raw.ALLOWED_ORIGINS
        ? raw.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
        : DEFAULT_ALLOWED_ORIGINS),
    ]),
  ),

  databaseUrl: isTest ? (raw.DATABASE_URL_TEST ?? raw.DATABASE_URL) : raw.DATABASE_URL,
  databaseUrlTest: raw.DATABASE_URL_TEST,

  jwt: {
    accessSecret: raw.JWT_ACCESS_SECRET,
    /// Verify-only, so the signing secret can be rotated without logging everyone out.
    accessSecretPrevious: raw.JWT_ACCESS_SECRET_PREVIOUS,
    accessExpiresIn: raw.JWT_ACCESS_EXPIRES_IN,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
  },

  refreshToken: {
    expiresIn: raw.REFRESH_TOKEN_EXPIRES_IN,
    expiresInDays: refreshDays(raw.REFRESH_TOKEN_EXPIRES_IN),
  },

  captcha: {
    // Tests never call a real CAPTCHA provider over the network, regardless
    // of what CAPTCHA_PROVIDER is set to in .env for local dev — mirrors
    // rateLimitEnabled's own isTest override below.
    provider: isTest ? "noop" : (raw.CAPTCHA_PROVIDER ?? (isProduction ? "recaptcha" : "noop")),
    turnstileSecretKey: raw.TURNSTILE_SECRET_KEY,
    recaptchaSecretKey: raw.RECAPTCHA_SECRET_KEY,
    timeoutMs: raw.CAPTCHA_TIMEOUT_MS,
  },

  email: {
    provider: raw.EMAIL_PROVIDER,
    from: raw.EMAIL_FROM,
    brevo: {
      apiKey: raw.BREVO_API_KEY,
      apiUrl: raw.BREVO_API_URL ?? "https://api.brevo.com/v3/smtp/email",
      senderEmail: raw.BREVO_SENDER_EMAIL,
      senderName: raw.BREVO_SENDER_NAME,
    },
  },

  media: {
    provider: raw.MEDIA_PROVIDER ?? (isProduction ? "cloudinary" : "local"),
    cloudinary: {
      cloudName: raw.CLOUDINARY_CLOUD_NAME,
      apiKey: raw.CLOUDINARY_API_KEY,
      apiSecret: raw.CLOUDINARY_API_SECRET,
    },
  },

  contact: {
    infoEmail: raw.CONTACT_INFO_EMAIL,
    salesEmail: raw.CONTACT_SALES_EMAIL,
  },

  payments: {
    mockWebhookSecret: raw.PAYMENTS_MOCK_WEBHOOK_SECRET,
  },

  cookies: {
    secure: isProduction,
    sameSite: raw.COOKIE_SAMESITE,
    domain: raw.COOKIE_DOMAIN,
    /// The __Secure- prefix requires the Secure attribute, so it is only
    /// usable where we actually serve over HTTPS.
    usePrefix: isProduction,
  },

  trustProxyHops: raw.TRUST_PROXY_HOPS,
  csrfHeaderName: raw.CSRF_HEADER_NAME.toLowerCase(),
  rateLimitEnabled: raw.RATE_LIMIT_ENABLED ?? !isTest,

  adminBootstrap: {
    email: raw.BOOTSTRAP_ADMIN_EMAIL,
    password: raw.BOOTSTRAP_ADMIN_PASSWORD,
    firstName: raw.BOOTSTRAP_ADMIN_FIRST_NAME,
    lastName: raw.BOOTSTRAP_ADMIN_LAST_NAME,
    allowInProduction: raw.SEED_ALLOW_ADMIN_BOOTSTRAP ?? false,
  },
} as const;

export type Env = typeof env;

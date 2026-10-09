# CONTACT Module

**Purpose:** Own the storefront Contact Us form — submission intake, persistence, and email routing to the business.

**Responsibilities:** Validate and accept contact submissions (CAPTCHA-protected, rate-limited, honeypot-filtered), persist them for a future admin inbox, and email the business with the visitor's address set as Reply-To.

**Data ownership:** `ContactSubmission` table.

**Main entities:** ContactSubmission (fullName, email, phone, subject, message, status, createdAt).

**API boundary:** `POST /api/v1/contact` (public, no auth).

**Dependencies:** `integrations/email` (EmailProvider.sendContactMessage), `security/captcha` (Turnstile via `requireCaptcha`), `middleware/rateLimiters` (`contactIpLimiter`).

**Security considerations:** CAPTCHA-protected (Google reCAPTCHA v3, action `"contact"` — see `docs/AUTH_SECURITY.md`) and IP-rate-limited (5/hour); a hidden honeypot field (`website`) causes a silent fake-success for bot submissions without persisting or sending; recipient email is resolved server-side from the validated `subject` enum only — never trusted from the client; user-supplied strings are HTML-escaped before being interpolated into the outbound email.

**Current status:** COMPLETE (MVP) — `POST /api/v1/contact` persists + emails. No admin UI exists yet to read `ContactSubmission` rows (list/detail/status update) — reading them currently requires direct DB access (e.g. `db:studio`).

Built: `ContactSubmission` Prisma model, migration `add_contact_submissions`; `contact.validators.ts`/`contact.repository.ts`/`contact.service.ts`/`contact.controller.ts`/`contact.routes.ts` following the standard layered module pattern; `contactErrors` (`AppError.ts`), `contactIpLimiter` (`rateLimiters.ts`); `EmailProvider.sendContactMessage` added to the interface and implemented in `ConsoleEmailProvider` (dev-only, logs instead of sending — no real SMTP transport exists anywhere in this codebase yet, for any email); `CONTACT_INFO_EMAIL`/`CONTACT_SALES_EMAIL` env vars (default to `info@vizauraglobal.com`/`sales@vizauraglobal.com`).

Frontend: real `/contact` page (`ContactHero`, `ContactForm`, `ContactInfoCard`, `FAQSection`+`Accordion`, `OfficeMapCard` with a keyless Google Maps iframe embed) replacing the prior placeholder; new `Textarea` and `Accordion` UI primitives; `SocialIcon` extended with `x`/`linkedin`; `lib/api/contact.ts`/`lib/types/contact.ts`.

Not built: admin UI to view/manage `ContactSubmission` rows; real SMTP/email delivery (flagged as a separate, app-wide task since it would change every existing email flow, not just Contact); real hero/office photography (hero background and office-photo slots use neutral CSS placeholders pending real assets).

**Future notes:** A future admin inbox (list/detail/status transitions on `ContactSubmission`) is the natural next increment once prioritized, likely under the same pattern as the Customers/Orders admin modules.

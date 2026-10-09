# PROJECT_CONTEXT.md

> Read this file FIRST in any new Claude Code task. It is the single source of truth for high-level intent. Read only additional docs relevant to your specific task after this.

## Project

**VIZAURA GLOBAL** — a production-grade e-commerce platform for premium natural, wellness, lifestyle, and personal-care products.

## Markets

- Pakistan (PK)
- UAE (AE)
- Architecture must allow additional markets to be added later without structural rework.

This is **one business operating in multiple markets**, NOT a multi-tenant marketplace. See [MARKETS.md](modules/MARKETS.md).

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript, REST API |
| ORM | Prisma |
| Database | PostgreSQL |

## Frontend / Backend Separation

Two independent applications (`frontend/`, `backend/`) communicating only over documented HTTP/REST APIs. The frontend never touches Prisma, PostgreSQL, backend repositories/services/internal modules, or backend secrets. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Architectural Principles

- Domain-oriented backend (Services → Repositories → Prisma), not screen-oriented.
- Market is a business-configuration boundary, not a tenant boundary.
- Prices per market are independently set commercial values, never FX-derived.
- Authorization is permission-driven, never role-string-equality checks.
- MVP first — no premature infrastructure (no Redis, no Elasticsearch, no microservices, no Kubernetes).

## Authentication Approach (implemented, Phase 4D-2 backend / Phase 5B-2A frontend)

JWT-based: short-lived access token + rotating refresh token, delivered via HttpOnly/Secure/SameSite cookies. No tokens in localStorage. See [AUTH_SECURITY.md](AUTH_SECURITY.md).

## Authorization Approach (implemented, Phase 4D-2 backend)

Granular permission strings (`resource:action`) grouped into roles, plus resource/ownership-level checks. Backend is always the final authority; frontend permission checks are UX-only. As of Phase 6B/6D, the frontend does perform real permission-based UI gating: `/admin/*` gates on `hasAdminAccess`/`hasAnyPermission` (`lib/authorization.ts`), the admin nav filters per-item by permission, and every admin data page (`requireAdminPermission.ts`) checks permission before fetching, not just before rendering. `/account` remains an "is authenticated" gate only (no permission tiers exist for customer-facing pages). **As of Phase 6E, exactly two roles are seeded: `super_admin` (every permission) and `customer` (none).** The 7 operational roles seeded through Phase 6D were retired as a deliberate product-scope decision — a future operational role is reintroduced later with only the permissions it needs; the permission-driven mechanism itself is unchanged. See [RBAC.md](RBAC.md) and [AUTH_SECURITY.md](AUTH_SECURITY.md).

## Database

PostgreSQL via Prisma, organized by domain (Identity, Markets, Catalog, Pricing, Inventory, Customers, Cart, Checkout, Orders, Payments, Shipping, Promotions, Reviews, Wishlist, Notifications, CMS, Analytics, Audit). See [DATABASE.md](DATABASE.md).

## Major Domains

Identity/Users, RBAC, Markets, Catalog, Pricing, Inventory, Customers, Cart, Checkout, Orders, Payments, Shipping, Promotions, Reviews, Wishlist, Notifications, CMS, Analytics, Audit.

## UI Direction

Premium, natural, modern, elegant, trustworthy, wellness-oriented. Primary visual direction: teal-green. See [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) and `design-references/`.

## Development Methodology

Token-efficient, Claude-Code-driven development. Read only the docs relevant to the current task; do not scan the whole repo; keep documentation updates scoped to what changed. See [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md).

## Non-Negotiable Decisions

1. Frontend and backend are separate applications — never merge into one full-stack app.
2. Frontend never directly accesses the database, Prisma, or backend internals.
3. Authentication tokens are never stored in localStorage.
4. Authorization is permission-based, never `role === "admin"` checks.
5. CAPTCHA (Cloudflare Turnstile) is isolated behind a provider abstraction.
6. Market pricing is independently configured per market, never currency-converted.
7. Client-supplied price, total, role, permissions, inventory, and sensitive IDs are never trusted.
8. No infrastructure (Redis, Elasticsearch, microservices, K8s) beyond MVP needs.

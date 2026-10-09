# ARCHITECTURE.md

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first.

## Layered Flow

```
Frontend (Next.js/React/TS/Tailwind)
    ↓  HTTP / REST (/api/v1)
Backend (Express/TS)
    ↓
Application / Domain Services
    ↓
Repository / Data Access
    ↓
Prisma
    ↓
PostgreSQL
```

## Frontend Responsibilities

- Storefront (customer-facing) and admin dashboard, as separate route groups/apps within the frontend project.
- Rendering strategy: server components / SSR for SEO-critical storefront pages (product, category, content pages); client components for interactive areas (cart, checkout, admin forms).
- Consumes the backend exclusively via documented REST endpoints (`API_CONTRACTS.md`).
- Never imports backend code, Prisma client, or database credentials.
- Implements permission-aware UI (show/hide) as UX sugar only — never the security boundary.

## Backend Responsibilities

- Exposes versioned REST API (`/api/v1`).
- Enforces authentication, authorization, and validation at the API boundary.
- Organized by domain module, each with Controller → Service → Repository layers.
- Repositories are the only layer allowed to call Prisma.
- Does not depend on any frontend code or types.

## API Boundary

- All contracts documented in [API_CONTRACTS.md](API_CONTRACTS.md).
- Backend is the single source of truth for business rules (pricing, inventory, permissions) — frontend never computes or asserts these independently.

## Domain Boundaries

Each domain (Markets, Catalog, Pricing, Inventory, Orders, Payments, Shipping, Promotions, Reviews, Wishlist, Notifications, CMS, Analytics, Audit, Identity/RBAC) owns its own tables and service layer. Cross-domain reads happen through service calls, not direct cross-domain repository access.

## Service / Repository Approach

- **Controller**: HTTP concerns only (parse request, call service, shape response).
- **Service**: business/domain logic, orchestration across repositories, enforces invariants.
- **Repository**: Prisma queries for one domain's entities only.

## External Integration Abstraction

Payment providers, shipping providers, CAPTCHA providers, and notification providers (email/SMS) are each accessed through a small interface in the service layer, so a provider can be swapped without touching business logic. No specific providers are chosen in this foundation task beyond CAPTCHA (Cloudflare Turnstile, see [AUTH_SECURITY.md](AUTH_SECURITY.md)).

## Background Jobs (concept only, MVP: none required yet)

Future need: order-confirmation emails, inventory reconciliation, report generation. MVP may run these inline or via a simple scheduled task; a dedicated queue is a future-scale option, not MVP.

## Caching (concept only, MVP: none required yet)

Future candidates: catalog/category listing pages, market configuration. MVP relies on database queries and HTTP caching headers; a dedicated cache layer (e.g. Redis) is future-scale, not MVP.

## Observability (concept only)

MVP: structured server logs + audit log domain table. Future: centralized log aggregation, metrics, tracing.

## Deployment (concept only)

MVP: frontend and backend deployed as two independent services, each with its own environment configuration. Future: containerization/orchestration if scale requires it — not part of MVP.

## Scalability Direction

MVP is a modular monolith on both sides (one Next.js app, one Express app), with domain boundaries clean enough that a domain could later be extracted into its own service if needed. No microservices, no Kubernetes, no Elasticsearch, no Redis in the MVP.

## MVP vs Future Summary

| Concern | MVP | Future |
|---|---|---|
| Architecture style | Modular monolith (frontend + backend) | Extractable services per domain if needed |
| Caching | DB + HTTP caching | Redis/CDN caching |
| Search | DB queries/filters | Elasticsearch/dedicated search |
| Jobs | Inline/simple scheduled | Queue-based workers |
| Infra | Two deployed apps | Container orchestration |

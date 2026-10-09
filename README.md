# VIZAURA GLOBAL

Production e-commerce platform for premium natural, wellness, lifestyle, and personal-care products, launching in Pakistan and UAE.

## Project Structure

```
vizaura-global/
├── frontend/            Next.js/React/TypeScript/Tailwind storefront + admin dashboard
├── backend/             Node.js/Express/TypeScript REST API + Prisma/PostgreSQL
├── docs/                Architecture, domain, and AI-context documentation
├── design-references/   Approved UI/UX reference images
├── README.md
└── .gitignore
```

## Technology Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript, REST API
- **ORM:** Prisma
- **Database:** PostgreSQL

## Frontend / Backend Separation

`frontend/` and `backend/` are two independent applications communicating only through a documented REST API (`/api/v1`). The frontend never accesses the database, Prisma, backend services/repositories, or backend secrets directly. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development Prerequisites

- Node.js (v20+ recommended) and npm.

## Running the Project

`frontend/` and `backend/` are independent applications — install and run each separately, no monorepo tooling is used.

```
cd backend
npm install
cp .env.example .env
npm run dev        # http://localhost:4001 — GET /api/v1/health

cd frontend
npm install
cp .env.example .env.local
npm run dev         # http://localhost:3000 (port is pinned — see below)
```

**The frontend must run on exactly the origin `FRONTEND_URL` names in `backend/.env` (`http://localhost:3000`).** Both the CORS allowlist and the CSRF `Origin` check compare it by exact string match, port included. If the frontend comes up on a different port, every non-GET request fails with `403 CSRF_VALIDATION_FAILED` and the browser blocks the response on CORS — catalog browsing still works, but login and registration break. `npm run dev` pins `-p 3000` so a port clash fails loudly instead of silently shifting the origin. To use a different port, change the frontend port **and** `FRONTEND_URL`/`APP_URL` in `backend/.env` together. See [docs/AUTH_SECURITY.md](docs/AUTH_SECURITY.md#csrf).

## Documentation Guide

Start with [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) for every task, then read only what's relevant:

| Document | Covers |
|---|---|
| [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | High-level project overview — read first |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, layering, boundaries |
| [docs/DATABASE.md](docs/DATABASE.md) | Database/Prisma architecture |
| [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) | REST API standards and conventions |
| [docs/AUTH_SECURITY.md](docs/AUTH_SECURITY.md) | Authentication and security architecture |
| [docs/RBAC.md](docs/RBAC.md) | Roles, permissions, authorization |
| [docs/UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md) | Brand, palette, UI principles |
| [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) | Rules for working on this codebase |
| [docs/MODULE_STATUS.md](docs/MODULE_STATUS.md) | Per-module implementation status |
| [docs/CURRENT_TASK.md](docs/CURRENT_TASK.md) | The currently active task |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Chronological project changes |
| [docs/modules/](docs/modules/) | Per-domain implementation context |

## Development Workflow

This project is developed with Claude Code using a token-efficient workflow: read `docs/PROJECT_CONTEXT.md` and only the relevant module docs before starting a task, keep changes scoped to the task, and update `MODULE_STATUS.md`, `CURRENT_TASK.md`, and `CHANGELOG.md` as work completes. See [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md).

## Environment Strategy

Separate environment configuration per application (`frontend/`, `backend/`) and per deployment target (development, production). Secrets are never committed to the repository. Exact environment files/variables will be defined once each application is scaffolded.

## Testing Strategy

To be defined per module as implementation begins; see [docs/DEVELOPMENT_RULES.md](docs/DEVELOPMENT_RULES.md) rule 16 (tests appropriate to the module).

# VIZAURA GLOBAL — Frontend

Storefront and admin dashboard application for VIZAURA GLOBAL, built with Next.js, React, TypeScript, and Tailwind CSS. This is the technical foundation only — no business pages are implemented yet. See [../docs/PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md) and [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) before adding code.

## Setup

```
npm install
cp .env.example .env
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint the project |

## Current State

- Minimal placeholder root route (`src/app/page.tsx`) — not a designed homepage.
- Tailwind CSS configured.
- `src/lib/api.ts` — thin fetch wrapper reading `NEXT_PUBLIC_API_BASE_URL`, no business calls yet.
- `src/components/` reserved (empty) for future reusable UI.
- No storefront, account area, admin dashboard, auth UI, or state management yet.

This application communicates with the backend exclusively via the documented REST API (see [../docs/API_CONTRACTS.md](../docs/API_CONTRACTS.md)) and never accesses the database, Prisma, or backend internals directly.

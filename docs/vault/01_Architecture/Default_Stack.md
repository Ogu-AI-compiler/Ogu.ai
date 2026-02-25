# Default Stack

General-purpose stack for new projects. Covers ~80% of SaaS and product apps.
Override per project with an ADR when needed.

## Language

**TypeScript** everywhere — client, server, contracts, config.
Shared types, compile-time safety, agent-friendly for Ogu enforcement.

## Frontend

**Next.js** (App Router) + **React** + **TypeScript**

- SSR/SSG for marketing and SEO pages
- App router for authenticated app
- Route groups to separate public / learner / admin areas
- Tailwind CSS for styling
- Zod for client-side validation (shared with server)
- React Query or built-in fetch with caching

## Backend

**Node.js** + **Fastify** + **TypeScript**

- Separate from Next.js — not API routes inside Next
- Zod schemas for request/response validation
- OpenAPI generation from Zod schemas
- Modular monolith structure (modules with clear boundaries)

## Mock API

**Fastify** + **in-memory state** + **shared contracts**

- Same Zod schemas as real API
- Real HTTP server, real request/response cycle
- In-memory Maps for state (no DB)
- Switching: single `API_BASE_URL` config change

## Database

**PostgreSQL**

- General purpose, transactional, scalable
- Full-text search built in (upgrade to Elasticsearch/OpenSearch later if needed)

## ORM

**Prisma**

- Excellent TypeScript integration
- Standard migration workflow
- Schema in `packages/db/`

## Cache

**Redis** — added when needed, not from day one

## Queue

**BullMQ** with Redis — added when needed for background jobs

## Auth

- httpOnly session cookies for web
- JWT access token (short) + refresh token (with rotation) for mobile
- 2FA via TOTP (optional module)
- RBAC: roles per user per organization

## Storage

**S3-compatible** (AWS S3, Cloudflare R2, MinIO for local dev)

## Email

External provider (SendGrid, Resend, etc.) behind `EmailProvider` interface.
Mock provider for local dev.

## Payments

**Stripe** behind `PaymentProvider` interface.
Mock provider for local dev and tests.

## Video

**Mux** or **Cloudflare Stream** behind `VideoProvider` interface.
Never build video pipeline in-house.

## Design System

Determined by platform — see `Design_System_Contract.md` for full rules.

| Platform | Default |
|----------|---------|
| Web only | shadcn/ui + Tailwind + custom tokens |
| Web + Mobile | Tamagui + shared tokens |
| Mobile only | Tamagui |

Structure: `packages/ui/` with tokens → primitives → components.
Apps never import design library directly — only through `packages/ui/`.

## Testing

- Unit: **Vitest**
- E2E Web: **Playwright**
- E2E Mobile (if needed): **Maestro** or **Detox**

## Monorepo

**pnpm workspaces**

```
apps/
  web/          Next.js
  api/          Fastify
  mock-api/     Fastify mock

packages/
  contracts/    Zod schemas, shared types
  db/           Prisma schema + client
  ui/           Design system components
  config/       Shared config utilities
```

## DevOps

- Docker Compose for local development
- CI: lint → typecheck → unit tests → E2E tests
- Structured logging with correlation IDs
- Environment config validated at startup with Zod

# Module Boundaries

Three layers with strict dependency direction: Domain ← Application ← Infrastructure.
Nothing flows backwards.

## Layers

### Domain

Pure business logic. No framework imports, no DB, no HTTP, no UI.

Contains:
- Entities and value objects
- Business rules and policies
- Validation logic
- Repository interfaces (not implementations)

Must NOT:
- Import from Infrastructure or Application
- Access environment variables
- Make HTTP calls or DB queries
- Know about frameworks

### Application

Orchestration layer. Coordinates domain logic with infrastructure.

Contains:
- Use cases / service functions
- DTO mapping
- Permission checks
- Workflow coordination

Must NOT:
- Contain business rules (those belong in Domain)
- Access DB directly (uses repository interfaces)
- Know about HTTP specifics (request/response objects)

### Infrastructure

External tools and adapters. Implements interfaces defined by Domain/Application.

Contains:
- DB clients and repository implementations
- HTTP server and route handlers
- Queue workers
- Email/SMS/payment provider adapters
- Storage adapters
- Config and environment loading

Must NOT:
- Contain business logic
- Be imported by Domain

## Monorepo Structure

```
apps/
  web/          Next.js frontend
  api/          Fastify real API server
  mock-api/     Fastify mock API server (in-memory state, same contracts)

packages/
  contracts/    Zod schemas and shared TypeScript types
  db/           Prisma schema and client wrapper
  ui/           Design system components
  config/       Shared config loading utilities
```

## Boundary Rules

- `apps/web/` imports from `packages/contracts/`, `packages/ui/`, `packages/config/`. Never from `apps/api/` or `packages/db/`.
- `apps/api/` imports from `packages/contracts/`, `packages/db/`, `packages/config/`. Never from `apps/web/`.
- `apps/mock-api/` imports from `packages/contracts/`, `packages/config/`. Never from `packages/db/`.
- `packages/contracts/` imports from nothing. It is the shared truth.
- `packages/ui/` imports from `packages/contracts/` only for types. No API or DB imports.

## Module Structure (inside api)

Each business module follows the same internal structure:

```
src/modules/<module>/
  api.ts          Route handlers (Infrastructure)
  service.ts      Use cases (Application)
  domain.ts       Business rules (Domain)
  repository.ts   Repository interface (Domain)
  repo-impl.ts    Repository implementation (Infrastructure)
```

# Patterns

Established patterns used in this project. Follow these when implementing new features.

## Naming Conventions

- Files: `kebab-case.ts`
- Components: `PascalCase.tsx`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Zod schemas: `PascalCase` matching the type name (e.g. `CreateUserRequest`)
- Database tables: `snake_case` plural (e.g. `users`, `course_modules`)
- API routes: `kebab-case` (e.g. `/api/course-modules`)
- Test files: `<name>.test.ts` or `<name>.spec.ts`
- E2E tests: `<feature>.smoke.spec.ts`

## File Organization

- One exported entity per file when possible
- Index files only for public module API, never for re-exporting everything
- Co-locate tests next to source files for unit tests
- E2E tests in `tests/e2e/` (web) or `e2e/` (mobile)
- Shared types and schemas live in `packages/contracts/`, never duplicated

## Config

- All config loaded through `packages/config/`
- No direct `process.env` access outside config layer
- Config validated with Zod at startup — fail fast on missing values
- Separate config per app: `apps/api/src/config.ts`, `apps/web/src/config.ts`

## API Endpoints

- Every endpoint has a Zod request schema and response schema in `packages/contracts/`
- Route handlers validate input with the request schema, return data matching response schema
- Auth policy declared per route: `public`, `authenticated`, or specific role
- Error responses follow a consistent shape: `{ error: string, code: string, details?: unknown }`
- Every new endpoint must be implemented in both `apps/api/` and `apps/mock-api/`

## Mock API

- Mock API is a real Fastify HTTP server in `apps/mock-api/`
- Uses in-memory Maps/arrays for state — no DB, no files
- Imports schemas from `packages/contracts/` — same validation as real API
- Switching between mock and real is a single `API_BASE_URL` config change
- Mock API resets state on restart

## Auth

- Sessions via httpOnly cookies for web
- Short-lived access token (10-15 min) + refresh token with rotation for mobile
- Refresh tokens stored hashed in DB
- Revoke capability for all devices
- RBAC by default: roles assigned per user per organization
- 2FA via TOTP (authenticator apps) as optional module

## Error Handling

- Domain errors are typed: custom error classes extending a base `DomainError`
- Application layer catches domain errors and maps to HTTP status codes
- Infrastructure errors (DB down, network) are logged and returned as 500 with correlation ID
- Never swallow errors. Never return empty 200 on failure.
- Correlation ID attached to every request, passed through all layers

## Testing

- Unit tests: Vitest, co-located with source
- E2E tests: Playwright for web
- Every use case has at least one unit test
- Every feature has at least one E2E smoke test
- Tests use factories for data creation, not raw object literals
- E2E tests interact via `data-testid` or role selectors, never text content
- API tests run against mock-api for speed and stability

## Design System

- Design tokens defined in `packages/ui/`: colors, typography, spacing, radius
- Core components: Button, Input, Modal, Table, Card, Tabs, Toast
- All interactive elements must accept `data-testid` prop
- Components are framework-agnostic where possible (plain React)
- Storybook for component documentation if web project

## Adding a New Module

1. Create directory `src/modules/<name>/` with standard files (api, service, domain, repository, repo-impl)
2. Define contracts in `packages/contracts/<name>.ts`
3. Register routes in the API router
4. Implement same routes in mock-api
5. Add to Module_Boundaries.md if it introduces new dependency rules

## Adding an External Service

1. Evaluate using Build_vs_Buy.md criteria
2. Create ADR if adopting
3. Define an abstraction interface in application layer
4. Implement adapter in infrastructure layer
5. Add mock adapter for testing
6. Update contracts

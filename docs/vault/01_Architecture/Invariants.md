# Invariants

These are the non-negotiable architectural rules of this system.
Any implementation that violates an invariant is rejected.

To change an invariant, create an ADR first.

## Rules

### Ogu

- All Ogu state must be file-based and git-tracked. No external services or databases.
- CONTEXT.md is generated only. It must never be hand-edited.
- If implementation conflicts with vault invariants, invariants win. No exceptions.
- Every invariant change requires an approved ADR before implementation.
- STATE.json must conform to the schema defined in Ogu_Memory_Contract.md at all times.
- Assembly order of CONTEXT.md sections must never change (see Memory Contract section 6).
- ADRs are append-only. An ADR may be deprecated or superseded, never deleted.

### Architecture

- Domain layer must not import from Infrastructure. No DB, HTTP, or storage imports in domain code.
- Controllers contain no business logic. Only input validation and delegation to application layer.
- All DB access goes through repository interfaces defined in domain or application layer.
- Secrets and tokens are read only through a config layer. No scattered `process.env` access.
- No hardcoded URLs, keys, or credentials in code. Everything through config.
- Every endpoint must have an explicit auth policy or a `public` declaration.
- Every UI action must have a real handler that produces a user-visible effect. No dead buttons.
- Errors are never swallowed. Every error must be mapped to a consistent response.
- Each new use case must have a unit test.

### Data

- No static mock data inside the web app. No JSON fixtures in UI code.
- All data flows through HTTP. The UI fetches from an API, never imports data directly.
- Mock API is a real HTTP server using shared contracts, not static files.
- Both real API and mock API must implement the same contracts from `packages/contracts/`.

### Design System

- No hardcoded colors, spacing, or font values in components. Tokens only.
- App code imports from `packages/ui/` only. Never import shadcn/Tamagui directly in app code.
- Tokens must exist before primitives. Primitives must exist before feature components.
- No MUI, Chakra, Ant Design, or similar runtime-heavy libraries without ADR.

### Feature Completion

- No TODO, FIXME, or placeholder code in shipped features.
- No feature is complete without E2E smoke test that passes.
- No new external service without ADR and abstraction interface.
- No new API endpoint without contract definition in `packages/contracts/`.

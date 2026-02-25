# Artifact Contract

The Builder produces an Artifact. The Preview Runtime executes it. The Production Runtime deploys it. These are three separate layers that must never be mixed.

```
Builder → Artifact → Preview Runtime → Production Runtime
```

## Required Structure

Every generated project must contain:

```
apps/
  web/                 Frontend app
  api/                 Real backend (or empty scaffold if not yet implemented)
  mock-api/            Mock backend with in-memory state

packages/
  contracts/           Zod schemas, shared types
  ui/                  Design system components
  config/              Shared config utilities
  db/                  Prisma schema + client (when DB is needed)

docker-compose.yml     Orchestrates all services for preview
docker-compose.prod.yml  Production overrides (optional, added at deploy)
.env.example           All required env vars with dummy values
scripts/
  preview.sh           One command to start preview
  seed.sh              Seed mock data (if needed beyond mock-api state)

tests/
  e2e/                 Playwright smoke tests
```

## Required Files Per App

### apps/web/

- `Dockerfile` — multi-stage build
- `next.config.ts` (or framework equivalent)
- Health endpoint: `GET /api/health` → `{ status: "ok" }`

### apps/api/

- `Dockerfile`
- `src/config.ts` — Zod-validated env loading
- Health endpoint: `GET /health` → `{ status: "ok", services: {...} }`

### apps/mock-api/

- `Dockerfile`
- Same route structure as `apps/api/`
- Uses `packages/contracts/` for validation
- In-memory state (Maps/arrays), resets on restart
- Health endpoint: `GET /health` → `{ status: "ok" }`

## docker-compose.yml Requirements

Must define at minimum:

```yaml
services:
  web:        # Frontend, depends on mock-api
  mock-api:   # Mock backend
  # api:      # Real backend (optional in preview)
  # db:       # Postgres (optional in preview)
```

Each service must have:
- `healthcheck` defined
- Explicit `ports`
- `depends_on` with `condition: service_healthy`

## Environment

- `.env.example` must list every required variable with safe defaults
- Preview mode: `API_BASE_URL` points to `mock-api`
- Production mode: `API_BASE_URL` points to `api`
- Switching is a single env var change

## Artifact Invariants

- The artifact must be runnable without the builder. No dependency on Ogu CLI at runtime.
- The artifact must be runnable without any external service (cloud, DB, third-party APIs) in preview mode.
- Every API endpoint in the artifact must exist in both `apps/api/` (or scaffold) and `apps/mock-api/`.
- The artifact must include at least one E2E test that passes against preview.

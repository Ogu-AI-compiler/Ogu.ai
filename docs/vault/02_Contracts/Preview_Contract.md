# Preview Contract

Preview is the proof that the artifact works. No feature is "done" without preview health.

## What Preview Is

Preview Runtime is a temporary, local execution of the artifact in sandbox mode:
- Real HTTP servers (web + mock-api)
- Real request/response cycle
- In-memory data (no production DB)
- No external service dependencies
- Deterministic, reproducible, disposable

Preview is NOT:
- A production deployment
- The builder itself
- A static HTML export
- A screenshot

## How to Run Preview

### Default: Docker Compose

```bash
docker compose up
# or
./scripts/preview.sh
```

### Fallback: pnpm scripts

```bash
pnpm preview
```

Both must produce the same result: all services running and healthy.

## Success Criteria

Preview is HEALTHY when ALL of these are true:

1. **Web is reachable** — `GET http://localhost:3000/api/health` returns `{ status: "ok" }`
2. **Mock API is reachable** — `GET http://localhost:4001/health` returns `{ status: "ok" }`
3. **Web talks to Mock API** — at least one page successfully fetches data from mock-api
4. **No crash loops** — all containers/processes stay up for at least 30 seconds
5. **Health checks pass** — Docker healthchecks (if Compose) all report healthy

## Preview Ports (defaults)

| Service | Port |
|---------|------|
| web | 3000 |
| api (real) | 4000 |
| mock-api | 4001 |
| db (if needed) | 5432 |
| redis (if needed) | 6379 |

## Preview Report

`ogu preview` writes `.ogu/PREVIEW.md`:

```markdown
# Preview Report

Built: <timestamp>
Mode: docker-compose | pnpm

## Services
- web: UP (http://localhost:3000)
- mock-api: UP (http://localhost:4001)

## Health Checks
- web /api/health: OK
- mock-api /health: OK

## Result: HEALTHY | FAILED
```

## Lifecycle

1. `ogu preview` starts services
2. Waits for health endpoints
3. Reports status
4. Services stay running for manual inspection
5. `ogu preview --stop` tears down

## Rules

- Preview must work offline (no internet required beyond initial image pull)
- Preview must work on a fresh clone with only Docker installed
- Preview must not require production secrets
- `.env.example` must be sufficient to run preview
- If preview fails, the feature is not complete — `/done` gate will reject it

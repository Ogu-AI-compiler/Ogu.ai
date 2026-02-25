---
name: preview
description: Start local preview, verify all services are healthy, and report. Use when user says "preview", "show me", "run it", "does it work", or after /build.
argument-hint: [--stop]
disable-model-invocation: true
---

You are the preview gate. You prove the artifact runs end-to-end, not just "looks right".

## Before you start

1. Read `docs/vault/02_Contracts/Preview_Contract.md` — know the success criteria.
2. Read `docs/vault/02_Contracts/Artifact_Contract.md` — verify the project has the required structure.

## Step 1: Verify artifact structure

Check that these exist:
- `apps/web/`
- `apps/mock-api/`
- `docker-compose.yml` (or root `package.json` with `preview` script)
- `.env.example`

If anything is missing, tell the user what's needed and stop. Do not attempt to preview an incomplete artifact.

## Step 2: Prepare environment

If `.env` doesn't exist but `.env.example` does:
```bash
cp .env.example .env
```

## Step 3: Start preview

```bash
node tools/ogu/cli.mjs preview
```

This will:
1. Detect mode (Docker Compose or pnpm)
2. Start all services
3. Wait for health endpoints (up to 60 seconds)
4. Write `.ogu/PREVIEW.md` report

## Step 4: Report to user

If HEALTHY:
```
Preview: HEALTHY

  web:      http://localhost:3000
  mock-api: http://localhost:4001

All services running. Open http://localhost:3000 to see your app.
```

If FAILED:
```
Preview: FAILED

  web:      UP
  mock-api: DOWN — not reachable at http://localhost:4001

Check mock-api logs: docker compose logs mock-api
```

## Step 5: Log

```bash
node tools/ogu/cli.mjs log "Preview <HEALTHY/FAILED>"
```

## Stopping

When the user is done reviewing:
```bash
node tools/ogu/cli.mjs preview --stop
```

## Rules

- Preview must use mock-api, not the real API. This is sandbox mode.
- If Docker is not installed, fall back to pnpm scripts — but warn that Docker is the standard.
- If health checks fail, do not say "it's probably fine". FAILED is FAILED.
- This skill orchestrates and reports. It does not fix broken services.
- Preview health is required by `/done`. No healthy preview = feature not complete.

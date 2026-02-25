# Deploy Packs

Deterministic mapping from project profile to deployment target. Ogu does not "choose" a cloud provider — it matches the profile to a pack.

## Project Profile

`ogu profile` scans the repo and produces `.ogu/PROFILE.json`:

```json
{
  "platform": "web" | "web+mobile" | "mobile",
  "needs_db": true | false,
  "needs_jobs": true | false,
  "needs_storage": true | false,
  "needs_realtime": true | false,
  "needs_auth": true | false,
  "needs_video": true | false,
  "needs_search": true | false,
  "services": ["web", "api", "mock-api", "db", "redis", ...]
}
```

## Pack Mapping

| Profile | Recommended Pack | Alternative |
|---------|-----------------|-------------|
| Static web (no API) | Cloudflare Pages, Vercel | Netlify |
| Web + API, no DB | Vercel + Railway | Render |
| Web + API + DB | Render | Railway, Fly.io |
| Web + API + DB + Jobs | Render + Redis | Fly.io |
| Full stack (DB + storage + jobs + realtime) | AWS (ECS/RDS) | Fly.io, Railway |
| Mobile backend only | Railway | Render, Fly.io |

## What Ogu Generates Per Pack

Ogu does not deploy directly. It generates deployment artifacts:

### For every pack:
- `Dockerfile` per service (if not already present)
- `.env.production.example` with required vars listed
- CI workflow (`.github/workflows/deploy.yml`)
- Deploy instructions in `docs/vault/05_Runbooks/Deploy.md`

### Pack-specific:

**Vercel:**
- `vercel.json`
- Environment variable list for Vercel dashboard

**Render:**
- `render.yaml` (blueprint)
- Service definitions matching docker-compose

**Railway:**
- `railway.toml` per service

**Fly.io:**
- `fly.toml` per service

**AWS:**
- `infra/` directory with IaC (CDK or Terraform)
- ECS task definitions
- RDS configuration

## Deploy Flow

```
ogu profile              → .ogu/PROFILE.json
ogu deploy --target X    → generates deploy artifacts
                         → does NOT push to cloud
                         → user reviews and deploys from their account
```

## Rules

- Ogu never holds cloud credentials. Deploy happens in the user's account.
- Ogu generates IaC and CI, does not execute deployment.
- Every deploy target must be documented in `docs/vault/05_Runbooks/Deploy.md`.
- Production deploy requires all `/done` gates passed including preview health.
- Pack selection requires profile. No manual "just pick Vercel" without scanning.
- Changing deploy target requires ADR if it's mid-project.

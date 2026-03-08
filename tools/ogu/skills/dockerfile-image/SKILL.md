---
name: dockerfile-image
description: Compiler skill for the dockerfile_image compiler. Activates when producing dockerfile-artifact.json. Gates: DF001–DF010. No upstream dependency.
---

# dockerfile-image — Compiler Skill

## What This Compiler Does

Compiles the Dockerfile image specification — runtime, entrypoint, ports, base image pinning, non-root user, secrets safety, .dockerignore, port-spec consistency, and contract invariants. Enforces: a Dockerfile exists, base images are pinned to specific versions (no `:latest`), the container runs as a non-root user, no credentials in ARG/ENV, .dockerignore is present, EXPOSE matches spec ports, and contract invariants (HEALTHCHECK, WORKDIR, no ADD for local files) are met.

**Upstream dependency:** none
**Output artifact:** `dockerfile-artifact.json`
**IR identifier:** `DOCKERFILE_IMAGE:{project}`

---

## Spec Shape

```json
{
  "runtime": "node",
  "entrypoint": "node dist/server.js",
  "ports": [3000, 9229],
  "packageManager": "npm"
}
```

Required fields:
- `runtime` — `node`, `python`, `go`, `java`, `ruby`, `rust`, `dotnet`, `php`, `bun`, or `deno`
- `entrypoint` — container startup command
- `ports` — array of port numbers (1–65535)

---

## Gates

### DF001 — spec-valid
Reads `dockerfile-spec.json`. Required: `runtime` (valid), `entrypoint`, `ports` (array of valid integers).

Hard-fails if `dockerfile-spec.json` is missing.

### DF002 — dockerfile-exists
A `Dockerfile` must be present in the target directory. Accepted names: `Dockerfile`, `dockerfile`, `Dockerfile.prod`, `Dockerfile.production`, or any file starting with `Dockerfile`.

BAD: No Dockerfile found.
GOOD: `Dockerfile` or `Dockerfile.prod` exists.

### DF003 — single-entrypoint
The final Dockerfile stage must have exactly one `CMD` or `ENTRYPOINT` instruction. Multiple `CMD` instructions silently collapse — only the last takes effect.

BAD:
```dockerfile
CMD ["node", "server.js"]
CMD ["node", "worker.js"]
# second CMD silently overrides first
```
GOOD:
```dockerfile
ENTRYPOINT ["node"]
CMD ["server.js"]
```

### DF004 — base-image-pinned
Every `FROM` instruction must use a pinned tag or digest. `:latest` and images with no tag are rejected as non-deterministic.

BAD:
```dockerfile
FROM node:latest
FROM node
FROM python:dev
```
GOOD:
```dockerfile
FROM node:20.11-alpine
FROM node@sha256:abc123...
```

### DF005 — non-root
The container must not run as root. The Dockerfile must include a `USER` instruction, and the final user must not be `root` or uid `0`.

BAD:
```dockerfile
# no USER instruction — runs as root
CMD ["node", "server.js"]
```
```dockerfile
USER root
CMD ["node", "server.js"]
```
GOOD:
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
CMD ["node", "server.js"]
```

### DF006 — no-secrets-in-build
`ARG` and `ENV` instructions with secret-sounding names (`password`, `token`, `api_key`, `secret`, `credentials`) must not have literal non-placeholder values. Build args and env vars are baked into image layers and readable by anyone who can pull the image.

BAD:
```dockerfile
ARG API_KEY=sk-abc123realtoken
ENV DB_PASSWORD=secretpassword
```
GOOD:
```dockerfile
# Inject at runtime, not build time
# Use: docker run -e DB_PASSWORD=$DB_PASSWORD
```

### DF007 — dockerignore-present
`.dockerignore` must exist. Without it, the entire build context (including `.git`, `node_modules`, `.env` files) is sent to the Docker daemon.

GOOD: `.dockerignore` exists with at minimum `.git`, `node_modules`, `.env`, `*.log`.

### DF008 — ports-match-spec
Every port declared in `dockerfile-spec.json` must be `EXPOSE`d in the Dockerfile. Unexposed ports won't receive traffic at runtime without explicit mapping.

BAD:
```json
{ "ports": [3000, 9229] }
```
```dockerfile
EXPOSE 3000
# port 9229 declared in spec but not EXPOSE'd
```
GOOD: All spec ports appear in `EXPOSE` instructions.

### DF009 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### DF010 — contract-dockerfile
Final contract checks:
- `HEALTHCHECK` instruction required — orchestrators cannot detect stuck containers without it
- `WORKDIR` instruction required — files must not be written to `/`
- `ADD` must not be used for local files — use `COPY` instead (ADD silently unpacks archives)

BAD:
```dockerfile
FROM node:20-alpine
COPY . .
CMD ["node", "server.js"]
# no HEALTHCHECK, no WORKDIR
```
GOOD:
```dockerfile
FROM node:20.11-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:3000/health || exit 1
RUN adduser -S appuser
USER appuser
CMD ["node", "server.js"]
```

---

## What This Compiler Never Forgives

- `dockerfile-spec.json` missing (DF001 hard-fails)
- `runtime`, `entrypoint`, or `ports` missing (DF001)
- `runtime` not in valid list (DF001)
- Invalid port numbers (< 1 or > 65535) (DF001)
- No Dockerfile found in directory (DF002)
- Multiple `CMD` instructions in final stage (DF003)
- No `CMD` or `ENTRYPOINT` in final stage (DF003)
- Base image using `:latest` tag (DF004)
- Base image with no tag (implicit `:latest`) (DF004)
- No `USER` instruction (DF005)
- Final `USER` is `root` or uid `0` (DF005)
- Literal credentials in `ARG`/`ENV` instructions (DF006)
- `.dockerignore` missing (DF007)
- Spec ports not `EXPOSE`d in Dockerfile (DF008)
- No `HEALTHCHECK` instruction (DF010)
- No `WORKDIR` instruction (DF010)
- `ADD` used for local files (DF010)

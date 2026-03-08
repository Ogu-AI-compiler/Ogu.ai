---
name: config-validation-module
description: Compiler skill for the config-validation-module compiler. Activates when producing config-artifact.json. Gates: CV001–CV010. No upstream dependency.
---

# config-validation-module — Compiler Skill

## What This Compiler Does

Compiles a typed, validated config module from an env key contract. Enforces that every key has a schema type and is either required or has a default, secrets are flagged, `process.env` is accessed only inside the config module boundary, invalid config causes startup failure, and unknown keys are handled explicitly.

**Upstream dependency:** none
**Output artifact:** `config-artifact.json`
**IR identifier:** `CONFIG`
**Config module location:** `src/config/index.ts` or `src/config/env.ts` (or `config/index.ts`)

---

## Spec Shape

```json
{
  "envKeys": [
    {
      "name": "DATABASE_URL",
      "type": "url",
      "required": true,
      "description": "PostgreSQL connection URL"
    },
    {
      "name": "JWT_SECRET",
      "type": "string",
      "required": true,
      "secret": true,
      "description": "JWT signing secret"
    },
    {
      "name": "LOG_LEVEL",
      "type": "string",
      "required": false,
      "default": "info",
      "description": "Application log level"
    },
    {
      "name": "PORT",
      "type": "port",
      "required": false,
      "default": 3000,
      "description": "HTTP server port"
    }
  ],
  "unknownKeyPolicy": "reject"
}
```

Valid `type` values: `string` | `number` | `boolean` | `url` | `port` | `email`

Valid `unknownKeyPolicy` values: `reject` | `ignore`

---

## Gates

### CV001 — spec-valid
Reads `config-spec.json`. Fails if missing.

Required fields: `envKeys` (non-empty array), `unknownKeyPolicy` (`reject` or `ignore`).

Each entry in `envKeys` must have `name` (string) and `type` (one of the six valid types).

BAD: `"unknownKeyPolicy": "warn"` — not in enum. `"type": "integer"` — not valid (use `number`). `"envKeys": []` — must have at least one.
GOOD: All keys have `name` and a valid `type`. Policy is `reject` or `ignore`.

### CV002 — exports-valid
Searches for the config output file in: `src/config/index.ts`, `src/config/env.ts`, `config/index.ts`, `config.ts`, `env.ts` (and any `.ts` file containing `export` and `config` as a fallback).

Every key `name` declared in `envKeys` must appear in the config file (as a reference or export).

BAD: Spec declares `DATABASE_URL` but the config module never references it.
BAD: No config file found at any expected location.
GOOD: `src/config/index.ts` exports a validated config object referencing all declared key names.

### CV003 — schema-complete
Every envKey must have EITHER `required: true` OR a `default` value. Keys with neither are ambiguous — the config module doesn't know what to do when the env var is absent.

BAD: `{ "name": "REDIS_URL", "type": "url" }` — no `required` and no `default`.
GOOD: `{ "name": "REDIS_URL", "type": "url", "required": true }` or `{ ..., "default": "redis://localhost:6379" }`.

### CV004 — no-env-leak
`process.env.*` access is only allowed inside the config module boundary: `src/config/`, `config/`, or `src/env/` directories.

All other non-test `.ts`/`.mjs`/`.js` files must NOT access `process.env` directly. Import from the config module instead.

BAD: `src/services/user.service.ts` contains `process.env.DATABASE_URL` — outside config boundary.
GOOD: `import { config } from '../config'` then `config.databaseUrl`.

### CV005 — secret-marked
Keys whose names match secret patterns must have `secret: true` in the spec.

Secret patterns detected: `secret`, `password`, `passwd`, `token`, `api-key`, `apiKey`, `private-key`, `auth-key`, `credential`, `signing-key`, `jwt-secret`, `hmac`, `encryption-key` (case-insensitive, partial match).

BAD: `{ "name": "JWT_SECRET", "type": "string", "required": true }` — missing `"secret": true`.
BAD: `{ "name": "API_TOKEN", "type": "string" }` — `token` matches, must be marked.
GOOD: `{ "name": "JWT_SECRET", "type": "string", "required": true, "secret": true }`.

### CV006 — startup-fail
The config module must enforce that missing required keys cause the process to fail at startup.

Patterns recognized as startup-failure enforcement:
- `throw new Error(...)` in config initialization
- `process.exit(1)`
- `.parse(...)` — Zod throws `ZodError` on invalid input
- `cleanEnv(...)` — envalid throws on missing required keys
- `z.object(...)` — Zod schema declaration
- `parseEnv(...)` or `validateSync(...)`

Skips if no keys have `required: true`.

BAD: Config module just reads `process.env.DB_URL ?? ""` — silently continues with empty string.
GOOD:
```ts
const config = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
}).parse(process.env);  // throws ZodError if invalid → kills process at startup
```

### CV007 — no-unknown-keys
The `unknownKeyPolicy` declared in spec must be implemented in the config module code:

**`"reject"` policy** — code must contain:
- `.strict()` (Zod strict mode)
- `additionalProperties: false`
- `stripUnknown: false` or `allowUnknown: false`
- `cleanEnv(` or `parseEnv(` (envalid rejects unknown by default)

**`"ignore"` policy** — code must contain:
- `.passthrough()` (Zod)
- `stripUnknown: true` or `allowUnknown: true`
- `.strip()`

BAD: Spec declares `"unknownKeyPolicy": "reject"` but the Zod schema uses `.passthrough()`.
GOOD: Spec is `"reject"` and code uses `z.object({...}).strict()`.

### CV008 — no-todos
Recursively scans all `.ts`/`.mjs`/`.js` files. Blocked: `TODO`, `FIXME`, `HACK`.

### CV009 — tests-pass
Finds test files. Hard-fails if none. Tries vitest then jest.

### CV010 — contract-config
Four contract rules:

| Rule | Check |
|---|---|
| CONFIG-001 | `envKeys` is non-empty |
| CONFIG-002 | `unknownKeyPolicy` is `reject` or `ignore` |
| CONFIG-003 | At least one key has `required: true` |
| CONFIG-004 | Keys matching secret patterns are marked `secret: true` |

CONFIG-003 is the most commonly missed: every config module must have at least one required key — an all-defaults config is suspicious.

---

## What This Compiler Never Forgives

- `config-spec.json` missing (CV001 hard-fails)
- EnvKey with no `required` and no `default` (CV003)
- `process.env.*` accessed outside `src/config/`, `config/`, or `src/env/` (CV004)
- Keys named `*secret*`, `*token*`, `*password*`, `*apiKey*` etc. without `secret: true` (CV005)
- Config module with no startup-failure pattern (`z.parse`, `cleanEnv`, `throw`, `process.exit`) (CV006)
- `unknownKeyPolicy` not reflected in code (CV007)
- No required keys at all — the contract requires at least one (CV010 CONFIG-003)

---
name: env-schema
description: Compiler skill for the env_schema compiler. Activates when producing env-schema-artifact.json. Gates: ES001–ES007. No upstream dependency.
---

# env-schema — Compiler Skill

## What This Compiler Does

Compiles the environment variable schema — key names, types, required/optional declarations, default values, and secret flags. Enforces: all key names are unique, every key has a valid type and declared optionality (required or default), default values conform to their declared type, secret keys have no literal defaults or committed values, and every key has a description.

**Upstream dependency:** none
**Output artifact:** `env-schema-artifact.json`
**IR identifier:** `ENV_SCHEMA:{project}`

---

## Spec Shape

```json
{
  "envKeys": [
    {
      "name": "DATABASE_URL",
      "type": "url",
      "required": true,
      "secret": true,
      "description": "PostgreSQL connection string for primary database"
    },
    {
      "name": "PORT",
      "type": "port",
      "default": 3000,
      "description": "HTTP server port"
    },
    {
      "name": "LOG_LEVEL",
      "type": "string",
      "default": "info",
      "description": "Logging verbosity level"
    },
    {
      "name": "FEATURE_NEW_DASHBOARD",
      "type": "boolean",
      "default": false,
      "description": "Enable new dashboard UI feature flag"
    }
  ],
  "unknownKeyPolicy": "reject"
}
```

Required fields:
- `envKeys` — non-empty array, each with `name` and `type`
- `unknownKeyPolicy` — `"reject"` or `"ignore"`

Valid types: `string`, `number`, `boolean`, `url`, `port`, `email`, `json`, `base64`

---

## Gates

### ES001 — spec-valid
Reads `env-schema-spec.json`. Required: `envKeys` (non-empty array), `unknownKeyPolicy` (`reject` or `ignore`). Each key must have `name` and a valid `type`.

Hard-fails if `env-schema-spec.json` is missing.

### ES002 — unique-names
No two keys may share the same `name`. Duplicate env var names cause runtime ambiguity — the last declaration silently wins.

BAD:
```json
{ "envKeys": [
  { "name": "DATABASE_URL", "type": "url", "required": true },
  { "name": "DATABASE_URL", "type": "string", "default": "fallback" }
]}
// DATABASE_URL declared twice
```
GOOD: Each key name appears exactly once.

### ES003 — type-valid
Every key must:
1. Have a valid type from: `string`, `number`, `boolean`, `url`, `port`, `email`, `json`, `base64`
2. Declare either `required: true` OR a `default` value — keys with neither are ambiguous

BAD:
```json
{ "name": "API_KEY", "type": "string" }
// no required or default — ambiguous optionality
```
```json
{ "name": "PORT", "type": "integer" }
// "integer" is not a valid type — use "number" or "port"
```
GOOD:
```json
{ "name": "PORT", "type": "port", "default": 3000 }
{ "name": "API_KEY", "type": "string", "required": true }
```

### ES004 — defaults-typed
Default values must conform to their declared type. A default that fails its own type rule is a silent runtime bug.

BAD:
```json
{ "name": "PORT", "type": "port", "default": "three-thousand" }
// string default for port type
```
```json
{ "name": "API_URL", "type": "url", "default": "not-a-url" }
// invalid URL default
```
GOOD:
```json
{ "name": "PORT", "type": "port", "default": 3000 }
{ "name": "API_URL", "type": "url", "default": "https://api.example.com" }
```

### ES005 — no-secret-default
Keys marked `secret: true` must:
1. Have no literal `default` value in the spec
2. Not appear with a literal value in any committed `.env` file (`.env.example` is exempt)

BAD:
```json
{ "name": "API_SECRET", "type": "string", "secret": true, "default": "hardcoded-secret" }
```
```ini
# .env.production (committed to git)
API_SECRET=real-production-secret
```
GOOD:
```json
{ "name": "API_SECRET", "type": "string", "secret": true, "required": true }
```

### ES006 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### ES007 — contract-env-schema
Final contract checks:
- Every key must have a `description` — undescribed keys are opaque to operators
- `required: true` keys must not have a `default` — a required key with a default is effectively optional (self-contradictory)

BAD:
```json
{ "name": "PORT", "type": "port", "required": true, "default": 3000 }
// required but has a default — contradictory
```
```json
{ "name": "LOG_LEVEL", "type": "string", "default": "info" }
// no description
```
GOOD:
```json
{
  "name": "LOG_LEVEL",
  "type": "string",
  "default": "info",
  "description": "Log verbosity: debug, info, warn, error"
}
```

---

## What This Compiler Never Forgives

- `env-schema-spec.json` missing (ES001 hard-fails)
- `envKeys` or `unknownKeyPolicy` missing (ES001)
- `envKeys` empty (ES001)
- `unknownKeyPolicy` not `"reject"` or `"ignore"` (ES001)
- Any key with invalid `type` (ES001, ES003)
- Duplicate key names (ES002)
- Any key without `required` or `default` (ES003)
- Default value that does not conform to declared type (ES004)
- `secret: true` key with a literal `default` value (ES005)
- `secret: true` key with literal value in committed `.env` file (ES005)
- Any key missing `description` (ES007)
- `required: true` key that also has `default` (ES007)

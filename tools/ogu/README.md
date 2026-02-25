# Ogu

Ogu is a repository-local autonomous memory system. It provides deterministic memory, context assembly, and architectural consistency for AI-assisted development. All state lives in plain files tracked by git — no external services, no databases, no embeddings.

Ogu organizes knowledge into two layers: a **Knowledge Vault** (`docs/vault/`) for stable architectural knowledge, and **Runtime Memory** (`.ogu/`) for operational state that evolves across sessions.

## Commands

### `ogu init`

Creates the full Ogu directory structure and populates template files. Idempotent — existing files are never overwritten.

```bash
node tools/ogu/cli.mjs init
```

### `ogu validate`

Checks that all required directories, files, and schemas are present and valid. Exits with code 0 on success, 1 on failure.

```bash
node tools/ogu/cli.mjs validate
```

### `ogu log`

Appends a timestamped entry to today's daily log (`.ogu/memory/YYYY-MM-DD.md`) and to `SESSION.md`. Creates the daily log file if it doesn't exist.

```bash
node tools/ogu/cli.mjs log "Implemented user auth module"
node tools/ogu/cli.mjs log "Decided to use JWT over sessions - simpler for API"
```

Output:
```
  logged  - [14:32] Implemented user auth module
     to   .ogu/memory/2026-02-22.md
```

### `ogu repo-map`

Scans the repository and generates a concise, semantic summary in `docs/vault/01_Architecture/Repo_Map.md`. Detects tech stack, entrypoints, and directory purposes. Updates `last_repo_map_update` in STATE.json.

```bash
node tools/ogu/cli.mjs repo-map
```

### `ogu context`

Assembles `.ogu/CONTEXT.md` from vault documents and runtime memory in a fixed, deterministic section order. Updates `last_context_build` in STATE.json.

```bash
# Basic — no feature
node tools/ogu/cli.mjs context

# With a feature slug — includes feature docs from docs/vault/04_Features/<slug>/
node tools/ogu/cli.mjs context --feature user-auth

# With feature and issue text
node tools/ogu/cli.mjs context --feature user-auth --issue "Users can't log in with Google OAuth"
```

Assembly order (fixed, never changes):
1. Invariants
2. Contracts (API, Navigation, SDUI, Ogu Memory Contract)
3. Repo Map
4. Patterns
5. Feature Spec (PRD, Spec, QA, Plan.json — if `--feature` provided)
6. MEMORY.md
7. Last 2 daily logs

Missing source files produce a `MISSING: <path>` placeholder, not a hard failure.

### `ogu adr`

Creates a new Architecture Decision Record with auto-incremented numbering. Updates `00_Index.md` with a link and tracks the ADR in STATE.json.

```bash
# Minimal — just a title
node tools/ogu/cli.mjs adr "Use JWT for authentication"

# Full — with context, decision, and alternatives
node tools/ogu/cli.mjs adr "Use JWT for authentication" \
  --context "We need stateless auth for the API" \
  --decision "Use JWT with short-lived access tokens and refresh tokens" \
  --alternatives "Session cookies, OAuth2 only, API keys"
```

Output:
```
  created  docs/vault/03_ADRs/ADR_0002_use-jwt-for-authentication.md
  updated  docs/vault/00_Index.md
  updated  .ogu/STATE.json
```

### `ogu remember`

Reads today's daily log and SESSION.md, extracts stable long-term facts and decisions, and writes a proposal to `.ogu/MEMORY_PROPOSAL.md`. Does **not** modify MEMORY.md — you review the proposal and apply manually.

```bash
node tools/ogu/cli.mjs remember
```

Output:
```
  created  .ogu/MEMORY_PROPOSAL.md (3 candidates)
  Review the proposal and manually apply changes to .ogu/MEMORY.md
```

The proposal contains `ADD:`, `REMOVE:`, and `UPDATE:` sections. Only `ADD:` is auto-populated; `REMOVE:` and `UPDATE:` are for your manual review.

### `ogu doctor`

Runs a full end-to-end health check: validate, repo-map, context assembly, log, remember, and validate again. Writes a report to `.ogu/DOCTOR.md`.

```bash
# Standard check
node tools/ogu/cli.mjs doctor

# Strict mode — also fails if vault docs contain TODO markers or Repo_Map.md is too small
node tools/ogu/cli.mjs doctor --strict

# Custom report path
node tools/ogu/cli.mjs doctor --report /tmp/ogu-report.md
```

Output:
```
[1/6] validate ........ OK
[2/6] repo-map ........ OK
[3/6] context ......... OK
[4/6] log ............. OK
[5/6] remember ........ OK
[6/6] validate ........ OK

Ogu doctor: HEALTHY
  report   .ogu/DOCTOR.md
```

On failure, each failed step shows the error and a "Next action" hint.

**Strict mode** additionally checks:
- `API_Contracts.md`, `Navigation_Contract.md`, `Patterns.md` have no TODO markers
- `Repo_Map.md` has at least 15 non-empty lines

**Exit codes:** 0 = healthy, 11 = validate, 12 = repo-map, 13 = context, 14 = log, 15 = remember.

**Recommended workflow:** Run `ogu doctor` before starting any implementation to ensure the system is consistent.

### `ogu feature:create`

Creates a new feature directory under `docs/vault/04_Features/<slug>/` with four template files: `PRD.md`, `Spec.md`, `Plan.json`, `QA.md`. Idempotent — existing files are never overwritten.

```bash
node tools/ogu/cli.mjs feature:create user-auth
```

Output:
```
  created  PRD.md
  created  Spec.md
  created  Plan.json
  created  QA.md

Feature "user-auth": 4 files created, 0 skipped.
  path     docs/vault/04_Features/user-auth/
```

### `ogu feature:validate`

Validates that a feature is complete and ready for implementation.

```bash
node tools/ogu/cli.mjs feature:validate user-auth
```

Checks:
- All 4 files exist (`PRD.md`, `Spec.md`, `Plan.json`, `QA.md`)
- `Spec.md` contains no TODO markers
- `Plan.json` is valid JSON with at least one task

## What it creates

```
docs/vault/
  00_Index.md
  01_Architecture/
    Repo_Map.md, Module_Boundaries.md, Invariants.md, Patterns.md
  02_Contracts/
    API_Contracts.md, Navigation_Contract.md, SDUI_Schema.md
  03_ADRs/
    ADR_0001_template.md
  04_Features/
    README.md
  05_Runbooks/
    Dev_Setup.md, Release_Process.md

.ogu/
  SOUL.md, USER.md, IDENTITY.md, MEMORY.md, SESSION.md
  STATE.json, CONTEXT.md
  memory/.gitkeep
```

## Troubleshooting

**"Not inside a git repository"**
Run `git init` in the project root before using Ogu.

**validate fails with missing files**
Run `ogu init` first to create the structure.

**validate fails on Invariants.md**
Open `docs/vault/01_Architecture/Invariants.md` and replace the TODO comments with at least 5 real invariant rules under the `## Rules` section.

**STATE.json schema errors**
Delete `.ogu/STATE.json` and run `ogu init` again to regenerate it with the correct schema.

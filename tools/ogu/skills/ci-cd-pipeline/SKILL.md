---
name: ci-cd-pipeline
description: Compiler skill for the ci_cd_pipeline compiler. Activates when producing ci-cd-artifact.json. Gates: CIP001–CIP008. No upstream dependency.
---

# ci-cd-pipeline — Compiler Skill

## What This Compiler Does

Compiles the CI/CD pipeline specification — platform, triggers, stages, jobs, secret safety, quality gate enforcement, and deploy branch filters. Enforces: valid trigger types, every job references a declared stage, no cyclic dependencies, no literal secrets in YAML, build AND test/lint stages required, and deploy jobs have branch filters.

**Upstream dependency:** none
**Output artifact:** `ci-cd-artifact.json`
**IR identifier:** `CI_CD_PIPELINE:{project}`

---

## Spec Shape

```json
{
  "platform": "github",
  "triggers": ["push", "pull_request"],
  "stages": ["build", "test", "deploy"],
  "jobs": [
    {
      "name": "build-app",
      "stage": "build",
      "steps": ["npm ci", "npm run build"],
      "artifacts": ["dist/"]
    },
    {
      "name": "unit-tests",
      "stage": "test",
      "needs": ["build-app"],
      "steps": ["npm test"]
    },
    {
      "name": "deploy-staging",
      "stage": "deploy",
      "needs": ["unit-tests"],
      "steps": ["npm run deploy:staging"],
      "branches": ["main"]
    }
  ]
}
```

Required fields:
- `platform` — `github`, `gitlab`, `jenkins`, `circleci`, or `buildkite`
- `triggers` — non-empty array
- `stages` — non-empty array
- `jobs` — non-empty array, each with `name`, `stage`, and `steps`/`script`/`run`

---

## Gates

### CIP001 — spec-valid
Reads `ci-cd-spec.json`. Required: `platform` (valid), `triggers` (non-empty), `stages` (non-empty), `jobs` (non-empty). Each job must have `name`, a valid `stage`, and `steps`/`script`/`run`.

Hard-fails if `ci-cd-spec.json` is missing.

### CIP002 — trigger-defined
All trigger values must be valid: `push`, `pull_request`, `merge_request`, `schedule`, `manual`, `tag`, `workflow_dispatch`, `release`.

BAD:
```json
{ "triggers": ["on-commit"] }
// unrecognized trigger type
```
GOOD:
```json
{ "triggers": ["push", "pull_request"] }
```

### CIP003 — jobs-staged
Each job must reference a stage that exists in `spec.stages`. Dependencies declared via `needs`/`requires` must reference existing job names. Jobs without steps/script/run are rejected.

BAD:
```json
{
  "stages": ["build", "test"],
  "jobs": [{ "name": "deploy", "stage": "deploy" }]
}
// stage "deploy" not in stages array
```
GOOD: Every job's `stage` must appear in the `stages` array.

### CIP004 — no-cyclic-needs
Job dependency graph (via `needs`/`requires`) must be a DAG — no cycles. Cyclic dependencies cause pipelines to hang or error immediately.

BAD:
```json
{ "jobs": [
  { "name": "a", "needs": ["b"] },
  { "name": "b", "needs": ["a"] }
]}
// circular dependency
```

### CIP005 — no-secret-literals
Pipeline YAML/JSON files are scanned for literal credentials. Safe patterns are env var references: `${{ secrets.FOO }}`, `${VAR}`, `$VAR`, `$CI_*`, `vault:kv/...`. Bare string values matching credential patterns are rejected.

BAD:
```yaml
env:
  API_KEY: "sk-abc123realtoken"
```
GOOD:
```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### CIP006 — required-quality-gates
Pipeline must have:
- A job in a stage matching `build` (by name pattern)
- A job in a stage matching `test`, `lint`, or `check` (by name pattern)

BAD:
```json
{ "stages": ["deploy"], "jobs": [{ "name": "deploy-prod", "stage": "deploy" }] }
// no build or test stage
```
GOOD:
```json
{ "stages": ["build", "test", "deploy"] }
```

### CIP007 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### CIP008 — contract-pipeline
Final contract checks:
- Deploy jobs must declare branch filters via `branches`, `only`, `if`, or `when` — unrestricted deploy jobs run on every commit
- Pipelines with >3 jobs without timeouts are flagged
- Pipelines with >2 jobs and no `artifacts`/`cache` config are flagged

BAD:
```json
{ "jobs": [{ "name": "deploy-prod", "stage": "deploy", "steps": ["./deploy.sh"] }] }
// no branch filter on deploy job
```
GOOD:
```json
{ "jobs": [{ "name": "deploy-prod", "stage": "deploy", "branches": ["main"], "steps": ["./deploy.sh"] }] }
```

---

## What This Compiler Never Forgives

- `ci-cd-spec.json` missing (CIP001 hard-fails)
- `platform` not in valid list (CIP001)
- `triggers`, `stages`, or `jobs` missing or empty (CIP001)
- Any job `stage` not declared in `stages` array (CIP003)
- `needs`/`requires` referencing non-existent job (CIP003)
- Cyclic job dependencies (CIP004)
- Literal credentials in pipeline files (CIP005)
- No build stage in pipeline (CIP006)
- No test/lint stage in pipeline (CIP006)
- Deploy jobs with no branch filter (CIP008)

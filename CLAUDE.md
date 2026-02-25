# AI Compiler (Ogu)

A compiler pipeline that transforms ideas into fully working, tested, verified applications.

## Philosophy

- **Compiler, not task runner**: Every phase produces verified output for the next phase.
- **Correctness over speed**: Code must pass gates, not just look right.
- **Spec as contract**: Spec.md is law. Code that violates it is rejected.
- **Nothing manual**: Even after human review, Ogu updates automatically.
- **File-based only**: No databases, no external services. Everything is git-tracked plain files.

## Pipeline

```
/idea        → IDEA.md          (explore concept, set involvement level + visual style)
/feature     → PRD.md + Spec skeleton + QA.md  (product requirements + test plan)
/architect   → Spec.md + Plan.json  (technical architecture + implementation plan)
/preflight   → Verify health     (doctor, context, constraints check)
/lock        → Context lock      (verify or refresh context lock before coding)
/build       → Implementation    (task-by-task from Plan.json)
/build-parallel → Parallel build (DAG-based concurrent task execution)
/verify-ui   → UI audit          (every button, link, form works)
/smoke       → E2E tests         (write and run smoke tests)
/vision      → Visual verify     (DOM + screenshots + AI vision)
/enforce     → Contract check    (code matches vault contracts)
/preview     → Preview gate      (start services, verify health)
/done        → 10 gates          (automated completion verification)
/observe     → Production        (errors, analytics, uptime monitoring)
/pipeline    → Full autopilot    (runs entire pipeline end-to-end)
```

## Structure

- **Vault**: `docs/vault/` — architecture, contracts, ADRs, feature specs
- **Runtime**: `.ogu/` — STATE.json, CONTEXT.md, MEMORY.md, daily logs
- **Skills**: `.claude/skills/` — 15 skills for each pipeline phase
- **CLI**: `tools/ogu/cli.mjs` — 35 commands for automation
- **Global memory**: `~/.ogu/global-memory/` — cross-project patterns

## CLI Commands (35)

### Core pipeline
- `doctor` — full health check (runs validate, repo-map, context, lock, log, remember)
- `context` — assemble CONTEXT.md from vault and runtime memory
- `context:lock` — lock context/state/repo-map hashes
- `feature:create` — create feature directory with templates
- `feature:validate` — validate feature files (`--phase-1` after /feature, `--phase-2` after /architect)
- `gates` — run 10 completion gates with checkpoint/resume
- `preview` — start local preview and verify health

### Architecture & contracts
- `profile` — detect project platform and service needs
- `graph` — build project dependency graph (static, dynamic, style, API, config edges)
- `impact` — show what files are affected by a change
- `adr` — create Architecture Decision Records
- `contracts:validate` — validate contract files (no TODOs)
- `contract:version` — bump version on .contract.json files
- `contract:diff` — show structural changes in contracts
- `contract:migrate` — detect breaking changes and assess impact

### Visual & testing
- `vision` — run visual verification (DOM + screenshots)
- `vision:baseline` — manage vision baselines (record, update, list)

### Memory & learning
- `remember` — propose memory updates (`--apply` auto-apply, `--auto` auto-curate, `--prune` deduplicate)
- `learn` — extract patterns from completed features to global memory
- `recall` — query global memory for relevant cross-project patterns
- `trends` — analyze gate failure rates, completion times, production issues

### Orchestration & state
- `orchestrate` — build DAG from Plan.json for parallel execution (`--validate` for post-wave check)
- `wip` — show all features and their current phase
- `switch` — switch active feature context
- `status` — full project dashboard (feature, gates, theme, health, trends)

### Production
- `observe:setup` — configure production observation sources
- `observe` — fetch and analyze production data (`--create-tickets` auto-creates fix features)

### Theme
- `theme set <mood>` — set visual mood (cyberpunk, minimal, brutalist, playful, corporate, retro-pixel)
- `theme show` — display current theme
- `theme apply` — write tokens to design.tokens.json
- `theme presets` — list built-in presets

### Brand
- `brand-scan <url>` — scan website brand DNA: colors, fonts, spacing, tone, icons (`--deep`, `--apply`, `--soul`)
- `brand-scan list` — list all scanned brands
- `brand-scan apply <domain>` — apply scanned brand as project theme
- `brand-scan compare <d1> <d2>` — compare two brand scans side-by-side
- `reference <urls|files>` — composite design from inspiration sites, images, and PDFs (`--apply`, `--soul`)
- `reference show` — display current design reference
- `reference clear` — remove reference data

### Maintenance
- `init` — create Ogu directory structure and templates
- `validate` — validate Ogu structure and required files
- `log` — append entry to today's daily log
- `repo-map` — scan repo and update Repo_Map.md
- `clean` — remove old logs, orchestration files, vision artifacts (`--dry-run`)
- `migrate` — migrate .ogu/ structure to latest version (`--dry-run`)

## Key Rules

- Invariants always win. Code bends to invariants, never the other way.
- Contracts are law until changed by ADR.
- CONTEXT.md is generated — never hand-edit.
- Every feature needs PRD → Spec → Plan → Build → Gates.
- Default stack from `docs/vault/01_Architecture/Default_Stack.md`. Deviations require ADR.

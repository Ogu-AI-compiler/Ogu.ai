# AI Compiler (Ogu)

A compiler pipeline that transforms ideas into fully working, tested, verified applications.

## Philosophy

- **Compiler, not task runner**: Every phase produces verified output for the next phase.
- **Correctness over speed**: Code must pass compilation, not just look right.
- **Spec as contract**: Spec.md is law. Code that violates it is rejected.
- **IR as source of truth**: Everything validates against the Product IR (Plan.json inputs/outputs).
- **Nothing manual**: Even after human review, Ogu updates automatically.
- **File-based only**: No databases, no external services. Everything is git-tracked plain files.

## Pipeline

```
/idea        → IDEA.md          (explore concept, set involvement level + visual style + design mode)
/feature     → PRD.md + Spec skeleton + QA.md  (product requirements + test plan)
/architect   → Spec.md + Plan.json + IR  (technical architecture + implementation plan + product IR)
/design      → DESIGN.md        (visual identity, design assertions, anti-generic variants)
/preflight   → Verify health     (doctor, context, constraints check)
/lock        → Context lock      (verify or refresh context lock before coding)
/build       → Implementation    (task-by-task from Plan.json with IR pre/post checks)
/build-parallel → Parallel build (DAG-based concurrent task execution)
/verify-ui   → UI audit          (every button, link, form works)
/smoke       → E2E tests         (write and run smoke tests)
/vision      → Visual verify     (DOM + screenshots + AI vision + design assertions)
/enforce     → Contract check    (code matches vault contracts via IR)
/preview     → Preview gate      (start services, verify health)
/done        → ogu compile       (single compilation entry point, 14 gates, formal error codes)
/observe     → Production        (errors, analytics, uptime monitoring + drift detection)
/pipeline    → Full autopilot    (runs entire pipeline end-to-end)
```

## Structure

- **Vault**: `docs/vault/` — architecture, contracts, ADRs, feature specs, design directions
- **Runtime**: `.ogu/` — STATE.json, CONTEXT.md, MEMORY.md, daily logs
- **Skills**: `.claude/skills/` — 16 skills for each pipeline phase (including /design)
- **CLI**: `tools/ogu/cli.mjs` — 40 commands for automation
- **Shared libs**: `tools/ogu/commands/lib/` — normalize-ir, errors, ir-registry, drift-verifiers
- **Global memory**: `~/.ogu/global-memory/` — cross-project patterns

## CLI Commands (40)

### Core pipeline
- `compile <slug>` — **single compilation entry point** (`--fix`, `--gate N`, `--verbose`)
- `doctor` — full health check (runs validate, repo-map, context, lock, log, remember)
- `context` — assemble CONTEXT.md from vault and runtime memory
- `context:lock` — lock context/state/repo-map/spec hashes
- `feature:create` — create feature directory with templates
- `feature:validate` — validate feature files (`--phase-1` after /feature, `--phase-2` after /architect, includes IR validation)
- `gates` — run 14 completion gates with checkpoint/resume
- `spec:patch` — create Spec Change Record (SCR) with hash chain
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
- `vision` — run visual verification (DOM + screenshots + design assertions)
- `vision:baseline` — manage vision baselines (record, update, list)
- `drift <slug>` — detect drift from spec, contracts, IR outputs, and design tokens

### Design
- `design:show <slug>` — show design variant summaries for quick selection
- `design:pick <slug> <N>` — apply chosen design variant and amplify

### Memory & learning
- `remember` — propose memory updates (`--apply` auto-apply, `--auto` auto-curate, `--prune` deduplicate)
- `learn` — extract patterns from completed features to global memory
- `recall` — query global memory for relevant cross-project patterns
- `trends` — analyze gate failure rates, completion times, production issues

### Orchestration & state
- `orchestrate` — build DAG from Plan.json for parallel execution (resource conflict detection, `--validate`)
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
- IR is the single source of truth. Spec, Plan, Code, and Drift all validate against IR.
- CONTEXT.md is generated — never hand-edit.
- Every feature needs PRD → Spec → Plan → Design → Build → Compile.
- Default stack from `docs/vault/01_Architecture/Default_Stack.md`. Deviations require ADR.
- `ogu compile` is the canonical verification command. Error codes (OGU####) are formal and greppable.

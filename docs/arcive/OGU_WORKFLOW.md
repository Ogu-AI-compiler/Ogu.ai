# Ogu — Complete Workflow Reference

## What is Ogu?

A **compiler pipeline** that transforms product ideas into fully working, tested, verified applications. Not a task runner — a deterministic system where every phase produces verified output for the next phase.

Named after John Ugochukwu Ogu — Nigerian midfielder who became a legend at Hapoel Beer Sheva. Arrived in 2014 for a trial after barely playing 139 minutes. Proceeded to win championships and earn the nickname "Ogu Meshuga" for his wild celebrations.

---

## Philosophy

| Principle | Meaning |
|-----------|---------|
| **Compiler, not task runner** | Every phase produces verified output for the next phase |
| **IR as source of truth** | Everything validates against the Product IR (Plan.json inputs/outputs/resources) |
| **Correctness over speed** | Code must pass compilation, not just look right |
| **Spec as contract** | Spec.md is law. Code that violates it is rejected |
| **Nothing manual** | Even after human review, Ogu updates automatically |
| **File-based only** | No databases, no external services. Everything is git-tracked plain files |

---

## Pipeline Overview

```
/idea → /feature → /architect → /design → /preflight → /lock → /build → /verify-ui → /smoke → /vision → /enforce → /preview → /done → /observe
```

Each arrow means: the output of the left phase is the **verified input** of the right phase. No skipping.

**Compilation:** `ogu compile <slug>` is the single entry point that verifies everything. `/done` calls it.

---

## Memory Architecture

Ogu has two memory layers that work together:

### Layer A: Knowledge Vault (`docs/vault/`)

Long-term, stable, source of truth. Obsidian-style markdown files organized by topic.

```
docs/vault/
├── 00_Index.md                          # Root index
├── 01_Architecture/
│   ├── System_Overview.md               # How the two layers work
│   ├── Default_Stack.md                 # Technology choices (TS, Next.js, Fastify, etc.)
│   ├── Invariants.md                    # Non-negotiable rules (30 rules)
│   ├── Module_Boundaries.md             # Domain ← Application ← Infrastructure
│   ├── Patterns.md                      # Naming, file org, API patterns, auth, testing
│   ├── Repo_Map.md                      # Auto-generated codebase map
│   └── Build_vs_Buy.md                  # Decision framework for external services
├── 02_Contracts/
│   ├── API_Contracts.md                 # Endpoint definitions
│   ├── Navigation_Contract.md           # Routes and routing rules
│   ├── SDUI_Schema.md                   # Server-Driven UI schema
│   ├── Design_System_Contract.md        # shadcn/ui vs Tamagui decision rules
│   ├── Ogu_Memory_Contract.md           # How memory files work
│   ├── Preview_Contract.md              # How preview must work
│   ├── Artifact_Contract.md             # Required project structure
│   ├── Deploy_Packs.md                  # Deployment target configurations
│   ├── api.contract.json                # Machine-readable API schema
│   ├── navigation.contract.json         # Machine-readable routes
│   └── design.tokens.json               # Design tokens (colors, spacing, fonts)
├── 03_ADRs/
│   ├── ADR_0001_template.md             # Template for decisions
│   ├── ADR_0002_*.md                    # File-based memory over SQLite
│   └── ADR_0003_*.md                    # Deterministic context assembly
├── 04_Features/
│   └── <slug>/                          # Per-feature directory
│       ├── IDEA.md                      # Concept exploration
│       ├── PRD.md                       # Product requirements
│       ├── Spec.md                      # Technical specification
│       ├── Plan.json                    # Implementation tasks (with Product IR)
│       ├── QA.md                        # Test scenarios
│       ├── DESIGN.md                    # Visual identity and design direction
│       └── SCR_NNN_*.md                 # Spec Change Records (hash chain)
└── 05_Runbooks/
    ├── Dev_Setup.md                     # How to set up locally
    ├── Release_Process.md               # How to release
    └── Error_Codes.md                   # Formal OGU error code reference
```

### Layer B: Runtime Memory (`.ogu/`)

Operational state that changes frequently. Working memory for the agent.

```
.ogu/
├── SOUL.md                  # Core identity, brand reference, philosophy
├── USER.md                  # Project owner preferences
├── IDENTITY.md              # Ogu's operating role and behavior rules
├── MEMORY.md                # Curated long-term facts (not raw logs)
├── SESSION.md               # Current session scratch (overwritten each session)
├── STATE.json               # Machine-readable state (current_task, timestamps)
├── CONTEXT.md               # ⚡ Assembled context (GENERATED — never hand-edit)
├── CONTEXT_LOCK.json        # SHA-256 hashes for staleness detection
├── DOCTOR.md                # Last health check report
├── PROFILE.json             # Platform detection (web/mobile, service needs)
├── THEME.json               # Visual mood and design tokens
├── GRAPH.json               # File dependency graph
├── GATE_STATE.json          # Completion gate checkpoint
├── METRICS.json             # Feature metrics and gate results
├── MEMORY_PROPOSAL.md       # Proposed memory updates (before --apply)
├── REFERENCE.json           # Composite design direction from references
├── OBSERVE.json             # Production observation source config
├── OBSERVATION_REPORT.md    # Latest production observation
├── DRIFT_REPORT.md          # Latest drift detection report
├── TRENDS.md                # Gate failure rates, completion trends
├── memory/
│   └── YYYY-MM-DD.md        # Daily logs (Summary, Actions, Decisions, Notes)
├── brands/
│   └── <domain>.json        # Brand DNA scans (colors, fonts, tone)
├── vision/
│   └── <slug>/              # Visual verification data per feature
└── orchestrate/
    └── <slug>/PLAN_DAG.json # Parallel execution DAG
```

### How They Work Together

```
Vault (brain)      →  CONTEXT.md  →  Agent reads before every action
Runtime (working)  ↗
```

`ogu context` assembles CONTEXT.md from both layers in a fixed, deterministic order:

| Priority | Section | Source |
|----------|---------|--------|
| P1 (highest) | Invariants | `docs/vault/01_Architecture/Invariants.md` |
| P1 | Feature Spec | `docs/vault/04_Features/<slug>/Spec.md` |
| P1 | Feature Contracts | Relevant contract files |
| P2 | Memory | `.ogu/MEMORY.md` |
| P2 | Repo Map | `docs/vault/01_Architecture/Repo_Map.md` |
| P2 | Design Theme | `.ogu/THEME.json` |
| P2 | Project Profile | `.ogu/PROFILE.json` |
| P3 | Patterns | `docs/vault/01_Architecture/Patterns.md` |
| P3 | All Contracts | `docs/vault/02_Contracts/*` |
| P4 (lowest) | Recent Logs | Last 2 daily logs |

Same git commit = same CONTEXT.md. Always.

---

## Pipeline Phases — Detailed

### Phase 1: `/idea` — Concept Exploration

**Trigger:** "I have an idea", "build me an app", user describes a concept

**What it does:**
1. Reads existing CONTEXT.md (if exists) to respect invariants
2. Classifies the idea as **broad** (needs research) or **specific** (ready to detail)
3. Asks about involvement level:
   - **Autopilot** — Ogu decides everything, user reviews at end
   - **Guided** — Ogu proposes, user confirms at checkpoints
   - **Product-focused** — Detailed summaries, user gives product feedback
   - **Hands-on** — Show every file, explain every choice, get approval
4. Explores design preferences (layout, colors, brand references)
5. For broad ideas: researches 3-4 approaches, narrows down
6. For specific ideas: details screens, personas, journeys, features, scope
7. Conducts risk/gaps review

**Creates:**
- `docs/vault/04_Features/<slug>/IDEA.md`
- Updates `.ogu/STATE.json` with current_task

**CLI commands used:**
- `ogu profile` (if first feature)
- `ogu feature:create <slug>`
- `ogu brand-scan <url> --apply` (optional, if brand URL given)
- `ogu theme set <mood>` (optional)
- `ogu reference <urls> --apply` (optional)
- `ogu log "Created idea: ..."`

**Invariants status:** READ (if context exists) — not modified yet

---

### Phase 2: `/feature` — Product Requirements

**Trigger:** "spec this feature", "create feature", after `/idea`

**What it does:**
1. Gets feature slug from arguments or STATE.json
2. Reads IDEA.md (if exists)
3. Fills **PRD.md** — product requirements with concrete, testable statements
4. Fills **Spec.md skeleton** — product-facing sections only. Technical sections left with `<!-- TO BE FILLED BY /architect -->` markers
5. Fills **QA.md** — test scenarios traced to PRD requirements
6. Validates via `ogu feature:validate <slug>`

**Creates:**
- `docs/vault/04_Features/<slug>/PRD.md`
- `docs/vault/04_Features/<slug>/Spec.md` (skeleton)
- `docs/vault/04_Features/<slug>/QA.md`

**Key rule:** This is a product phase. No technical decisions yet. Spec.md has placeholders for `/architect` to fill.

**Invariants status:** READ — not modified

---

### Phase 3: `/architect` — Technical Architecture

**Trigger:** "architect", "design the system", "tech spec", after `/feature`

**What it does:**
1. Reads CONTEXT.md, Default_Stack.md, Build_vs_Buy.md, Module_Boundaries.md, Patterns.md, PRD.md, Spec.md skeleton
2. Determines scope (new project vs new feature in existing project)
3. Selects stack (uses defaults unless deviation — deviation requires ADR)
4. Evaluates module boundaries (new modules? dependencies? layer violations?)
5. Build vs Buy for sensitive categories (payments, auth, email, video, etc.)
6. **Fills Spec.md technical sections:**
   - Data Model (entities, relationships, validation)
   - API endpoints (routes, request/response schemas)
   - Mock API (in-memory implementation)
   - UI Components (hierarchy, interactions, tokens)
7. Removes `<!-- TO BE FILLED BY /architect -->` markers
8. **Creates Plan.json** — ordered tasks with groups, dependencies, `done_when` conditions, `touches` (files each task modifies), and **Product IR fields** (`inputs`, `outputs`, `resources`)
9. Builds dependency graph via `ogu graph`
10. Bumps contract versions if modified
11. **Generates Invariants** from architectural decisions — including **Design Rules** (machine-verifiable visual constraints)

**Creates/Updates:**
- `docs/vault/04_Features/<slug>/Spec.md` (fully filled)
- `docs/vault/04_Features/<slug>/Plan.json`
- `docs/vault/01_Architecture/Invariants.md` (5-12 rules derived from decisions)
- `.ogu/GRAPH.json`
- ADR files (if deviations from defaults)

**Plan.json structure (with Product IR):**
```json
{
  "feature": "<slug>",
  "tasks": [
    {
      "id": 1,
      "title": "Set up database schema",
      "group": "foundation",
      "depends_on": [],
      "spec_section": "## Data Model",
      "touches": ["packages/db/schema.prisma"],
      "done_when": "Schema file exists with all entities from Spec",

      "inputs": ["CONTRACT:user-schema"],
      "outputs": ["SCHEMA:users-table", "SCHEMA:tasks-table"],
      "resources": ["SCHEMA:prisma"]
    }
  ]
}
```

**Product IR fields** (all optional — backward compatible):
- `inputs` — what the task consumes: `TYPE:identifier`
- `outputs` — what the task produces: `TYPE:identifier`
- `resources` — what the task locks: `TYPE:identifier`

**IR Types:** `CONTRACT`, `API`, `ROUTE`, `SCHEMA`, `COMPONENT`, `TOKEN`, `FILE`, `TEST`

**IR is the single source of truth.** All validation (spec coverage, code verification, drift detection, contract checks) routes through the IR. See [Error Codes](../docs/vault/05_Runbooks/Error_Codes.md) for formal error codes.

**Invariants generation rules:**
- Derived from actual architectural decisions (stack, modules, data model, API)
- Written as negative constraints ("must not", "never", "only through")
- Concrete and verifiable (not vague)
- If Invariants.md already has rules: merge, don't duplicate
- Minimum 5 rules, aim for 8-12

**Invariants status:** **WRITTEN** — first population with real rules

---

### Phase 3.5: `/design` — Design Direction

**Trigger:** "design this feature", "visual direction", after `/architect`

**What it does:**
1. Reads Spec.md (UI sections), THEME.json, REFERENCE.json (if exists), IDEA.md (design preferences)
2. Branches on `design_mode` from STATE.json:
   - **standard** — produces one design direction (default)
   - **bold** — produces 3 wildly different directions, user picks one
   - **extreme** — bold + hard limits ("max 2 colors", "single font weight")
3. Produces `DESIGN.md` with: Color System, Typography Hierarchy, Layout Rhythm, Motion Philosophy, Component DNA, Forbidden Patterns, Component Exemplars, **Design Assertions**
4. Design assertions become machine-verifiable checks consumed by `/vision`

**Creates:**
- `docs/vault/04_Features/<slug>/DESIGN.md`

**Anti-generic mode (bold/extreme):**
- 3 variants generated: safe, unexpected, extreme contrast
- `ogu design:show <slug>` — prints one-liner summary of each variant
- `ogu design:pick <slug> <N>` — applies chosen variant, amplifies it
- Selected variant stored in DESIGN.md header: `**Variant:** N (amplified)`

**Design Assertions (in DESIGN.md):**
- `measurable` — checked via Playwright DOM inspection at 1280x720 viewport
- `visual` — AI vision with boolean PASS/FAIL answer
- `critical: true` — must pass (100% required)
- `critical: false` — contributes to pass rate (≥80% threshold)

---

### Phase 4: `/preflight` — Health Check

**Trigger:** "preflight", "check before building", "is everything ready"

**What it does:**
1. Runs `ogu doctor` (full health check) — **STOP if fails**
2. Queries cross-project patterns via `ogu recall`
3. Builds context via `ogu context --feature <slug>`
4. Reads CONTEXT.md in full
4.5. Checks if `DESIGN.md` exists — warns if missing ("Consider running `/design <slug>`")
5. Extracts and **displays all constraints:**
   - Project Profile (platform, services)
   - **All invariants** (listed individually — never summarized)
   - Relevant contracts
   - Design theme and design direction summary
   - Relevant patterns

**Creates:** Nothing (verification only)

**Key rule:** Never skip or summarize invariants. Every single rule is listed.

**Invariants status:** READ and DISPLAYED to user

---

### Phase 5: `/lock` — Context Lock

**Trigger:** "lock context", "check lock", before coding

**What it does:**
1. Checks if CONTEXT_LOCK.json exists
2. If not: builds context and locks
3. If exists: validates hashes match current files
4. If stale: rebuilds context and re-locks
5. Outputs lock status with hashes and timestamp

**Creates/Updates:**
- `.ogu/CONTEXT_LOCK.json` (SHA-256 hashes)
- `.ogu/CONTEXT.md` (rebuilt if stale)

**Purpose:** Guarantees the context hasn't changed between preflight and build. Prevents building against outdated invariants/contracts.

---

### Phase 6: `/build` — Implementation

**Trigger:** "build", "implement", "start coding", after preflight

**What it does:**
1. Confirms preflight passed, reads CONTEXT.md
2. Reads Spec.md, Plan.json, QA.md
3. Runs `ogu feature:validate <slug> --phase-2` — **STOP if fails**
4. **For each task in Plan.json** (respecting `depends_on` order):
   - Announces task
   - **Pre-check:** Verify IR `inputs` exist (produced by prior tasks or pre-existing)
   - Reads relevant `spec_section` from Spec.md
   - Reads DESIGN.md if exists (for visual direction)
   - Implements code following contracts and invariants
   - **Post-check:** Verify IR `outputs` are present in codebase
   - Verifies `done_when` condition met
   - Logs task completion
5. After each group: checkpoint based on involvement level
   - Autopilot: log and continue
   - Guided: summarize, ask to continue
   - Product-focused: detailed summary, feedback
   - Hands-on: show every file, explain, get approval
6. After ALL tasks: full verification checklist

**Verification checklist:**
- All handlers have real logic (not empty, not just console.log)
- All routes exist and connected
- All UI actions wired to real behavior
- No TODO/FIXME/placeholder code
- Code respects all invariants
- Code follows patterns from Patterns.md
- Code conforms to contracts

**Invariants status:** READ and **ENFORCED** — any violation causes STOP

**Critical rule:** "Invariants always win. If a task would violate an invariant, STOP and tell the user."

---

### Phase 6b: `/build-parallel` — Parallel Build (Alternative)

**Trigger:** "build parallel", "build fast", for features with many independent tasks

Same as `/build` but uses DAG-based concurrent execution:

1. Builds DAG via `ogu orchestrate <slug>` (Kahn's algorithm)
2. Groups tasks into **waves** by dependency level
3. Tasks in the same wave with no file conflicts **and no resource conflicts** run in parallel
4. Resource conflicts: same `resources[]` entry, wildcard match (`CONTRACT:*`), or route prefix match (`ROUTE:/users` conflicts with `ROUTE:/users/:id`)
5. After each wave: validates, checks for conflicts, runs typecheck
6. All same verification rules as `/build`

**Creates additionally:**
- `.ogu/orchestrate/<slug>/PLAN_DAG.json`

---

### Phase 7: `/verify-ui` — UI Audit

**Trigger:** "check UI", "verify buttons", "no dead buttons", after build

**What it does:**
1. Finds all interactive elements (onClick, onSubmit, onChange, href, Link)
2. For each element, verifies ONE of:
   - Handler exists with real logic (not empty/console.log/TODO)
   - Navigation route exists (resolves to real component)
   - API call exists (real endpoint)
3. Reports each element as VALID or INVALID
4. Traces through indirection (button → handler → handler → empty = INVALID)

**Creates:** Nothing (verification only)

**Key rule:** No dead buttons. No `href="#"`. No empty handlers. Period.

---

### Phase 8: `/smoke` — E2E Tests

**Trigger:** "smoke test", "write e2e", "test this feature", after build

**What it does:**
1. Reads PRD.md, Spec.md, QA.md
2. Detects platform and test framework:
   - Web: Playwright (default)
   - React Native/Expo: Detox or Maestro
3. Plans ONE happy path flow (3-6 steps) from PRD/Spec/QA
4. Writes test file with real assertions
5. Ensures testIDs exist on all interactive elements
6. Runs test locally if possible

**Creates:**
- `tests/e2e/<slug>.smoke.spec.ts` (Playwright)
- `e2e/detox/<slug>.smoke.test.ts` (Detox)
- `e2e/maestro/<slug>_smoke.yaml` (Maestro)

**Key rule:** Every interaction has an assertion after it. No render-only tests. No stubs.

---

### Phase 9: `/vision` — Visual Verification

**Trigger:** "check visuals", "does it look right", after build + preview

**What it does (3 tiers):**

| Tier | Method | What it checks |
|------|--------|----------------|
| Tier 1 | DOM assertions (Playwright at 1280x720) | Selectors exist, text present, layout correct, **measurable design assertions** |
| Tier 2 | Screenshot capture | Captures current UI to `.ogu/vision/<slug>/current/` |
| Tier 3 | AI Vision (structured boolean) | Reads screenshots, answers specific PASS/FAIL questions from design assertions |

**Measurable assertions (Tier 1, DOM-based):**
- Text contrast ≥ 4.5:1 on solid backgrounds (scoped to `[data-testid]` elements)
- Border-radius count (unique values on `[data-testid]`, ignoring `0px`)
- Typography hierarchy (`fontSize` descends: H1 > H2 > H3 > body)
- Spacing from tokens (`margin`/`padding` vs token set, ±2px tolerance)

**Visual assertions (Tier 3, AI vision):**
- Each `visual` type assertion from DESIGN.md becomes a specific boolean question
- "Is the primary CTA button using the primary color (#hex)? PASS or FAIL."
- No open-ended "does it look good?" — every question has a concrete answer

**Critical vs non-critical:**
- `critical: true` → must pass (100% required)
- `critical: false` → contributes to pass rate (≥80% threshold)
- Gate 9 fails if ANY critical assertion fails OR non-critical rate < 80%

For each screen, rated: **PASS / WARN / FAIL**

**Creates:**
- `.ogu/vision/<slug>/VISION_SPEC.json` (includes `design_assertions[]`)
- `.ogu/vision/<slug>/VISION_REPORT.md` (includes per-screen assertion tables)
- `.ogu/vision/<slug>/current/*.png`
- `.ogu/vision/<slug>/baseline/*.png` (first run)

---

### Phase 10: `/enforce` — Contract Check

**Trigger:** "check contracts", "enforce", "verify invariants", after build

**What it does:**
1. **Checks IR completeness first** via `ogu compile <slug> --gate 3`
2. Reads ALL vault rules:
   - `Invariants.md` (every rule under ## Rules, including ## Design Rules)
   - `API_Contracts.md`
   - `Navigation_Contract.md`
   - `SDUI_Schema.md`
   - `Patterns.md`
   - `DESIGN.md` (if exists)
3. Validates contracts are clean: `ogu contracts:validate` — **STOP if TODOs found**
4. Checks for contract drift: `ogu contract:diff`
5. **Scans implementation against IR:**
   - Every IR output present in codebase (drift verifiers)
   - Every contract entry maps to an IR output
   - Every invariant checked against code
   - Colors/spacing/fonts use tokens only
   - Code follows established patterns
6. Reports each rule as PASS or VIOLATION (with formal OGU error codes)
7. On violation: **STOP** — user must either fix code or create ADR

**Creates:** ADR files (if violations need contract changes)

**Key rule:** Contracts are law until changed by ADR. No silent violations.

---

### Phase 11: `/preview` — Preview Gate

**Trigger:** "preview", "show me", "run it", after build

**What it does:**
1. Verifies artifact structure (apps/web/, apps/mock-api/, docker-compose.yml)
2. Copies .env.example to .env if needed
3. Starts services via `ogu preview` (Docker Compose or pnpm)
4. Waits for health endpoints (60 seconds timeout)
5. Reports HEALTHY or FAILED

**Creates:**
- `.ogu/PREVIEW.md` (health report)

**Success criteria:**
- Web reachable at `/api/health`
- Mock API reachable at `/health`
- Web talks to mock-api
- No crash loops
- All health checks pass

---

### Phase 12: `/done` — Compilation

**Trigger:** "is it done", "mark complete", "finish feature", "ship it"

Runs `ogu compile <slug>` — the single compilation entry point. This replaces running gates individually.

**Compilation phases (sequential):**

| Phase | Name | What it checks |
|-------|------|----------------|
| 1 | **IR Load** | Load Plan.json, build IR registry, validate completeness |
| 2 | **Spec Consistency** | Hash chain validation (SCR traversal), spec↔IR coverage |
| 3 | **IR Validation** | Input chain, duplicate outputs, resource conflicts |
| 4 | **Code Verification** | No TODOs, IR outputs present in codebase, contract consistency |
| 5 | **Design Verification** | Design invariants, design token drift (if DESIGN.md exists) |
| 6 | **Runtime Verification** | UI functional, vision assertions, preview health (if app running) |

**Error codes:** Every issue produces a formal error code (`OGU####`). See `docs/vault/05_Runbooks/Error_Codes.md`.

**Output:**
```
Ogu Compiler v1.0.0 — compiling "my-feature"

Phase 1: IR Load .................. ✔ (12 tasks, 34 outputs)
Phase 2: Spec Consistency ......... ✔ (hash chain valid, 8/8 sections covered)
Phase 3: IR Validation ............ ✔ (all inputs resolved, no duplicates)
Phase 4: Code Verification ........ ✔ (34/34 outputs present, 0 TODOs)
Phase 5: Design Verification ...... ✔ (all invariants satisfied)
Phase 6: Runtime Verification ..... ✔ (UI functional, vision 100%, preview healthy)

────────────────────────────────────
Compilation PASSED ✔ — 0 error(s), 0 warning(s)

Feature "my-feature" is production-ready.
```

**Useful commands:**
```bash
ogu compile <slug> --verbose     # Show per-phase detail
ogu compile <slug> --gate 3      # Stop at phase 3
ogu compile <slug> --fix          # Attempt auto-fix for fixable errors
ogu gates status <slug>           # Show gate checkpoint state
ogu gates run <slug> --gate 13    # Run specific gate (for debugging)
```

**Individual gates (14 total):** Still available via `ogu gates run` for debugging:

| Gate | Name | What it checks |
|------|------|----------------|
| 1 | Doctor | Full health check |
| 2 | Context Lock | Hash validation |
| 3 | Plan Tasks | IR output verification + done_when |
| 4 | No TODOs | Grep for TODO/FIXME/HACK/XXX |
| 5 | UI Functional | No empty handlers, no stubs |
| 6 | Design Compliance | Design invariants from Invariants.md |
| 7 | Brand Consistency | Brand color/font token matching |
| 8 | Smoke Test | E2E tests run and pass |
| 9 | Vision | 3-tier visual verification with design assertions |
| 10 | Contracts | Contract files valid, IR cross-referenced |
| 11 | Preview | Preview healthy, services up |
| 12 | Memory | Auto-apply memory updates |
| 13 | Spec Consistency | SCR hash chain + spec↔IR coverage |
| 14 | Drift Check | IR output drift, contract drift, design drift |

**After compilation passes:**
- Runs `ogu learn` (extract patterns to global memory)
- Runs `ogu trends` (update trend analysis)
- Clears current_task in STATE.json
- Logs completion

**Key rule:** Compilation must pass with 0 errors. Warnings are allowed but should be addressed.

---

### Phase 13: `/observe` — Production Monitoring

**Trigger:** "check production", "any errors?", after deployment

**What it does:**
1. Checks observation sources configured (Sentry, analytics, uptime, custom)
2. Fetches events from all enabled sources
3. **Runs drift detection** on active feature: `ogu drift <slug>`
4. Deduplicates against known issues
5. Correlates with releases (which deploy caused this?)
6. Classifies ownership (which module/feature owns this error?)
7. Includes drift findings in observation report
8. Recommends actions for high-severity events
9. Optionally creates fix features with `--create-tickets`

**Drift detection checks:**
- IR output drift (per-TYPE verifiers)
- Contract drift (.contract.json vs implementation)
- Design drift (design.tokens.json vs computed styles)
- Plan drift (touched files still exist)
- Untracked files (new files not in any task's touches[])

---

### Meta: `/pipeline` — Full Autopilot

**Trigger:** "autopilot", "run pipeline", "full pipeline", "end to end"

Runs 8 stages in order, stopping at first failure:

```
Stage 1: Doctor (health check)
Stage 2: Feature validation phase-1 (PRD.md exists)
Stage 3: Architect validation phase-2 (Plan.json + IR valid)
Stage 4: Design direction (DESIGN.md — warn if missing)
Stage 5: Preflight (context + constraints)
Stage 6: Build (implement all tasks with IR pre/post checks)
Stage 7: Compilation (ogu compile — all 6 phases)
Stage 8: Post-completion (learn, trends, log, clear)
```

**Requires:** `/feature` and `/architect` already completed before running.

---

### Special: `/onboard` — Existing Project Setup

**Trigger:** "onboard this project", "learn my codebase", "set up Ogu here"

For bringing an existing codebase into Ogu. 6 phases:

1. **Scaffolding** — Create `.ogu/` and vault structure
2. **Deep Analysis** — Read package.json, framework configs, source files, detect patterns
3. **Populate Vault** — Write Default_Stack.md, Invariants.md (from code patterns), Patterns.md, Module_Boundaries.md, contracts
4. **Populate Runtime** — PROFILE.json, THEME.json, SOUL.md, USER.md, MEMORY.md
5. **Verify** — Build context, lock, run doctor
6. **Report** — Summary to user

---

## Invariants Lifecycle

The most important file in the system. Here's exactly when it's touched:

```
ogu init       → CREATE skeleton (empty TODOs)
/idea          → READ (if context exists) — respect existing rules
/feature       → READ — don't violate existing rules
/architect     → WRITE (Step 9) — populate with 5-12 real rules + Design Rules ← FIRST POPULATION
/design        → READ — design assertions reference invariant constraints
/preflight     → READ — display every single rule to user
/lock          → (indirect) — included in context hash
/build         → ENFORCE — any violation = STOP
/enforce       → AUDIT — check every rule against code via IR, report PASS/VIOLATION
/done          → COMPILE — ogu compile validates all invariants via formal error codes
/onboard       → REPOPULATE — derive from existing code patterns
```

**Key insight:** `/idea` and `/feature` run without real invariants. This is intentional — they are product phases. Architectural rules only exist after `/architect` makes technical decisions.

---

## CLI Commands (40 total)

### Core Pipeline
| Command | Purpose |
|---------|---------|
| `ogu compile <slug>` | **Single compilation entry point** — runs all 6 phases |
| `ogu init` | Create full directory structure with templates (idempotent) |
| `ogu validate` | Verify structure completeness and schema validity |
| `ogu doctor` | Full health check (7 sequential steps) |
| `ogu context --feature <slug>` | Assemble CONTEXT.md from vault + runtime |
| `ogu context:lock` | Lock context/state/repo-map hashes (includes spec_hashes) |
| `ogu log "text"` | Append to daily log and SESSION.md |
| `ogu repo-map` | Auto-generate Repo_Map.md from codebase |

### Architecture & Contracts
| Command | Purpose |
|---------|---------|
| `ogu profile` | Detect platform (web/mobile) and service needs |
| `ogu graph` | Build file dependency graph (imports, API calls, styles) |
| `ogu impact <file>` | Show what files are affected by a change (BFS) |
| `ogu adr "Title"` | Create numbered Architecture Decision Record |
| `ogu contracts:validate` | Check contract files have no TODOs |
| `ogu contract:version` | Bump semver on .contract.json files |
| `ogu contract:diff` | Show structural changes (breaking vs non-breaking) |
| `ogu contract:migrate` | Detect breaking changes and assess impact |

### Feature Management
| Command | Purpose |
|---------|---------|
| `ogu feature:create <slug>` | Create feature directory with templates |
| `ogu feature:validate <slug>` | Validate feature files (`--phase-1` or `--phase-2`, includes IR validation) |
| `ogu spec:patch <slug> "desc"` | Create Spec Change Record (SCR) with hash chain |
| `ogu gates run <slug>` | Run 14 completion gates with checkpoint/resume |
| `ogu gates status <slug>` | Show current gate state |
| `ogu gates reset <slug>` | Clear checkpoint |

### Visual & Testing
| Command | Purpose |
|---------|---------|
| `ogu vision <slug>` | Run 3-tier visual verification (with design assertions) |
| `ogu vision baseline record <slug>` | Capture baseline screenshots |
| `ogu vision baseline list <slug>` | List recorded baselines |
| `ogu drift <slug>` | Detect drift from IR outputs, contracts, design tokens |
| `ogu preview` | Start local preview, verify health |

### Design
| Command | Purpose |
|---------|---------|
| `ogu design:show <slug>` | Print variant summaries for quick selection |
| `ogu design:pick <slug> <N>` | Apply chosen variant, amplify, write DESIGN.md |

### Memory & Learning
| Command | Purpose |
|---------|---------|
| `ogu remember` | Propose memory updates from logs |
| `ogu remember --apply` | Auto-apply candidates to MEMORY.md |
| `ogu remember --prune` | Remove duplicates and stale entries |
| `ogu learn` | Extract patterns to global memory (`~/.ogu/global-memory/`) |
| `ogu recall` | Query global memory for relevant patterns |
| `ogu trends` | Analyze gate failure rates, completion times |

### Orchestration & State
| Command | Purpose |
|---------|---------|
| `ogu orchestrate <slug>` | Build DAG from Plan.json for parallel execution |
| `ogu wip` | Show all features and their current phase |
| `ogu switch <slug>` | Switch active feature context |
| `ogu status` | Full project dashboard |
| `ogu phase` | Show current pipeline phase for active feature |

### Theme & Brand
| Command | Purpose |
|---------|---------|
| `ogu theme set <mood>` | Set visual mood (cyberpunk, minimal, brutalist, playful, corporate, retro-pixel) |
| `ogu theme show` | Display current theme |
| `ogu theme apply` | Write tokens to design.tokens.json |
| `ogu brand-scan <url>` | Extract brand DNA from website (colors, fonts, tone, icons) |
| `ogu brand-scan <url> --deep` | Deep scan with Playwright DOM sampling |
| `ogu brand-scan list` | List all scanned brands |
| `ogu brand-scan compare <d1> <d2>` | Compare two brand scans |
| `ogu reference <urls\|files>` | Composite design from multiple inspiration sources |
| `ogu reference show` | Display current design reference |

### Production
| Command | Purpose |
|---------|---------|
| `ogu observe:setup` | Configure observation sources (Sentry, analytics, uptime) |
| `ogu observe` | Fetch and analyze production data |
| `ogu observe --create-tickets` | Auto-create fix features from high-severity events |

### Maintenance
| Command | Purpose |
|---------|---------|
| `ogu clean` | Remove old logs, orchestration files, vision artifacts |
| `ogu migrate` | Migrate .ogu/ structure to latest version |
| `ogu studio` | Launch Ogu Studio web dashboard |
| `ogu ports` | Manage global port registry across projects |

---

## State Files Reference

| File | Format | Created By | Purpose |
|------|--------|------------|---------|
| `.ogu/STATE.json` | JSON | init | Current task, timestamps, recent ADRs, design_mode, recent_scrs |
| `.ogu/CONTEXT.md` | Markdown | context | Assembled context (GENERATED) |
| `.ogu/CONTEXT_LOCK.json` | JSON | context:lock | SHA-256 hashes for staleness (includes spec_hashes) |
| `.ogu/PROFILE.json` | JSON | profile | Platform, service needs |
| `.ogu/THEME.json` | JSON | theme set | Visual mood, tokens |
| `.ogu/GRAPH.json` | JSON | graph | File dependency graph |
| `.ogu/GATE_STATE.json` | JSON | gates | Completion gate checkpoint |
| `.ogu/METRICS.json` | JSON | gates/observe | Feature metrics, gate results |
| `.ogu/DOCTOR.md` | Markdown | doctor | Health check report |
| `.ogu/MEMORY.md` | Markdown | remember | Curated long-term facts |
| `.ogu/MEMORY_PROPOSAL.md` | Markdown | remember | Proposed updates (before apply) |
| `.ogu/SESSION.md` | Markdown | log | Current session scratch |
| `.ogu/REFERENCE.json` | JSON | reference | Composite design direction |
| `.ogu/OBSERVE.json` | JSON | observe:setup | Observation source config |
| `.ogu/DRIFT_REPORT.md` | Markdown | drift | Latest drift detection results |
| `.ogu/TRENDS.md` | Markdown | trends | Analytics report |
| `~/.ogu/global-memory/patterns.json` | JSON | learn | Cross-project patterns |
| `~/.ogu/port-registry.json` | JSON | ports | Global port reservations |

---

## End-to-End Example

Building a task management feature:

```
1. /idea task-manager
   → User describes concept, sets design boldness (standard/bold/extreme)
   → Ogu explores design, personas, scope
   → Creates docs/vault/04_Features/task-manager/IDEA.md

2. /feature task-manager
   → Reads IDEA.md
   → Creates PRD.md (requirements), Spec.md (skeleton), QA.md (test plan)
   → Validates with ogu feature:validate

3. /architect task-manager
   → Reads PRD.md, Default_Stack.md, patterns
   → Fills Spec.md technical sections (data model, API, UI)
   → Creates Plan.json (15 tasks in 4 groups, with IR: inputs/outputs/resources)
   → Writes 8 invariants + design rules to Invariants.md
   → Creates ADR if deviating from defaults

4. /design task-manager
   → Reads Spec.md UI sections, THEME.json, IDEA.md
   → If bold mode: generates 3 variants → ogu design:show → user picks → ogu design:pick
   → Creates DESIGN.md (color system, typography, layout, component DNA, assertions)

5. /preflight task-manager
   → Runs ogu doctor (health check)
   → Builds context (ogu context --feature task-manager)
   → Checks DESIGN.md exists
   → Lists ALL invariants and constraints
   → "Everything ready. 8 invariants active, 3 contracts loaded."

6. /lock task-manager
   → Locks context hashes (including spec_hashes)
   → "Context locked at SHA abc123..."

7. /build task-manager
   → Reads Plan.json, implements task by task
   → Per task: pre-check IR inputs → implement → post-check IR outputs
   → After each group: checkpoint per involvement level
   → Invariant violated? STOP.
   → "15/15 tasks complete. 34/34 IR outputs present."

8. /verify-ui task-manager
   → Finds 23 interactive elements
   → "22/23 VALID, 1 INVALID (empty handler on delete button)"
   → Fix → re-run → "23/23 VALID"

9. /smoke task-manager
   → Writes Playwright test: create task → check list → complete → verify
   → Adds testIDs to components
   → Runs test → PASS

10. /vision task-manager
    → Tier 1 (DOM): PASS (contrast 5.2:1, 2 border-radius values, hierarchy valid)
    → Tier 2 (Screenshots): captured
    → Tier 3 (AI Vision): "Primary CTA uses primary color: PASS. Mood matches: PASS."
    → Design assertions: 5/5 critical PASS, 3/3 non-critical PASS (100%)

11. /enforce task-manager
    → Checks IR completeness: 34/34 outputs present
    → Checks 8 invariants + design rules: all PASS
    → Checks contracts via IR cross-reference: all mapped
    → "COMPLIANT"

12. /preview task-manager
    → Starts services
    → Health checks pass
    → "HEALTHY — web at :3000, mock-api at :4001"

13. /done task-manager
    → ogu compile task-manager
    → Phase 1: IR Load .............. ✔ (15 tasks, 34 outputs)
    → Phase 2: Spec Consistency ..... ✔ (hash chain valid, 6/6 sections covered)
    → Phase 3: IR Validation ........ ✔ (all inputs resolved, no duplicates)
    → Phase 4: Code Verification .... ✔ (34/34 outputs present, 0 TODOs)
    → Phase 5: Design Verification .. ✔ (all invariants satisfied)
    → Phase 6: Runtime Verification . ✔ (UI functional, vision 100%, preview healthy)
    → Compilation PASSED ✔ — 0 error(s), 0 warning(s)
    → "Feature complete. Patterns extracted to global memory."
```

---

## CI Integration

`.github/workflows/ogu.yml` runs on every push and PR to main:

```yaml
- Run ogu validate          # Structure and schema validation
- Run ogu doctor            # Full health check
- Run ogu compile <slug>    # Full compilation (if feature active)
```

---

## Default Stack

When no deviations are specified, Ogu uses:

| Layer | Technology |
|-------|-----------|
| Language | TypeScript everywhere |
| Frontend | Next.js (App Router) + React + Tailwind CSS + Zod |
| Backend | Node.js + Fastify |
| Mock API | Fastify + in-memory state |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| Queue | BullMQ + Redis |
| Auth | httpOnly cookies (web), JWT + refresh (mobile) |
| Design System | shadcn/ui (web) or Tamagui (mobile) |
| Testing | Vitest (unit), Playwright (E2E web), Maestro/Detox (mobile) |
| Monorepo | pnpm workspaces |
| DevOps | Docker Compose, structured logging |

Any deviation requires an **ADR** (Architecture Decision Record).

---

## Error Codes

Ogu produces formal error codes for every issue. Format: `OGU{gate}{sequence}` — 4-digit code.

| Range | Gate | Examples |
|-------|------|----------|
| `OGU00xx` | General | Missing file, invalid JSON, feature not found |
| `OGU01xx` | Doctor | Stale lock, corrupted .ogu/ |
| `OGU02xx` | Context | Spec section has no IR coverage |
| `OGU03xx` | Plan/IR | Broken input chain, duplicate outputs, unresolved inputs |
| `OGU04xx` | TODOs | TODO/FIXME found in code |
| `OGU05xx` | UI | Non-functional UI element |
| `OGU06xx` | Design | Invariant violation, spacing/radius/inline style errors |
| `OGU07xx` | Brand | Color mismatch |
| `OGU08xx` | Smoke | Test failure |
| `OGU09xx` | Vision | Critical/non-critical assertion failure, pass rate below threshold |
| `OGU10xx` | Contracts | Orphan contracts, missing contracts, contract violation |
| `OGU11xx` | Preview | Health check failure |
| `OGU12xx` | Memory | No new patterns |
| `OGU13xx` | Spec | Hash chain broken, missing spec section, redundant SCR |
| `OGU14xx` | Drift | IR output drift, untracked files, contract drift, design token drift |

Full reference: `docs/vault/05_Runbooks/Error_Codes.md`

---

## Key Rules (Always True)

1. **IR is the single source of truth.** Everything validates against IR (Plan.json inputs/outputs/resources).
2. **Invariants always win.** Code bends to invariants, never the other way.
3. **Contracts are law** until changed by ADR.
4. **CONTEXT.md is generated** — never hand-edit.
5. **Every feature needs:** PRD → Spec → Plan → Design → Build → Compile.
6. **`ogu compile` is the canonical command.** It's how you know a feature is done.
7. **No TODO/FIXME in shipped code.** `OGU0401` catches this.
8. **No dead UI buttons.** `OGU0501` catches this.
9. **No skipping compilation phases.** 6 phases, all must pass (0 errors).
10. **Same commit = same context.** Deterministic assembly.
11. **File-based only.** No databases, no external services for Ogu itself.
12. **ADR before deviation.** Every non-default choice is documented.
13. **Spec changes require SCR.** `ogu spec:patch` creates hash-chain records.

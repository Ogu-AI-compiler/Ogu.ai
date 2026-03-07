# Ogu — System Architecture Overview

> מסמך זה נבנה מתוך הקוד בפועל, לא מתיעוד. כל ציטוט מפנה לקובץ מקור אמיתי.

---

## 1. מה זה Ogu — בקצרה

Ogu הוא **קומפיילר של רעיונות לאפליקציות**. הוא לוקח brief טקסטואלי, מפרק אותו ל-CTO Plan, מרכיב צוות סוכנים, מייצר PRD, בונה Task Graph, ומריץ סוכני AI שכותבים קוד — עם 14 gates של אימות, rollback אוטומטי, ו-feedback loop.

**שלוש שכבות:**

```
┌─────────────────────────────────────────────────────────┐
│  Studio (React + Hono + WebSocket)  — UI / control      │
├─────────────────────────────────────────────────────────┤
│  Kadima Daemon (6 loops + RunnerPool) — control plane   │
├─────────────────────────────────────────────────────────┤
│  CLI (120+ commands) + .ogu/ filesystem — execution     │
└─────────────────────────────────────────────────────────┘
```

**אפס דטאבייסים.** הכל קבצי JSON/JSONL על דיסק, גיט-tracked.

---

## 2. מודלי AI — מה קיים בפועל

שלושה מודלים מוגדרים ב-`model-router.mjs`:

| Model ID | Tier | Cost/1K Input | Cost/1K Output | Max Output Tokens |
|---|---|---|---|---|
| `claude-haiku-4-5-20251001` | 1 (fast) | $0.001 | $0.005 | 8,192 |
| `claude-sonnet-4-6` | 2 (standard) | $0.003 | $0.015 | 16,384 |
| `claude-opus-4-6` | 3 (advanced) | $0.015 | $0.075 | 32,768 |

```js
// model-router.mjs — default provider config
providers: [{ id: 'anthropic', enabled: true, models: [
  { id: 'haiku',  fullId: 'claude-haiku-4-5-20251001', tier: 1 },
  { id: 'sonnet', fullId: 'claude-sonnet-4-6',          tier: 2 },
  { id: 'opus',   fullId: 'claude-opus-4-6',            tier: 3 },
] }]
```

### Routing Logic

**שלוש אסטרטגיות ב-`model-routing-config.mjs`:**
- `cost-optimized`: haiku → sonnet → opus (ברירת מחדל)
- `quality-first`: opus → sonnet → haiku (בלי escalation)
- `balanced`: sonnet → opus → haiku

**Escalation אוטומטי:** כשמשימה נכשלת, ה-router מטפס בשרשרת:

```js
// model-router.mjs — escalation
// modelPolicy default: { escalationChain: ['haiku', 'sonnet', 'opus'] }
// On failure: walks chain indexed by failureCount
```

**Budget guard:** אם התקציב היומי נגמר → downgrade ל-tier 1 (haiku):

```js
// reason: 'budget-exhausted' → forced tier 1
```

### LLM Client

קריאה ישירה ל-Anthropic Messages API דרך `fetch`:

```js
// llm-client.mjs
// Endpoint: https://api.anthropic.com/v1/messages
// Header: anthropic-version: 2023-06-01
// temperature: 0 (deterministic by default)
```

**Token estimation** — heuristic פשוט בכל המערכת:

```js
// token-counter.mjs
const CHARS_PER_TOKEN = 4;
export function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
```

---

## 3. Lifecycle Flow — מרעיון ליישום

### Phase 1: תכנון (CTO Pipeline)

```
brief (טקסט חופשי)
  │
  ├─ cto-planner.planProject()
  │     assessComplexity() → tier (low/medium/high) + score + signals
  │     buildTeamBlueprint() → roles + headcount
  │     buildWorkFramework() → architecture + phases + timeline
  │     → .ogu/projects/{id}/cto-plan.json
  │
  ├─ team-assembler.assembleTeam()
  │     scoreAgentForRole() → role match (10pts) + specialty (5pts) + skills (2pts)
  │     hireAgent() → capacity allocation per agent
  │     → .ogu/projects/{id}/team.json
  │
  ├─ pm-engine.generatePRD()
  │     simulate mode (deterministic) OR LLM mode (Haiku, temp=0)
  │     → .ogu/projects/{id}/prd.json
  │
  └─ task-enricher.enrichPlan()
        feature mapping + role assignment + gate inference + DoD
        → .ogu/projects/{id}/plan.enriched.json
```

**Complexity scoring:**

```js
// cto-planner.mjs
const score = (detectedHigh.length * 3) + detectedMedium.length - detectedLow.length;
// HIGH requires ≥1 architectural signal AND score≥6
if (score >= 6 && detectedHigh.length >= 1) tier = 'high';
else if (score >= 2) tier = 'medium';
else tier = 'low';
```

**Team templates:**
- `low`: pm + architect + 2 backend + qa (5 members)
- `medium`: + frontend x2 + devops (7 members)
- `high`: 2 architects + 4 backend + 2 frontend + 2 qa + devops + security (14 members)

### Phase 2: ביצוע (Execution)

```
plan.enriched.json
  │
  ├─ capacity-scheduler.buildCapacitySchedule()
  │     per-agent capacity check + concurrency limit (default: 10)
  │
  ├─ topologicalSort() — Kahn's algorithm
  │
  └─ executeTaskGraph()
       │
       ├─ Wave N (parallel tasks within wave)
       │     executeAgentTask() per task:
       │       1. Feature isolation envelope check
       │       2. Sandbox creation (per-role)
       │       3. Prompt build (dual-mode: simple or agent)
       │       4. LLM call (with tier escalation on failure)
       │       5. Response parse (FILE: markers + code fences)
       │       6. Write files to disk
       │       7. Budget deduction
       │       8. Artifact storage
       │       9. Agent state update
       │
       ├─ Gate check per task
       │     on fail → gate-feedback.retryWithFeedback() (max 3 iterations)
       │
       └─ Next wave (sequential between waves, parallel within)
```

**12-Step Agent Execution (agent-executor.mjs):**

```
1.  Load OrgSpec
2.  Find role (by roleId or first enabled)
3.  Marketplace resolve (inject hired agent skills + DNA)
4.  Find model (cost-sorted by tier)
5.  Budget check (tokens + cost)
6.  Governance evaluate (ALLOW / DENY / REQUIRES_APPROVAL)
7.  Session create (formal identity binding)
8.  Build InputEnvelope → .ogu/runners/{taskId}.input.json
9.  LLM retry loop (escalate tier on failure: fast→standard→advanced)
10. Build OutputEnvelope → .ogu/runners/{taskId}.output.json
11. Deduct budget
12. End session + marketplace hooks + audit emit
```

### Phase 3: אימות (Compile + Gates)

**`ogu compile` — 7 phases:**

| # | Phase | What |
|---|---|---|
| 1 | IR Load | Plan.json valid, all tasks have outputs |
| 2 | Spec Consistency | SHA-256 hash chain verification |
| 3 | IR Validation | DAG input/output chain integrity |
| 4 | Code Verification | No TODOs, all outputs exist physically |
| 4b | Determinism Check | High-impact determinism events = errors |
| 5 | Design Verification | DESIGN.md exists, no inline styles |
| 6 | Runtime Verification | App actually running on localhost |
| 7 | Summary | Pass/fail + attestation |

**14 gates (`ogu gates`):**

```js
// gates.mjs
const GATE_NAMES = [
  "doctor", "context_lock", "plan_tasks", "no_todos",
  "ui_functional", "design_compliance", "brand_compliance",
  "smoke_test", "vision", "contracts", "preview",
  "memory", "spec_consistency", "drift_check",
];
```

**Checkpoint/resume:** שמירה ל-`GATE_STATE.json` אחרי כל gate. ב-rerun, gates שעברו מדולגים (אלא אם `--force`).

---

## 4. Edge Cases ומנגנוני שגיאה

### Error Classification

```js
// error-recovery.mjs — 5 error categories
budget:     { retryable: false }               // → halt immediately
transient:  { retryable: true, 3 retries }     // → exponential backoff (2s, 4s, 8s)
quality:    { retryable: true, escalate tier }  // → try higher model
permission: { retryable: false }               // → halt, needs approval
conflict:   { retryable: true, 5 retries }     // → linear backoff (1s each)
```

### Circuit Breaker — 5 Failure Domains

```js
// circuit-breaker.mjs
'FD-AUDIT':      { haltOnFailure: true, circuitBreaker: null }  // audit fails = system halt
'FD-FILESYSTEM': { threshold: 1, haltOnFailure: true }          // single FS failure = halt
'FD-PROVIDER':   { threshold: 3, failover: ['anthropic', 'openai', 'local'] }
```

**States:** `closed → open → half-open → closed`. ה-`circuit-prober` loop (15s) בודק breakers שב-half-open.

### DAG Rewind

```js
// error-recovery.mjs
// On task failure: rewind to the dependency wave, not the whole DAG
const tasksToRerun = [...deps, failedTaskId];
return { rewindToWave: depWave, tasksToRerun };
```

### Saga Pattern (Distributed Transactions)

```js
// saga-manager.mjs
// Forward execution in order; on failure → compensate in REVERSE order
// Compensations are best-effort (fire-and-forget)
for (let i = failedIdx - 1; i >= 0; i--) {
  try { await step.compensate(); } catch { /* silent */ }
}
```

### System Guards

שני guards שחוסמים את **כל** המערכת:
- `system-halt.json` — halt חירום
- `company-freeze.json` — הקפאת חברה

```js
// Every scheduler tick, state machine tick, and API write checks:
if (isSystemBlocked(root)) return; // skip entire tick
```

### Gate Feedback Loop

```
gate fails → buildGateFeedback()     → structured error message
           → detectLearningOpportunity()
           → if iterations < 3: re-execute with fixNote
           → on success: clear feedback records
           → on 3rd failure: stop, emit learning trigger
```

```js
// gate-feedback.mjs
const ITERATION_THRESHOLD = 3;              // 'excessive_iterations' trigger
const EXCEPTIONAL_IMPROVEMENT_RATIO = 0.5;  // 50% faster = 'exceptional_improvement'
```

### Phase Guards

```js
// lifecycle-guards.mjs — forward-only
const PHASE_ORDER = [
  'idea', 'feature', 'architect', 'design', 'preflight',
  'lock', 'build', 'verify-ui', 'smoke', 'vision',
  'enforce', 'preview', 'done', 'observe',
];
// Cannot go backwards
if (toIdx < fromIdx) return { allowed: false };
```

### Project Resume

```js
// project-resume.mjs
// "completed" → never re-run
// "failed"    → retried (unless skip_failed=true)
// "skipped"   → re-evaluated (dependency may be fixed now)
// "running"   → reset to pending (was interrupted mid-run)
```

---

## 5. Personas (סוכנים)

### Role Taxonomy — 64 roles ב-8 קטגוריות

```
product (8):       product-manager, ux-researcher, ux-designer, scrum-master...
architecture (7):  backend-architect, cloud-architect, api-designer...
engineering (8):   frontend-developer, backend-developer, full-stack, compiler-engineer...
quality (5):       qa-engineer, test-automation, performance-tester...
security (6):      security-architect, penetration-tester, compliance-officer...
devops (9):        devops-engineer, site-reliability, platform-engineer, chaos-engineer...
data (6):          data-engineer, ml-engineer, database-admin...
expert (12):       ai-engineer, cto (minTier 4!), vp-engineering (minTier 4), staff-engineer...
documentation (3): technical-writer, developer-advocate, api-documentarian
```

### Agent Profile — שני דורות

**V1 (Marketplace basics):**
- role + specialty + tier
- DNA profile: 6 fields (work_style, communication_style, risk_appetite, strength_bias, tooling_bias, failure_strategy)
- Skills: core + specialty + DNA-based
- System prompt: 7 sections

**V2 (Playbook-based — current):**
- 4-layer prompt assembly: `playbook → specialty addendum → DNA → experience`
- 7 playbooks (product, architecture, engineering, quality, security, devops, expert)
- 3 specialty addendums (react, node, kubernetes)
- Experience digest from post-compile training
- Role history tracking

```js
// agent-generator.mjs — V2 flow
getRoleConfig(roleSlug)      → displayName, category, capacityUnits
loadPlaybookForRole()        → playbook sections + skills
loadSpecialty()              → specialty addendum
seededRand()                 → DNA + name
resolveSkills()              → skill definitions
assembleSystemPrompt()       → 4-layer prompt
```

### Agent Trainer

רץ אוטומטית אחרי `ogu compile` מוצלח:

```js
// compile.mjs — post-compile hook
// On success: lazy-import agent-trainer.mjs → trainAll()
// Distills learning candidates → experience rules
// Tier promotion/demotion based on performance
```

### Pricing Engine

```js
// pricing-engine.mjs
// tier 1=$1.50, tier 2=$4.00, tier 3=$8.00, tier 4=$16.00
// Performance multiplier: success_rate(0.5) + projects(0.3) + utilization(0.2)
// Range: floor=0.5x to ceiling=2.0x
final_price = base * multiplier  // rounded to 2 decimals
```

### Marketplace Allocation

סוכנים מושכרים לפרויקטים עם capacity tracking:

```js
// marketplace-allocator.mjs
if (units > available) {
  throw new Error(`Agent ${agentId} has insufficient capacity`);
}
// Agents cannot be reused across team slots (usedAgentIds Set)
```

---

## 6. Kadima Daemon — Control Plane

שש לולאות רקע שרצות במקביל:

| Loop | Interval | Role |
|---|---|---|
| `scheduler` | 5s | Task dispatch → RunnerPool |
| `state-machine` | 10s | Feature FSM auto-transitions |
| `consistency` | 30s | Orphan detection, saga repair, archival |
| `metrics-aggregator` | 60s | Health score computation |
| `circuit-prober` | 15s | Probe half-open circuit breakers |
| `knowledge` | 5min | Index task outputs → semantic memory |

### Scheduler — Two-Path Architecture

```
Path A (preferred): Wave-based dispatch
  Load allocations → buildDAG() → take first ready wave
  → check resource governor → executeWave() → update statuses

Path B (fallback): Enhanced single-task scheduling
  Policies: deadline-heavy | high-contention | fifo
  hasDeadlines       → priority queue
  pending > 10       → WFQ + formal scheduler (starvation prevention)
  otherwise          → simple FIFO

Both paths: resource governor acquire/release + system halt guard
```

### RunnerPool

```
maxConcurrent: 4 (configurable)
Each task: fork(runner-worker.mjs, [taskId])
  reads  .ogu/runners/{id}.input.json
  writes .ogu/runners/{id}.output.json
On exit(0): mark completed, resolve blockedBy on dependents
On exit(≠0): retry eligible, escalate tier
Drain: 10s timeout, then SIGKILL remaining workers
```

### Graceful Shutdown (LIFO)

```
1. Stop all 6 loops
2. Drain runner pool (10s timeout)
3. Close HTTP server
4. Shutdown system runtime
5. Deregister from service registry
6. HMAC-seal final audit event
7. Remove PID file
```

---

## 7. Studio — Web UI

### Architecture

```
Frontend: React + Zustand (state machine routing, no React Router)
Backend:  Hono on @hono/node-server (port 4200)
Realtime: WebSocket with EventBatcher (80ms) + ReplayBuffer (5K events)
```

### API Surface — 12 routers, 40+ endpoints

```
/api         → state, features, files, sessions, marketplace, widgets, SSE
/api         → exec (CLI execution)
/api         → chat (AI)
/api/kadima  → proxy to Kadima daemon
/api/ogu     → CLI bridge
/api         → wizard, brief, project-state, manifest, Kadima control
/api         → project-lifecycle
/api/marketplace → agent marketplace
```

### WebSocket Event Flow

```
File watchers (chokidar) → audit JSONL / state changes
  → mapAuditToWsEvent() (30+ audit types → typed events)
  → EventBatcher (80ms coalescing)
  → ReplayBuffer (5K events)
  → CursorManager (per-client, per-stream tracking)
  → Browser WebSocket
```

**Critical events bypass batcher:** `GOV_BLOCKED`, `INTENT_STATE`, `SNAPSHOT_AVAILABLE`

### UI State Machine

```
No accessToken        → Auth screen
projectValid === null → Loading
route === "/wizard"   → HomeView (wizard)
!projectValid         → HomeView (greeting + wizard)
otherwise             → Full OS: Sidebar + MainArea + KadimaInterrupts + Cmd+K
```

---

## 8. Governance & Policy

### Policy Engine — Two Evaluation Paths

```js
// policy-engine.mjs
// 1. AST-based (deterministic, preferred)
// 2. Legacy (direct rules, fallback)

// Decision priority:
// DENY           → any deny effect or _blocked flag
// REQUIRES_APPROVAL → requireApprovals effect + no existing approval file
// ALLOW          → explicit allow, non-blocking, or no matching rules

// Default: no rules = ALLOW (not a security failure)
if (effects.length === 0) {
  return { decision: 'ALLOW', reason: 'No matching rules — default allow' };
}
```

### Approval Lifecycle

```
States: pending → approved | denied | escalated | timed_out
Terminal: approved, denied, timed_out
Non-terminal: escalated (can still be approved/denied after escalation)
```

### Governance Triggers

ארבעה triggers שמפעילים approval:

```js
checkScopeViolation()  // path outside ownership patterns
checkPathMatch()       // sensitive paths (auth, secret, key)
checkBudgetExceeded()  // ratio >= 90% of quota
checkRiskTier()        // high/critical risk tier
```

### Escalation Chain

```js
// escalation-chain.mjs
// Simple pointer-advancing chain
// Calling escalate() on exhausted chain throws (caller must guard)
// terminal escalation: `to` is null when escalating from last member
```

---

## 9. Data Model — File Layout

```
.ogu/
  ├── STATE.json                    # current project state
  ├── CONTEXT.md                    # assembled context (generated)
  ├── CONTEXT_LOCK.json             # hash lock for context/spec/state
  ├── OrgSpec.json                  # organization configuration
  ├── THEME.json                    # visual theme data
  ├── kadima.config.json            # daemon configuration
  ├── kadima.pid                    # daemon PID file
  │
  ├── state/
  │   ├── scheduler-state.json      # task queue (pending/dispatched/completed)
  │   ├── features/*.state.json     # FSM state per feature
  │   ├── circuit-breakers.json     # per-domain breaker state
  │   ├── system-halt.json          # emergency halt flag
  │   ├── company-freeze.json       # company freeze flag
  │   ├── metrics-snapshot.json     # latest health snapshot
  │   └── knowledge-state.json      # semantic memory index
  │
  ├── budget/
  │   ├── budget-state.json         # daily/monthly spend
  │   └── transactions.jsonl        # append-only transaction log
  │
  ├── audit/
  │   ├── current.jsonl             # append-only audit trail
  │   └── {date}.jsonl              # daily rotation
  │
  ├── runners/
  │   ├── {taskId}.input.json       # InputEnvelope per task
  │   └── {taskId}.output.json      # OutputEnvelope per task
  │
  ├── marketplace/
  │   ├── agents/{id}.json          # agent profiles
  │   ├── index.json                # fast lookup index
  │   ├── pricing/tiers.json        # pricing config
  │   ├── pricing/multipliers.json  # performance multipliers
  │   └── allocations/              # capacity allocations
  │
  ├── projects/{id}/
  │   ├── cto-plan.json             # CTO analysis
  │   ├── team.json                 # assembled team
  │   ├── prd.json                  # product requirements
  │   ├── plan.enriched.json        # enriched task graph
  │   └── execution-state.json      # execution progress
  │
  ├── agents/
  │   ├── {role}.state.json         # per-role runtime state
  │   └── sessions/{id}.json        # execution sessions
  │
  └── gate-feedback/{taskId}/       # feedback records per task
```

---

## 10. Formal Error Codes

קודי שגיאה OGU#### — פורמלי וסריק:

| Code | Gate | Meaning |
|---|---|---|
| `OGU0001` | general | Missing required file |
| `OGU0201` | spec | Spec section not covered in IR |
| `OGU0301` | plan | IR output chain broken |
| `OGU0303` | plan | Duplicate output in IR |
| `OGU0401` | todos | TODO/FIXME found in code |
| `OGU0601` | design | DESIGN.md missing |
| `OGU0605` | design | Inline style violation |
| `OGU0606` | runtime | App not running (strict mode) |
| `OGU1002` | contracts | Contract not referenced in IR |
| `OGU1301` | spec | Spec hash chain broken |
| `OGU1401` | drift | IR output drift detected |
| `OGU5201` | runner | Runner pool full |

---

## 11. Connection Map — הכל ביחד

```
                          ┌──────────────────────┐
                          │     Studio (UI)       │
                          │  React + Zustand      │
                          │  WebSocket + REST     │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Studio Server        │
                          │  Hono (port 4200)     │
                          │  12 API routers       │
                          │  WS + SSE + chokidar  │
                          └──────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼──────────┐ ┌────────▼─────────┐ ┌─────────▼──────────┐
    │   CLI (120+ cmds)  │ │  Kadima Daemon   │ │  Marketplace       │
    │   ogu compile      │ │  6 loops         │ │  64 roles          │
    │   ogu gates        │ │  RunnerPool(4)   │ │  Pricing engine    │
    │   ogu agents       │ │  Circuit breakers│ │  Capacity ledger   │
    └─────────┬──────────┘ └────────┬─────────┘ └─────────┬──────────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   .ogu/ filesystem   │
                          │   (git-tracked)      │
                          │   JSON + JSONL        │
                          │   Zero databases      │
                          └──────────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Anthropic API        │
                          │  claude-haiku-4-5     │
                          │  claude-sonnet-4-6    │
                          │  claude-opus-4-6      │
                          └──────────────────────┘
```

### Audit Stream — כל רכיב כותב לאותו trail

```
CLI tools → emitAudit() (audit-emitter.mjs)
Kadima daemon → emitAudit() (inline function)
  ↓
.ogu/audit/current.jsonl (append-only)
  ↓
SSE broadcast → Studio WebSocket → Browser
```

**30+ event types:** `agent:started`, `agent:completed`, `compile:started`, `compile:gate`, `governance:approval_required`, `task:dispatched`, `wave:started`, `budget:exhausted`, `circuit.tripped`, `feature.auto_transition`, `knowledge.indexed`, `metrics.health_critical`...

---

*Generated from code analysis on 2026-03-04. Source files: cli.mjs, compile.mjs, gates.mjs, daemon.mjs, state-machine.mjs, scheduler.mjs, agent-executor.mjs, agent-runtime.mjs, model-router.mjs, llm-client.mjs, prompt-builder.mjs, response-parser.mjs, budget-tracker.mjs, error-recovery.mjs, circuit-breaker.mjs, saga-manager.mjs, policy-engine.mjs, approval-lifecycle.mjs, cto-planner.mjs, team-assembler.mjs, pm-engine.mjs, task-enricher.mjs, project-executor.mjs, gate-feedback.mjs, marketplace-allocator.mjs, agent-generator.mjs, role-taxonomy.mjs, pricing-engine.mjs, capacity-scheduler.mjs, project-resume.mjs, skill-router.mjs, playbook-loader.mjs, and 60+ additional modules.*

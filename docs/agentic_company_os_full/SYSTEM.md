# Ogu — System Architecture

> The definitive technical reference for the Ogu Agentic Company OS.
>
> Version: Ogu v5 | Last updated: 2026-03-02

---

## 1. What Is Ogu?

Ogu is a **compiler that transforms ideas into fully working, tested, verified applications**. You give it an idea in natural language; it produces a deployed product that passes 14 verification gates, complete with tests, design compliance, contract enforcement, and production monitoring.

What makes Ogu different from copilots, task runners, or code generators is the compiler metaphor taken to its logical conclusion. A traditional compiler has a front end (parsing), a middle end (optimization on an intermediate representation), and a back end (code generation). Ogu applies the same structure to software product development:

```
Traditional Compiler            Ogu Product Compiler
─────────────────────           ─────────────────────
Source code (C, Rust)      -->  Idea (natural language)
Lexing / Parsing           -->  /idea, /feature (explore + define requirements)
AST / IR generation        -->  /architect (Spec.md + Plan.json + Product IR)
Optimization passes        -->  /design, /preflight, /lock (visual + health + context)
Code generation            -->  /build (task-by-task implementation from Plan.json)
Linking                    -->  /verify-ui, /smoke, /vision (integration + E2E)
Verification               -->  /enforce, /preview, /done (contract + gate checks)
Deployed binary            -->  Production-ready application
```

The key insight: every phase produces **verified output** that becomes the input to the next phase. The Product IR (intermediate representation) in `Plan.json` defines typed inputs and outputs for every task. If a task's inputs are not satisfied by prior outputs, compilation fails -- just like an unresolved symbol in a linker.

This is not "AI writes code and hopes for the best." This is a formal pipeline where correctness is enforced at every stage, and the system knows precisely what has been built, what remains, and whether the output matches the specification.

---

## 2. System Architecture Overview

Ogu is composed of three layers, each with a distinct responsibility:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐      │
│   │                    STUDIO (Visual Interface)                  │      │
│   │                                                               │      │
│   │   React 19 frontend    Express backend    WebSocket events    │      │
│   │   15 pages, 67 comps   18 API endpoints   Real-time updates   │      │
│   │                                                               │      │
│   └───────────────────────────┬───────────────────────────────────┘      │
│                               │                                          │
│                    HTTP REST + WebSocket + SSE                           │
│                               │                                          │
│   ┌───────────────────────────┴────────────────────────────────────┐     │
│   │                   KADIMA (Organization OS)                     │     │
│   │                                                                │     │
│   │   Daemon process        Wave scheduler       Runner pool       │     │
│   │   Agent registry        Budget enforcement   Governance        │     │
│   │   Task allocation       Standup generation   Health monitoring │     │
│   │                                                                │     │
│   └───────────────────────────┬────────────────────────────────────┘     │
│                               │                                          │
│                File-based state (.ogu/) + CLI invocation                 │
│                               │                                          │
│   ┌───────────────────────────┴────────────────────────────────────┐     │
│   │                   OGU (Product Compiler)                       │     │
│   │                                                                │     │
│   │   93 CLI commands       14-gate pipeline     IR validation     │     │
│   │   ~1,169 lib modules    Drift detection      Contract enforce  │     │
│   │   Audit trail           Memory fabric        Design system     │     │
│   │                                                                │     │
│   └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐      │
│   │                   .ogu/ (Single Source of Truth)              │      │
│   │                                                               │      │
│   │   STATE.json   CONTEXT.md   OrgSpec.json   audit/   budget/   │      │
│   │   MEMORY.md    SESSION.md   kadima/        agents/  metrics/  │      │
│   │                                                               │      │
│   └───────────────────────────────────────────────────────────────┘      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### How the Layers Communicate

| Path                        | Protocol          | Purpose                            |
| --------------------------- | ----------------- | ---------------------------------- |
| Studio <--> Express backend | HTTP REST         | CRUD operations, commands          |
| Studio <--> Express backend | WebSocket         | Real-time state updates, logs      |
| Express backend --> Kadima  | HTTP (localhost)  | Daemon control, task dispatch      |
| Kadima --> Runners          | HTTP / SSE        | Distributed task execution         |
| All layers <--> .ogu/       | Filesystem (JSON) | Shared state, audit, configuration |
| CLI --> .ogu/               | Filesystem        | Direct state reads and writes      |

The `.ogu/` directory is the **single source of truth**. Every component reads from and writes to plain files in this directory. There are no databases, no external services, no message queues. This makes the entire system state git-trackable, inspectable, and reproducible.

---

## 3. The Compilation Pipeline

### Full Pipeline Flow

```
   IDEA                                                          PRODUCTION
    │                                                                 ▲
    ▼                                                                 │
┌────────┐   ┌──────────┐   ┌───────────┐   ┌────────┐   ┌────────┐   │
│ /idea  │──>│ /feature  │──>│ /architect │──>│ /design│──>│/preflight│
│        │   │          │   │           │   │        │   │        │   │
│IDEA.md │   │PRD.md    │   │Spec.md    │   │DESIGN  │   │Health  │   │
│        │   │QA.md     │   │Plan.json  │   │.md     │   │check   │   │
│        │   │Spec skel │   │IR outputs │   │Tokens  │   │        │   │
└────────┘   └──────────┘   └───────────┘   └────────┘   └────────┘   │
                                                              │       │
    ┌─────────────────────────────────────────────────────────┘       │
    ▼                                                                 │
┌────────┐   ┌───────────┐   ┌───────────┐   ┌────────┐    ┌────────┐ │
│ /lock  │──>│  /build   │──>│ /verify-ui│──>│ /smoke │──>│ /vision │ │
│        │   │           │   │           │   │        │    │        │ │
│Context │   │Task-by-   │   │UI audit:  │   │E2E     │    │DOM +   │ │
│lock    │   │task from  │   │buttons,   │   │test    │    │screen  │ │
│hashes  │   │Plan.json  │   │links,     │   │suite   │    │shots + │ │
│        │   │+ IR checks│   │forms work │   │        │    │AI vis  │ │
└────────┘   └───────────┘   └───────────┘   └────────┘    └────────┘ │
                                                              │       │
    ┌─────────────────────────────────────────────────────────┘       │
    ▼                                                                 │
┌────────┐   ┌──────────┐   ┌───────────┐                             │
│/enforce│──>│ /preview │──>│   /done   │─────────────────────────────┘
│        │   │          │   │           │
│Contract│   │Start     │   │ogu compile│
│check   │   │services, │   │14 gates   │
│vs vault│   │verify    │   │Error codes│
│        │   │health    │   │Pass/Fail  │
└────────┘   └──────────┘   └───────────┘
```

### Phase Details

Each phase follows the same contract: **Input --> Processing --> Output --> Gate verification**.

| Phase        | Input                    | Processing                                               | Output                           | Gate                    |
| ------------ | ------------------------ | -------------------------------------------------------- | -------------------------------- | ----------------------- |
| `/idea`      | Natural language concept | Explore feasibility, set involvement level, visual style | `IDEA.md`                        | --                      |
| `/feature`   | `IDEA.md`                | Generate product requirements, test plan                 | `PRD.md`, `QA.md`, Spec skeleton | Phase-1 validation      |
| `/architect` | `PRD.md`                 | Technical architecture, task decomposition               | `Spec.md`, `Plan.json`, IR       | Phase-2 validation (IR) |
| `/design`    | `Spec.md`                | Visual identity, design tokens, assertions               | `DESIGN.md`, design tokens       | Design rules check      |
| `/preflight` | All prior artifacts      | Doctor check, context verify, constraints                | Health report                    | System readiness        |
| `/lock`      | Context state            | Hash Spec, Plan, Repo Map, State                         | `CONTEXT_LOCK.json`              | Hash integrity          |
| `/build`     | `Plan.json` + IR         | Execute tasks sequentially or in parallel                | Implementation files             | IR input/output chain   |
| `/verify-ui` | Running application      | Audit every button, link, form                           | UI audit report                  | All interactions work   |
| `/smoke`     | Running application      | Write and execute E2E tests                              | Test results                     | All tests pass          |
| `/vision`    | Running application      | DOM inspection + screenshots + AI vision                 | Vision report                    | Visual match to design  |
| `/enforce`   | Codebase + contracts     | Validate code matches vault contracts                    | Contract report                  | No violations           |
| `/preview`   | Built application        | Start services, verify health endpoints                  | Preview URL                      | Services respond        |
| `/done`      | Everything above         | Run `ogu compile` -- all 14 gates                        | Compilation result               | 0 errors = pass         |
| `/observe`   | Production deployment    | Error monitoring, analytics, drift detection             | Observation report               | SLA compliance          |

### The 14 Gates

`ogu compile <slug>` orchestrates the full verification pipeline. When called with
`ogu gates run <slug>`, all 14 gates execute with checkpoint/resume support:

```
Gate  Name                What It Checks
────  ──────────────────  ───────────────────────────────────────────────
 1    doctor              Full system health (validate, repo-map, context)
 2    context_lock        CONTEXT_LOCK.json hashes match current state
 3    plan_tasks          Every IR input resolved by prior output or pre-existing file
 4    no_todos            No TODO, FIXME, HACK, XXX, PLACEHOLDER in shipped code
 5    ui_functional       Every button, link, and form has a working handler
 6    design_compliance   Design tokens used (no hardcoded colors, fonts, spacing)
 7    brand_compliance    Brand colors, fonts, and tone match scanned brand DNA
 8    smoke_test          E2E test suite runs and passes
 9    vision              DOM + screenshots + AI vision match design assertions
10    contracts           Code matches vault contract definitions
11    preview             Application starts, health endpoints respond
12    memory              Cross-project patterns recorded to global memory
13    spec_consistency    Spec.md content aligns with IR task coverage
14    drift_check         No drift from spec, contracts, IR outputs, design tokens
```

**Checkpoint/Resume**: Gate state is persisted in `.ogu/GATE_STATE.json`. If compilation
is interrupted (crash, timeout, manual stop), running `ogu gates run <slug>` resumes
from the last failed gate. Use `--force` to re-run from scratch.

### The Compile Command

`ogu compile <slug>` is the single canonical entry point. It runs 7 internal phases
(distinct from the 14 gates) in this order:

```
1. Company freeze guard     -- abort immediately if organization is frozen (OGU0099)
2. Execution graph hash     -- snapshot dependency graph before build
3. Kadima allocation check  -- verify agent task allocations (informational)
4. Phase 1: IR Load         -- load Plan.json, validate task/output structure
5. Phase 2: Spec Consistency -- verify Spec.md hash chain + IR coverage
6. Phase 3: IR Validation   -- verify input/output chains, detect duplicates
7. Phase 4: Code Verification -- scan for TODOs, verify IR outputs exist in code
8. Graph hash drift check   -- compare pre/post build hashes
9. Phase 5: Design Verification -- check inline styles, design token compliance
10. Phase 6: Runtime Verification -- verify running app (strict mode)
11. Consistency check        -- SAGA reconciliation across all layers
12. Summary                  -- emit audit, report errors/warnings
```

### Error Codes

All errors follow the format `OGU####` and are formal, greppable, and documented:

| Code      | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `OGU0001` | Required file not found (Plan.json, Spec.md)         |
| `OGU0099` | Organization is frozen -- all operations blocked     |
| `OGU0201` | Spec section not covered by IR                       |
| `OGU0302` | IR input not resolved by prior output                |
| `OGU0303` | Duplicate IR output across tasks                     |
| `OGU0304` | Task has no outputs defined (legacy warning)         |
| `OGU0305` | IR output not present in codebase                    |
| `OGU0401` | TODO/FIXME found in shipped code                     |
| `OGU0601` | DESIGN.md required but missing (strict mode)         |
| `OGU0605` | Inline style violation (hardcoded color, font, etc.) |
| `OGU0606` | Application not running (strict mode)                |
| `OGU1002` | Contract not referenced in IR                        |
| `OGU1301` | Spec hash mismatch with broken SCR chain             |

---

## 4. Agent Execution Model

Ogu agents are not chatbots. They are **execution units** that receive structured tasks,
operate under governance and budget constraints, and produce verified outputs.

### Execution Pipeline

```
                          ┌──────────────────────────────────────┐
                          │         AGENT EXECUTOR CORE          │
                          │                                      │
  InputEnvelope ──────>   │  1. Deterministic mode check         │
  (task, role,            │     Block overrides if locked        │
   feature, spec)         │                                      │
                          │  2. MicroVM sandbox allocation       │
                          │     Optional process isolation       │
                          │                                      │
                          │  3. Load OrgSpec + resolve role      │
                          │     Match roleId to org definition   │
                          │                                      │
                          │  4. Find model (provider + tier)     │
                          │     Cost-optimized routing           │
                          │                                      │
                          │  5. Check budget                     │
                          │     Estimate cost, verify allowance  │
                          │                                      │
                          │  6. Governance policy evaluation     │
                          │     ALLOW / DENY / REQUIRES_APPROVAL │
                          │     Override check (blocked in det.) │
                          │                                      │
                          │  7. Build prompt                     │
                          │     Memory fabric injection (RAG)    │
                          │     Handoff context from upstream    │
                          │                                      │
                          │  8. Call LLM                         │
                          │     Retry with tier escalation       │
                          │     haiku -> sonnet -> opus          │
                          │                                      │
                          │  9. Parse response + write files     │
                          │     Determinism tolerance check      │
                          │                                      │
                          │ 10. Deduct budget + emit audit       │
                          │                                      │
  <────── OutputEnvelope  │ 11. Return structured result         │
  (files, cost,           │     { success, files, cost,          │
   tokens, status)        │       tokens, duration, attempts }   │
                          │                                      │
                          └──────────────────────────────────────┘
```

### Key Concepts

**InputEnvelope**: A structured JSON document containing the task specification,
feature slug, role assignment, risk tier, files to touch, and handoff context from
upstream tasks. This is the "source code" the agent compiles.

**OutputEnvelope**: The structured result containing generated files, token usage,
cost breakdown, model used, duration, and number of attempts (escalations).

**Memory Fabric Injection**: Before the LLM call, the prompt builder queries the
semantic memory system (TF-IDF + entity extraction + decay) for relevant context.
This injects project knowledge, past decisions, and patterns into the prompt --
giving the agent "memory" beyond its context window.

**Escalation Chain**: If the assigned model fails (budget exceeded, quality too low),
the system automatically escalates to a higher tier: `fast -> standard -> advanced`.
Each escalation is a separate attempt with audit trail. In deterministic mode,
escalation is blocked -- the task fails instead of trying a more expensive model.

**Determinism Tolerance**: After the LLM responds, the system runs a variance check
comparing the output AST against expected structure. Adaptive thresholds determine
how much deviation is acceptable. This catches hallucinated imports, phantom
dependencies, and structural drift.

**MicroVM Sandbox**: For high-risk tasks (touching production config, security-critical
files), the executor can allocate a MicroVM with resource limits, isolated filesystem,
and network restrictions. The task executes inside the VM and results are extracted
on success.

### Who Calls the Agent Executor

The executor core is shared across three entry points:

```
  ogu agent:run           -- CLI direct invocation
  agent-runtime.mjs       -- Programmatic call during DAG execution
  runner-worker.mjs       -- Kadima daemon dispatch to local/remote worker
```

All three converge on `executeAgentTaskCore()` -- the same governance, budget,
prompt building, and LLM call logic regardless of how the task was initiated.

---

## 5. Orchestration & Scheduling

### DAG-Based Task Scheduling

`Plan.json` defines tasks with explicit dependencies. The `dag-builder` module
constructs a directed acyclic graph and partitions tasks into **waves** --
groups of tasks that can execute in parallel because they have no mutual dependencies.

```
Plan.json tasks:

  T1 (setup)  ────>  T3 (backend)  ────>  T5 (integration)
                           │
  T2 (config)  ────>  T4 (frontend) ────>  T5 (integration)
                                                   │
                                              T6 (tests)

Computed waves:

  Wave 0: [T1, T2]       -- no dependencies, execute in parallel
  Wave 1: [T3, T4]       -- depend on Wave 0, execute in parallel
  Wave 2: [T5]           -- depends on T3 and T4
  Wave 3: [T6]           -- depends on T5
```

### Wave Execution

Each wave follows this protocol:

```
For each wave:
  1. Governance gate       -- evaluate policy for each task
     - DENY: task excluded from wave, marked failed
     - REQUIRES_APPROVAL: task excluded, marked pending
     - ALLOW: proceed

  2. Semantic mutex        -- acquire locks on files each task will touch
     - Lock acquired: task proceeds
     - Lock busy: task deferred to next wave (avoids file conflicts)

  3. Parallel execution    -- Promise.allSettled on all approved, locked tasks
     - Each task runs executeAgentTask() independently
     - Worktree isolation: each task gets its own git branch
     - Distributed dispatch: optionally route to remote runner

  4. Worktree merge        -- merge each task's branch back to main
     - Success: artifacts collected
     - Conflict: task marked failed

  5. AST merge validation  -- detect multi-writer conflicts
     - Multiple tasks wrote same file? Report and attempt structural merge

  6. Lock release          -- release all semantic mutex locks

  7. Artifact collection   -- store outputs for downstream tasks
```

### Kadima's Role

Kadima is the **Organization OS** -- it sits above Ogu and orchestrates multi-agent
work across features, teams, and time.

```
Kadima Lifecycle:

  kadima:start   -- Start daemon process (HTTP API + scheduler + SSE)
       │
       ▼
  allocatePlan() -- Match Plan.json tasks to OrgSpec roles
       │            Role matching: capabilities, budget, availability
       ▼
  dispatchTask() -- Send task to best available runner
       │            Local runner (default) or remote runner (distributed)
       ▼
  monitor        -- Track task progress, budget consumption, health
       │            SSE streaming to Studio for real-time updates
       ▼
  generateStandup() -- Summarize completed/blocked/pending work
       │
  kadima:stop    -- Graceful shutdown with state persistence
```

### Distributed Runners

By default, tasks execute locally. When distributed runners are configured
(`.ogu/kadima/runners.json`), the system selects the best runner using:

```
Runner Selection:

  1. Filter by required capabilities
     (e.g., "node18", "docker", "gpu")

  2. Filter by health status
     (only healthy runners with recent heartbeat)

  3. Sort by load (least busy first)

  4. Dispatch via HTTP POST to runner endpoint

  5. If remote dispatch fails, fall back to local execution
```

Remote runners report results back via callback. The system handles the case where
a remote runner goes dark (timeout -> local fallback -> audit event).

### Semantic Mutex

When multiple agents work in parallel, they might try to modify the same file.
The semantic mutex system prevents corruption:

```
Agent A wants to edit src/auth/login.ts (function: handleLogin)
Agent B wants to edit src/auth/login.ts (function: validateToken)

Semantic mutex resolves this:
  - Agent A acquires lock on login.ts:handleLogin -- granted
  - Agent B acquires lock on login.ts:validateToken -- granted (different symbol)

But if both touch the same function:
  - Agent A acquires lock on login.ts:handleLogin -- granted
  - Agent B tries lock on login.ts:handleLogin -- BLOCKED (deferred to next wave)
```

The mutex operates at the **symbol level**, not just the file level. Two agents
can work on the same file if they touch different functions. Deadlock detection
prevents circular waits. Lock state is cleaned up after each wave.

### AST Merge

After parallel waves complete and worktrees are merged, the system checks for
structural conflicts. If two agents both wrote to the same file (even in different
worktrees), the AST merge module compares the abstract syntax trees of both
versions and attempts to merge non-conflicting changes automatically.

---

## 6. Governance & Safety

### Policy Engine

Governance is enforced through a declarative policy engine with a custom AST evaluator:

```
Policy Rule Example:

{
  "id": "block-production-writes",
  "conditions": {
    "AND": [
      { "field": "touches", "contains": "production/" },
      { "field": "riskTier", "eq": "high" }
    ]
  },
  "effect": "DENY",
  "reason": "Production writes require CTO approval"
}
```

The policy AST supports full boolean logic (`AND`, `OR`, `NOT`), comparison
operators (`eq`, `ne`, `gt`, `lt`, `contains`, `matches`), and field references.
Multiple rules can match; effects are aggregated with DENY taking precedence.

### Approval Workflow

When a policy evaluates to `REQUIRES_APPROVAL`, the task enters the approval pipeline:

```
  REQUIRES_APPROVAL
       │
       ▼
  ┌─────────┐     ┌──────────┐     ┌───────────┐
  │ PENDING  │────>│ APPROVED │────>│ EXECUTED   │
  │          │     │          │     │            │
  │          │     └──────────┘     └───────────┘
  │          │
  │          │────>│ DENIED   │     (task fails with audit trail)
  │          │     └──────────┘
  │          │
  │          │────>│ ESCALATED│────> (moves to higher authority)
  └─────────┘     └──────────┘
```

Escalation chains are time-based: if no response within the configured timeout,
the request escalates to the next authority level. All decisions are logged in
the audit trail.

### Budget Enforcement

Budget is tracked at four levels:

```
  Organization level   -- total monthly spend cap
  Role level           -- per-role daily/monthly limits
  Feature level        -- per-feature budget allocation
  Model level          -- per-model cost tracking
```

Budget state lives in `.ogu/budget/budget-state.json`. Every LLM call logs a
transaction in `.ogu/budget/transactions.jsonl`. The system emits alerts at 80%
utilization and hard-blocks at 100%.

### Company Freeze

A nuclear option. When activated (`ogu freeze`), **all operations stop immediately**:

- `ogu compile` aborts with `OGU0099`
- Kadima refuses new task allocations
- Agent executor blocks all LLM calls
- Override handler rejects all overrides

Unfreezing requires explicit `ogu thaw` with audit trail. This is designed for
security incidents, budget crises, or organizational emergencies.

### Deterministic Mode

When enabled (`ogu deterministic:enable`), the system locks down:

- Policy overrides are blocked (no bypassing governance)
- Escalation chains are disabled (no automatic tier upgrades)
- All decisions are recorded with deterministic IDs
- Variance tolerance is tightened (less LLM output deviation allowed)

This mode is used during compliance audits, critical deployments, or when
reproducibility is required.

### Override Handler

Authorized users can bypass governance for specific targets:

```
Override Record:
{
  "id": "override-abc123",
  "target": "governance:my-feature:task-3",
  "authority": { "role": "cto", "userId": "..." },
  "reason": "Emergency hotfix, approved in incident call",
  "expiresAt": "2026-03-03T00:00:00Z"
}
```

Every override is scoped (specific task, feature, or global), time-limited,
and logged in the audit trail. In deterministic mode, overrides are completely
blocked regardless of authority.

---

## 7. State Management

### The `.ogu/` Directory

All runtime state lives in `.ogu/` at the repository root. Every file is plain
text (Markdown or JSON), designed to be human-readable and git-trackable.

```
.ogu/
├── STATE.json              Machine-readable state (phase, active task, involvement)
├── CONTEXT.md              Assembled context (generated, never hand-edited)
├── CONTEXT_LOCK.json       Hashes of Spec, Plan, Repo Map, State
├── MEMORY.md               Curated long-term facts and conventions
├── SESSION.md              Current session state (working on, pending)
├── GATE_STATE.json         Checkpoint state for 14-gate pipeline
├── OrgSpec.json            Organization specification (roles, providers, budget)
├── THEME.json              Active visual theme configuration
├── IDENTITY.md             Project identity document
├── PROFILE.json            Detected platform and service profile
├── GRAPH.json              Project dependency graph
├── DOCTOR.md               Last health check report
├── BUDGET.json             Budget configuration
├── METRICS.json            Current metrics snapshot
├── SOUL.md                 Design soul / brand personality
│
├── agents/                 Per-agent state files
│   └── {roleId}.state.json   Status, task history, session binding
│
├── audit/                  Append-only audit trail
│   ├── index.json            Audit index (for fast lookups)
│   └── YYYY-MM-DD.jsonl      Daily audit log (one JSON object per line)
│
├── budget/                 Budget tracking
│   ├── budget-state.json     Current balances and limits
│   └── transactions.jsonl    All LLM cost transactions
│
├── kadima/                 Kadima daemon state
│   ├── allocations/          Task-to-role assignments
│   ├── runners.json          Registered distributed runners
│   └── standups/             Generated standup reports
│
├── memory/                 Daily logs and memory fabric
│   ├── YYYY-MM-DD.md         Daily decision logs
│   └── fabric.json           Semantic memory index
│
├── metrics/                Performance metrics
│   └── YYYY-MM-DD.json       Daily metrics snapshot
│
├── governance/             Policy definitions and approval records
├── policies/               Active policy rules
├── locks/                  Semantic mutex lock files
├── checkpoints/            Build checkpoint state
├── artifacts/              Task output artifacts
├── attestations/           Cryptographic attestation records
├── brands/                 Scanned brand DNA profiles
├── cache/                  Temporary computation cache
├── company-snapshots/      Full organization state snapshots
├── context/                Context assembly intermediate files
├── logs/                   Operational logs
├── model-log.jsonl         Model routing decisions (append-only)
├── model-config.json       Model routing configuration
├── orchestrate/            DAG orchestration state
├── reports/                Generated reports
├── runners/                Task runner input/output files
├── sessions/               Chat and interaction sessions
└── state/                  Feature state, scheduler state, knowledge state
```

### Audit Trail

The audit system uses append-only JSONL files with daily rotation:

```json
{
  "id": "evt_a1b2c3d4",
  "timestamp": "2026-03-02T14:30:00.000Z",
  "type": "agent.task.completed",
  "severity": "info",
  "source": "agent-executor",
  "actor": "backend-dev",
  "payload": {
    "taskId": "T3",
    "featureSlug": "user-auth",
    "model": "claude-3-sonnet",
    "cost": 0.0042,
    "durationMs": 3200
  }
}
```

Every significant action emits an audit event: gate passes/failures, governance
decisions, budget charges, agent task starts/completions, worktree operations,
and more. The index file enables fast lookups by type, severity, or time range.

### Consistency Model

Ogu uses a SAGA pattern for multi-step operations:

```
SAGA Transaction (e.g., compile):

  Step 1: Lock context          Compensate: unlock
  Step 2: Build tasks           Compensate: revert files
  Step 3: Run gates             Compensate: reset gate state
  Step 4: Update state          Compensate: restore previous state

  If Step 3 fails:
    -> Run compensation for Step 3, Step 2, Step 1 (reverse order)
    -> Emit audit: saga.compensation.executed
```

Idempotency keys prevent duplicate operations. Every state mutation carries a
transaction ID. Cross-layer reconciliation runs after compilation to detect and
repair inconsistencies between `.ogu/STATE.json`, audit logs, and feature state.

### Failure Domains

The system defines four failure domains with circuit breakers:

```
Domain 1: LLM Provider     -- API errors, rate limits, timeouts
  Circuit breaker: 3 failures in 60s -> open for 120s
  Degraded mode: fall back to cheaper model or simulate

Domain 2: Filesystem        -- disk full, permission errors, lock contention
  Circuit breaker: 5 failures -> open for 60s
  Degraded mode: read-only operations continue

Domain 3: Network           -- runner unreachable, API gateway timeout
  Circuit breaker: 3 failures -> open for 180s
  Degraded mode: local-only execution

Domain 4: Governance        -- policy engine error, approval service down
  Circuit breaker: 2 failures -> open for 300s
  Degraded mode: deny all (fail-safe)
```

### Health Score

System health is a weighted composite of 6 components:

```
Component              Weight   Source
─────────────────────  ──────   ────────────────────────
Gate pass rate         25%      Last N gate runs
Budget utilization     15%      Current spend vs. limit
Agent availability     20%      Agents in idle vs. total
Build success rate     20%      Recent build outcomes
Drift score            10%      Spec/contract drift level
Response latency       10%      Average LLM response time

Health = SUM(component_score * weight)

  90-100: Healthy
  70-89:  Degraded
  50-69:  Warning
  0-49:   Critical
```

---

## 8. Studio -- Visual Interface

### Architecture

Studio is a browser-based control room for the Ogu system:

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 19)                   │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐ │
│  │Dashboard│  │ Features │  │Pipeline│  │  Agents   │ │
│  │         │  │          │  │        │  │           │ │
│  │Gate     │  │List,     │  │DAG     │  │Canvas,    │ │
│  │progress │  │detail,   │  │view,   │  │execution  │ │
│  │Recent   │  │create,   │  │stages, │  │monitor,   │ │
│  │activity │  │wizard    │  │connect │  │status     │ │
│  └─────────┘  └──────────┘  └────────┘  └───────────┘ │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐ │
│  │  Chat   │  │  Brand   │  │ Theme  │  │  Budget   │ │
│  │         │  │          │  │        │  │           │ │
│  │SSE      │  │Color     │  │Presets,│  │Spend      │ │
│  │stream,  │  │swatches, │  │preview,│  │tracking,  │ │
│  │CTO mode │  │brand     │  │CSS     │  │per-role   │ │
│  │         │  │cards     │  │tokens  │  │breakdown  │ │
│  └─────────┘  └──────────┘  └────────┘  └───────────┘ │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐ │
│  │ Audit   │  │Governance│  │Terminal│  │ Settings  │ │
│  │         │  │          │  │        │  │           │ │
│  │Timeline,│  │Approval  │  │Embed.  │  │Config,    │ │
│  │filters, │  │panel,    │  │shell   │  │project    │ │
│  │search   │  │policy    │  │access  │  │state      │ │
│  └─────────┘  └──────────┘  └────────┘  └───────────┘ │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
              HTTP REST + WebSocket
                         │
┌────────────────────────┴────────────────────────────────┐
│                Express Backend (Node.js)                  │
│                                                         │
│  18 API Endpoints:                                       │
│    /api/org          Organization data from OrgSpec.json │
│    /api/agents       Agent state and session info        │
│    /api/budget       Budget state and transactions       │
│    /api/audit        Audit events with filters           │
│    /api/governance   Approval workflows, policy state    │
│    /api/kadima/*     Daemon control (start/stop/status)  │
│    /api/chat         LLM chat with SSE streaming         │
│    /api/exec         CLI command execution               │
│    /api/dispatch     Task dispatch to agents             │
│    /api/pipeline     Pipeline status and control         │
│    /api/phase-guard  Smart intent detection              │
│    /api/brand        Brand scan data                     │
│    /api/manifest     Feature manifests                   │
│    /api/wizard       Feature creation wizard             │
│    /api/brief        Morning brief generation            │
│    /api/project-state Project-wide state aggregation     │
│                                                         │
│  WebSocket Events:                                       │
│    allocation.update, governance.approval,                │
│    agent.status, agent.log, task.completed,               │
│    chat.stream, file.changed, scheduler.tick,             │
│    budget.alert                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### How Studio Reads State

Studio has **no database**. Every API endpoint reads directly from `.ogu/` files:

- `/api/org` reads `.ogu/OrgSpec.json`
- `/api/budget` reads `.ogu/budget/budget-state.json`
- `/api/audit` reads `.ogu/audit/index.json` and daily JSONL files
- `/api/agents` reads `.ogu/agents/*.state.json`

File watchers detect changes and push updates through WebSocket, so the UI
updates in real time when a gate passes, a task completes, or budget is consumed.

### Phase Guard

The phase guard is a smart intent detection system. When a user types a message
in Studio's chat, the phase guard analyzes the intent and determines which
pipeline phase should execute. This prevents users from accidentally running
build commands during the design phase or skipping required prerequisites.

---

## 9. SaaS Deployment

Ogu's file-based architecture enables two cloud deployment strategies:

### Strategy A: Container Per User (MVP -- 2-4 weeks)

Each user gets an isolated Docker container running the full Ogu stack.
Zero code changes required. Multi-tenancy through process isolation.

```
  User A  ──>  Container A  ──>  /data/userA/.ogu/
  User B  ──>  Container B  ──>  /data/userB/.ogu/
  User C  ──>  Container C  ──>  /data/userC/.ogu/
```

- Pros: Fast to market, full isolation, no code changes
- Cons: Higher per-user cost, container cold starts
- Target: Kubernetes / ECS / Fly.io with persistent volumes

### Strategy B: Storage Abstraction (Scale -- 3-6 months)

Replace all `fs` calls with a storage abstraction layer. A `storage-adapter.mjs`
module (already exists, currently unused) provides the interface.

```
  All users  ──>  Single application  ──>  storage-adapter.mjs
                                                │
                                    ┌───────────┼───────────┐
                                    │           │           │
                                  S3/GCS     DynamoDB    Local FS
                                (objects)   (metadata)  (dev mode)
```

- Pros: True multi-tenancy, serverless-ready, lower per-user cost
- Cons: Significant refactoring (217 files, ~3,700 fs call sites)
- Target: Serverless with object storage backend

**Recommended path**: Launch with Strategy A, migrate to Strategy B post-launch.

Full details in `Cloud_Integration.md`.

---

## 10. Key Design Principles

These principles are non-negotiable. They define what Ogu is and how it behaves.

### Compiler, Not Task Runner

Every phase produces **verified output** for the next phase. A task runner executes
commands and hopes they work. A compiler verifies correctness at every stage.
If IR validation fails, the build stops -- just like a type error stops `rustc`.

### File-Based Only

No databases. No Redis. No Elasticsearch. No vector stores. Everything is plain
files: Markdown for human-readable documents, JSON for machine-readable state,
JSONL for append-only logs. This means the entire system state is:

- **Git-trackable**: Every change is a commit
- **Inspectable**: Open any file in a text editor
- **Portable**: Copy the directory, get the full system
- **Reproducible**: Same files = same behavior

### Spec as Contract

`Spec.md` is law. Once the architect phase produces a specification, all
downstream phases must conform to it. If code violates the spec, compilation
fails. Changing the spec requires a **Spec Change Record (SCR)** with a
cryptographic hash chain linking the old spec to the new one.

### IR as Source of Truth

The Product IR (defined in `Plan.json` inputs/outputs) is the canonical reference
for what exists and what should exist. Drift detection compares the codebase
against the IR. Contract enforcement validates the IR against vault contracts.
Every verification gate ultimately traces back to the IR.

### Invariants Always Win

Invariants are documented in `docs/vault/01_Architecture/Invariants.md`. They
are hard architectural constraints that cannot be violated:

- Domain layer must not import from Infrastructure
- No hardcoded colors, spacing, or font values
- No TODO/FIXME in shipped features
- All state must be file-based and git-tracked
- CONTEXT.md is generated, never hand-edited

An agent may propose changing an invariant through an Architecture Decision Record
(ADR). But it may **never** silently violate one. Violation without an approved
ADR is a compilation failure.

### Nothing Manual

Even when a human reviews and approves something, Ogu updates automatically.
Approval triggers state transition. State transition triggers next phase.
The human is in the loop for decisions, not for bookkeeping. The system handles
its own housekeeping: context assembly, state updates, audit logging, memory
curation, and health checks all happen automatically.

---

## Appendix: Module Inventory

The system comprises approximately 1,169 library modules organized into layers:

| Layer                  | Module Count | Examples                                                                          |
| ---------------------- | ------------ | --------------------------------------------------------------------------------- |
| Core Pipeline          | ~52          | normalize-ir, ir-registry, drift-verifiers, gate-runner, phase-detector           |
| Agent System           | ~30          | agent-runtime, agent-executor, agent-registry, agent-identity, agent-lifecycle    |
| Governance             | ~20          | policy-engine, policy-ast, approval-lifecycle, escalation-chain, override-handler |
| Orchestration          | ~25          | dag-builder, kadima-engine, wave-executor, dag-runner, task-allocator             |
| Budget & Audit         | ~15          | budget-tracker, audit-emitter, audit-rotation, audit-replay                       |
| Memory & Context       | ~15          | semantic-memory, memory-fabric, prompt-builder, conversation-context              |
| Infrastructure         | ~40          | file-lock, advisory-lock, graceful-shutdown, health-probe, service-registry       |
| Scheduling             | ~20          | formal-scheduler, wfq-integration, cron-scheduler, priority-scheduler             |
| Resilience             | ~25          | circuit-breaker, retry-policy, error-recovery, failure-strategy, chaos-engine     |
| Merge & Locks          | ~15          | semantic-mutex, ast-merge, worktree-manager, file-mutex, lock-coordinator         |
| Studio Data            | ~20          | studio-data-provider, materialized-views, stream-cursor, event-batcher            |
| Generic Infrastructure | ~474         | di-container, middleware-pipeline, batch-processor, content-hasher                |

All modules follow the same patterns: file-based state, audit emission,
best-effort degradation (failures never crash the system), and JSON-serializable
inputs/outputs.

---

_This document describes the Ogu system as of v5 (2026-03-02)._
_For the component inventory, see `ARCHITECTURE.md`._
_For cloud deployment details, see `Cloud_Integration.md`._
_For architectural invariants, see `docs/vault/01_Architecture/Invariants.md`._

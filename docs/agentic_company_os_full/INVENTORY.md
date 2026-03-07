# Ogu — System Inventory

> Agentic Company OS: A compiler pipeline that transforms ideas into fully working applications.
>
> Version: Ogu v5 | Kadima daemon | Studio UI | 93 CLI commands | 14-gate pipeline
>
> Last updated: 2026-03-02

---

## Overview

| Metric | Value |
|--------|-------|
| Library modules | ~1,169 (695 dedicated + 474 generic) |
| CLI commands | 93 |
| Test files | 366 |
| E2E slices | 125+ |
| Total tests | 4,657 |
| All tests | Passing |
| Contracts | 23 |
| Studio pages | 15 |
| Studio components | 67 |
| Server API endpoints | 18 |

---

## Implementation Status

```
IMPLEMENTATION PLAN                 STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 0: OrgSpec & Agent Registry   ██████████  100%  DONE
Phase 1: Model Router               ██████████  100%  DONE
Phase 2: Budget System              ██████████  100%  DONE
Phase 3: Audit Trail                ██████████  100%  DONE
Phase 4: Governance Engine          ██████████  100%  DONE
Phase 5: Kadima Organization OS     ██████████  100%  DONE
Phase 6: Multi-Agent Runtime        ██████████  100%  DONE
Iteration 4: Formal Hardening       ██████████  100%  All 7 closures/enhancements
Iteration 5: OS Guarantees          ██████████  100%  All 7 closures/enhancements
Iteration 6: Absolute Horizon       ██████████  100%  All 4 closures
Iteration 7: Physical Architecture  ██████████  100%  All 5 topologies + 3 milestones
Gates (14)                          ██████████  100%  All gates integrated
Studio UI                           ██████████  100%  15 pages, 67 components, 18 APIs
Contracts                           ██████████  100%  23 contract files + 2 JSON schemas
CLI Commands                        ██████████  100%  93 commands registered
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OVERALL                             ██████████  ~99%
```

---

## Phase 0: OrgSpec & Agent Registry — DONE

- `OrgSpec.json` with 10 pre-built roles, providers, budget, teams, capabilities, governance
- `org.mjs` CLI: `org:init`, `org:show`, `org:validate`, `org:seed`
- `agent-registry.mjs` lib: `loadOrgSpec()`, `matchRole()`, `loadAgentState()`, `riskTierLevel()`
- Per-agent state files: `.ogu/agents/{roleId}.state.json`
- Status enum (idle/executing/blocked/escalating/exhausted), `updateAgentStatus()`, `pushTaskHistory()`
- OrgSpec Zod schema with full validation

---

## Phase 1: Model Router — DONE

- `model-router.mjs` (canonical): `routeModel()` role-based + `routeSelect()` capability-based
- `model-routing-config.mjs`: thin wrapper delegating to canonical router (unified)
- Routing policies: cost-optimized, quality-first, balanced
- Decision log: `.ogu/model-log.jsonl` (append-only)
- Audit emission: `model:routed`, `model:fallback` events
- Escalation chains: haiku -> sonnet -> opus with budget-aware downgrade

---

## Phase 2: Budget System — DONE

- `budget-tracker.mjs`: daily/monthly tracking, per-feature, per-model, per-role
- `budget-cmd.mjs` CLI: `budget:status`, `budget:check`, `budget:set`, `budget:report`
- Budget state: `.ogu/budget/budget-state.json`
- Transactions log: `.ogu/budget/transactions.jsonl`
- Audit emission: `budget:charged`, `budget:alert` (80%), `budget:exceeded` (100%)
- Per-role budget tracking with `byRole` breakdown

---

## Phase 3: Audit Trail — DONE

- `audit-emitter.mjs`: UUID, timestamp, type, severity, source, actor, payload
- `audit.mjs` CLI: `audit:show`, `audit:search`, `audit:replay`, `audit:export`
- Audit index: `.ogu/audit/index.json`
- Daily rotation: `.ogu/audit/YYYY-MM-DD.jsonl`
- Gate-level emission: `gate:started`, `gate:passed`, `gate:failed`, `gates:completed`
- Full event schema with `model`, `artifact`, `gate` blocks

---

## Phase 4: Governance Engine — DONE

- `governance.mjs` CLI: `governance:check`, `approve`, `deny`, `escalate`
- `policy-engine.mjs` + `policy-ast.mjs`: declarative rule engine with full condition operators
- Governance enforcement: actually blocks execution (DENY/REQUIRES_APPROVAL with override support)
- `governanceGate()` per task in `executeWave()` — blocked tasks excluded from dispatch
- Escalation chains with timeout-based escalation

---

## Phase 5: Kadima Organization OS — DONE

- `kadima.mjs` CLI: `kadima:start`, `kadima:stop`, `kadima:status`, `kadima:enqueue`, `kadima:allocate`
- Daemon: `tools/kadima/daemon.mjs` with HTTP API, scheduler, state machine, runner pool, SSE
- `kadima-engine.mjs`: unified orchestration with allocations, standups, `dispatchTask()` with distributed runner support
- `kadima-adapter.mjs`: strict boundary enforcement (dispatch/respond)
- `allocatePlan()`: role+capability+budget matching with freeze guard
- Standup generation with disk persistence (`.ogu/kadima/standups/`)
- Enhanced allocations schema (Kadima/Allocations/1.0) with backwards compatibility
- Orchestrate.mjs wired to Kadima: delegates to allocatePlan when daemon running
- Compile.mjs wired to Kadima: informational allocation check before build
- Studio page: Kadima.tsx with status, standups, allocations, logs tabs
- Server API: `/api/kadima/status/start/stop/standups/allocations/logs`

---

## Phase 6: Multi-Agent Runtime — DONE

- `agent-run.mjs` CLI: full pipeline (envelope -> governance -> budget -> LLM -> output)
- `llm-client.mjs`: `callLLM()` with simulate + Anthropic API
- `prompt-builder.mjs`: dual-mode prompt assembly with memory fabric `injectContext()` integration
- `response-parser.mjs`: LLM response -> OutputEnvelope
- `dag-builder.mjs`: dependency graph from Plan.json
- `agent-runtime.mjs`: `executeAgentTask()`, `executeWave()`, `executeDAG()` with:
  - Worktree isolation (create → execute → merge → cleanup)
  - Critical-path-aware DAG execution
  - Artifact dependency checking per wave
  - AST merge validation after parallel waves
  - Semantic mutex locking before dispatch
  - Distributed runner dispatch (opt-in)
- `artifact-store.mjs`: structured artifact passing with post-wave collection
- Agent identity with session binding
- Deterministic mode enforcement (blocks overrides + escalation)
- MicroVM sandbox allocation (opt-in per task)
- Determinism tolerance validation (post-LLM variance check)

---

## Iteration 4: Formal Hardening — DONE (all 7)

| Item | Status |
|------|--------|
| Closure 1: Policy AST | DONE — full condition operators, effect aggregation |
| Closure 2: Feature Lifecycle Guards | DONE — per-state invariants, triggers, timeouts |
| Closure 3: Feature Isolation | DONE — worktree-per-feature, filesystem boundaries |
| Closure 4: Agent Identity Contract | DONE — runtime enforcement, session binding |
| Enhancement 1: KadimaAdapter | DONE — strict boundary, dispatch/respond |
| Enhancement 2: Company Snapshot | DONE — full org state capture and replay |
| Enhancement 3: Failure Simulation | DONE — chaos injection mode |

---

## Iteration 5: OS Guarantees — DONE (all 7)

| Item | Status |
|------|--------|
| Closure 5: Consistency Model | DONE — SAGA transactions, idempotency, cross-layer reconciliation |
| Closure 6: Formal Scheduling | DONE — WFQ, priority classes, starvation prevention |
| Closure 7: Failure Domains | DONE — 4 domains, circuit breakers, degraded mode, failover chains |
| Closure 8: Formal Metrics Layer | DONE — 6-component weighted health score, SLA, regressions |
| Enhancement 4: Execution Graph Hash | DONE — wired into compile (pre/post build drift detection) |
| Enhancement 5: Deterministic Mode | DONE — wired into agent-executor (blocks overrides + escalation) |
| Enhancement 6: Company Freeze | DONE — wired into compile (OGU0099 abort) + kadima (allocation guard) |

---

## Iteration 6: Absolute Horizon — DONE (all 4)

| Item | Status |
|------|--------|
| Closure 9: Semantic Mutex & AST Merging | DONE — 819-line semantic-mutex (symbol locks, deadlock detection, queuing) + ast-merge wired into agent-runtime |
| Closure 10: Semantic Memory Fabric | DONE — 1032-line semantic-memory (RAG, TF-IDF, entity extraction, decay) + 680-line memory-fabric + wired into prompt-builder |
| Closure 11: Functional Determinism Tolerance | DONE — 818-line determinism-tolerance (AST comparison, adaptive thresholds, variance tracking) + wired into agent-executor |
| Closure 12: MicroVM Execution Matrix | DONE — 809-line microvm-matrix (VM lifecycle, pool, health monitoring) + wired into agent-executor |

---

## Iteration 7: Physical Architecture — DONE (all 5 topologies + 3 milestones)

### Topologies

| Topology | Status |
|----------|--------|
| Service Map | DONE — Kadima daemon + Studio server + service-registry |
| Persistence Layer | DONE — File-based with advisory locks, state compaction |
| IPC Protocol | DONE — HTTP + SSE + WebSocket, ipc-protocol defined |
| Process Lifecycle | DONE — PID, health, graceful shutdown |
| Task Lifecycle | DONE — enqueue → dispatch → execute → checkpoint → resume |

### Milestones

| Milestone | Status |
|-----------|--------|
| Milestone 1: Monolithic CLI | DONE — 93 commands, all tested |
| Milestone 2: Kadima Daemon | DONE — daemon runs, scheduler dispatches waves, runners execute, SSE streaming |
| Milestone 3: Distributed Runners | DONE — runner-remote (480 lines), pool with health-aware load balancing, capability routing, wired into kadima-engine and agent-runtime |

---

## Gates: 14-Gate Pipeline — DONE

All 14 gates implemented in `gates.mjs` (1611 lines) with audit emission:

1. **doctor** — Full health check
2. **context_lock** — Hash verification
3. **plan_tasks** — IR coverage validation
4. **no_todos** — No TODO/FIXME in code
5. **ui_functional** — All buttons, links, forms work
6. **design_compliance** — Design token adherence
7. **brand_compliance** — Brand colors, fonts, tone
8. **smoke_test** — E2E test suite runs
9. **vision** — DOM + screenshots + AI vision
10. **contracts** — Code matches vault contracts
11. **preview** — Services start, health verified
12. **memory** — Cross-project patterns recorded
13. **spec_consistency** — Spec <> IR alignment
14. **drift_check** — Drift detection

Compile pipeline additions:
- Pre-build: execution graph hash snapshot
- Post-build: graph hash drift check
- Pre-Phase 1: company freeze guard (OGU0099)
- Pre-Phase 2: task allocation validation
- Post-gates: consistency check + auto-reconciliation

---

## Contracts: 23 Architecture Contracts — DONE

1. OrgSpec.contract.md
2. Budget.contract.md
3. Audit.contract.md
4. Governance.contract.md
5. Kadima.contract.md
6. Kadima_Ogu.contract.md
7. KadimaAdapter.contract.md
8. FeatureLifecycle.v2.contract.md
9. FeatureIsolation.contract.md
10. AgentIdentity.contract.md
11. PolicyDeterminism.contract.md
12. Consistency.contract.md
13. Scheduler.contract.md
14. FailureDomains.contract.md
15. Metrics.contract.md
16. ExecutionGraphHash.contract.md
17. DeterministicMode.contract.md
18. SemanticMerge.contract.md
19. MicroVMMatrix.contract.md
20. Capability.contract.md
21. Override.contract.md
22. Sandbox.contract.md
23. Performance.contract.md

---

## CLI Commands: 93 Registered — DONE

### Core Pipeline (15)
compile, doctor, context, context:lock, feature:create, feature:validate, gates, phase, preview, spec:patch, profile, graph, impact, adr, drift

### Budget & Audit (10)
budget:status, budget:check, budget:set, budget:report, audit:show, audit:search, audit:export, audit:replay

### Governance (6)
governance:check, approve, deny, escalate, governance:diff

### Kadima & Agents (12)
kadima:start, kadima:stop, kadima:status, kadima:enqueue, kadima:allocate, agent:list, agent:show, agent:create, agent:status, agent:stop, agent:escalate

### Build & Orchestration (8)
orchestrate, dag:validate, build:dispatch, build:status, task:allocate, wave:run, compile:run

### Model & Routing (4)
model:providers, model:status, model:route, route:select

### Merge & Locks (5)
merge:preview, merge:ast, merge:conflicts, semantic:lock:acquire, semantic:lock:release

### Memory Fabric (2)
memory:fabric:inject, memory:merge

### MicroVM (3)
microvm:create, microvm:allocate, microvm:destroy

### Theme & Brand (8)
theme set, theme show, theme apply, theme presets, brand-scan, reference, design:show, design:pick

### Determinism & Chaos (8)
deterministic:enable, deterministic:disable, deterministic:status, freeze, thaw, chaos:plan, chaos:run, chaos:inject

### Maintenance & Memory (8)
init, validate, log, repo-map, clean, migrate, remember, learn, recall, trends

### Other (4)
studio, ports, wip, switch, status

---

## Studio UI: 15 Pages, 67 Components — DONE

### Pages
1. Welcome / Home
2. Dashboard (gate progress, recent activity, manifest proposals)
3. Chat (SSE streaming, session persistence, CTO mode)
4. Features (list, detail, create dialog, wizard)
5. Pipeline (stage nodes, DAG view, allocation kanban)
6. Agents (agent canvas, execution monitor)
7. Brand (color swatches, brand cards)
8. Theme (presets, preview, CSS token generation)
9. Audit (event timeline, filters, search)
10. Governance (approval panel, policy history)
11. Kadima (daemon status, standups, allocations, logs)
12. Terminal (embedded terminal)
13. Project (project management, build canvas)
14. Settings
15. Budget (budget view)

### Server API (18 endpoints)
`/api/org`, `/api/agents`, `/api/budget`, `/api/audit`, `/api/governance`,
`/api/kadima/*` (status, start, stop, standups, allocations, logs),
`/api/audit/events`, `/api/model-bridge`, `/api/chat`, `/api/exec`,
`/api/dispatch`, `/api/brand`, `/api/manifest`, `/api/wizard`,
`/api/brief`, `/api/project-state`, `/api/pipeline`, `/api/phase-guard`

### WebSocket Events
Allocation updates, governance approvals, agent status, agent logs, task completion,
chat streaming, file watchers, scheduler ticks, budget alerts

---

## SaaS Readiness

**Cloud Integration strategy documented in `Cloud_Integration.md`.**

Two strategies defined:
- **Strategy A (MVP)**: Container per user — zero code changes, 2-4 weeks to launch
- **Strategy B (Scale)**: Storage abstraction layer — full multi-tenancy, 3-6 months

Current coupling to local filesystem: 217 files, ~3,700 fs call sites.
`storage-adapter.mjs` exists but unused — activation path defined.

Recommended: Launch with Strategy A, migrate to Strategy B post-launch.

---

## E2E Test Coverage

**4,657 tests across 366 test files — all passing.**

| Slices | Area |
|--------|------|
| 1-18 | Core pipeline |
| 19-52 | Gap closure: agents, audit, budget, orchestration |
| 53-70 | Infrastructure: resources, config, metrics, plugins |
| 71-100 | Deep infra: logging, secrets, runners, provenance, chaos |
| 101-125 | Agentic OS: waves, DAG, kadima, governance, time travel |
| 126-366 | Extended coverage: all iterations, closures, enhancements |

All 93 CLI commands have test coverage.

---

## Summary

The Ogu Agentic Company OS is a comprehensive compiler pipeline with:

- **93 CLI commands** covering idea → production
- **~1,169 library modules** (695 dedicated + 474 generic)
- **14-gate compilation** with formal error codes and checkpoint/resume
- **Kadima daemon** with wave-based scheduling, distributed runners, health monitoring
- **Full governance** with policy AST, approval workflows, deterministic mode
- **23 architecture contracts** with drift enforcement
- **Studio UI** with 15 pages, 67 components, 18 API endpoints, WebSocket events
- **4,657 tests** — all passing
- **SaaS roadmap** documented (Container MVP → Storage Abstraction)

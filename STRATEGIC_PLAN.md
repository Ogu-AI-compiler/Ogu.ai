# Strategic Plan — Verified Execution Network

## Vision

The world does not have an AI productivity problem. It has an AI trust problem.

Every company experimenting with AI agents today faces the same wall: they cannot verify that what the AI produced is correct. Not "looks right" — actually correct. An AI can write a PRD that misses the core user problem. An AI can write code that passes a vibe check but fails in production. An AI can generate a test suite that covers nothing meaningful. And nobody catches it until it's expensive.

The billion-dollar opportunity is not building AI that does more work.
It is building infrastructure that **certifies** AI work.

This is what compilers did for software in the 1950s. Before compilers, you could write code that looked correct. After compilers, code was either provably correct or it did not ship. That shift — from "looks right" to "verified correct" — is worth trillions of dollars in productivity.

We are building the same thing for knowledge work.

The product: **170 domain compilers, each owned by an AI agent with a specific specialty, that certify the artifacts they produce before passing them to the next domain — all running on Ogu, the compiler runtime.**

Not "AI that writes PRDs." A PM compiler that certifies a PRD passed 12 domain gates and is guaranteed to be consumable by the Architecture compiler downstream.

Not "AI that writes code." A Frontend compiler with specific expertise — bundle size gates, accessibility gates, TypeScript strict mode gates — that certifies every component it produces before the QA compiler accepts it.

---

## Current State

### Kadima (tools/kadima/) ✅
- Node daemon, port 4210, 6 background loops + React UI (tools/kadima/ui/)
- Full OS: scheduler, state machine, circuit prober, consistency checker, metrics collector, knowledge updater
- HTTP API: all project, wizard, brief, exec, marketplace, ogu, dispatch endpoints
- React frontend served from ui/dist/ in production; Vite dev proxy in development
- **Phase 1 complete** — Kadima is the single architecture (UI + API + daemon)

### Ogu (tools/ogu/) ✅
- 120+ CLI commands, 715+ library modules
- The **compiler runtime**: pipeline phases (idea → done), 14 meta-gates, IR validation, DAG orchestration, audit trail
- Orchestrates the 170 domain compilers — provides the infrastructure they run on
- See: [What is Ogu now?](#what-is-ogu-now) below

### Marketplace (64 roles, 68 playbooks, ~100 agents) ✅
- 64 roles across 10 categories, each with a deep operational playbook in `tools/ogu/playbooks/`
- 3 specialty addendums (react, node, kubernetes)
- V2 agents: 4-layer prompt (playbook → specialty → DNA → experience), tier promotion, role evolution
- Agent Trainer runs post-compile: distills learning events → experience rules → tier/role changes
- **Status**: agents are workers with rich playbooks. Domain compiler gates not yet enforced per-agent.

---

## What is Ogu Now?

> This is the most important architectural question as we scale to 170 domain compilers.

**Before:** Ogu was the compiler — one generic pipeline that wrote code and validated it through 14 gates.

**Now:** Ogu is the **compiler runtime** — the infrastructure on which 170 domain compilers run.

The analogy: LLVM is not "a compiler." LLVM is a compiler infrastructure that many language frontends run on. Clang, Rust, Swift — they're all domain compilers that use LLVM as their runtime. LLVM provides the IR, the optimization passes, the backend. The language frontends provide the domain knowledge.

Ogu is LLVM. The 170 agent compilers are the language frontends.

**What Ogu provides to every domain compiler:**

```
1. Pipeline infrastructure    — phases, DAG execution, wave-based parallelism
2. IR (Intermediate Repr.)    — Plan.json as the contract between all compilers
3. Meta-gates (14)            — validate that the artifact chain is complete and consistent
4. Handoff validation         — IR input/output chain integrity between compilers
5. Memory system              — vault, context assembly, audit trail, drift detection
6. Attestation primitives     — crypto-attestation.mjs for sealing artifacts
7. Contract system            — 23 contracts that define what each compiler must accept/produce
8. Observability              — every compiler's output is recorded in the audit trail
```

**What each domain compiler adds on top of Ogu:**

```
1. Domain gates               — bundle size, accessibility, TypeScript strict, SQL injection, etc.
2. Domain rules               — what's allowed, what's rejected, what triggers escalation
3. Handoff spec               — what inputs it requires, what outputs it certifies
4. Evolution                  — compiler rules improve from project experience
```

**The result:**

```
Brief
  → Ogu orchestrates CTO pipeline → team assembled
  → PM compiler (runs on Ogu) → certifies PRD
  → Architect compiler (runs on Ogu) → certifies Spec.md + Plan.json
  → Engineer compiler (runs on Ogu) → certifies implementation
  → QA compiler (runs on Ogu) → certifies test coverage
  → Ogu meta-gates validate the full artifact chain
  → ogu compile seals the project with attestation
```

Ogu didn't become less important when we built 170 compilers on top of it. It became the foundation everything depends on.

---

## The Two Initiatives

### Initiative 1 — One Architecture ✅ COMPLETE

**Completed**:
- All API routes (brief, wizard, exec, ogu-api, marketplace, dispatch, researcher) in Kadima
- React frontend at tools/kadima/ui/, served by Kadima daemon
- Frontend uses SSE (/api/events) instead of WebSocket
- One server, one port (4210), one architecture

---

### Initiative 2 — 170 Domain Compilers

**Goal**: Each marketplace agent becomes a domain compiler — not a worker that executes tasks, but a compiler that certifies the artifacts it produces.

**The core shift:**

```
Today:
  Kadima dispatches task → Agent executes → Output accepted as-is

After:
  Kadima dispatches task → Agent executes → Agent's compiler runs domain gates
  → Gates pass → Artifact sealed with attestation → Output certified
```

**Compiler structure:**

```
.ogu/compilers/
  {agent_id}/
    compiler.json        — gates, contracts, pipeline phases, handoff spec
    rules.json           — domain rules (encoded from playbook)
    evolution.jsonl      — every change, why, what triggered it
    benchmarks.json      — gate pass rates over time
    compatibility.json   — which downstream compilers accept this compiler's output
```

**How compilers get built:**

Manually. One by one. The playbook of each agent already contains everything needed — the rules, the checklists, the anti-patterns, the escalation triggers. These are read carefully and encoded as verifiable gates.

This is not extraction by LLM. This is deliberate design work. The compilers are the product.

**The evolution loop:**

- Gate failure → learning event → compiler version bump
- Repeated failures on same gate → gate rule refinement
- Successful handoffs → compatibility score update between compilers
- Tier promotion of agent → compiler gets access to stricter gate set

---

## Initiative 3 — Verified Execution Network (the commercial product)

**What you sell:**
Not "AI agents that do work."
**"Verified execution pipelines where every artifact is certified by a domain compiler before handoff."**

**What enterprises pay for:**
Enterprises do not pay for AI productivity. They pay for **accountability and auditability**.

- "Show me the gates that ran on this PRD before engineering started" — yes
- "Who certified this component was accessible?" — yes, compiler_agent_0001 v1.3, gates: 8/8 passed
- "Why did the QA compiler reject this artifact?" — gate: integration-test-coverage, required ≥ 80%, actual 61%
- "Which agents have never had a compliance gate failure?" — queryable from compiler benchmarks

This is not available anywhere else. Not in GitHub Copilot, not in Devin, not in any agent framework. They all produce output. None of them certify it.

**The moat:**

The moat is the compiler definitions — built through deliberate design work, enriched through project experience, validated across hundreds of handoffs. At 1,000 projects: the compilers know which gate combinations predict project success. At 10,000 projects: the handoff compatibility graph tells you the optimal team composition before a project starts.

---

## Execution Phases

### Phase 1 — One Architecture ✅ COMPLETE

**Outcome**: Kadima is the OS. One server, one port, one architecture.

### Phase 2 — Compiler Schema + First Compiler

**Objective**: Define the schema. Build the first reference compiler manually.

1. Define compiler.json schema (the contract all compilers follow)
2. Define `.ogu/compilers/` registry structure
3. Build `compiler-registry.mjs` (register, lookup, version, benchmark)
4. Choose the first agent (clearest domain) and build its compiler manually
5. Build `compiler-executor.mjs` (runs domain gates after agent output)
6. Wire compiler-executor into Kadima dispatch path

**Done when**: One compiler running on real task outputs. Gates enforced. Attestation written.

### Phase 3 — 170 Compilers

**Objective**: Build all compilers manually. One by one. With care.

1. Map all 64 roles by category (engineering roles first — highest frequency)
2. For each: read playbook → extract rules → write domain gates → define handoff spec
3. Every 10 compilers: benchmark against existing project data

**Done when**: All agents have a compiler.json. All outputs in Kadima are routed through the producing agent's compiler.

### Phase 4 — Handoff IR + Attestation

**Objective**: Every handoff between compilers is validated.

1. Define Handoff IR schema
2. Build `handoff-validator.mjs` — compiler B validates compiler A's sealed artifacts
3. Build attestation store using existing `crypto-attestation.mjs`
4. Build compatibility tracker
5. Handoff rejection is a first-class event

**Done when**: Full artifact chain runs end-to-end. No compiler accepts unvalidated input.

### Phase 5 — Evolution + Intelligence

**Objective**: Compilers improve from project experience. The marketplace becomes intelligent.

1. Gate failure → version bump → new rule (automated)
2. Compiler benchmarking dashboard
3. Team composition optimizer (brief → recommend compiler combination by historical success)
4. Cross-compiler analytics (which gate failures predict project delays?)

**Done when**: Compilers have version history driven by real data. Recommendations are data-backed.

---

## What We Are Building

```
Phase 1:  One architecture          ✅ DONE  → foundation
Phase 2:  First compiler live               → proof of concept
Phase 3:  170 compilers live               → differentiated product
Phase 4:  Verified artifact chain          → enterprise-grade trust
Phase 5:  Self-improving compiler network  → the moat
```

The company is not an AI agent company.
The company is **the compiler runtime that makes AI-produced work verifiable and trustworthy**.

That is a different category. Categories, not companies, become worth a billion dollars.

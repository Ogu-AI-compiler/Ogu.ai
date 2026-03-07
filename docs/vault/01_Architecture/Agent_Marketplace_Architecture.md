# Agent Marketplace Architecture

## Overview

The marketplace is a living ecosystem of AI agents that grow, specialize, and evolve over time. Agents are hired into projects, execute real work through the Ogu pipeline, learn from outcomes, and advance — changing roles, tiers, and capabilities based on proven performance.

This is not a static catalog. It's a workforce that develops.

---

## Agent Taxonomy

64 roles across 14 categories. Every role has a dedicated deep playbook — an operational manual that defines what the agent knows and how it works.

### Product (2)
| Role | What it does |
|------|-------------|
| Product Manager | Defines requirements, writes PRDs, prioritizes backlog, manages stakeholders |
| Product Analyst | Analyzes usage data, identifies opportunities, measures feature impact |

### Design (4)
| Role | What it does |
|------|-------------|
| UI/UX Designer | Designs interfaces, user flows, wireframes, interaction patterns |
| Art Director | Sets visual direction, brand consistency, design systems |
| Motion Designer | Animations, transitions, micro-interactions, loading states |
| Brand Designer | Logo, typography, color systems, brand guidelines |

### Content (3)
| Role | What it does |
|------|-------------|
| Copywriter | UI text, marketing copy, onboarding flows, error messages |
| Technical Writer | API docs, user guides, changelogs, architecture docs |
| Content Strategist | Content structure, tone of voice, information architecture |

### Architecture (8)
| Role | What it does |
|------|-------------|
| Backend Architect | Server-side systems, APIs, data flow, service boundaries |
| Frontend Architect | Component architecture, state management, rendering strategy |
| Mobile Architect | Native/hybrid architecture, offline-first, platform-specific patterns |
| Data Architect | Data models, pipelines, warehousing, schema design |
| Cloud/Infra Architect | Cloud services, networking, scaling, cost optimization |
| System Architect | End-to-end system design, cross-cutting concerns, integration points |
| Integration Architect | Third-party integrations, API contracts, event-driven architecture |
| Game Architect | Game loops, physics, state machines, multiplayer architecture |

### Engineering (8)
| Role | What it does |
|------|-------------|
| Frontend Developer | Implements UI components, pages, client-side logic |
| Backend Developer | Implements APIs, business logic, server-side services |
| Mobile Developer | Implements native/hybrid mobile applications |
| Fullstack Developer | Works across frontend and backend, end-to-end features |
| Data Engineer | Builds data pipelines, ETL, data infrastructure |
| ML Engineer | Implements ML models, training pipelines, inference services |
| Game Developer | Implements game mechanics, rendering, physics, gameplay |
| Embedded/IoT Developer | Firmware, device communication, resource-constrained systems |

### Data & AI (4)
| Role | What it does |
|------|-------------|
| Data Scientist | Statistical analysis, experiment design, model selection |
| Algorithm Specialist | Algorithm design, optimization, complexity analysis |
| ML/AI Researcher | Novel approaches, model architecture, evaluation |
| Data Analyst | Dashboards, reports, data visualization, insight extraction |

### Security (4)
| Role | What it does |
|------|-------------|
| CISO / Security Architect | Security strategy, threat landscape, security architecture |
| AppSec Engineer | Application security, secure coding, vulnerability remediation |
| Penetration Tester | Offensive security, vulnerability discovery, exploit chains |
| Compliance Officer | Regulatory compliance, audits, policy enforcement, GDPR/SOC2 |

### Quality (3)
| Role | What it does |
|------|-------------|
| QA Engineer | Test planning, test execution, bug triage, regression testing |
| Performance Engineer | Load testing, profiling, bottleneck identification, optimization |
| Accessibility Engineer | WCAG compliance, screen reader testing, inclusive design |

### DevOps & Infra (4)
| Role | What it does |
|------|-------------|
| DevOps Engineer | CI/CD pipelines, automation, build systems |
| SRE | Reliability, incident response, SLOs, chaos engineering |
| Platform Engineer | Internal tools, developer experience, infrastructure abstraction |
| DBA | Database tuning, replication, backup, query optimization |

### Marketing & Growth (3)
| Role | What it does |
|------|-------------|
| Growth Engineer | A/B tests, funnel optimization, experimentation infrastructure |
| SEO Specialist | Technical SEO, crawlability, structured data, performance |
| Analytics Engineer | Event tracking, attribution, dashboard implementation |

### DevRel & Community (2)
| Role | What it does |
|------|-------------|
| Developer Advocate | Tutorials, examples, community engagement, SDK docs |
| Solutions Architect | Customer-facing technical design, integration guidance |

### Process (2)
| Role | What it does |
|------|-------------|
| Scrum Master / Agile Coach | Process facilitation, retrospectives, flow optimization |
| Release Engineer | Release process, versioning, rollback strategy, feature flags |

### Localization (1)
| Role | What it does |
|------|-------------|
| Localization Engineer | i18n implementation, translation management, locale handling |

### Cross-cutting Expert (16)
Specialists with deep expertise in a specific concern. Cost more than generalists. Hired for focused review, audit, or advisory work.

| Expert | Focus |
|--------|-------|
| Security & Edge Cases | Threat modeling, attack vectors, defensive coding |
| Scale & Performance | Load handling, caching strategy, resource efficiency |
| Simplicity & Clean Code | Code clarity, refactoring, complexity reduction |
| Testing & Coverage | Test strategy, coverage gaps, test architecture |
| DevOps & Deployment | Pipeline design, deployment strategy, rollback |
| UX & Accessibility | Usability, inclusive design, interaction quality |
| Data & Privacy | Data handling, PII, consent, encryption at rest |
| API Design & Contracts | API consistency, versioning, backward compatibility |
| Error Handling & Resilience | Failure modes, graceful degradation, retry strategy |
| Database & Data Modeling | Schema design, query optimization, data integrity |
| Concurrency & Async | Race conditions, deadlocks, async patterns |
| Documentation & DX | Developer experience, onboarding, self-serve docs |
| Cost & Resource Optimization | Cloud costs, resource allocation, efficiency |
| Internationalization | i18n patterns, RTL, locale-aware formatting |
| Monitoring & Observability | Logging, tracing, alerting, dashboards |
| Migration & Compatibility | Breaking changes, version migration, data migration |

---

## System Prompt Architecture

Every agent's system prompt is assembled from 4 layers. This is not a flat string — it's a structured composition that keeps knowledge stable while allowing growth.

### Layer 1: Base Playbook (immutable)

The operational manual for the role. Written by humans. 300-500 lines of deep, actionable knowledge: methodology, checklists, what to do, what to avoid, how to think about problems.

A QA Engineer playbook doesn't say "you know testing." It says exactly how to analyze code for bugs, what edge cases to check, how to structure test plans, what constitutes a pass/fail, how to report findings.

**This layer never changes.** It is the contract. When an agent changes role, it gets a new playbook.

### Layer 2: Specialty Addendum (immutable per specialty)

Additional knowledge specific to the agent's specialty within its role. A Frontend Developer who specializes in React gets React-specific patterns, hooks best practices, component architecture guidelines.

**Changes only when the agent's specialty changes.**

### Layer 3: DNA Style Layer (immutable forever)

The agent's personality. Set at creation, never changes. Affects tone, communication style, risk appetite, work rhythm — not knowledge.

```
DNA dimensions:
  work_style:          async-first | sync-preferred | deep-work | sprint-burst
  communication_style: concise | verbose | visual | data-driven | narrative
  risk_appetite:       conservative | balanced | aggressive | experimental
  strength_bias:       analytical | creative | systematic | collaborative | decisive | meticulous
  tooling_bias:        cli | gui | automation | manual | hybrid
  failure_strategy:    retry | escalate | rollback | checkpoint | failfast
```

Two agents with the same playbook and specialty but different DNA will produce different output. One will be cautious and thorough, another will be fast and bold. Like real people.

### Layer 4: Experience Addendum (evolves over time)

Concrete rules learned from real project outcomes. **Not prose — a checklist.** Derived from PatternRecord data, not generated from imagination.

Example for a QA Engineer after 30 projects:

```
## Learned Rules

- Always add a regression test for every fixed bug.
- For React async flows, explicitly test cancellation and stale state updates.
- If TypeScript strict mode fails, resolve types before refactoring logic.
- Monorepo projects: check cross-package imports before integration tests.
- When gate 5 fails on forms, verify both submit handler AND validation.

## Known Failure Modes

- Race condition in useEffect cleanup — seen in 4 projects, test explicitly.
- Missing error boundary around lazy-loaded routes — check every time.

## Strengths (proven)

- React component testing: 98% success rate across 15 projects.
- API integration tests: caught 12 bugs other agents missed.
```

**Updated only by the Agent Trainer process, never by the agent itself.**

### Experience Retrieval: Per-Agent Vector Store

The Experience Addendum is not loaded in full into the system prompt. Each agent has a personal vector store (embedded patterns, indexed by task type, failure mode, and context signature). At runtime, only the **relevant** experience is retrieved and injected.

```
Task arrives → extract context (role, task type, tech stack, feature)
           → vector search agent's experience store
           → top K relevant rules injected into Layer 4
           → remaining experience stays in store, not in prompt
```

This solves two problems:
- **Token efficiency**: An agent with 200 learned rules only loads the 5-10 relevant ones per task
- **Relevance**: A React-specific rule doesn't pollute a Node.js backend task

The full experience store is persisted in the agent profile. The vector index is rebuilt on prompt_version change.

### Assembly

At runtime, the system prompt is assembled:

```
[Layer 1: Base Playbook]
[Layer 2: Specialty Addendum]
[Layer 3: DNA Style Layer]
[Layer 4: Experience Addendum — retrieved via vector search, not full dump]
```

Deterministic per query. Reproducible. Versionable.

---

## Agent Generation

### Flow

```
1. Select role + specialty + tier
              ↓
2. Load Base Playbook (from playbooks/)
              ↓
3. Load Specialty Addendum (from specialties/)
              ↓
4. Generate DNA (deterministic from seed)
              ↓
5. Generate name (deterministic from seed)
              ↓
6. LLM call: "Rephrase the playbook in this agent's voice.
              Keep all rules and checklists intact.
              Adjust tone and emphasis to match DNA."
              ↓
7. Save agent profile with assembled system_prompt
              ↓
8. Experience Addendum starts empty
```

Step 6 is the only LLM call. It doesn't invent knowledge — it rephrases existing knowledge in the agent's personality. Two QA agents will have the same operational knowledge but different voices.

### What generation costs

One LLM call per agent. The playbook is the source of truth; the LLM only adjusts style. If generation fails or produces garbage, the raw playbook is used as fallback.

---

## Agent Trainer

An external process that evaluates agents after project completion and updates their Experience Addendum, tier, and potentially their role.

### When it runs

After `ogu compile` succeeds. For every marketplace agent that participated in the project.

### What it does

```
1. Collect learning events since last update
              ↓
2. Distill into concrete rules (not prose)
   - Top patterns (what worked)
   - Top failure modes (what broke)
   - Prevention checks (what to verify next time)
              ↓
3. Update Experience Addendum
   - Append new rules
   - Compress if > threshold (keep top N by confidence)
              ↓
4. Evaluate tier change
   - Promotion criteria met? → tier up + price up
   - Demotion criteria met? → tier down + price down
              ↓
5. Evaluate role change
   - Agent consistently performing at a different level?
   - Accumulated expertise in a new domain?
   → Change role + assign new Base Playbook
   → Experience Addendum carries over
              ↓
6. Verification gate
   - New prompt doesn't contradict playbook
   - New prompt doesn't remove safety constraints
   - Optional: synthetic task to validate behavior
              ↓
7. Save updated profile
   - Bump prompt_version
   - Update last_prompt_update timestamp
   - Log change in agent history
```

### Tier movement criteria

**Promotion** (must meet ALL):
- success_rate > 0.9 over last N projects
- projects_completed > threshold for current tier
- Zero critical regressions in last M projects
- At least one "exceptional" learning event

**Demotion** (any ONE triggers):
- success_rate < 0.6 over last N projects
- Repeated gate failures on same pattern (not learning)
- Security or data regression

### Role change criteria

Role changes are rare and significant. They require:

- Sustained performance in tasks outside current role scope
- Accumulated patterns that match a different role's playbook
- The agent has been "borrowed" for cross-role tasks and succeeded repeatedly

Example: A Backend Developer who consistently designs system architecture, recommends service boundaries, and produces architecture docs — the Trainer flags them for review as a potential System Architect.

**Role changes require a new Base Playbook** but the Experience Addendum transfers — after generalization.

### Experience Generalization on Role Change

Raw experience from a previous role contains low-level details that don't apply to the new role. A Backend Developer's rule "always check null in Express middleware" is noise for a System Architect.

When an agent changes role, the Trainer runs a **generalization pass**:

```
Old experience (concrete):
  "Always check null in Express middleware params"
  "Use connection pooling for PostgreSQL — max 20 connections"
  "Race condition in useEffect cleanup — test explicitly"

Generalized for Architect role (abstract):
  "Input validation at service boundaries is critical — seen failures without it"
  "Database connection management requires explicit resource limits"
  "Async lifecycle management is a common failure mode in frontend"
```

The generalized experience carries forward. The raw details are archived (not deleted) in case the agent returns to a similar role later.

---

## Pricing

Price is a function of role, tier, and performance:

```
final_price = base_price(tier) × performance_multiplier

base_price:
  Tier 1: $1.50  (junior)
  Tier 2: $4.00  (mid)
  Tier 3: $8.00  (senior)
  Tier 4: $16.00 (principal/expert)

performance_multiplier: 0.5 — 2.0
  Based on: success_rate, projects_completed, utilization
```

Cross-cutting Experts start at Tier 3 minimum — they're specialists, not generalists.

When an agent gets promoted, their base_price jumps to the new tier. When they demonstrate exceptional performance, the multiplier increases. Both affect what the user pays.

---

## Data Model

### Agent Profile

```json
{
  "agent_id": "agent_0042",
  "name": "Finn Mercer",
  "role": "QA Engineer",
  "specialty": "frontend",
  "tier": 3,
  "dna": {
    "work_style": "deep-work",
    "communication_style": "concise",
    "risk_appetite": "conservative",
    "strength_bias": "meticulous",
    "tooling_bias": "automation",
    "failure_strategy": "checkpoint"
  },
  "skills": ["test-planning", "regression-testing", "react", "accessibility", ...],
  "system_prompt": "... assembled from 4 layers ...",
  "prompt_version": 7,
  "last_prompt_update": "2026-03-04T10:00:00Z",
  "experience_digest": "... the Experience Addendum text ...",
  "experience_sources_count": 23,
  "last_learning_event_id": "evt-abc123",
  "capacity_units": 8,
  "base_price": 8.00,
  "performance_multiplier": 1.35,
  "stats": {
    "success_rate": 0.94,
    "projects_completed": 47,
    "utilization_units": 3,
    "gate_failures": 2,
    "last_task_duration_ms": 12000
  },
  "role_history": [
    { "role": "Frontend Developer", "tier": 1, "from": "2026-01-15", "to": "2026-02-10" },
    { "role": "Frontend Developer", "tier": 2, "from": "2026-02-10", "to": "2026-03-01" },
    { "role": "QA Engineer", "tier": 3, "from": "2026-03-01", "to": null }
  ],
  "created_at": "2026-01-15T08:00:00Z",
  "status": "available"
}
```

### Key fields

| Field | Mutability | Changed by |
|-------|-----------|------------|
| `agent_id` | immutable | set at creation |
| `name` | immutable | set at creation |
| `dna` | immutable | set at creation |
| `role` | mutable | Agent Trainer |
| `tier` | mutable | Agent Trainer |
| `system_prompt` | mutable | Agent Trainer (recomposed from layers) |
| `prompt_version` | mutable | incremented on every prompt update |
| `experience_digest` | mutable | Agent Trainer |
| `skills` | mutable | derived from playbook + specialty + experience |
| `stats` | mutable | post-execution hooks |
| `performance_multiplier` | mutable | pricing engine |
| `role_history` | append-only | Agent Trainer |

---

## Storage Layout

```
.ogu/marketplace/
├── playbooks/                    ← 64 Base Playbooks (source of truth)
│   ├── pm/
│   │   └── product-manager.md
│   ├── design/
│   │   ├── ui-ux-designer.md
│   │   ├── art-director.md
│   │   ├── motion-designer.md
│   │   └── brand-designer.md
│   ├── architecture/
│   │   ├── backend-architect.md
│   │   ├── frontend-architect.md
│   │   └── ...
│   ├── engineering/
│   │   ├── frontend-developer.md
│   │   └── ...
│   ├── expert/
│   │   ├── security-edge-cases.md
│   │   ├── scale-performance.md
│   │   └── ...
│   └── .../
├── specialties/                  ← Specialty Addendums
│   ├── react.md
│   ├── node.md
│   ├── kubernetes.md
│   └── ...
├── agents/                       ← Agent profiles
│   ├── agent_0001.json
│   ├── agent_0002.json
│   └── ...
├── allocations/                  ← Hiring records
│   ├── index.json
│   └── {allocation_id}.json
├── patterns/                     ← Learned patterns (PatternRecord)
│   └── {pattern_id}.json
├── learning-candidates/          ← Raw learning events
│   └── {event_id}.json
├── pricing/                      ← Pricing config
│   ├── tiers.json
│   └── multipliers.json
├── trainer/                      ← Agent Trainer logs
│   ├── promotions.jsonl
│   ├── role-changes.jsonl
│   └── prompt-updates.jsonl
└── index.json                    ← Agent index for fast lookup
```

### Storage Evolution: SQLite

The file-based layout above works for single-user local development. As the marketplace scales (concurrent agents, parallel compilation, multiple projects), flat JSON files create race conditions — two processes updating the same agent profile simultaneously will clobber each other.

**Planned migration**: Move allocations, stats, learning events, and agent index to SQLite. Benefits:

- **Atomic writes**: No file-lock contention between parallel agent executions
- **Query efficiency**: "Find all available QA agents with success_rate > 0.9" is a SQL query, not a full directory scan
- **Vector search**: SQLite extensions (sqlite-vec) enable per-agent experience retrieval without an external vector DB
- **Single file**: `.ogu/marketplace/marketplace.db` — still git-trackable, still file-based philosophy

Playbooks and specialty addendums stay as `.md` files — they're human-authored content, not transactional data.

---

## Integration with Ogu Pipeline

### Hiring

```bash
ogu agents populate --count=30    # Generate agents for marketplace
ogu agents list --role=QA         # Browse available agents
ogu agents hire agent_0042 my-app 2  # Hire agent for project
```

### Execution

When `ogu agent:run` or `ogu compile` executes a task:

1. **marketplace-bridge.mjs** checks if a hired agent matches the role
2. If yes → uses the agent's system_prompt (all 4 layers assembled)
3. Searches pattern-store for relevant learned patterns → injects into prompt
4. Executes task through normal pipeline (budget, governance, LLM call, gates)
5. After completion → post-execution hooks update stats and trigger learning

### Post-project (Agent Trainer)

After `ogu compile` succeeds:

1. Trainer collects learning events for each participating agent
2. Distills into Experience Addendum rules
3. Evaluates tier/role changes
4. Runs verification gate
5. Updates agent profiles

### The lifecycle

```
Generate → Hire → Execute → Learn → Grow → Execute → Learn → Grow → ...
                                       ↓
                              Promote / Change Role
                                       ↓
                              New Playbook + Carried Experience
```

Agents start as blank Tier 1 workers. Over time, through real project work, they become senior architects and domain experts. Their system prompt — and therefore their behavior — evolves based on proven outcomes, not arbitrary configuration.

The marketplace is alive.

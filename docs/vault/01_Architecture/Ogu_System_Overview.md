# Ogu — System Overview

## Purpose

Ogu is the execution and memory system of this repository.

It provides three guarantees:
1. **Deterministic memory** — every decision, invariant, and contract is stored in version-controlled files. Nothing lives only in context windows.
2. **Context assembly** — before any implementation begins, Ogu assembles a complete, relevant context from long-term knowledge and runtime state.
3. **Architectural consistency** — implementation is constrained by documented invariants. Code that violates them is rejected.

Ogu is not a tool you install. It is a structure embedded in the repository itself.

---

## Two Memory Layers

### Layer A: Knowledge Vault

**Location:** `docs/vault/`
**Purpose:** Long-term architectural knowledge. Stable, rarely changes. Source of truth.

| Directory | Contains |
|---|---|
| `01_Architecture/` | System overview, invariants, patterns, repo map |
| `02_Contracts/` | API contracts, interface definitions, module boundaries |
| `03_ADRs/` | Architecture Decision Records — why decisions were made |
| `04_Features/` | Feature specifications — what each feature does and how |

The vault is **append-mostly**. Entries are added or updated, rarely deleted. Every change is a git commit with a clear reason.

### Layer B: Runtime Memory

**Location:** `.ogu/`
**Purpose:** Operational memory for execution. Changes frequently. Tracks current state.

| File | Purpose |
|---|---|
| `MEMORY.md` | Curated long-term facts — conventions, preferences, lessons learned |
| `SESSION.md` | Current session state — what we're working on, what's pending |
| `STATE.json` | Machine-readable state — current phase, active task, involvement level |
| `memory/YYYY-MM-DD.md` | Daily logs — decisions made, problems encountered, solutions found |
| `CONTEXT.md` | Assembled active context (generated, not hand-written) |

Runtime memory is **ephemeral by nature, persistent by design**. Sessions end, but their artifacts remain in daily logs and curated memory.

---

## Context Assembly

Before any implementation step, Ogu assembles a single file:

```
.ogu/CONTEXT.md
```

This file is constructed from:

```
docs/vault/01_Architecture/Invariants.md    — what must never be violated
docs/vault/02_Contracts/*                   — module boundaries and interfaces
docs/vault/01_Architecture/Repo_Map.md      — current structure of the codebase
docs/vault/01_Architecture/Patterns.md      — established patterns to follow
docs/vault/04_Features/<relevant>.md        — spec for the feature being built
.ogu/MEMORY.md                              — accumulated knowledge
.ogu/memory/<recent>.md                     — recent daily logs for continuity
```

CONTEXT.md is **generated, never hand-edited**. It is the single source of truth for any implementation step. If an agent or skill needs to understand the system before acting, it reads CONTEXT.md.

---

## Invariant Rule

```
If implementation conflicts with vault invariants, invariants win.
```

This is non-negotiable. Invariants are documented in `docs/vault/01_Architecture/Invariants.md` and represent hard architectural constraints.

An agent may propose changing an invariant through an ADR. But it may **never** silently violate one. Violation without an approved ADR is a build failure.

---

## Design Constraints

- **File-based only** — all memory is plain files (Markdown, JSON). No databases.
- **Git-tracked only** — everything is versioned. No external state.
- **No external services** — no APIs, no cloud storage, no vector databases.
- **Deterministic behavior** — same inputs produce same context assembly.
- **No embeddings in v1** — context relevance is determined by explicit references, not semantic search.

---

## Non-Goals

Ogu is **NOT**:

- A runtime engine — it does not execute code or manage processes
- A framework — it does not impose a programming language or library
- A cloud service — it runs entirely within the local repository
- An AI model — it is a structure that AI agents read and write to

Ogu **IS**:

- A memory system — it remembers what matters across sessions
- An execution support system — it assembles context so agents act correctly
- A consistency enforcer — it ensures the codebase respects its own rules

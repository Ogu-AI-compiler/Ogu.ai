// All file templates for ogu init.
// Keys are paths relative to repo root. Values are file contents.

export const templates = {
  // === docs/vault ===

  "docs/vault/00_Index.md": `# Knowledge Vault — Index

This is the root index of the project's knowledge vault.

## Structure

| Directory | Purpose |
|---|---|
| \`01_Architecture/\` | System overview, invariants, patterns, repo map |
| \`02_Contracts/\` | API contracts, interface definitions, module boundaries |
| \`03_ADRs/\` | Architecture Decision Records |
| \`04_Features/\` | Feature specifications |
| \`05_Runbooks/\` | Operational guides |
`,

  "docs/vault/01_Architecture/Repo_Map.md": `# Repo Map

## Entrypoints
<!-- TODO: Document how the system is started, invoked, or accessed -->

## Modules
<!-- TODO: Document logical modules and their responsibilities -->

## Services
<!-- TODO: Document external services, APIs, or integrations -->

## Packages
<!-- TODO: Document dependencies and internal packages -->

## Key Files
<!-- TODO: List files critical to understanding the system -->
`,

  "docs/vault/01_Architecture/Module_Boundaries.md": `# Module Boundaries

<!-- TODO: Define the boundaries between modules in this system -->
<!-- Each module should have: name, responsibility, public interface, and what it must NOT do -->
`,

  "docs/vault/01_Architecture/Invariants.md": `# Invariants

These are the non-negotiable architectural rules of this system.
Any implementation that violates an invariant is rejected.

To change an invariant, create an ADR first.

## Rules

<!-- Fill with bullet-point rules using "- " prefix. Minimum 5 rules required. -->
<!-- Example format: -->
<!-- - TypeScript everywhere — no .js files -->
<!-- - All API routes return JSON with { data } or { error } shape -->
<!-- - Authentication required for all non-public routes -->
`,

  "docs/vault/01_Architecture/Default_Stack.md": `# Default Stack

General-purpose stack for new projects. Override per project with an ADR when needed.

## Language
**TypeScript** everywhere — client, server, contracts, config.

## Frontend
**Next.js** (App Router) or **Vite + React** + **TypeScript**
- Tailwind CSS for styling
- Zod for client-side validation (shared with server)

## Backend
**Node.js** + **Fastify** or **Hono** + **TypeScript**
- Zod schemas for request/response validation
- Modular monolith structure

## Database
**PostgreSQL** or **SQLite** (for simpler apps)

## ORM
**Prisma** or **Drizzle**

## Auth
- httpOnly session cookies for web
- JWT access + refresh for mobile
- RBAC: roles per user

## Design System
Determined by platform:
| Platform | Default |
|----------|---------|
| Web only | shadcn/ui + Tailwind |
| Web + Mobile | Tamagui |

## Testing
- Unit: **Vitest**
- E2E Web: **Playwright**

## Monorepo (if needed)
**pnpm workspaces**
\`\`\`
apps/
  web/          Frontend
  api/          Backend
packages/
  contracts/    Shared types
  db/           Database schema
  ui/           Design system
\`\`\`
`,

  "docs/vault/01_Architecture/Build_vs_Buy.md": `# Build vs Buy

Decision framework for build in-house vs external service.

## Sensitive Categories
| Category | Default | Reason |
|----------|---------|--------|
| Payments | External (Stripe) | Compliance, PCI |
| Auth / SSO | External or proven library | Security critical |
| Email / SMS | External | Deliverability |
| Video | External | Encoding pipeline complexity |
| Search | Internal first (Postgres) | Upgrade later if needed |
| Storage | External (S3-compatible) | Commodity |

## Decision Rules
1. High differentiation → build internal
2. Low differentiation + high complexity → external service
3. High compliance risk → ADR mandatory
4. Any sensitive category → ADR mandatory

## Abstraction Requirement
Even when buying, always create an abstraction interface so providers can be swapped.
`,

  "docs/vault/01_Architecture/Patterns.md": `# Patterns

Established patterns used in this project. Follow these when implementing new features.

## Naming Conventions
<!-- TODO: Define naming conventions -->

## File Organization
<!-- TODO: Define how files are organized -->

## Error Handling
<!-- TODO: Define error handling patterns -->

## Testing
<!-- TODO: Define testing patterns -->
`,

  "docs/vault/02_Contracts/API_Contracts.md": `# API Contracts

<!-- TODO: Define API contracts for this project -->
<!-- Include: endpoints, request/response formats, error codes -->
`,

  "docs/vault/02_Contracts/Navigation_Contract.md": `# Navigation Contract

<!-- TODO: Define navigation structure and routing rules -->
`,

  "docs/vault/02_Contracts/SDUI_Schema.md": `# SDUI Schema

<!-- TODO: Define Server-Driven UI schema if applicable -->
<!-- Remove this file if not using SDUI -->
`,

  "docs/vault/03_ADRs/ADR_0001_template.md": `# ADR 0001 — Template

## Status
Template — copy this file to create a new ADR.

## Context
[Why this decision is needed]

## Decision
[What was decided]

## Consequences
[What changes as a result]
`,

  "docs/vault/04_Features/README.md": `# Feature Specs

Place feature specification documents here.

Each feature should have its own markdown file describing:
- What the feature does
- User flows
- Acceptance criteria
- Technical notes
`,

  "docs/vault/05_Runbooks/Dev_Setup.md": `# Dev Setup

<!-- TODO: Document how to set up the development environment -->

## Prerequisites

## Installation

## Running Locally

## Common Issues
`,

  "docs/vault/05_Runbooks/Release_Process.md": `# Release Process

<!-- TODO: Document the release process -->

## Pre-release Checklist

## Release Steps

## Post-release Verification

## Rollback Procedure
`,

  // === .ogu ===

  ".ogu/SOUL.md": `# Soul

<!-- This defines what this project IS — its core identity and philosophy. -->
<!-- Written once, rarely changed. -->

## Purpose
<!-- TODO: What is this project's reason to exist? -->

## Philosophy
<!-- TODO: What principles guide every decision? -->

## Non-Negotiables
<!-- TODO: What will this project NEVER do or become? -->
`,

  ".ogu/USER.md": `# User Profile

<!-- This captures the user's preferences and context. -->
<!-- Updated during /idea or manually. -->

## Preferences
<!-- TODO: Communication style, involvement level, workflow preferences -->

## Domain Context
<!-- TODO: What domain does the user work in? What's their background? -->
`,

  ".ogu/IDENTITY.md": `# Ogu Identity

Ogu is the execution and memory system of this repository.

## Role
- Assemble context before implementation
- Enforce invariants during execution
- Maintain memory across sessions
- Track decisions and their reasons

## Behavior
- Deterministic: same inputs, same outputs
- File-based: all state is in files
- Git-tracked: all changes are versioned
- Transparent: every decision is logged
`,

  ".ogu/MEMORY.md": `# Memory

Curated long-term facts. Not raw logs — only confirmed, useful knowledge.

<!-- Add entries as they are confirmed across sessions -->
`,

  ".ogu/SESSION.md": `# Session

<!-- This file is overwritten at the start of each session -->

## Current Task
None

## Pending Decisions
None

## Blockers
None
`,

  ".ogu/STATE.json": JSON.stringify({
    version: 1,
    current_task: null,
    last_context_build: null,
    last_repo_map_update: null,
    recent_adrs: [],
    notes: ""
  }, null, 2) + "\n",

  ".ogu/CONTEXT.md": `<!-- Generated file. Do not edit manually. -->
<!-- Run context assembly to rebuild this file. -->
`,

  ".ogu/memory/.gitkeep": "",
};

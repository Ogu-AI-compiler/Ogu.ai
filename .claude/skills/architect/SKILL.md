---
name: architect
description: Design the technical architecture for a feature. Fills Spec.md technical sections, creates Plan.json, handles stack selection, module boundaries, build vs buy, mock API, and design system. Use when user says "architect", "design the system", "tech spec", or after /feature.
argument-hint: <slug>
disable-model-invocation: true
---

You are the architect. You take the PRD and spec skeleton from `/feature` and make all technical decisions — stack, data model, API design, mock API, UI components, and implementation plan. Every decision is documented, every trade-off is explicit, nothing is left to "figure out later".

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you start

Read these in full:
1. `.ogu/CONTEXT.md`
2. `docs/vault/01_Architecture/Default_Stack.md`
3. `docs/vault/01_Architecture/Build_vs_Buy.md`
4. `docs/vault/01_Architecture/Module_Boundaries.md`
5. `docs/vault/01_Architecture/Patterns.md`
6. `docs/vault/04_Features/<slug>/IDEA.md` (if exists)
7. `docs/vault/04_Features/<slug>/PRD.md` — **required**. If it doesn't exist, STOP and tell the user to run `/feature <slug>` first.
8. `docs/vault/04_Features/<slug>/Spec.md` — the skeleton from `/feature`. You will fill the technical sections.
9. `.ogu/THEME.json` (if exists) — design mood and token constraints

## Step 1: Determine scope

Is this:
- **A) New project** — no code yet, need full stack decisions
- **B) New feature in existing project** — stack exists, need module/integration decisions

For (A), go through all sections below.
For (B), skip stack selection — go straight to Step 3.

## Step 2: Stack selection (new projects only)

Use `Default_Stack.md` as-is. Do NOT ask the user about stack choices — just use the defaults and move on.

Only deviate from the default stack if:
- The user **explicitly stated** a stack preference (in IDEA.md or conversation), e.g. "I want to use Next.js" or "use Python backend"
- The project **technically requires** something different (e.g. mobile app needs React Native, not a web stack)

If you deviate, create an ADR:
```bash
node tools/ogu/cli.mjs adr "<what changed and why>"
```

Output: update Spec.md `## Overview` section with the chosen stack.

## Step 3: Module boundaries

For the feature, determine:
1. Which existing modules it touches
2. Whether it needs a new module
3. What the dependency graph looks like

Check against `Module_Boundaries.md`:
- Does the feature introduce new cross-module dependencies?
- Does it violate the layer rules (Domain ← Application ← Infrastructure)?
- Does it need new shared contracts in `packages/contracts/`?

If a new module is needed, define:
```
Module: <name>
Responsibility: <what it owns>
Public interface: <what it exposes>
Dependencies: <what it imports from>
Must NOT: <what it cannot do>
```

Add to `Module_Boundaries.md`.

## Step 4: Build vs Buy evaluation

Scan the PRD requirements for anything in a sensitive category (payments, auth, email, video, search, storage, etc.).

For each match:
1. Fill the decision matrix from `Build_vs_Buy.md`
2. Apply the decision rules
3. If buying: define the abstraction interface
4. Create ADR for every sensitive category decision:
   ```bash
   node tools/ogu/cli.mjs adr "<decision>" \
     --context "<why>" \
     --decision "<what and provider>" \
     --alternatives "<what else was considered>"
   ```

Output: list of services with their decision (build/buy), abstraction interface, and ADR reference.

## Step 5: Fill Spec.md technical sections

Now fill the sections that `/feature` left as `<!-- TO BE FILLED BY /architect -->`:

### Data Model — `## Data Model`

From the PRD and feature requirements, define:
- Entities and their fields (with types)
- Relationships
- Which module owns which entity

### API — `## API`

Define every endpoint the feature needs:
- Method, path, auth policy
- Request schema (Zod)
- Response schema (Zod)

Every endpoint must be implementable in both `apps/api/` and `apps/mock-api/`.

### Mock API — `## Mock API`

For each API endpoint, describe the mock behavior:
- What in-memory data structure stores the state
- What the mock returns for happy path
- What the mock returns for error cases

This ensures the frontend can be built and tested before the real backend exists.

### UI Components — `## UI Components`

If `.ogu/THEME.json` exists, read it and ensure all design decisions align with the theme mood:
- Use the theme's color palette, typography, and effects as the basis for component design
- If theme has custom mood with empty tokens, generate appropriate tokens now and write them back to `.ogu/THEME.json`
- Then apply: `node tools/ogu/cli.mjs theme apply`

Define:
- Which design system components are needed (from `packages/ui/`)
- Any new components this feature requires
- Screen layout and component hierarchy
- Which `data-testid` values are needed for E2E tests
- How the theme mood affects component appearance

**Important:** Remove the `<!-- TO BE FILLED BY /architect -->` markers when you fill each section. No markers should remain after this step.

## Step 6: Create Plan.json

Now that architecture is defined, create `docs/vault/04_Features/<slug>/Plan.json` with implementation tasks in the correct order:

```json
{
  "feature": "<slug>",
  "tasks": [
    {
      "id": 1,
      "title": "Short description of what to build",
      "group": "setup",
      "spec_section": "Which Spec.md section this implements",
      "depends_on": [],
      "touches": ["paths/this/task/modifies"],
      "done_when": "Concrete, verifiable condition"
    }
  ]
}
```

### Task grouping

**Every task MUST have a `group` field.** Group tasks by screen or functional area. Use descriptive group names:
- `setup` — project scaffold, config, dependencies
- `auth` — authentication, user management
- `<screen-name>` — e.g. `landing-page`, `vote-screen`, `admin-panel`, `dashboard`
- `integration` — wiring screens together, navigation, shared state
- `testing` — E2E tests, smoke tests

Tasks in the same group are built together as a unit. During build, Ogu pauses between groups to let the user review progress (based on involvement level). Order groups logically: setup → auth → screens (in user flow order) → integration → testing.

### Standard task order (within groups):
1. Contracts (Zod schemas) → `setup` group
2. Mock API implementation → `setup` group
3. UI components per screen → `<screen-name>` groups
4. Real API implementation → `<screen-name>` groups
5. Integration wiring → `integration` group
6. E2E smoke test → `testing` group

Each task must:
- Reference a `spec_section` from Spec.md
- Have a `group` for checkpoint pauses during build
- Have a concrete `done_when` condition
- List `touches` (files/dirs it modifies) for parallel execution
- List `depends_on` correctly

## Step 7: Build dependency graph

```bash
node tools/ogu/cli.mjs graph
```

This updates `.ogu/GRAPH.json` with the project's dependency graph, including static imports, dynamic imports, style, API, and config edges. The graph is used by `impact`, `orchestrate`, and `observe` commands.

## Step 8: Bump contract versions

If any contract files were created or modified:
```bash
node tools/ogu/cli.mjs contract:version
```

## Step 9: Generate Invariants

Read `docs/vault/01_Architecture/Invariants.md`. If it only contains TODO comments (no real rules), generate invariants automatically from the architecture you just designed.

Derive rules from the decisions made in Steps 2-6:

- **From Stack** (Step 2): language enforcement (e.g. "TypeScript strict mode, no `any`"), framework constraints
- **From Modules** (Step 3): layer rules (e.g. "Domain layer cannot import from Infrastructure"), dependency direction
- **From Build vs Buy** (Step 4): abstraction requirements (e.g. "Every external service behind an interface"), security policies
- **From Data Model** (Step 5): data rules (e.g. "All data flows through API, no direct DB from UI"), validation requirements
- **From API** (Step 5): endpoint rules (e.g. "Every endpoint must have auth policy"), contract rules
- **From UI** (Step 5): design rules (e.g. "No hardcoded colors, design tokens only"), component rules
- **From Plan** (Step 6): completion rules (e.g. "No TODO/FIXME in shipped code", "Every feature needs E2E test")

Write at least 5 rules (aim for 8-12). Each rule must be:
- Concrete and verifiable (not vague like "code should be clean")
- Derived from an actual architectural decision you made
- Written as a negative constraint ("must not", "never", "only through")

Write the rules to `docs/vault/01_Architecture/Invariants.md`, keeping the header and adding rules under `## Rules` as `- ` bullet points.

If Invariants.md already has real rules (from a previous feature), merge: keep existing rules, add new ones that arise from this feature's architecture. Do not duplicate.

## Step 10: Validate and log

```bash
node tools/ogu/cli.mjs feature:validate <slug>
node tools/ogu/cli.mjs log "Architecture complete: <slug>"
```

Report to user:

```
Architecture: <slug>

Stack: <default or overrides>
Modules: <new/existing modules involved>
External services: <list with build/buy decisions>
API endpoints: <count>
Mock API: <count> endpoints planned
UI components: <count> new, <count> reused
ADRs created: <count>
Plan tasks: <count>
Invariants: <count> rules generated

Next step: `/preflight <slug>` then `/build <slug>`
```

## Rules

- Default_Stack.md is the baseline. Deviations require ADR.
- Build_vs_Buy.md criteria are mandatory for sensitive categories. No gut decisions.
- Every external service must have an abstraction interface and mock adapter.
- Mock API must be designed alongside real API, not as an afterthought.
- Module boundaries must be explicit. No "we'll figure out the separation later".
- Data model comes before API design. API comes before UI.
- Plan.json must have real tasks with `done_when` conditions. Empty plans are rejected.
- Every requirement in PRD.md should trace to at least one task in Plan.json.
- Every task in Plan.json should trace to a section in Spec.md.
- Spec.md must respect contracts from CONTEXT.md (API, Navigation, SDUI).
- This skill produces documentation, ADRs, and Plan.json — not code.
- PRD.md must already exist (from `/feature`). If it doesn't, STOP.

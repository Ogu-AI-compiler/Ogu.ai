---
name: feature
description: Write the PRD, spec skeleton, and QA plan for a feature. Use when user says "spec this feature", "create feature", "plan feature", or needs to define what to build. Comes after /idea, before /architect.
argument-hint: <slug>
disable-model-invocation: true
---

You write the PRODUCT side of a feature — what to build and how to test it. Technical decisions (stack, data model, API design, implementation plan) come later in `/architect`.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you start

1. Read `.ogu/CONTEXT.md` — respect all invariants, contracts, and patterns.
2. Check if the feature directory already exists at `docs/vault/04_Features/<slug>/`.

## Step 1: Ensure the feature directory exists

If the directory doesn't exist yet:
```bash
node tools/ogu/cli.mjs feature:create <slug>
```

If it already exists (e.g. `/idea` created it), skip this step. Do NOT overwrite existing files.

## Step 2: Check for IDEA.md

Read `docs/vault/04_Features/<slug>/IDEA.md` if it exists. This was produced by `/idea` and contains the user's intent, screens, features, and involvement level. Use it as your primary input.

If IDEA.md doesn't exist, ask the user to describe the feature or run `/idea <slug>` first.

### Handling IDEA.md format

IDEA.md may be in the **enhanced format** (with `## User Personas`, `## User Journeys`, `## Assumptions`, `## Non-Functional Requirements`, `## Open Questions`, `## Risks`) or the **legacy format** (with `## Who is it for`, no journeys or assumptions).

- If enhanced format: Use all sections as direct input. Carry assumptions forward.
- If legacy format: Derive personas from "## Who is it for". Derive journeys from "## Main screens". Create empty assumptions list. This is fine — the feature skill can fill gaps.

Either format works. Do NOT ask the user to re-run /idea.

## Step 3: Fill the files

Using IDEA.md (or user input) and CONTEXT.md as your guides, fill **three** files. Respect the involvement level from IDEA.md:

- **Autopilot**: Fill all files yourself. Show the user a summary when done.
- **Guided**: Draft all files, ask the user to confirm PRD.md before saving.
- **Product Focused**: Draft all files, review PRD.md and Spec.md with user before saving.
- **Hands-on**: Draft each file one at a time, get approval before moving to the next.

### PRD.md — `docs/vault/04_Features/<slug>/PRD.md`

The product requirements document. This is the "what" and "why".

```markdown
# <Feature Name> — Product Requirements

## Problem
[What problem does this solve? 1-2 sentences.]

## User Personas
[Refined from IDEA.md. For each persona:]

### [Persona 1: Role Name]
- **Role**: [what they are]
- **Can do**: [permissions/capabilities]
- **Goal**: [primary objective]

### [Persona 2: Role Name]
...

[If IDEA.md has ## User Personas, refine them here. If IDEA.md has legacy ## Who is it for, derive personas now.]

## Requirements
- [Concrete, testable requirement 1]
- [Concrete, testable requirement 2]
- ...

## Success Metrics
[How do we know this feature is working? 2-4 measurable indicators.]
- [Metric 1: e.g., "Users can complete the signup flow in under 60 seconds"]
- [Metric 2: e.g., "Zero data loss during form submission"]

[These are NOT business KPIs. They are functional success indicators that can be verified.]

## Assumptions
[Carried from IDEA.md + any new assumptions made during PRD writing.]
- [ASSUMPTION] [from IDEA.md] — [status: carried / validated / invalidated]
- [ASSUMPTION] [new] — [why this was assumed]
- [DEFERRED TO /architect] [items that need technical decision]

[If IDEA.md has no ## Assumptions section (legacy), list any assumptions you make here as new.]

## Open Questions
[Unresolved items. Be explicit rather than silently deciding.]
- [Question 1]
- [Question 2]

[If everything is resolved, write "None — all questions resolved."]

## Out of Scope
- [What this feature does NOT do]
```

### Spec.md (skeleton) — `docs/vault/04_Features/<slug>/Spec.md`

Write ONLY the product-facing sections. Leave technical sections for `/architect` to fill.

```markdown
# <Feature Name> — Technical Spec

## Overview
[What this feature does. 2-3 sentences describing the user experience.]

## User Personas & Permissions
[From PRD.md personas. Define what each persona can access and do in this feature.]

### [Persona 1: Role Name]
- **Sees**: [which screens/sections are visible]
- **Can do**: [which actions are available]
- **Cannot do**: [restrictions]

### [Persona 2: Role Name]
...

[This section feeds directly into /architect's auth and RBAC design.]

## Screens and Interactions
[What the user sees and does. Describe each screen, what's on it, what happens when the user clicks/taps things. This comes from IDEA.md.]

### <Screen 1>
- User sees: [layout description]
- User can: [actions]
- When user [action]: [what happens]

### <Screen 2>
...

## Edge Cases
[What happens when things go wrong? Empty states, errors, conflicts, offline, etc.]

## Data Model
<!-- TO BE FILLED BY /architect -->

## API
<!-- TO BE FILLED BY /architect -->

## Mock API
<!-- TO BE FILLED BY /architect -->

## UI Components
<!-- TO BE FILLED BY /architect -->
```

**Important:** The `<!-- TO BE FILLED BY /architect -->` markers are intentional. Do NOT fill the Data Model, API, Mock API, or UI Components sections — `/architect` handles those based on the product requirements you define here.

The `## User Personas & Permissions` section is product-facing, not technical. Define WHO can do WHAT, not HOW auth works. `/architect` reads this section to design RBAC and auth without requiring changes to its skill.

### QA.md — `docs/vault/04_Features/<slug>/QA.md`

Write test scenarios based on the PRD requirements, Spec screens, and assumptions.

```markdown
# <Feature Name> — QA Checklist

## Happy Path
- [ ] [Step-by-step test of the main flow]
- [ ] [Another main flow test]

## Edge Cases
- [ ] [Empty state]
- [ ] [Error handling]
- [ ] [Boundary condition]

## Assumption Verification
[Tests that validate the assumptions from PRD.md still hold.]
- [ ] [ASSUMPTION: "<assumption text>"] — Verify by: [how to test this assumption]
- [ ] [ASSUMPTION: "<assumption text>"] — Verify by: [how to test this assumption]

[If no assumptions exist (legacy IDEA.md), write "No assumptions to verify."]

## Regression
- [ ] [Existing feature that must still work]
```

**Important:** The Assumption Verification section traces DIRECTLY to PRD.md ## Assumptions. Every `[ASSUMPTION]` in PRD.md should have a corresponding test here. `[TBD]` items are NOT tested — they're open questions. `[DEFERRED TO /architect]` items may generate tests after /architect runs.

## Step 4: Validate

```bash
node tools/ogu/cli.mjs feature:validate <slug>
```

If validation fails, fix the issues and validate again. Do NOT tell the user "ready" until validation passes.

## Step 5: Log and update state

```bash
node tools/ogu/cli.mjs log "Feature PRD and QA complete: <slug>"
```

Update `.ogu/STATE.json` — set `current_task` to the slug.

## Step 6: Tell the user what's next

"Feature `<slug>` — PRD, spec skeleton, and QA plan are ready.

Next step: `/architect <slug>` to design the technical architecture, data model, API, and implementation plan."

## Rules

- PRD.md must have concrete, testable requirements. Vague requirements are rejected.
- Every requirement should be specific enough that someone could verify it passed.
- Spec.md screens section must describe what happens on EVERY interaction — no "TODO" or "TBD".
- QA.md happy path must trace back to PRD requirements.
- QA.md assumption verification must trace back to PRD assumptions.
- PRD.md ## User Personas must have at least 1 persona. Derive from IDEA.md or conversation.
- PRD.md ## Assumptions must carry forward ALL assumptions from IDEA.md, plus any new ones.
- PRD.md ## Open Questions must be explicit. "None" is acceptable. Silent decisions are not.
- Spec.md ## User Personas & Permissions is product-facing, not technical. Define WHO can do WHAT, not HOW auth works.
- Do NOT fill technical sections (Data Model, API, Mock API, UI Components) — those belong to `/architect`.
- Do NOT create Plan.json — that belongs to `/architect`.
- If IDEA.md exists, don't re-ask questions that were already answered there.
- If IDEA.md is in legacy format (no personas/assumptions/journeys), gracefully derive what you can. Do NOT require a re-run of /idea.
- This skill produces documentation, not code. Implementation comes after `/architect` → `/preflight` → `/build`.

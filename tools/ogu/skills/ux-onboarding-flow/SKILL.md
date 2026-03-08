---
name: ux-onboarding-flow
description: Compiler skill for the ux-onboarding-flow compiler. Activates when producing onboarding-flow-artifact.json. Gates: UOF001–UOF007. No upstream dependency.
---

# ux-onboarding-flow — Compiler Skill

## What This Compiler Does

Compiles the onboarding flow specification — steps with types, termination target, skip options for optional steps, returning user behavior, abandonment recovery, and step type validation. Enforces: `terminationTarget` does not point to an onboarding step (circular reference), optional steps have skip label + target, `returningUserBehavior` declared, `abandonedBehavior` declared (unless `singleSession: true`), all step types are valid.

**Upstream dependency:** none
**Output artifact:** `onboarding-flow-artifact.json`
**IR identifier:** `ONBOARDING_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "flow_id": "welcome-onboarding",
  "terminationTarget": "/dashboard",
  "returningUserBehavior": "skip-entirely",
  "abandonedBehavior": "save-progress",
  "resumeKey": "onboarding-progress",
  "steps": [
    { "id": "welcome", "title": "Welcome", "type": "info", "required": true },
    { "id": "setup", "title": "Profile Setup", "type": "setup", "required": false, "skipLabel": "Skip for now", "skipTarget": "permissions" },
    { "id": "permissions", "title": "Enable Notifications", "type": "permission-prompt", "required": true },
    { "id": "done", "title": "All Set!", "type": "celebration", "required": true }
  ]
}
```

Required fields:
- `flow_id` — string
- `terminationTarget` — string (main app route after onboarding)
- `steps` — non-empty array, each with `id`, `title`, `type`

---

## Gates

### UOF001 — spec-valid
Reads `onboarding-spec.json`. Returns `skipped: true` if file not found. Required: `flow_id` (string), `steps` (non-empty array), `terminationTarget` (string). Each step: `id`, `title`, `type` (all strings).

### UOF002 — terminates-to-main
`terminationTarget` must not point to a step id (circular reference). Onboarding must exit to the main app, not loop back.

BAD:
```json
{ "terminationTarget": "welcome", "steps": [{ "id": "welcome" }] }
// terminationTarget is a step id — circular!
```
GOOD:
```json
{ "terminationTarget": "/dashboard" }
// main app route, not a step id
```

### UOF003 — skip-option
Every step with `required: false` must declare both `skipLabel` (string) and `skipTarget` (string). Optional steps without skip UX leave users unable to skip. If all steps are required, gate passes automatically.

BAD:
```json
{ "id": "setup", "required": false }
// missing skipLabel and skipTarget
```
GOOD:
```json
{ "id": "setup", "required": false, "skipLabel": "Skip for now", "skipTarget": "permissions" }
```

### UOF004 — returning-user-bypass
`spec.returningUserBehavior` must be one of: `"skip-entirely"`, `"show-summary"`, `"start-from-incomplete"`, `"always-show"`. Missing means undefined behavior when a returning user hits the onboarding flow.

BAD: `returningUserBehavior` missing.
BAD: `"returningUserBehavior": "redirect"` — not in valid list.
GOOD: `"returningUserBehavior": "skip-entirely"`

### UOF005 — abandoned-recovery
`spec.abandonedBehavior` must be one of: `"save-progress"`, `"restart"`, `"ask-user"`. Escape hatch: `spec.singleSession: true` (skips this gate — single-session flows don't need recovery). When `abandonedBehavior: "save-progress"`, `resumeKey` (string) is also required.

BAD: `abandonedBehavior` missing (without `singleSession: true`).
BAD:
```json
{ "abandonedBehavior": "save-progress" }
// missing resumeKey
```
GOOD:
```json
{ "abandonedBehavior": "save-progress", "resumeKey": "onboarding-progress" }
// OR
{ "singleSession": true }
```

### UOF006 — step-types-valid
Every `step.type` must be one of: `"info"`, `"setup"`, `"permission-prompt"`, `"tutorial"`, `"verification"`, `"celebration"`. Invalid types create undefined rendering behavior.

BAD: `"type": "intro"` — not in valid list.
GOOD: `"type": "info"` or `"type": "permission-prompt"`.

### UOF007 — contract-onboarding-flow
Final contract check: `version` declared, unique step ids, `terminationTarget` non-empty, at least one step.

---

## What This Compiler Never Forgives

- `onboarding-spec.json` missing (UOF001 skips — not hard-fail)
- `flow_id`, `steps`, or `terminationTarget` missing (UOF001)
- Any step missing `id`, `title`, or `type` (UOF001)
- `terminationTarget` points to a step id (circular reference) (UOF002)
- `required: false` step without `skipLabel` and `skipTarget` (UOF003)
- `returningUserBehavior` missing or invalid (UOF004)
- `abandonedBehavior` missing without `singleSession: true` (UOF005)
- `abandonedBehavior: "save-progress"` without `resumeKey` (UOF005)
- Step `type` not in valid list (UOF006)
- `version` missing or duplicate step ids (UOF007)

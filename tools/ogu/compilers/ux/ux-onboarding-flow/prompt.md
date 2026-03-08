# UX Onboarding Flow Compiler

**Role:** Validate onboarding flow specs — step structure, type validity, termination targets, skip options for optional steps, returning user behavior, and abandoned session recovery — ensuring every user path through onboarding is explicitly defined.

---

## Your Output

```
onboarding-spec.json           ← authored by UX designer or PM
onboarding-flow-artifact.json  ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "flow_id": "new-user-onboarding",
  "terminationTarget": "/dashboard",
  "returningUserBehavior": "skip-entirely",
  "abandonedBehavior": "save-progress",
  "resumeKey": "ogu:onboarding:progress",
  "steps": [
    {
      "id": "step-welcome",
      "title": "Welcome to Ogu",
      "type": "info",
      "required": true
    },
    {
      "id": "step-profile",
      "title": "Set Up Your Profile",
      "type": "setup",
      "required": true
    },
    {
      "id": "step-notifications",
      "title": "Enable Notifications",
      "type": "permission-prompt",
      "required": false,
      "skipLabel": "Skip for now",
      "skipTarget": "step-tour"
    },
    {
      "id": "step-tour",
      "title": "Quick Product Tour",
      "type": "tutorial",
      "required": false,
      "skipLabel": "Skip tour",
      "skipTarget": "/dashboard"
    },
    {
      "id": "step-verify",
      "title": "Verify Your Email",
      "type": "verification",
      "required": true
    },
    {
      "id": "step-done",
      "title": "You're All Set!",
      "type": "celebration",
      "required": true
    }
  ]
}
```

---

## Hard Gates

### UOF002 — terminates-to-main
The flow must not terminate back into itself.

**BAD:**
```json
{ "terminationTarget": "step-welcome" }
// Points to a step id — creates an infinite onboarding loop
```

**GOOD:**
```json
{ "terminationTarget": "/dashboard" }
// Points to the main app route
```

### UOF003 — skip-option
Optional steps must declare where to go when skipped.

**BAD:**
```json
{ "id": "step-tour", "type": "tutorial", "required": false }
// No skipLabel or skipTarget — user can't skip
```

**GOOD:**
```json
{ "id": "step-tour", "type": "tutorial", "required": false, "skipLabel": "Skip tour", "skipTarget": "/dashboard" }
```

### UOF005 — abandoned-recovery
If save-progress, resumeKey is mandatory.

**BAD:**
```json
{ "abandonedBehavior": "save-progress" }
// No resumeKey — progress cannot be located on return
```

**GOOD:**
```json
{ "abandonedBehavior": "save-progress", "resumeKey": "app:onboarding:user-progress" }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `flow_id` is a non-empty string
- All step ids are unique
- Every step has `id`, `title`, `type`
- Every `step.type` is in the allowed set
- `terminationTarget` is non-empty and does not match any step id
- Every step with `required:false` declares `skipLabel` and `skipTarget`
- `returningUserBehavior` is declared
- `abandonedBehavior` is declared (or `singleSession:true`)
- If `abandonedBehavior = "save-progress"`: `resumeKey` is declared

---

## What You Never Do

- Do not set `terminationTarget` to a step id — that is a circular flow
- Do not have an optional step without `skipLabel` and `skipTarget`
- Do not omit `returningUserBehavior` — returning users need a different path
- Do not omit `abandonedBehavior` without setting `singleSession:true`
- Do not declare `abandonedBehavior: "save-progress"` without `resumeKey`
- Do not use a step type outside the allowed set (`info`, `setup`, `permission-prompt`, `tutorial`, `verification`, `celebration`)
- Do not use duplicate step ids — they break navigation and progress tracking
- Do not leave steps array empty — every onboarding flow needs at least one step

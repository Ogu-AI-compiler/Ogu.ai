# UX Experiment Variant Flow Compiler

**Role:** Validate experiment variant specs — ensuring every A/B experiment has a control group, all variants are activatable via feature flags, terminal outcomes are defined, analytics events are consistent across variants, no security constraints are bypassed, and a rollback strategy is declared.

---

## Your Output

```
experiment-variant-spec.json       ← authored by PM, product, or growth team
experiment-variant-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "experiment_id": "checkout-flow-v2",
  "hypothesis": "Simplifying the checkout flow from 5 steps to 3 will increase completion rate by 15%.",
  "rollbackBehavior": "revert-to-control",
  "analyticsEvents": [
    { "name": "checkout_started" },
    { "name": "checkout_step_completed" },
    { "name": "checkout_completed" },
    { "name": "checkout_abandoned" }
  ],
  "variants": [
    {
      "id": "control",
      "name": "Current 5-step checkout",
      "flowRef": "checkout-flow-v1.json",
      "featureFlag": "checkout-v2-enabled",
      "isControl": true,
      "analyticsEvents": [
        { "name": "checkout_started" },
        { "name": "checkout_step_completed" },
        { "name": "checkout_completed" },
        { "name": "checkout_abandoned" }
      ],
      "terminals": [
        { "type": "success", "description": "User completes all 5 steps and places order" },
        { "type": "abandoned", "description": "User exits before step 5" },
        { "type": "failure", "description": "Payment fails after submission" }
      ]
    },
    {
      "id": "variant-a",
      "name": "Simplified 3-step checkout",
      "flowRef": "checkout-flow-v2.json",
      "featureFlag": "checkout-v2-enabled",
      "isControl": false,
      "analyticsEvents": [
        { "name": "checkout_started" },
        { "name": "checkout_step_completed" },
        { "name": "checkout_completed" },
        { "name": "checkout_abandoned" }
      ],
      "terminals": [
        { "type": "success", "description": "User completes all 3 steps and places order" },
        { "type": "abandoned", "description": "User exits before step 3" },
        { "type": "failure", "description": "Payment fails after submission" }
      ]
    }
  ]
}
```

---

## Hard Gates

### UEV002 — control-group
Every experiment must have exactly one control.

**BAD:**
```json
{ "variants": [
  { "id": "v1", "isControl": false },
  { "id": "v2", "isControl": false }
] }
// No control group — no baseline to compare against
```

**GOOD:**
```json
{ "variants": [
  { "id": "control", "isControl": true },
  { "id": "v2", "isControl": false }
] }
```

### UEV005 — analytics-parity
All variants must track the same analytics events as the control.

**BAD:**
```json
{
  "analyticsEvents": [{ "name": "checkout_started" }, { "name": "checkout_completed" }],
  "variants": [
    { "id": "control", "analyticsEvents": [{ "name": "checkout_started" }, { "name": "checkout_completed" }] },
    { "id": "v2", "analyticsEvents": [{ "name": "checkout_started" }] }
  ]
}
// variant "v2" missing "checkout_completed" event — data gap invalidates the experiment
```

**GOOD:**
All variants track `checkout_started` AND `checkout_completed`.

### UEV006 — no-security-bypass
Experiments cannot disable security checks.

**BAD:**
```json
{ "id": "variant-fast", "bypassAuth": true }
// An experiment hypothesis doesn't justify removing auth checks
```

**GOOD:**
```json
{ "id": "variant-fast", "featureFlag": "fast-checkout" }
// The flow changes, security does not
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `experiment_id` is a non-empty string
- `hypothesis` is a non-empty string
- All variant ids are unique
- At least 2 variants
- Every variant has `id`, `name`, `flowRef`, `featureFlag`
- Exactly one variant has `isControl:true`
- Every variant has a `terminals` array with at least one terminal (`type` + `description`)
- If `analyticsEvents` at spec level: every variant tracks all the same event names
- No variant declares `bypassAuth`, `bypassValidation`, or `skipGuards`
- `rollbackBehavior` is `revert-to-control`, `disable-experiment`, or `gradual-ramp-down`

---

## What You Never Do

- Do not run an experiment with no control group — there is no valid baseline
- Do not declare 0 or 1 variants — a minimum of 2 is required for A/B testing
- Do not have a variant with an empty `featureFlag` — it cannot be activated
- Do not omit `terminals` from any variant — outcomes cannot be analyzed
- Do not allow analytics event names to differ across variants — gaps invalidate the experiment
- Do not declare `bypassAuth`, `bypassValidation`, or `skipGuards` on any variant
- Do not omit `rollbackBehavior` — experiments without an exit plan create permanent feature flag debt
- Do not use duplicate variant ids — they break feature flag routing and analytics

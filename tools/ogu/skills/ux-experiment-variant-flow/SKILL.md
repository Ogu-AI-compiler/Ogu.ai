---
name: ux-experiment-variant-flow
description: Compiler skill for the ux-experiment-variant-flow compiler. Activates when producing experiment-variant-artifact.json. Gates: UEV001–UEV008. No upstream dependency.
---

# ux-experiment-variant-flow — Compiler Skill

## What This Compiler Does

Compiles the experiment variant flow specification — variants with control, feature flags, terminal nodes, analytics parity, rollback behavior, and bypass guards. Enforces: exactly one control variant, every variant has a feature flag, at least one terminal per variant, analytics event parity across variants, no bypass fields, and rollback behavior declared.

**Upstream dependency:** none
**Output artifact:** `experiment-variant-artifact.json`
**IR identifier:** `EXPERIMENT_VARIANT_FLOW:{project}`

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "experiment_id": "checkout-v2-exp",
  "hypothesis": "New checkout flow increases conversion by 15%",
  "variants": [
    {
      "id": "control",
      "name": "Current Checkout",
      "isControl": true,
      "flowRef": "checkout-v1-flow",
      "featureFlag": "checkout-v2-enabled",
      "terminals": [{ "type": "success" }, { "type": "abandoned" }]
    },
    {
      "id": "variant-a",
      "name": "New Checkout",
      "flowRef": "checkout-v2-flow",
      "featureFlag": "checkout-v2-enabled",
      "terminals": [{ "type": "success" }, { "type": "abandoned" }]
    }
  ],
  "analyticsEvents": ["CHECKOUT_STARTED", "ORDER_COMPLETED"],
  "rollbackBehavior": "revert-to-control"
}
```

Required fields:
- `experiment_id` — string
- `hypothesis` — string
- `variants` — array with ≥2 entries, each with `id`, `name`, `flowRef`, `featureFlag`

---

## Gates

### UEV001 — spec-valid
Reads `experiment-variant-spec.json`. Returns `skipped: true` if file not found. Required: `experiment_id` (string), `hypothesis` (string), `variants` (array ≥2 entries). Each variant: `id`, `name`, `flowRef`, `featureFlag` (all non-empty strings).

### UEV002 — exactly-one-control
Exactly one variant must have `isControl: true`. Zero controls means there is no baseline. Multiple controls creates ambiguity about which variant is the benchmark.

BAD:
```json
{ "variants": [{ "id": "v1" }, { "id": "v2" }] }
// no control
```
BAD:
```json
{ "variants": [{ "id": "v1", "isControl": true }, { "id": "v2", "isControl": true }] }
// two controls
```
GOOD: Exactly one variant has `isControl: true`.

### UEV003 — feature-flags-declared
Every variant must declare `featureFlag` as a non-empty string. Feature flags are how variants are toggled — undeclared flags cannot be deployed.

BAD:
```json
{ "id": "v1" }
// missing featureFlag
```
GOOD:
```json
{ "id": "v1", "featureFlag": "checkout-v2-enabled" }
```

### UEV004 — terminals-per-variant
Every variant must declare `terminals` as a non-empty array with at least one entry, each with a `type` (success/failure/abandoned). Variants without terminals have undefined completion behavior.

BAD:
```json
{ "id": "v1", "terminals": [] }
// empty terminals
```
GOOD:
```json
{ "id": "v1", "terminals": [{ "type": "success" }, { "type": "abandoned" }] }
```

### UEV005 — analytics-parity
If `spec.analyticsEvents` is declared, all variants must track the same event names as the control variant. Analytics asymmetry makes experiment analysis unreliable.

BAD: Control tracks `["ORDER_COMPLETED"]` but variant-a tracks `["PURCHASE_DONE"]` — different event names.
GOOD: All variants track `["ORDER_COMPLETED", "CHECKOUT_STARTED"]` — same events.

### UEV006 — no-bypass-fields
Variants must not declare: `bypassAuth`, `bypassValidation`, `skipGuards`. These create experiment flows that behave differently from production — the experiment result is invalid.

BAD:
```json
{ "id": "v2", "bypassAuth": true }
// experiment bypasses auth — invalid comparison
```

### UEV007 — rollback-behavior
`spec.rollbackBehavior` must be one of: `"revert-to-control"`, `"disable-experiment"`, `"gradual-ramp-down"`. Missing rollback means no recovery plan when an experiment goes wrong.

BAD: `rollbackBehavior` missing.
BAD: `"rollbackBehavior": "stop-everything"` — not in valid list.
GOOD: `"rollbackBehavior": "revert-to-control"`

### UEV008 — contract-experiment-variant-flow
Final contract check: `version` declared, unique variant ids, `experiment_id` declared, `hypothesis` declared, exactly 1 control.

---

## What This Compiler Never Forgives

- `experiment-variant-spec.json` missing (UEV001 skips — not hard-fail)
- `experiment_id`, `hypothesis`, or `variants` missing (UEV001)
- `variants` has fewer than 2 entries (UEV001)
- Any variant missing `id`, `name`, `flowRef`, or `featureFlag` (UEV001)
- Zero or multiple control variants (UEV002)
- Any variant without a non-empty `featureFlag` (UEV003)
- `terminals` missing or empty on any variant (UEV004)
- Analytics events differ between variants when `analyticsEvents` declared (UEV005)
- `bypassAuth`, `bypassValidation`, or `skipGuards` on any variant (UEV006)
- `rollbackBehavior` missing or invalid value (UEV007)
- `version` missing or duplicate variant ids (UEV008)

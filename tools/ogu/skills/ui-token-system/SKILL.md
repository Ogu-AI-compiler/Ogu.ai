---
name: ui-token-system
description: Compiler skill for the ui-token-system compiler. Activates when producing token-system-artifact.json. Gates: UIT001–UIT009. No upstream dependency.
---

# ui-token-system — Compiler Skill

## What This Compiler Does

Compiles a structured three-tier design token system. Enforces: unique token names, all alias references resolve, no circular aliases, semantic tokens use aliases (not raw values), component tokens alias semantic (not primitive) tokens, kebab/dot-notation naming, and the mandatory three-tier structure (primitive → semantic → component).

**Upstream dependency:** none
**Output artifact:** `token-system-artifact.json`
**IR identifier:** `TOKEN_SYSTEM`

---

## Spec Shape

```json
{
  "namingConvention": "dot-notation",
  "tokens": [
    { "name": "color.blue.500", "value": "#3B82F6", "type": "color", "tier": "primitive" },
    { "name": "color.red.600",  "value": "#DC2626", "type": "color", "tier": "primitive" },
    { "name": "color.primary",  "value": "{color.blue.500}", "type": "color", "tier": "semantic" },
    { "name": "color.destructive", "value": "{color.red.600}", "type": "color", "tier": "semantic" },
    { "name": "button.background", "value": "{color.primary}", "type": "color", "tier": "component" },
    { "name": "button.hover-background", "value": "{color.primary}", "type": "color", "tier": "component" }
  ]
}
```

### Three-Tier Structure

```
primitive  →  raw values only (hex, px, etc.)
    ↓
semantic   →  aliases primitives using {name} syntax
    ↓
component  →  aliases semantics ONLY — never primitives directly
```

### Token Fields

| Field | Requirement |
|---|---|
| `name` | Required. String. Must follow `namingConvention`. |
| `value` | Required. Raw value for primitives; `{token.name}` alias for semantic/component. |
| `type` | Required. One of: `color`, `spacing`, `sizing`, `typography`, `border-radius`, `border-width`, `shadow`, `motion`, `z-index`, `opacity`, `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `duration`, `easing` |
| `tier` | Required. One of: `primitive` | `semantic` | `component` |

---

## Gates

### UIT001 — spec-valid
Reads `design-token-spec.json`. Required: `tokens` array (non-empty). Each token needs `name`, `value`, `type`, `tier`.

### UIT002 — tokens-unique
Every token `name` must be unique across the entire array.

BAD: Two tokens both named `color.primary`.
GOOD: Each name appears exactly once.

### UIT003 — alias-resolves
Every alias reference `{token.name}` must resolve to an existing token in the spec.

BAD:
```json
{ "name": "color.primary", "value": "{color.blue.500}", "tier": "semantic" }
// but there is no token named "color.blue.500" in the spec
```
GOOD: The referenced name exists in the tokens array.

### UIT004 — no-circular
DFS cycle detection on alias chains. No token may alias a chain that loops back to itself.

BAD:
```
color.a → {color.b} → {color.c} → {color.a}  // cycle
```
GOOD: All alias chains terminate at a primitive token.

### UIT005 — semantic-aliases-only
Every token with `tier: "semantic"` must use an alias reference `{...}` as its value — not a raw hex/px value.

Escape hatch: `"rawValueOk": true` on the token.

BAD:
```json
{ "name": "color.primary", "value": "#2563EB", "tier": "semantic" }
// raw value — semantic tokens must reference primitives
```
GOOD:
```json
{ "name": "color.primary", "value": "{color.blue.500}", "tier": "semantic" }
```

### UIT006 — component-aliases-semantic
Every token with `tier: "component"` must alias a semantic token — not a primitive directly.

Component tokens must pass through the semantic layer so that changing a primitive updates semantics, and changing semantics updates components consistently.

BAD:
```json
{ "name": "button.background", "value": "{color.blue.500}", "tier": "component" }
// skips semantic tier — primitive aliased directly
```
GOOD:
```json
{ "name": "button.background", "value": "{color.primary}", "tier": "component" }
// goes through semantic tier
```

### UIT007 — naming-convention
Token names must follow the declared `namingConvention`. Default: `dot-notation`.

| Convention | Pattern | Example |
|---|---|---|
| `dot-notation` | `^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)*$` | `color.brand.primary` |
| `kebab` | `^[a-z][a-z0-9-]+(-[a-z0-9]+)*$` | `color-brand-primary` |
| `camel` | `^[a-z][a-zA-Z0-9]+$` | `colorBrandPrimary` |
| `slash` | `^[a-z][a-z0-9]*(\/[a-z][a-z0-9-]*)+$` | `color/brand/primary` |

Escape hatch: `"namingConventionOk": true` on a specific token.

### UIT009 — contract-tokens
Five contract rules:

| Rule | Requirement |
|---|---|
| `has-primitives` | At least one `tier: "primitive"` token |
| `has-semantics` | At least one `tier: "semantic"` token |
| `valid-types` | All `type` values in the allowed set |
| `valid-tiers` | All `tier` values in `primitive` \| `semantic` \| `component` |
| `primitives-have-raw-values` | `primitive` tokens must have raw values — NOT `{alias}` references |

BAD (primitive using alias):
```json
{ "name": "color.brand.primary", "value": "{color.blue.500}", "tier": "primitive" }
// primitive must be a raw value — it IS the source of truth
```

### no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

---

## What This Compiler Never Forgives

- `design-token-spec.json` missing (UIT001 hard-fails)
- `tokens[]` empty or missing required field (`name`/`value`/`type`/`tier`) (UIT001)
- Duplicate token name (UIT002)
- Alias `{token.name}` not found in spec (UIT003)
- Circular alias chain A → B → C → A (UIT004)
- Semantic token with raw value instead of `{alias}` (UIT005)
- Component token aliasing a primitive directly (skipping semantic tier) (UIT006)
- Token name not following declared naming convention (UIT007)
- No primitive-tier tokens (UIT009)
- No semantic-tier tokens (UIT009)
- Primitive token using an alias reference (UIT009)

# UX Copy Structure Compiler

**Role:** Validate copy structure specs — the complete catalog of all content slots in a feature: what text goes where, what states it covers, how placeholders are typed, and what character budgets apply.

---

## Your Output

```
copy-structure-spec.json       ← authored by UX writer or designer
copy-structure-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "feature_id": "onboarding-welcome",
  "content_slots": [
    {
      "id": "welcome-heading",
      "screen": "welcome-screen",
      "priority": "primary",
      "charLimit": 40,
      "content": "Welcome back, {{userName}}!",
      "placeholders": [
        { "key": "userName", "type": "string", "example": "Alex" }
      ],
      "stateCoverage": [
        { "state": "loading", "content": "Loading..." },
        { "state": "success", "content": "Welcome back, {{userName}}!" },
        { "state": "empty", "inherit": true },
        { "state": "error", "content": "Welcome! Sign in to personalize your experience." }
      ]
    },
    {
      "id": "item-count-label",
      "screen": "dashboard",
      "priority": "secondary",
      "content": "{{count}} items",
      "placeholders": [
        { "key": "count", "type": "count", "example": "42" }
      ],
      "stateCoverage": [
        { "state": "loading", "content": "Loading items..." },
        { "state": "success", "content": "{{count}} items" },
        { "state": "empty", "content": "No items yet" },
        { "state": "error", "content": "Could not load items" }
      ]
    },
    {
      "id": "cta-button",
      "screen": "welcome-screen",
      "priority": "primary",
      "charLimit": 24,
      "content": "Get Started",
      "experimentVariant": { "variantId": "onboarding-cta-v2" }
    }
  ]
}
```

### Slot fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique slot identifier |
| `screen` | Yes | Screen/page this slot lives on |
| `priority` | Yes | `primary` \| `secondary` \| `tertiary` |
| `charLimit` | Required for primary | Maximum character count |
| `content` | Recommended | Default content string |
| `placeholders` | Required when content has {keys} | Array of typed placeholder objects |
| `stateCoverage` | Optional | States the slot must handle |
| `experimentVariant` | Optional | `null` or `{ variantId: "..." }` |

### Placeholder object

```json
{ "key": "userName", "type": "string", "example": "Alex" }
```

| Field | Required | Values |
|-------|----------|--------|
| `key` | Yes | Matches the interpolation key in content strings |
| `type` | Yes | `string` \| `number` \| `date` \| `currency` \| `count` |
| `example` | Yes | Representative value for screenshots and QA |

### State coverage entry

```json
{ "state": "loading", "content": "Loading..." }
{ "state": "empty", "inherit": true }
```

| Field | Required | Description |
|-------|----------|-------------|
| `state` | Yes | `loading` \| `success` \| `empty` \| `error` |
| `content` | Either content or inherit | String to show in this state |
| `inherit` | Either content or inherit | `true` to inherit default content |

---

## Hard Gates

### UCS002 — unique-content-ids
Slot ids must be unique across the entire spec.

**BAD:**
```json
[
  { "id": "cta-button", "screen": "onboarding" },
  { "id": "cta-button", "screen": "dashboard" }
]
// Same id on different screens — duplicate
```

### UCS003 — placeholder-typed
Placeholders must be typed objects, never bare strings.

**BAD:**
```json
{ "placeholders": ["userName"] }
// Bare string — no type information, no example
```

**GOOD:**
```json
{ "placeholders": [{ "key": "userName", "type": "string", "example": "Alex" }] }
```

### UCS004 — state-coverage
Each stateCoverage entry must declare what to show.

**BAD:**
```json
{ "state": "error" }
// No content, no inherit — blank UI in error state
```

**GOOD:**
```json
{ "state": "error", "content": "Could not load. Try again." }
// or
{ "state": "error", "inherit": true }
```

### UCS005 — char-limits
Primary slots must declare a character budget.

**BAD:**
```json
{ "id": "hero-headline", "priority": "primary" }
// No charLimit — headline can overflow the container
```

**GOOD:**
```json
{ "id": "hero-headline", "priority": "primary", "charLimit": 60 }
```

### UCS006 — i18n-interpolation
Every `{{key}}` or `{key}` in content must be declared in `placeholders`.

**BAD:**
```json
{
  "content": "Hello, {{firstName}}!",
  "placeholders": [{ "key": "userName", "type": "string", "example": "Alex" }]
}
// firstName used but only userName declared — runtime failure
```

**GOOD:**
```json
{
  "content": "Hello, {{firstName}}!",
  "placeholders": [{ "key": "firstName", "type": "string", "example": "Alex" }]
}
```

### UCS007 — variant-refs
`experimentVariant` must be null or an object with a non-empty variantId.

**BAD:**
```json
{ "experimentVariant": "" }
// Empty string — not a valid variant id
```

**GOOD:**
```json
{ "experimentVariant": { "variantId": "checkout-cta-v2" } }
// or to opt out:
{ "experimentVariant": null }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- `feature_id` or `id` declared
- All slot ids are unique
- All slots have `screen` reference
- All slots have valid `priority` (primary, secondary, tertiary)
- All primary slots have `charLimit > 0`
- All `placeholders` are objects with `key`, `type`, and `example`
- All `stateCoverage` entries have valid `state` and `content` or `inherit`
- All `{{key}}` patterns in `content` strings have matching `placeholders` entries
- All `experimentVariant` non-null values have a non-empty `variantId`

---

## What You Never Do

- Do not use duplicate slot ids — two slots cannot share the same id
- Do not use bare string placeholders — always use typed placeholder objects
- Do not omit `charLimit` on primary slots
- Do not leave `stateCoverage` entries with neither `content` nor `inherit`
- Do not use `{{key}}` in content without a matching `placeholders` entry
- Do not set `experimentVariant` to an empty string — use `null` to opt out
- Do not omit the `screen` field — every slot belongs to a screen
- Do not use an invalid state value in `stateCoverage` — only loading, success, empty, error

---
name: ux-state-matrix
description: Compiler skill for the ux-state-matrix compiler. Activates when producing state-matrix-artifact.json. Gates: UXS001–UXS009. Hard-fails when spec not found.
---

# ux-state-matrix — Compiler Skill

## What This Compiler Does

Compiles the screen state matrix specification — screens with data dependencies, required states (loading/success/empty/error), offline state for network-dependent screens, unauthorized state for auth-protected screens, recovery actions on error states, no duplicate state types per screen, and partial state for paginated data. Enforces a complete state coverage model so no screen is left in an undefined render state.

**NOTE:** This compiler **hard-fails** (not skips) when `state-matrix-spec.json` is missing.

**Upstream dependency:** none
**Output artifact:** `state-matrix-artifact.json`
**IR identifier:** `UX_STATE_MATRIX:{project}`

---

## Spec Shape

```json
{
  "version": "1.0",
  "screens": [
    {
      "id": "order-list",
      "auth": true,
      "visibility": "authenticated",
      "networkDependent": true,
      "paginated": true,
      "dataDependencies": [
        { "source": "api", "endpoint": "/api/orders", "networkRequired": true }
      ],
      "states": [
        { "type": "loading" },
        { "type": "success" },
        { "type": "empty" },
        { "type": "error", "recoveryActions": ["retry", "contact-support"] },
        { "type": "offline", "recoveryActions": ["retry-when-online"] },
        { "type": "unauthorized", "redirect": "/login" },
        { "type": "partial", "recoveryActions": ["load-more"] }
      ]
    },
    {
      "id": "about-page",
      "dataDependencies": [],
      "states": [
        { "type": "success" }
      ]
    }
  ]
}
```

Required fields:
- `version` — string (required for contract gate)
- `screens` — non-empty array, each with `id` (string), `dataDependencies` (array)

---

## Gates

### UXS001 — spec-valid
Reads `state-matrix-spec.json`. **Hard-fails** if not found. Required: `screens` (non-empty array). Each screen needs: `id` (string), `dataDependencies` (array).

### UXS002 — required-states
Every screen with at least one data dependency (`dataDependencies.length > 0`) must declare all four required states: `loading`, `success`, `empty`, `error`. Static screens (no data dependencies) are exempt.

BAD:
```json
{
  "id": "orders",
  "dataDependencies": [{ "source": "api" }],
  "states": [{ "type": "loading" }, { "type": "success" }]
  // Missing "empty" and "error"
}
```
GOOD:
```json
{
  "states": [
    { "type": "loading" },
    { "type": "success" },
    { "type": "empty" },
    { "type": "error", "recoveryActions": ["retry"] }
  ]
}
```

### UXS003 — offline-state
Network-dependent screens (`networkDependent: true`, or any dependency with `source: "api"` or `source: "remote"`) must declare an `"offline"` state. Escape hatch: `screen.offlineHandledGlobally: true`.

BAD:
```json
{ "id": "feed", "networkDependent": true, "states": [
  { "type": "loading" }, { "type": "success" }, { "type": "empty" }, { "type": "error" }
] }
// No "offline" state
```
GOOD:
```json
{ "states": [..., { "type": "offline", "recoveryActions": ["retry-when-online"] }] }
```

### UXS004 — unauthorized-state
Auth-protected screens (`auth: true` or `visibility !== "public"`) must declare an `"unauthorized"` state — the UI behavior when auth expires mid-session. Escape hatch: `screen.unauthorizedHandledByGuard: true`.

BAD:
```json
{ "id": "settings", "auth": true, "states": [
  { "type": "loading" }, { "type": "success" }, { "type": "empty" }, { "type": "error" }
] }
// No "unauthorized" state
```
GOOD:
```json
{ "states": [..., { "type": "unauthorized", "redirect": "/login" }] }
```

### UXS005 — recovery-action
Every error-type state (`error`, `offline`, `unauthorized`, `not-found`, `partial`) must declare at least one recovery action. Error states declared as bare strings (not objects) are violations. Use `terminal: true` for intentional dead-ends.

BAD:
```json
{ "states": [{ "type": "error" }] }
// Bare string-equivalent: no recoveryActions
```
BAD:
```json
{ "states": [{ "type": "error", "recoveryActions": [] }] }
// Empty recoveryActions
```
GOOD:
```json
{ "states": [{ "type": "error", "recoveryActions": ["retry", "contact-support"] }] }
{ "states": [{ "type": "error", "retry": true }] }
{ "states": [{ "type": "error", "redirect": "/home" }] }
{ "states": [{ "type": "error", "terminal": true }] }
// terminal:true = intentional dead-end
```

### UXS006 — no-duplicate-states
Within a single screen, each state `type` must appear at most once. Having two `"error"` states on the same screen creates ambiguity.

BAD:
```json
{ "states": [
  { "type": "error", "recoveryActions": ["retry"] },
  { "type": "error", "recoveryActions": ["contact-support"] }
] }
// Two "error" states
```
GOOD: each state type appears exactly once per screen.

### UXS007 — partial-state
Screens with paginated or optional data (`paginated: true`, `partial: true`, or any dependency with `optional: true` or `paginated: true`) must declare a `"partial"` state. Escape hatch: `screen.partialStateNotApplicable: true`.

BAD:
```json
{ "id": "products", "paginated": true, "states": [
  { "type": "loading" }, { "type": "success" }, { "type": "empty" }, { "type": "error" }
] }
// No "partial" state for paginated screen
```
GOOD:
```json
{ "states": [..., { "type": "partial", "recoveryActions": ["load-more"] }] }
```

### UXS008 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### UXS009 — contract-state-matrix
Final contract check:
- `version` declared
- All screen `id` values are unique
- Every state object (non-string) has a `type` field

---

## What This Compiler Never Forgives

- `state-matrix-spec.json` missing — **hard-fails** (UXS001)
- `screens` array missing or empty (UXS001)
- Screen missing `id` or `dataDependencies` (UXS001)
- Data-dependent screen missing loading/success/empty/error (UXS002)
- Network-dependent screen without `"offline"` state (UXS003)
- Auth-protected screen without `"unauthorized"` state (UXS004)
- Error-type state with no recovery action (UXS005)
- Duplicate state types within one screen (UXS006)
- Paginated/optional screen without `"partial"` state (UXS007)
- Duplicate screen ids (UXS009)
- State object without `type` field (UXS009)
- `version` missing (UXS009)

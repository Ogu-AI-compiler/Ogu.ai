# UX State Matrix Compiler

**Role:** Validate state coverage for every screen — every data surface must declare what the UI shows in every runtime state: loading, success, empty, error, and conditionally offline, unauthorized, and partial.

---

## Your Output

```
state-matrix-spec.json       ← authored by UX designer
state-matrix-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "screens": [
    {
      "id": "dashboard",
      "auth": true,
      "visibility": "authenticated",
      "networkDependent": true,
      "dataDependencies": [
        { "id": "metricsQuery", "source": "api", "optional": false },
        { "id": "recentActivity", "source": "api", "optional": true, "paginated": true }
      ],
      "states": [
        {
          "type": "loading",
          "ui": "skeleton-cards"
        },
        {
          "type": "success",
          "ui": "metric-cards + activity-feed"
        },
        {
          "type": "empty",
          "ui": "empty-state-illustration + onboarding-cta",
          "recoveryActions": ["start-tour"]
        },
        {
          "type": "error",
          "ui": "error-banner",
          "recoveryActions": ["retry", "contact-support"]
        },
        {
          "type": "offline",
          "ui": "stale-data-banner + cached-metrics",
          "retry": true
        },
        {
          "type": "unauthorized",
          "ui": "access-denied-message",
          "redirect": "login"
        },
        {
          "type": "partial",
          "ui": "metric-cards + activity-loading-placeholder",
          "recoveryActions": ["refresh"]
        }
      ]
    },
    {
      "id": "about",
      "dataDependencies": [],
      "states": [
        { "type": "success", "ui": "static-content" }
      ]
    }
  ]
}
```

### Screen fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique screen identifier. |
| `dataDependencies` | array | List of data queries this screen depends on. Empty = static screen. |
| `states` | array | State declarations. Can be strings (bare) or objects with type + metadata. |
| `auth` | boolean | Whether the screen is auth-protected. |
| `visibility` | string | Access level. |
| `networkDependent` | boolean | Explicit override to mark screen as network-dependent. |
| `paginated` | boolean | Screen has paginated data — requires partial state. |

### State types (required for data-dependent screens)

| Type | Required when | Description |
|------|--------------|-------------|
| `loading` | Always for data-dependent | UI while data is being fetched |
| `success` | Always for data-dependent | UI when data is available |
| `empty` | Always for data-dependent | UI when query returns zero results |
| `error` | Always for data-dependent | UI when query fails |
| `offline` | Network-dependent screens | UI when connectivity is lost |
| `unauthorized` | Auth-protected screens | UI when session expires mid-use |
| `partial` | Paginated/optional data | UI when some but not all data has loaded |

---

## Hard Gates

### UXS002 — required-states
Data-dependent screens must declare all four: `loading`, `success`, `empty`, `error`.

**BAD:**
```json
{
  "id": "orders",
  "dataDependencies": [{ "id": "ordersQuery", "source": "api" }],
  "states": [{ "type": "success", "ui": "orders-table" }]
}
// Missing: loading, empty, error
```

### UXS005 — recovery-action
Every error/offline/unauthorized/partial state must declare recovery.

**BAD:**
```json
{ "type": "error", "ui": "something-went-wrong" }
// No recoveryActions, retry, or redirect
```
**GOOD:**
```json
{ "type": "error", "ui": "error-banner", "recoveryActions": ["retry", "contact-support"] }
```

### UXS003 — offline-state
Network-dependent screens must declare an `offline` state.

**Escape hatch:** `screen.offlineHandledGlobally: true` if a global app-level offline banner handles all screens.

---

## Contract (Gold Standard)

A dashboard screen with full state coverage:

```json
{
  "version": "1.0.0",
  "screens": [
    {
      "id": "dashboard",
      "auth": true,
      "networkDependent": true,
      "dataDependencies": [{ "id": "statsQuery", "source": "api" }],
      "states": [
        { "type": "loading", "ui": "shimmer-layout" },
        { "type": "success", "ui": "stats-grid" },
        { "type": "empty",   "ui": "no-data-cta",   "recoveryActions": ["create-first-item"] },
        { "type": "error",   "ui": "error-toast",    "recoveryActions": ["retry"] },
        { "type": "offline", "ui": "offline-banner", "retry": true },
        { "type": "unauthorized", "ui": "session-expired", "redirect": "login" }
      ]
    }
  ]
}
```

---

## What You Never Do

- Do not declare a data-dependent screen with only a `success` state
- Do not leave error states without recovery actions — even `terminal: true` must be explicit
- Do not declare two `error` states on the same screen — merge them into one with multiple `recoveryActions`
- Do not use bare strings for error states — they cannot carry recovery action metadata
- Do not mark `networkDependent: false` on a screen that makes API calls
- Do not omit `version` from the spec

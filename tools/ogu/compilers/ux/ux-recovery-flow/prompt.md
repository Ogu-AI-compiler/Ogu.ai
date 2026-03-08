# UX Recovery Flow Compiler

**Role:** Validate recovery flow specs — the systematic catalog of every failure state in a feature, the recovery actions available to users, and the behavioral policies (retry limits, backoff, escape hatches) that govern error recovery.

---

## Your Output

```
recovery-flow-spec.json       ← authored by UX designer or engineer
recovery-flow-artifact.json   ← produced by this compiler on full pass
```

---

## Spec Shape

```json
{
  "version": "1.0.0",
  "failures": [
    {
      "id": "upload-timeout",
      "trigger": "upload request exceeds 30s",
      "severity": "warning",
      "userMessage": "Your upload timed out. Check your connection and try again.",
      "recovery": {
        "retry": true,
        "maxRetries": 3,
        "backoff": "exponential"
      }
    },
    {
      "id": "server-500",
      "trigger": "API returns 500 status",
      "severity": "critical",
      "escapeHatch": "go-home",
      "userMessage": "Something went wrong on our end. We have been notified. Please try again in a few minutes.",
      "recovery": {
        "retry": true,
        "maxRetries": 2,
        "backoff": "linear",
        "contactSupport": true
      }
    },
    {
      "id": "offline-detected",
      "trigger": "network offline event fired",
      "severity": "warning",
      "userMessage": "You appear to be offline. Some features may be limited.",
      "recovery": {
        "fallback": "read-only-cached-mode"
      }
    },
    {
      "id": "auth-expired",
      "trigger": "401 response on API call",
      "severity": "error",
      "userMessage": "Your session has expired. Please sign in again.",
      "recovery": {
        "redirect": "/login?reason=session-expired"
      }
    }
  ]
}
```

### Failure fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique failure identifier |
| `trigger` | Yes | What causes this failure (event, condition, API response) |
| `severity` | Recommended | `warning` \| `error` \| `critical` \| `fatal` |
| `userMessage` | Yes | Specific, actionable message shown to user |
| `escapeHatch` | Required for critical/fatal | Named action returning user to safe state |
| `recovery` | Yes | Object with at least one of: retry, redirect, fallback, contactSupport |
| `genericMessageOk` | Escape hatch | `true` to allow generic userMessage (rare) |

### Recovery object fields

| Field | Description |
|-------|-------------|
| `retry` | `true` to enable retry |
| `maxRetries` | Integer 1–10 (required when retry:true) |
| `backoff` | `linear` \| `exponential` \| `fixed` (required when maxRetries > 1) |
| `redirect` | Route or URL to redirect the user |
| `fallback` | Degraded mode identifier (string) |
| `contactSupport` | `true` to show contact support option |

---

## Hard Gates

### URF002 — all-failures-covered
Every failure must have at least one recovery action.

**BAD:**
```json
{ "id": "upload-failed", "trigger": "network error", "recovery": {} }
// Empty recovery object — user is stranded
```

**GOOD:**
```json
{ "recovery": { "retry": true, "maxRetries": 3, "backoff": "exponential" } }
```

### URF003 — retry-limits
`retry: true` requires `maxRetries` within 1–10.

**BAD:**
```json
{ "recovery": { "retry": true } }
// No maxRetries — infinite retry
```

**GOOD:**
```json
{ "recovery": { "retry": true, "maxRetries": 3, "backoff": "linear" } }
```

### URF004 — escape-hatch
Critical and fatal failures need a defined escape route.

**BAD:**
```json
{ "id": "db-crash", "severity": "critical", "recovery": { "contactSupport": true } }
// No escapeHatch — user is trapped
```

**GOOD:**
```json
{ "id": "db-crash", "severity": "critical", "escapeHatch": "go-home", "recovery": { "contactSupport": true } }
```

### URF005 — offline-fallback
Network and offline failures need a degraded-mode fallback.

**BAD:**
```json
{ "id": "no-connection", "trigger": "network offline" }
// No fallback — nothing to show offline users
```

**GOOD:**
```json
{ "id": "no-connection", "trigger": "network offline", "recovery": { "fallback": "cached-read-only-mode" } }
```

### URF006 — error-message-quality
`userMessage` must be specific — not a generic placeholder.

**BAD:**
```json
{ "userMessage": "An error occurred" }
```

**GOOD:**
```json
{ "userMessage": "We could not save your changes. Please check your connection and try again." }
```

### URF007 — backoff-declared
Multi-retry recoveries must specify a backoff strategy.

**BAD:**
```json
{ "recovery": { "retry": true, "maxRetries": 5 } }
// No backoff — 5 rapid-fire retries hit the server at full rate
```

**GOOD:**
```json
{ "recovery": { "retry": true, "maxRetries": 5, "backoff": "exponential" } }
```

---

## Contract

A spec that passes all gates:

- `version` declared
- At least one failure
- All failure ids are unique
- All failures have recovery with at least one action
- All critical/fatal failures have `escapeHatch`
- All offline/network failures have `fallback`
- All retryable recoveries have `maxRetries` between 1 and 10
- All multi-retry recoveries have `backoff` declared
- All failures have a specific, non-generic `userMessage`

---

## What You Never Do

- Do not declare `retry: true` without `maxRetries`
- Do not set `maxRetries > 10` — excessive retries are a DDoS on your own servers
- Do not use generic userMessage placeholders like "Something went wrong"
- Do not leave critical/fatal failures without an escapeHatch
- Do not leave network/offline failures without a fallback
- Do not use multi-retry recoveries without a backoff strategy
- Do not use duplicate failure ids
- Do not declare empty recovery objects

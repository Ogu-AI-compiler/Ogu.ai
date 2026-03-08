# Rate Limit Policy Module Compiler

## Purpose
Compiles a rate limit policy with scope, quota, window, and bypass safety.

## Invariants
1. **Deterministic keys** — No Date.now() or random in key builder.
2. **Retry-After** — 429 must include Retry-After header.
3. **No undeclared bypass** — Admin/internal bypasses must be in spec.bypassConditions.

## spec format
```json
{
  "policyId": "api-per-user",
  "scope": "user",
  "quota": 100,
  "windowSeconds": 60,
  "strategy": "sliding",
  "bypassConditions": ["internal-service"]
}
```

## Error codes
| Code  | Meaning |
|-------|---------|
| RL001 | rate-limit-spec.json missing/invalid |
| RL002 | Non-deterministic key builder |
| RL003 | 429 missing Retry-After header |
| RL004 | Undeclared bypass |
| RL005 | TODO/FIXME/HACK |
| RL006 | Tests failed |
| RL007 | Contract violation |

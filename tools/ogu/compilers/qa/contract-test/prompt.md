# QA Compiler: contract-test

## Purpose
Validate that consumer-driven contract tests are correctly configured, use a broker,
and produce assertions strong enough to actually prevent API breakage.

## Spec File
`contract-test-spec.json` in the compiler directory.

## Invariants

| Code  | Rule                                                                               |
|-------|------------------------------------------------------------------------------------|
| QA050 | Spec must have `framework`, `consumer`, `providers[]`, `interactions[]`            |
| QA051 | `broker.url` must use env-var syntax — no hardcoded URLs                           |
| QA052 | `publishResults: true` required when broker is declared (+ `consumerVersion`)      |
| QA053 | If `openApiSpec` declared: all interaction paths must exist in it                  |
| QA054 | No wildcard/SomethingLike matchers or empty response bodies                        |
| QA055 | If `openApiSpec` declared: `validateAgainstOpenApi: true` required                 |
| QA056 | No TODO/FIXME/HACK in any source file                                              |
| QA057 | `contract-test-artifact.json` must be structurally valid                           |

## Spec Shape

```json
{
  "framework": "pact",
  "consumer": "frontend-app",
  "providers": [
    { "name": "user-service" },
    { "name": "order-service" }
  ],
  "interactions": [
    {
      "description": "GET /users/123 returns user",
      "request": { "method": "GET", "path": "/users/123" },
      "response": {
        "status": 200,
        "body": {
          "id": 123,
          "name": "Alice",
          "email": "alice@example.com"
        }
      }
    }
  ],
  "broker": {
    "url": "${PACT_BROKER_URL}",
    "token": "${PACT_BROKER_TOKEN}"
  },
  "publishResults": true,
  "consumerVersion": "${GIT_COMMIT}",
  "openApiSpec": "docs/openapi.json",
  "validateAgainstOpenApi": true
}
```

## Error Codes

| Code  | Name                           | Fix                                                       |
|-------|--------------------------------|-----------------------------------------------------------|
| QA050 | spec-invalid                   | Add `framework`, `consumer`, `providers[]`, `interactions[]` |
| QA051 | broker-url-hardcoded           | Use `"url": "${PACT_BROKER_URL}"`                         |
| QA052 | publish-results-not-set        | Add `publishResults: true` and `consumerVersion`          |
| QA053 | interactions-path-not-in-oas   | Fix path or update OpenAPI spec                           |
| QA054 | wildcard-matching              | Add specific type/value assertions to response body       |
| QA055 | openapi-validation-disabled    | Add `validateAgainstOpenApi: true`                        |
| QA056 | todos-found                    | Resolve all TODO/FIXME/HACK                               |
| QA057 | artifact-invalid               | Run runner.mjs to regenerate artifact                     |

## Why No Wildcard Matchers?

A contract with `SomethingLike("any string")` for a user's email field will pass
even if the provider returns `null`, `""`, or removes the field entirely.
Contract tests must assert the actual structure and types that the consumer depends on.

**Acceptable**: `{ "email": { "match": "regex", "regex": ".+@.+\\..+" } }`
**Not acceptable**: `{ "email": { "json_class": "Pact::SomethingLike" } }`

## Why Publish Results?

Consumer contracts are useless if the provider never sees them.
Publishing to the Pact Broker enables:
- Provider verification runs against the latest consumer contracts
- `can-i-deploy` checks before any deployment
- Cross-team visibility into consumer-provider coupling

## Output Artifact

`contract-test-artifact.json`

```json
{
  "ir_id": "CONTRACT_TEST:frontend-app",
  "framework": "pact",
  "consumer": "frontend-app",
  "providers": [{ "name": "user-service" }],
  "interactions": [ ... ],
  "broker": { "url": "${PACT_BROKER_URL}" },
  "publishResults": true,
  "gates": [ { "pass": true, "code": "QA050" } ],
  "pass": true,
  "attestation": { "hash": "<sha256>", "timestamp": "..." }
}
```

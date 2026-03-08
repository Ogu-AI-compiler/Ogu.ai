---
name: contract-test
description: Compiler skill for the contract-test compiler. Activates when producing contract-test-artifact.json. Gates: QA050–QA057. No upstream dependency.
---

# contract-test — Compiler Skill

## What This Compiler Does

Compiles a consumer-driven contract test configuration — consumer name, providers, interactions with request/response pairs, broker setup, and OpenAPI validation. Enforces: broker URL from env var (not hardcoded), `publishResults: true` with `consumerVersion`, no wildcard matchers in response bodies, interactions align with OpenAPI spec if declared, and results published to broker.

**Upstream dependency:** none
**Output artifact:** `contract-test-artifact.json`
**IR identifier:** `CONTRACT_TEST:{consumer}`

---

## Spec Shape

```json
{
  "framework": "pact",
  "consumer": "web-app",
  "providers": [
    { "name": "user-service", "version": "2.1.0" },
    { "name": "order-service" }
  ],
  "interactions": [
    {
      "description": "Get user profile",
      "request": {
        "method": "GET",
        "path": "/api/users/123",
        "headers": { "Authorization": "Bearer ${TOKEN}" }
      },
      "response": {
        "status": 200,
        "body": {
          "id": "123",
          "name": "Alice",
          "email": "alice@example.com"
        }
      }
    },
    {
      "description": "Create order",
      "request": {
        "method": "POST",
        "path": "/api/orders",
        "body": { "productId": "abc", "quantity": 2 }
      },
      "response": {
        "status": 201,
        "body": { "orderId": "order-789", "status": "pending" }
      }
    }
  ],
  "broker": {
    "url": "${PACT_BROKER_URL}",
    "brokerToken": "${PACT_BROKER_TOKEN}"
  },
  "publishResults": true,
  "consumerVersion": "${GIT_COMMIT}",
  "openApiSpec": "openapi.json",
  "validateAgainstOpenApi": true
}
```

Required fields:
- `framework` — `pact`, `pactflow`, `spring-cloud-contract`, `dredd`, or `schemathesis`
- `consumer` — consuming service name
- `providers` — non-empty array, each with `name`
- `interactions` — non-empty array, each with `description`, `request.method`, `request.path`, `response.status`

---

## Gates

### QA050 — spec-valid
Reads `contract-test-spec.json`. Validates framework, consumer, providers, and interactions.

Each interaction must have:
- `description` — string
- `request.method` — HTTP method
- `request.path` — URL path
- `response.status` — number

### QA051 — broker-url-from-env
If `spec.broker` is declared, `broker.url` must use `${ENV_VAR}` or `$ENV_VAR` syntax — not a hardcoded `http://` or `https://` URL. Credentials (`brokerToken`, `brokerUsername`, `brokerPassword`) must also use env var syntax.

BAD:
```json
{ "broker": { "url": "https://my-pact-broker.com", "brokerToken": "abc123xyz" } }
```
GOOD:
```json
{ "broker": { "url": "${PACT_BROKER_URL}", "brokerToken": "${PACT_BROKER_TOKEN}" } }
```

If `spec.broker` not declared — gate is **skipped**.

### QA052 — publish-results-true
If `spec.broker` is declared:
1. `publishResults` must be `true`
2. `consumerVersion` must be declared (e.g. `"${GIT_COMMIT}"`)

BAD: `"publishResults": false` or missing.
BAD: `"publishResults": true` but no `consumerVersion`.
GOOD:
```json
{ "publishResults": true, "consumerVersion": "${GIT_COMMIT}" }
```

If `spec.broker` not declared — gate is **skipped**.

### QA053 — interactions-match-openapi
Skipped if `spec.openApiSpec` not declared. When declared:
1. The OpenAPI JSON file must exist on disk
2. Every `interaction.request.path` must match a path in OpenAPI (with `{param}` substitution)
3. Every `interaction.request.method` must be defined for that path in OpenAPI

BAD: Interaction references `/api/v2/users` but OpenAPI only has `/api/v1/users`.
GOOD: All interaction paths match OpenAPI path templates.

### QA054 — no-wildcard-matching
Response bodies must not use wildcard/empty matchers:
- `{ "json_class": "Pact::SomethingLike" }` — Pact v2 any-value matcher
- `matchers: [{ "match": "type" }]` — matches any value of that type
- Response body `{}` — empty, no assertions
- `response.body: null` for non-204 status

Escape hatch: add `"wildcardOk": true` to a specific interaction.

BAD:
```json
{ "response": { "status": 200, "body": {} } }
// empty body — no assertions at all
```
GOOD:
```json
{ "response": { "status": 200, "body": { "id": "123", "name": "Alice" } } }
```

### QA055 — openapi-validation-enabled
Skipped if `spec.openApiSpec` not declared. When declared, either:
- `spec.validateAgainstOpenApi: true`, OR
- `spec.validation.enabled: true`, OR
- Framework is `schemathesis` or `dredd` (inherently OpenAPI-based)

BAD: `openApiSpec` declared but `validateAgainstOpenApi` is false or missing.
GOOD: `"openApiSpec": "openapi.json", "validateAgainstOpenApi": true`

### QA056 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA057 — contract-pact
The compiled artifact `contract-test-artifact.json` must exist with: `ir_id` (starting `CONTRACT_TEST:`), `framework`, `consumer`, `providers` (non-empty array), `interactions` (non-empty array), `attestation.hash`.

---

## What This Compiler Never Forgives

- `contract-test-spec.json` missing (QA050 hard-fails)
- Framework not in valid list (QA050)
- `interactions` empty or any interaction missing `description`, `request.method`, `request.path`, `response.status` (QA050)
- `broker.url` hardcoded as `http://` or `https://` URL (QA051)
- Broker credentials as literal strings (QA051)
- `publishResults: false` or missing when broker declared (QA052)
- `consumerVersion` missing when `publishResults: true` (QA052)
- Interaction path not found in OpenAPI spec (QA053)
- Response body `{}` with no assertions (QA054)
- `Pact::SomethingLike` wildcard matcher in response (QA054)
- `openApiSpec` declared but `validateAgainstOpenApi` not enabled (QA055)

---
name: e2e-spec
description: Compiler skill for the e2e-spec compiler. Activates when producing e2e-spec-artifact.json. Gates: QA020–QA029. No upstream dependency.
---

# e2e-spec — Compiler Skill

## What This Compiler Does

Compiles the E2E test specification — framework, user flows, critical paths, base URL, retry policy, and failure artifact configuration. Enforces: at least one flow marked `criticalPath: true`, every flow covers ≥2 routes, `baseUrl` uses environment variable (not localhost), retries are 0 locally, screenshots configured for CI failures, and no hardcoded credentials in flow definitions.

**Upstream dependency:** none
**Output artifact:** `e2e-spec-artifact.json`
**IR identifier:** `E2E_SPEC:{project}`

---

## Spec Shape

```json
{
  "framework": "playwright",
  "baseUrl": "${E2E_BASE_URL}",
  "userFlows": [
    {
      "id": "user-registration",
      "name": "User Registration Flow",
      "criticalPath": true,
      "routesCovered": ["/register", "/verify-email", "/dashboard"],
      "steps": ["Fill form", "Submit", "Verify email", "Redirect to dashboard"]
    },
    {
      "id": "checkout",
      "name": "Checkout Flow",
      "criticalPath": true,
      "routesCovered": ["/cart", "/checkout", "/payment", "/confirmation"]
    },
    {
      "id": "profile-edit",
      "name": "Profile Editing",
      "criticalPath": false,
      "routesCovered": ["/profile", "/profile/edit"]
    }
  ],
  "retries": {
    "local": 0,
    "ci": 2
  },
  "failureArtifacts": {
    "screenshot": true,
    "video": "on-failure",
    "trace": "retain-on-failure"
  }
}
```

Required fields:
- `framework` — `playwright`, `cypress`, `webdriverio`, or `puppeteer`
- `baseUrl` — must use `${ENV_VAR}` syntax
- `userFlows` — non-empty array, each with `id`, `name`, `routesCovered` (≥2 routes)

---

## Gates

### QA020 — spec-valid
Reads `e2e-spec.json`. Required: `framework` (valid), `baseUrl` (declared), `userFlows` (non-empty). Each flow must have `id`, `name`, and `routesCovered` (non-empty array).

### QA021 — critical-paths-defined
At least one user flow must have `criticalPath: true`. Critical paths are the pre-deploy gate that must pass before any deployment.

BAD: No flows have `criticalPath: true`.
GOOD: Login and checkout flows marked `criticalPath: true`.

### QA022 — all-flows-multi-route
Every user flow must cover at least 2 routes in `routesCovered`. A single-route "flow" is a component test, not an E2E test.

Exception: `"singlePage": true` on the flow (document the reason).

BAD:
```json
{ "id": "login", "routesCovered": ["/login"] }
// Only one route — not a flow
```
GOOD:
```json
{ "id": "login", "routesCovered": ["/login", "/dashboard"] }
```

### QA023 — baseurl-from-env
`baseUrl` must not be a hardcoded localhost or IP URL. Must contain `${VAR_NAME}` syntax.

BAD:
```json
{ "baseUrl": "http://localhost:3000" }
{ "baseUrl": "https://app.example.com" }
```
GOOD:
```json
{ "baseUrl": "${E2E_BASE_URL}" }
```

### QA024 — no-hardcoded-credentials
Sensitive fields (`password`, `token`, `secret`, `apiKey`, `auth`, `credential`) must use `${ENV_VAR}` syntax — not literal values. Strings ≥40 chars matching API key patterns are also flagged.

BAD:
```json
{ "auth": { "password": "myPassword123" } }
```
GOOD:
```json
{ "auth": { "password": "${TEST_USER_PASSWORD}" } }
```

### QA025 — retries-ci-only
`retries.local` must be 0 (or not set). Local retries hide flaky tests. `retries.ci` may be >0 but must not exceed 3 (more than 3 = structurally flaky).

BAD:
```json
{ "retries": { "local": 2, "ci": 3 } }
// local retries mask flakiness
```
GOOD:
```json
{ "retries": { "local": 0, "ci": 2 } }
```

### QA026 — selectors-are-accessible
Page object files (in `pages/`, `pageObjects/`, `e2e/`, `playwright/`, `cypress/` dirs) must not use CSS class selectors (`.class`) or ID selectors (`#id`) in `locator()`, `find()`, `$()`, or `get()` calls.

Use role-based selectors: `getByRole`, `getByLabel`, `getByText`, `getByTestId`, `getByPlaceholder`.

BAD:
```ts
page.locator('.submit-button');
cy.get('#username-input');
```
GOOD:
```ts
page.getByRole('button', { name: 'Submit' });
page.getByLabel('Username');
```

Escape hatch: `// @css-selector-ok: reason`

### QA027 — failure-artifacts-configured
`spec.failureArtifacts.screenshot` must be `true`. Without screenshots, CI failure logs are undiagnosable.

BAD: `failureArtifacts` missing or `screenshot: false`.
GOOD:
```json
{ "failureArtifacts": { "screenshot": true, "video": "on-failure" } }
```

### QA028 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA029 — contract-e2e
The compiled artifact `e2e-spec-artifact.json` must exist with: `ir_id` (starting `E2E_SPEC:`), `framework`, `userFlows`, `criticalPaths`, `attestation.hash`.

---

## What This Compiler Never Forgives

- `e2e-spec.json` missing (QA020 hard-fails)
- No flows with `criticalPath: true` (QA021)
- Any flow with only 1 route in `routesCovered` (QA022)
- `baseUrl` hardcoded to `localhost` or `http://` URL (QA023)
- Literal passwords/tokens/secrets in spec (QA024)
- `retries.local` > 0 (QA025)
- `retries.ci` > 3 (QA025)
- CSS class/ID selectors in page objects (QA026)
- `failureArtifacts.screenshot` not `true` (QA027)

# E2E Specification Compiler

You are specifying **end-to-end test flows** — user journeys that span multiple pages and verify real user scenarios.

## Invariants (non-negotiable)

1. **Every flow covers ≥2 routes** — a single-route "flow" is a component test. E2E means crossing page boundaries. Violates QA022.
2. **At least one `criticalPath: true`** — defines the pre-deploy gate. Without it, no flow runs before deployment. Violates QA021.
3. **baseUrl from environment variable** — `${E2E_BASE_URL}`, not `http://localhost:3000`. Violates QA023.
4. **No hardcoded credentials** — passwords/tokens as `${ENV_VAR}`, never literal values. Violates QA024.
5. **retries.local must be 0** — local retries hide flaky tests. Violates QA025.
6. **Accessible selectors in page objects** — `getByRole`, `getByLabel`, never `.class` or `#id`. Violates QA026.
7. **Screenshots on failure** — `failureArtifacts.screenshot: true`. Violates QA027.

## Spec format

```json
{
  "framework": "playwright",
  "baseUrl": "${E2E_BASE_URL}",
  "userFlows": [
    {
      "id": "UF-001",
      "name": "user-registration",
      "routesCovered": ["/register", "/verify-email", "/onboarding"],
      "authState": "unauthenticated",
      "criticalPath": true
    },
    {
      "id": "UF-002",
      "name": "checkout-flow",
      "routesCovered": ["/cart", "/checkout", "/payment", "/confirmation"],
      "authState": "authenticated",
      "criticalPath": true
    }
  ],
  "isolation": "per-test",
  "failureArtifacts": {
    "screenshot": true,
    "video": "on-failure",
    "trace": "on-retry"
  },
  "retries": { "ci": 2, "local": 0 },
  "slowTestThresholdMs": 30000
}
```

## Page object pattern (Playwright recommended)

```typescript
// ✅ Accessible selectors — resilient to CSS refactors
class CheckoutPage {
  readonly page: Page;
  readonly proceedToPayment = this.page.getByRole('button', { name: 'Proceed to payment' });
  readonly orderTotal = this.page.getByLabel('Order total');
  readonly emailInput = this.page.getByLabel('Email address');

  async fillBillingDetails(email: string) {
    await this.emailInput.fill(email);
  }
}

// ❌ CSS selectors — break on CSS refactor (QA026)
class CheckoutPage {
  async fillBillingDetails(email: string) {
    await this.page.locator('.billing-form .email-input').fill(email); // FAIL
    await this.page.locator('#email').fill(email); // FAIL
  }
}
```

## Error codes

| Code | Gate | Meaning |
|------|------|---------|
| QA020 | spec-valid | e2e-spec.json missing or invalid |
| QA021 | critical-paths-defined | No flow marked criticalPath: true |
| QA022 | all-flows-multi-route | Flow covers only one route |
| QA023 | baseurl-from-env | baseUrl hardcoded (localhost/IP) |
| QA024 | no-hardcoded-credentials | Literal password/token in spec |
| QA025 | retries-ci-only | retries.local > 0 |
| QA026 | selectors-are-accessible | CSS/ID selector in page object |
| QA027 | failure-artifacts-configured | Screenshots not enabled |
| QA028 | no-todos | TODO/FIXME/HACK found |
| QA029 | contract-e2e | Artifact contract violation |

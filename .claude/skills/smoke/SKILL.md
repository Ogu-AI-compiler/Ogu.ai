---
name: smoke
description: Write and run E2E smoke tests for a feature. Use when user says "smoke test", "write e2e", "e2e test", "test this feature", or after /build.
argument-hint: <slug>
disable-model-invocation: true
---

You write the minimum E2E smoke test that proves a feature is wired end-to-end. No render-only tests. No stubs. Real clicks, real assertions.

## Input

Feature slug: $ARGUMENTS

If no slug is provided, check `.ogu/STATE.json` field `current_task`. If that's also null, ask the user.

## Before you write anything

1. Read `.ogu/CONTEXT.md`
2. Read `docs/vault/04_Features/<slug>/PRD.md` — find the happy path
3. Read `docs/vault/04_Features/<slug>/Spec.md` — find the exact flow, screens, actions
4. Read `docs/vault/04_Features/<slug>/Plan.json` — understand the implementation
5. Read `docs/vault/04_Features/<slug>/QA.md` — the happy path checklist is your test outline

## Step 1: Detect the platform and test framework

Scan the repo to determine what to use:

**Web:**
- If Playwright is already set up → use Playwright
- If not, use Playwright as default for web projects
- Test location: `tests/e2e/<slug>.smoke.spec.ts`

**React Native / Expo:**
- If Detox is set up → use Detox. Location: `e2e/detox/<slug>.smoke.test.ts`
- If Maestro is set up → use Maestro. Location: `e2e/maestro/<slug>_smoke.yaml`
- If neither → prefer Maestro as first step. Do not introduce a new framework without ADR.

**Other:** Ask the user what test framework to use.

## Step 2: Plan the flow

From PRD/Spec/QA, extract ONE happy path flow with 3-6 clear steps:

```
Flow: <feature> smoke happy path
1. Navigate to <entry screen>
2. Tap <CTA button>
3. Fill <required fields> (if any)
4. Submit
5. Assert <destination UI visible / modal open / data changed>
```

Tell the user the planned flow before writing the test.

## Step 3: Write the test

### Playwright (Web)

```typescript
// tests/e2e/<slug>.smoke.spec.ts
import { test, expect } from '@playwright/test';

test('<slug>: smoke happy path', async ({ page }) => {
  // 1. Navigate
  // 2. Click real buttons (use data-testid or role selectors)
  // 3. Fill fields if needed
  // 4. Submit
  // 5. Assert real outcome
});
```

Rules:
- Use `data-testid` or role selectors — never text selectors unless no alternative
- Every action MUST have an `expect` after it
- Mock API calls if needed for stability, but the UI interaction must be real
- No `waitForTimeout` — use `waitForSelector` or `expect` with auto-retry

### Detox (React Native)

```typescript
// e2e/detox/<slug>.smoke.test.ts
describe('<slug>: smoke happy path', () => {
  it('completes the main flow', async () => {
    // Use by.id() with testID props
    // Every tap must have an expect after it
  });
});
```

Rules:
- Use `by.id()` with `testID` — never `by.text()` unless no alternative
- Every `tap()` must be followed by `expect().toBeVisible()` or equivalent

### Maestro (React Native)

```yaml
# e2e/maestro/<slug>_smoke.yaml
appId: <from app.json>
---
- launchApp
- tapOn:
    id: "<testID>"
- assertVisible:
    id: "<target element testID>"
```

Rules:
- Use `id` (testID) for tapping — not text unless no alternative
- Every `tapOn` must be followed by `assertVisible`

## Step 4: Ensure testIDs exist

Scan the implementation code for every element the test interacts with. Each must have a stable identifier:

- **React/React Native**: `testID="<slug>-<element>"` or `data-testid="<slug>-<element>"`
- **Web HTML**: `data-testid="<slug>-<element>"`

If any testID is missing, add it to the component. List every testID you add.

## Step 5: Handle API calls

If the flow requires API calls:
1. If the project has an existing mock/stub layer → use it
2. If not, create a minimal stub at the client level (intercept fetch/axios)
3. Do NOT build a new mock infrastructure without ADR

For Playwright: use `page.route()` to intercept
For Detox: use the project's existing mock server or a simple stub

## Step 6: Verify the test

Run the test locally if possible:

**Playwright:**
```bash
npx playwright test tests/e2e/<slug>.smoke.spec.ts
```

**Detox:**
```bash
npx detox test e2e/detox/<slug>.smoke.test.ts
```

**Maestro:**
```bash
maestro test e2e/maestro/<slug>_smoke.yaml
```

If you can't run it (missing emulator, missing config), tell the user and provide exact run instructions.

## Step 7: Log and report

```bash
node tools/ogu/cli.mjs log "Smoke E2E written for <slug>: <test file path>"
```

Report:

```
Smoke E2E: <slug>

  Framework: <Playwright/Detox/Maestro>
  Test file: <path>
  Flow: <1-line description>
  Steps: <N>
  Assertions: <N>
  testIDs added: <list or "none needed">
  API mocks: <yes/no — details>
  Status: <PASSED locally / NOT RUN — instructions provided>
```

## Forbidden

- Test that only renders a component without interaction
- Test without assertions after interactions
- `click()` or `tap()` without `expect` / `assertVisible` after
- TODO or skip markers in test code
- Disabling the test to pass CI
- Text-based selectors when testID is available
- `waitForTimeout` / `sleep` instead of proper waits

## Rules

- One smoke test minimum per feature. More is fine, but one is required.
- The test must exercise real buttons, real navigation, real outcomes.
- If a testID is missing from implementation, add it — don't work around it.
- If you discover a dead button while writing the test, STOP. Report it. The implementation must be fixed first.
- This skill writes tests. It does not fix implementation bugs it discovers.

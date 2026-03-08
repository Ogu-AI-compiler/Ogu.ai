---
name: test-harness-config
description: Compiler skill for the test-harness-config compiler. Activates when producing test-harness-artifact.json. Gates: QA001–QA009. No upstream dependency.
---

# test-harness-config — Compiler Skill

## What This Compiler Does

Compiles the test runner harness configuration — runner, environments, coverage provider, reporters, timeouts, mock strategy, and global setup. Enforces: runner version pinned exactly (no `^` or `~`), JUnit reporter present for CI integration, every environment has a non-zero timeout, coverage provider explicitly `v8` or `istanbul` with non-empty include patterns, mock strategy is a recognized value, and global setup file exists on disk.

**Upstream dependency:** none
**Output artifact:** `test-harness-artifact.json`
**IR identifier:** `TEST_HARNESS_CONFIG:{project}`

---

## Spec Shape

```json
{
  "runner": "vitest",
  "environments": {
    "unit": { "testMatch": ["src/**/*.test.ts"] },
    "integration": { "testMatch": ["tests/integration/**/*.test.ts"] },
    "e2e": { "testMatch": ["tests/e2e/**/*.test.ts"] }
  },
  "coverage": {
    "provider": "v8",
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["src/**/*.stories.tsx", "src/**/*.d.ts"]
  },
  "reporters": ["default", "junit"],
  "timeouts": {
    "unit": 5000,
    "integration": 30000,
    "e2e": 120000
  },
  "mockStrategy": "msw",
  "globalSetup": "tests/setup.ts"
}
```

Required fields:
- `runner` — `vitest`, `jest`, `playwright`, `mocha`, or `jasmine`
- `environments` — object mapping env names to settings
- `coverage` — object
- `reporters` — non-empty array
- `timeouts` — object
- `mockStrategy` — declared and valid

---

## Gates

### QA001 — spec-valid
Reads `test-harness-spec.json`. Required: `runner`, `environments`, `coverage`, `reporters`, `timeouts`, `mockStrategy`. Runner must be one of: `vitest`, `jest`, `playwright`, `mocha`, `jasmine`.

### QA002 — runner-version-pinned
The test runner package must be in `package.json` devDependencies with an exact version — no `^` or `~` range specifiers. Range versions cause CI flakiness when minor releases introduce breaking changes.

BAD:
```json
{ "devDependencies": { "vitest": "^2.1.4" } }
// ^ range — next minor could break CI
```
GOOD:
```json
{ "devDependencies": { "vitest": "2.1.4" } }
```

### QA003 — coverage-provider-explicit
`coverage.provider` must be `"v8"` or `"istanbul"` (not unset — defaults change across versions). `coverage.include` must be a non-empty array. Test files (`.test.*`, `__tests__`) must not appear in `include` (inflates coverage numbers).

BAD:
```json
{ "coverage": { "include": ["src/**/*.test.ts"] } }
// test files in include — measures tests measuring themselves
```
BAD: `coverage.provider` missing.
GOOD:
```json
{ "coverage": { "provider": "v8", "include": ["src/**/*.ts"] } }
```

### QA004 — timeout-per-environment
Every declared environment must have a corresponding timeout in `spec.timeouts`. Timeout 0 means infinite — CI hangs forever. Every value must be a positive number.

BAD:
```json
{
  "environments": { "unit": {}, "integration": {} },
  "timeouts": { "unit": 5000 }
  // "integration" has no timeout entry
}
```
BAD: `"unit": 0` — infinite timeout.
GOOD: Every environment has a corresponding positive timeout in ms.

### QA005 — reporters-contain-junit
`spec.reporters` must include at least one JUnit reporter. CI systems (GitHub Actions, Jenkins, GitLab CI) use JUnit XML to annotate PRs with per-test results and track flaky tests.

Accepted JUnit reporters: `junit`, `junit-xml`, `jest-junit`, `vitest-junit`, `@vitest/reporter-junit`, `mocha-junit-reporter`, `jasmine-junit-reporter`.

BAD:
```json
{ "reporters": ["default", "verbose"] }
// no JUnit — CI cannot display per-test results
```
GOOD:
```json
{ "reporters": ["default", "junit"] }
```

### QA006 — global-setup-exists
Skipped if `spec.globalSetup` not declared. When declared, the file must exist on disk (resolved relative to `projectRoot` or the compiler directory).

BAD: `"globalSetup": "tests/setup.ts"` but `tests/setup.ts` doesn't exist.
GOOD: File present at the declared path.

### QA007 — mock-strategy-declared
`spec.mockStrategy` must be one of: `msw`, `jest.mock`, `vi.spyOn`, `manual`, `nock`, `sinon`. Multiple strategies allowed as comma-separated string.

BAD: `mockStrategy` missing or unrecognized value.
GOOD: `"mockStrategy": "msw"` or `"mockStrategy": "msw,vi.spyOn"`

### QA008 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA009 — contract-harness
The compiled artifact `test-harness-artifact.json` must exist with: `ir_id` (starting `TEST_HARNESS_CONFIG:`), `runner`, `environments`, `coverage`, `reporters`, `attestation.hash`.

---

## What This Compiler Never Forgives

- `test-harness-spec.json` missing (QA001 hard-fails)
- Any of `runner`, `environments`, `coverage`, `reporters`, `timeouts`, `mockStrategy` missing (QA001)
- Runner not in valid list (QA001)
- Test runner in `package.json` with `^` or `~` version range (QA002)
- `coverage.provider` missing or invalid (QA003)
- `coverage.include` empty (QA003)
- Test files in `coverage.include` (QA003)
- Any environment missing its timeout (QA004)
- `timeout: 0` for any environment (QA004)
- No JUnit reporter in `reporters` array (QA005)
- `globalSetup` file path declared but file missing (QA006)
- `mockStrategy` missing or unrecognized (QA007)

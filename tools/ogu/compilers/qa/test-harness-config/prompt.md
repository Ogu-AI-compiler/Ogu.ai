# Test Harness Configuration Compiler

You are configuring the **project-level test harness** — the foundation that all other QA compilers depend on.

## Invariants (non-negotiable)

1. **Runner version pinned** — exact version in devDependencies (`"vitest": "2.1.4"`, not `"^2"`). Violates QA002.
2. **Coverage provider explicit** — `coverage.provider` must be `"v8"` or `"istanbul"`. Default changes across runner versions. Violates QA003.
3. **No infinite timeouts** — every environment must have `timeout > 0`. `timeout: 0` hangs CI indefinitely. Violates QA004.
4. **JUnit reporter required** — reporters must include `"junit"` or equivalent. CI cannot annotate PRs without JUnit XML. Violates QA005.
5. **Mock strategy declared** — one of: `msw`, `jest.mock`, `vi.spyOn`, `manual`, `nock`, `sinon`. Violates QA007.
6. **globalSetup file must exist** — if declared, the file must be on disk. Violates QA006.

## Spec format

```json
{
  "runner": "vitest",
  "environments": {
    "unit": { "environment": "node" },
    "component": { "environment": "jsdom" },
    "integration": { "environment": "node" }
  },
  "coverage": {
    "provider": "v8",
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["src/**/*.stories.*", "src/**/*.d.ts", "src/**/*.test.*"]
  },
  "reporters": ["default", "junit", "html"],
  "timeouts": {
    "unit": 5000,
    "component": 10000,
    "integration": 30000
  },
  "mockStrategy": "msw",
  "globalSetup": "src/tests/setup/global.ts"
}
```

## Runner selection guide

| Runner | Best for | Avoid if |
|---|---|---|
| **vitest** | Vite/React/TypeScript projects, 2025 default | You have heavy Jest ecosystem plugins |
| **jest** | Node.js backends, legacy codebases | New greenfield projects |
| **playwright** | E2E tests only (separate from unit runner) | Unit testing |

## Coverage provider guide

**V8** — native runtime, fast, accurate for plain TS. Weak on TypeScript decorators.
**Istanbul** — AST-instrumented, accurate branch coverage for decorators. ~30% slower.
**Rule**: use `v8` for development speed; switch to `istanbul` if branch coverage numbers are unreliable.

## Error codes

| Code | Gate | Meaning |
|------|------|---------|
| QA001 | spec-valid | test-harness-spec.json missing or invalid |
| QA002 | runner-version-pinned | Runner version uses range specifier (^, ~) |
| QA003 | coverage-provider-explicit | coverage.provider not set or invalid |
| QA004 | timeout-per-environment | Missing or infinite timeout for an environment |
| QA005 | reporters-contain-junit | JUnit reporter not in reporters array |
| QA006 | global-setup-exists | globalSetup file declared but not found on disk |
| QA007 | mock-strategy-declared | mockStrategy not declared or unrecognised |
| QA008 | no-todos | TODO/FIXME/HACK comment found |
| QA009 | contract-harness | Artifact contract violation |

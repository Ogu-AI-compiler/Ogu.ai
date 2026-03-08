---
name: backend-test-harness-config
description: Compiler skill for the backend-test-harness-config compiler. Activates when producing backend-test-harness-artifact.json. Gates: TH001–TH008. No upstream dependency.
---

# backend-test-harness-config — Compiler Skill

## What This Compiler Does

Compiles the test runner configuration and test infrastructure for a backend project. Enforces that a test spec declares all environments and coverage thresholds, the runner config file is valid and references those thresholds, unit and integration environments are split with distinct file patterns, network calls are blocked in unit mode, and a setup file with teardown hooks is registered.

**Upstream dependency:** none
**Output artifact:** `backend-test-harness-artifact.json`
**IR identifier:** `BACKEND_TEST_HARNESS`
**Files you create:** `test-harness-spec.json`, `vitest.config.ts` (or jest), `test/setup.ts`

---

## Spec Shape

```json
{
  "runner": "vitest",
  "coverageThresholds": {
    "lines": 80,
    "functions": 80,
    "branches": 75,
    "statements": 80
  },
  "environments": [
    {
      "name": "unit",
      "pattern": "**/*.unit.test.ts",
      "env": "node",
      "networkBlocked": true
    },
    {
      "name": "integration",
      "pattern": "**/*.integration.test.ts",
      "env": "node"
    }
  ]
}
```

Valid `runner` values: `vitest` | `jest`

---

## Gates

### TH001 — spec-valid
Reads `test-harness-spec.json`. Fails if missing.

Required fields:
- `runner` — must be `"vitest"` or `"jest"`
- `coverageThresholds` — object with all four keys as numbers: `lines`, `functions`, `branches`, `statements`
- `environments` — non-empty array

BAD: `"runner": "mocha"` — not in enum. `"coverageThresholds": { "lines": "80%" }` — must be number, not string. `"environments": []` — must have at least one entry.
GOOD: runner is vitest or jest, all 4 threshold keys present as numbers, at least one environment declared.

### TH002 — runner-config-valid
Searches for the runner config file in the project root and compiler directory:
- Vitest: `vitest.config.ts`, `vitest.config.js`, `vitest.config.mjs`
- Jest: `jest.config.ts`, `jest.config.js`, `jest.config.cjs`

The config file must:
1. Export a config object — `export default` or `module.exports`
2. Define test file patterns — reference `include`, `testMatch`, or `testPathPattern`

BAD: Config file not found. Config file exists but has no `export default`. Config has no test pattern definition.
GOOD:
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    coverage: { ... }
  }
});
```

### TH003 — env-split-valid
Enforces that unit and integration tests run in explicitly separate environments.

Requirements:
1. At least one environment must be named `unit` or `node`
2. Every environment must have a **unique** file pattern — two environments sharing the same pattern fail
3. If multiple environments are declared and a runner config is found, the config must use `workspace`/`projects` or `environment`/`testEnvironment` to enforce the split

BAD: Only one environment named `"all"` covering all test files. Two environments both using `"**/*.test.ts"`. Multiple environments in spec but `vitest.config.ts` has no workspaces.

GOOD:
```json
"environments": [
  { "name": "unit", "pattern": "**/*.unit.test.ts" },
  { "name": "integration", "pattern": "**/*.integration.test.ts" }
]
```
With corresponding vitest workspaces or jest projects in runner config.

### TH004 — network-blocked
Unit tests must not hit live network. Checked in two stages:

**Stage 1 (spec):** The unit environment must not declare `"networkBlocked": false`. Setting this explicitly to false fails the gate.

**Stage 2 (setup file):** Looks for test setup files at: `test/setup.ts`, `test/setup.js`, `vitest.setup.ts`, `jest.setup.ts`, `test/setupTests.ts`, `src/test/setup.ts`.

The setup file must contain a network-blocking pattern:
- `setupServer(...)` — MSW
- `nock(...)` — Nock
- `vi.mock(...fetch...)` or `vi.mock(...axios...)`
- `jest.mock(...fetch...)` or `jest.mock(...axios...)`
- `globalThis.fetch = ...` or `global.fetch = ...`
- `fetchMock` import or usage

**Exception:** If no setup file exists yet but the spec declares `"networkBlocked": true` on the unit environment, the gate passes (setup file is pending).

BAD: Setup file exists but has no network-blocking code. Unit env declares `networkBlocked: false`.
GOOD:
```ts
// test/setup.ts
import { server } from "./mocks/server";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
```

### TH005 — coverage-enforced
Coverage thresholds must be declared in spec **and** reflected in the runner config.

**Spec check:** All four threshold values (`lines`, `functions`, `branches`, `statements`) must be numbers between 0 and 100.

**Runner config check:**
1. Runner config must have a `coverage { ... }` block
2. Coverage block must reference threshold keys (`threshold`, `perFile`, `branches`, `lines`, `functions`, or `statements`)

A threshold of 0 in spec does not fail this gate, but the contract gate (TH008) rejects all-zero thresholds as meaningless.

BAD: Runner config has no `coverage` block at all. Coverage block exists but has only `provider: "v8"` with no thresholds.
GOOD:
```ts
coverage: {
  provider: "v8",
  thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 }
}
```

### TH006 — setup-registered
The global setup file must be **referenced** in the runner config AND **contain teardown hooks**.

**Config check:** Runner config must reference `setupFiles`, `setupFilesAfterFramework`, or `globalSetup`.

**Setup file check:** Searches same candidates as TH004. The setup file must contain at least one teardown pattern:
- `afterAll(...)` or `afterEach(...)`
- `globalTeardown`
- `server.close()`
- `prisma.$disconnect()`
- `pool.end()`
- `redis.quit()`

BAD: Runner config has `setupFiles: ["./test/setup.ts"]` but `test/setup.ts` does not exist. Setup file exists but has no `afterAll` or teardown call.
GOOD:
```ts
// test/setup.ts
import { server } from "./mocks/server";
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### TH007 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files in the compiler directory (skips `node_modules`, `dist`, `.git`, `coverage`, `.ogu`).

Blocked markers: `TODO`, `FIXME`, `HACK`, `XXX` (word-boundary match, case-insensitive).

### TH008 — contract-test-harness
Final contract validation. Three rules:

| Rule | Check |
|---|---|
| TH-001 | `runner` is `vitest` or `jest` |
| TH-002 | `coverageThresholds` are not ALL zero — all-zero thresholds are meaningless |
| TH-003 | At least one environment named `unit` or `node` |

BAD: `"coverageThresholds": { "lines": 0, "functions": 0, "branches": 0, "statements": 0 }` — all zeros, rejected by TH-002.

---

## What This Compiler Never Forgives

- `test-harness-spec.json` missing (TH001 hard-fails)
- Runner config (`vitest.config.ts` or `jest.config.ts`) missing or not exporting a config object
- No unit/node environment in `environments[]`
- Unit environment declaring `networkBlocked: false`
- No test setup file, or setup file without teardown hooks
- Runner config missing coverage block or coverage thresholds
- All `coverageThresholds` set to 0 — the contract treats this as no enforcement

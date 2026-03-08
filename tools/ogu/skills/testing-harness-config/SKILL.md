---
name: testing-harness-config
description: Compiler skill for the testing-harness-config compiler. Activates when producing test-harness-artifact.json. Gates: TC001–TC006. No upstream dependency.
---

# testing-harness-config — Compiler Skill

## What This Compiler Does

Compiles the frontend testing harness configuration — Vitest or Jest setup with jsdom, @testing-library/jest-dom matchers, and coverage thresholds. Enforces: a config file with a `test` block, `@testing-library/jest-dom` configured in setup files, coverage configured with thresholds, and both the config and setup files exist.

**Upstream dependency:** none
**Output artifact:** `test-harness-artifact.json`
**IR identifier:** `TEST_HARNESS`

---

## Spec Shape

```json
{
  "runner": "vitest",
  "coverage_threshold": 80,
  "test_environment": "jsdom"
}
```

Required fields:
- `runner` — `"vitest"` or `"jest"`
- `coverage_threshold` — numeric percentage
- `test_environment` — typically `"jsdom"` for React

---

## Required Project Files

### vitest.config.ts (for Vitest runner)

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

### vitest.setup.ts (setup file)

```ts
import '@testing-library/jest-dom';
```

---

## Gates

### TC001 — spec-valid
Reads `test-harness-spec.json`. Required: `runner` (`vitest` or `jest`), `coverage_threshold`, `test_environment`.

BAD: `runner: "mocha"` — not supported. Missing fields.
GOOD: `{ "runner": "vitest", "coverage_threshold": 80, "test_environment": "jsdom" }`

### TC002 — vitest-config
Checks project root for a Vitest/Vite config file: `vitest.config.ts`, `vitest.config.js`, `vite.config.ts`, `vite.config.js`. The config must contain a `test:` configuration block.

BAD: No config file found, or config found but no `test:` block.
GOOD:
```ts
// vitest.config.ts
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'] }
});
```

### TC003 — jestdom-setup
`@testing-library/jest-dom` (or `vitest/globals`) must be configured in setup files or config. Checked by scanning: `vitest.config.ts`, `jest.config.ts`, `jest.setup.ts`, `vitest.setup.ts`.

BAD: Test files use `toBeInTheDocument()` but `@testing-library/jest-dom` is not imported in setup.
GOOD:
```ts
// vitest.setup.ts
import '@testing-library/jest-dom';
```
Or in config:
```ts
setupFiles: ['./vitest.setup.ts']
// where vitest.setup.ts has the import
```

### TC004 — coverage-config
Coverage must be configured with explicit thresholds. Both `coverage:` configuration AND threshold fields (`lines`, `branches`, `functions`, `statements`) must be present.

BAD: Coverage configured without thresholds — no enforcement.
BAD: No coverage configuration at all.
GOOD:
```ts
coverage: {
  reporter: ['text', 'lcov'],
  thresholds: { lines: 80, functions: 80, branches: 70 }
}
```

### TC005 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### TC006 — contract-test-harness
Two contract rules:

| Rule | Requirement |
|---|---|
| `has-config` | `vitest.config.ts`, `vitest.config.js`, `jest.config.ts`, or `jest.config.js` exists at project root |
| `has-setup` | `jest.setup.ts`, `jest.setup.js`, `vitest.setup.ts`, or `vitest.setup.js` exists at project root |

BAD: Config exists but no setup file (jest-dom not imported anywhere).
GOOD: Both `vitest.config.ts` and `vitest.setup.ts` present at project root.

---

## What This Compiler Never Forgives

- `test-harness-spec.json` missing (TC001 hard-fails)
- `runner` not `vitest` or `jest` (TC001)
- No `vitest.config.ts` or `vite.config.ts` at project root (TC002)
- Config file with no `test:` block (TC002)
- `@testing-library/jest-dom` not imported in setup files (TC003)
- Coverage not configured in test config (TC004)
- Coverage configured but no thresholds (TC004)
- No config file at project root (TC006)
- No setup file at project root (TC006)

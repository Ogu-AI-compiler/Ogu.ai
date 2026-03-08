---
name: coverage-policy
description: Compiler skill for the coverage-policy compiler. Activates when producing coverage-policy-artifact.json. Gates: QA010–QA018. No upstream dependency.
---

# coverage-policy — Compiler Skill

## What This Compiler Does

Compiles the project-level code coverage policy — global thresholds, per-file glob overrides, build failure mode, and assertion quality checks. Enforces: all four global thresholds declared (lines/branches/functions/statements), branches ≤ lines (logically required), thresholds between 60–100% (realistic range), `failBuildBelow` is not `"none"`, per-file globs match real files, library code has higher thresholds, and test files have no assertion-free blocks.

**Upstream dependency:** none
**Output artifact:** `coverage-policy-artifact.json`
**IR identifier:** `COVERAGE_POLICY:{project}`

---

## Spec Shape

```json
{
  "global": {
    "lines": 80,
    "branches": 75,
    "functions": 80,
    "statements": 80
  },
  "perFile": {
    "src/lib/**": { "lines": 95, "branches": 90 },
    "src/utils/**": { "lines": 95, "branches": 90 },
    "src/components/**": { "lines": 75, "branches": 70 }
  },
  "failBuildBelow": "global",
  "exclude": ["src/**/*.stories.tsx", "src/**/*.d.ts"]
}
```

Required fields:
- `global.lines` — number
- `global.branches` — number
- `global.functions` — number
- `global.statements` — number
- `failBuildBelow` — `"global"`, `"per-file"`, or `"both"` (not `"none"`)

Optional:
- `bootstrapMode: true` — waives the 60% minimum floor for new projects

---

## Gates

### QA010 — spec-valid
Reads `coverage-policy-spec.json`. Required: `global` object with all four numeric thresholds; `failBuildBelow`.

BAD: `"global": { "lines": 80 }` — missing branches/functions/statements.
BAD: Missing `failBuildBelow`.
GOOD: `{ "global": { "lines": 80, "branches": 75, "functions": 80, "statements": 80 }, "failBuildBelow": "global" }`

### QA011 — thresholds-consistent
`branches` must NOT exceed `lines`. Branch coverage is structurally harder to achieve — it measures every conditional path, not just executed lines. Setting `branches > lines` is logically impossible.

Also: per-file thresholds must not exceed 100%.

BAD:
```json
{ "global": { "lines": 80, "branches": 85 } }
// branches (85%) > lines (80%) — impossible
```
GOOD:
```json
{ "global": { "lines": 80, "branches": 75 } }
```

### QA012 — thresholds-realistic
Global thresholds must be between 60% and 100% (unless `spec.bootstrapMode: true`).

BAD: `"lines": 45` — below 60% floor; policy is not serious.
BAD: `"lines": 101` — impossible.
GOOD: Between 60 and 100 inclusive.

### QA013 — no-assertion-free-tests
Scans all `*.test.*` and `*.spec.*` files. Any `it()` or `test()` block with no `expect()` call in the next ~40 lines is a violation. Exceptions: `it.skip`, `it.todo`, or `// @assertion-free-ok: reason`.

BAD:
```ts
it('runs without crashing', async () => {
  await render(<Component />);
  // No expect() — coverage goes up, nothing is asserted
});
```
GOOD:
```ts
it('renders correctly', async () => {
  render(<Component />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### QA014 — fail-build-enforced
`failBuildBelow` must not be `"none"`, `false`, or `null`. Valid values: `"global"`, `"per-file"`, `"both"`.

BAD: `"failBuildBelow": "none"` — policy is defined but never enforced.
GOOD: `"failBuildBelow": "global"`

### QA015 — per-file-globs-valid
Skipped if `spec.perFile` not defined or empty. When defined, every glob pattern must match at least one actual file on disk.

BAD: `"src/services/**"` glob that matches no files — silently does nothing.
GOOD: All globs verified against actual project files.

### QA016 — critical-paths-higher
Skipped if `spec.criticalPathsExempt: true` or no critical patterns declared. When `perFile` includes patterns matching `src/lib/`, `src/utils/`, `src/helpers/`, or `src/shared/`, their `lines` threshold must be **strictly higher** than `global.lines`.

BAD:
```json
{
  "global": { "lines": 80 },
  "perFile": { "src/lib/**": { "lines": 80 } }
}
// lib threshold same as global — not higher
```
GOOD:
```json
{
  "global": { "lines": 80 },
  "perFile": { "src/lib/**": { "lines": 95 } }
}
```

### QA017 — no-todos
`TODO`, `FIXME`, `HACK` blocked in all `.ts`, `.mjs`, `.js`, `.json` files.

### QA018 — contract-coverage
The compiled artifact `coverage-policy-artifact.json` must exist with: `ir_id` (starting `COVERAGE_POLICY:`), `global`, `failBuildBelow`, `attestation.hash`.

---

## What This Compiler Never Forgives

- `coverage-policy-spec.json` missing (QA010 hard-fails)
- `global` missing or any of lines/branches/functions/statements absent (QA010)
- `failBuildBelow` missing (QA010)
- `branches` exceeds `lines` in global thresholds (QA011)
- Any per-file threshold exceeds 100% (QA011)
- Global threshold below 60% without `bootstrapMode: true` (QA012)
- `it()`/`test()` blocks with no `expect()` call (QA013)
- `failBuildBelow: "none"` — policy has no enforcement (QA014)
- Per-file glob that matches no real file (QA015)
- Library/utils paths with same-or-lower threshold than global (QA016)

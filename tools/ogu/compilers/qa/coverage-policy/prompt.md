# Coverage Policy Compiler

You are defining the **project-level code coverage policy** — what percentage of code must be tested, how it's enforced, and what cheating patterns are forbidden.

## Invariants (non-negotiable)

1. **All four thresholds required** — `lines`, `branches`, `functions`, `statements` in `spec.global`. Violates QA010.
2. **branches ≤ lines** — Branch coverage is structurally harder to achieve than line coverage. Setting `branches > lines` is logically impossible. Violates QA011.
3. **Realistic floor** — Global thresholds must be ≥ 60%. Below 60% is not a coverage policy, it's an absence of one. Violates QA012. Exception: `spec.bootstrapMode: true`.
4. **No assertion-free tests** — Every `it()` / `test()` block must contain an `expect()`. Tests without assertions inflate coverage without adding value. Violates QA013.
5. **failBuildBelow enforced** — Must not be `"none"`. A policy that never fails the build has no effect. Violates QA014.
6. **Critical paths higher** — `src/lib/**` and `src/utils/**` must exceed global threshold. Library bugs have large blast radius. Violates QA016.

## Spec format

```json
{
  "project": "my-app",
  "global": {
    "lines": 80,
    "branches": 75,
    "functions": 80,
    "statements": 80
  },
  "perFile": {
    "src/lib/**/*.ts": { "lines": 90, "branches": 85 },
    "src/utils/**/*.ts": { "lines": 95 },
    "src/components/**/*.tsx": { "lines": 70 }
  },
  "excludeFromThresholds": [
    "src/**/*.stories.*",
    "src/**/*.mock.*",
    "src/types/**"
  ],
  "antiCheatingGates": {
    "requireAssertionsPerTest": true,
    "forbidEmptyDescribe": true,
    "forbidSkippedTests": "warn"
  },
  "failBuildBelow": "global"
}
```

## Anti-cheating patterns detected

```typescript
// ❌ QA013 — test without assertion
it('renders component', () => {
  render(<MyComponent />);
  // No expect() — coverage goes up, quality stays zero
});

// ❌ QA013 — trivially true assertion
it('loads data', async () => {
  await fetchData();
  expect(true).toBe(true); // meaningless
});

// ✅ Real assertion
it('renders component', () => {
  const { getByRole } = render(<MyComponent />);
  expect(getByRole('heading')).toHaveTextContent('Hello');
});
```

## Escape hatches

| Annotation | Gate bypassed | Use when |
|---|---|---|
| `// @assertion-free-ok: reason` | QA013 | Performance benchmarks, intentional side-effect tests |
| `spec.bootstrapMode: true` | QA012 | Early project with < 60% coverage being built up |
| `spec.criticalPathsExempt: true` | QA016 | Non-standard directory structure |

## Error codes

| Code | Gate | Meaning |
|------|------|---------|
| QA010 | spec-valid | Spec missing or global thresholds incomplete |
| QA011 | thresholds-consistent | branches > lines (impossible) or per-file > 100% |
| QA012 | thresholds-realistic | Global threshold < 60% or > 100% |
| QA013 | no-assertion-free-tests | it/test block without expect() |
| QA014 | fail-build-enforced | failBuildBelow is "none" |
| QA015 | per-file-globs-valid | Glob pattern matches no files |
| QA016 | critical-paths-higher | Library/utils coverage not above global |
| QA017 | no-todos | TODO/FIXME/HACK found |
| QA018 | contract-coverage | Artifact contract violation |

---
name: a11y-harness-config
description: Compiler skill for the a11y-harness-config compiler. Activates when producing a11y-harness-artifact.json. Gates: AH001–AH007. No upstream dependency.
---

# a11y-harness-config — Compiler Skill

## What This Compiler Does

Compiles the accessibility testing harness configuration — axe-core integration with declared WCAG level, Storybook a11y addon when Storybook is present, and cross-check against the Storybook harness compiler. Enforces: `axe-core`/`jest-axe`/`vitest-axe` installed and used in tests, WCAG level declared in config, and `@storybook/addon-a11y` installed when Storybook is used.

**Upstream dependency:** none (cross-checks `storybook-harness-artifact.json` if present)
**Output artifact:** `a11y-harness-artifact.json`
**IR identifier:** `A11Y_HARNESS`

---

## Spec Shape

```json
{
  "wcag_level": "AA",
  "components_under_test": ["Button", "Input", "Modal", "Navigation"],
  "axe_rules": ["color-contrast", "keyboard-navigation", "aria-labels"]
}
```

Required fields:
- `wcag_level` — `"A"`, `"AA"`, or `"AAA"`
- `components_under_test` — array of component names
- `axe_rules` — array of a11y rule categories to enforce

---

## Required Project Setup

### package.json

```json
{
  "devDependencies": {
    "jest-axe": "^8.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  }
}
```

### axe.config.ts (or in test setup)

```ts
// WCAG level declaration
export const axeConfig = {
  runOnly: {
    type: 'tag',
    values: ['wcag2aa', 'wcag21aa'],
  },
};
```

### Usage in tests

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no a11y violations', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Storybook (when used)

```json
// .storybook/main.ts addons array
"@storybook/addon-a11y"
```

---

## Gates

### AH001 — spec-valid
Reads `a11y-harness-spec.json`. Required: `wcag_level` (`A`, `AA`, or `AAA`), `components_under_test`, `axe_rules`.

BAD: `wcag_level: "2AA"` — wrong format. Missing fields.
GOOD: `{ "wcag_level": "AA", "components_under_test": [...], "axe_rules": [...] }`

### AH002 — axe-wrapper
`axe-core`, `jest-axe`, `@axe-core/react`, or `vitest-axe` must be in `package.json` dependencies/devDependencies AND used in test files (`axe(`, `toHaveNoViolations`, `checkA11y`).

BAD: Package installed but not called in any test file.
BAD: Test file uses `axe` without it being in package.json.
GOOD:
```tsx
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### AH003 — wcag-level-declared
WCAG level must be declared in a config file: `.storybook/preview.ts`, `.storybook/preview.js`, `axe.config.ts`, `axe.config.js`, or `a11y.config.ts`. Checked for patterns: `wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21aa`, `WCAG`, `runOnly.*wcag`.

BAD: No WCAG level in any config — tests run without a declared compliance target.
GOOD:
```ts
// axe.config.ts
runOnly: { type: 'tag', values: ['wcag2aa'] }
```

### AH004 — storybook-addon
Skipped if Storybook is not in `package.json` (no `@storybook/*` packages).

When Storybook is used, `@storybook/addon-a11y` must be installed.

BAD: Storybook present but `@storybook/addon-a11y` missing.
GOOD: `"@storybook/addon-a11y"` in devDependencies.

### AH005 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### AH006 — cross-storybook
Skipped if `storybook-harness-artifact.json` not present.

When the storybook harness compiler has run, it must have passed. A11y harness depends on Storybook being correctly configured.

### AH007 — contract-a11y-harness
One contract rule:

| Rule | Requirement |
|---|---|
| `has-axe` | `axe-core`, `jest-axe`, `@axe-core/react`, or `vitest-axe` in `package.json` |

BAD: No axe library in dependencies.
GOOD: At least one axe library present.

---

## What This Compiler Never Forgives

- `a11y-harness-spec.json` missing (AH001 hard-fails)
- `wcag_level` not `A`, `AA`, or `AAA` (AH001)
- `components_under_test` or `axe_rules` missing (AH001)
- No axe library in `package.json` (AH002, AH007)
- Axe library installed but not used in tests (AH002)
- WCAG level not declared in any config file (AH003)
- Storybook used but `@storybook/addon-a11y` not installed (AH004)
- `storybook-harness-config` compiler failed (AH006)

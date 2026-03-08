---
name: storybook-harness-config
description: Compiler skill for the storybook-harness-config compiler. Activates when producing storybook-harness-artifact.json. Gates: SBC001–SBC006. No upstream dependency.
---

# storybook-harness-config — Compiler Skill

## What This Compiler Does

Compiles the Storybook configuration harness — `.storybook/main.ts` with framework, stories glob, and addons; TypeScript enabled; `@storybook/addon-a11y` installed and registered; and both `main.ts` and `preview.ts` present. This is the foundational config that all `storybook-story` compilers depend on.

**Upstream dependency:** none
**Output artifact:** `storybook-harness-artifact.json`
**IR identifier:** `STORYBOOK_HARNESS`

---

## Spec Shape

```json
{
  "framework": "@storybook/react-vite",
  "addons": ["@storybook/addon-essentials", "@storybook/addon-a11y", "@storybook/addon-interactions"],
  "stories_glob": "src/**/*.stories.{ts,tsx}"
}
```

Required fields:
- `framework` — Storybook framework package
- `addons` — array of addon package names
- `stories_glob` — glob pattern for story files

---

## Required Project Files

### .storybook/main.ts

```ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.{ts,tsx}'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    check: true,
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
```

### .storybook/preview.ts

```ts
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: { matchers: { color: /^(background|color)$/i } },
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
};

export default preview;
```

---

## Gates

### SBC001 — spec-valid
Reads `storybook-harness-spec.json`. Required: `framework`, `addons`, `stories_glob`.

BAD: Missing any required field.
GOOD: `{ "framework": "@storybook/react-vite", "addons": [...], "stories_glob": "src/**/*.stories.tsx" }`

### SBC002 — main-config
`.storybook/main.ts`, `.storybook/main.js`, or `.storybook/main.cjs` must exist at project root with both `framework:` and `stories:` configuration.

BAD: File missing, or found but no `framework:` block, or no `stories:` glob.
GOOD: Config file with both `framework` and `stories` configured.

### SBC003 — typescript-enabled
Either `main.ts` (TypeScript file) is used, OR config contains `typescript:` block or `@storybook/.*typescript` addon.

BAD: Using `main.js` with no TypeScript configuration.
GOOD: `main.ts` file, or `typescript: { check: true }` in main config.

### SBC004 — a11y-addon-installed
`@storybook/addon-a11y` must be in `package.json` devDependencies AND registered in `.storybook/main.ts`.

BAD: Package not in dependencies. Package installed but not in `addons` array in main config.
GOOD:
```json
// package.json
"@storybook/addon-a11y": "^8.0.0"
// .storybook/main.ts
addons: ['@storybook/addon-a11y']
```

### SBC005 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### SBC006 — contract-storybook-harness
Two contract rules:

| Rule | Requirement |
|---|---|
| `has-main` | `.storybook/main.ts` or `.storybook/main.js` exists |
| `has-preview` | `.storybook/preview.ts` or `.storybook/preview.js` exists |

BAD: `main.ts` exists but no `preview.ts` — global decorators and parameters not configured.
GOOD: Both `.storybook/main.ts` and `.storybook/preview.ts` present.

---

## What This Compiler Never Forgives

- `storybook-harness-spec.json` missing (SBC001 hard-fails)
- `framework`, `addons`, or `stories_glob` missing (SBC001)
- No `.storybook/main.ts` or `.storybook/main.js` at project root (SBC002, SBC006)
- Main config missing `framework:` or `stories:` block (SBC002)
- Using `main.js` without TypeScript configuration (SBC003)
- `@storybook/addon-a11y` not in package.json (SBC004)
- `@storybook/addon-a11y` installed but not registered in `addons` array (SBC004)
- No `.storybook/preview.ts` or `.storybook/preview.js` (SBC006)

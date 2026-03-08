---
name: storybook-story
description: Compiler skill for the storybook-story compiler. Activates when producing story-artifact.json. Gates: SB001–SB008. No upstream dependency.
---

# storybook-story — Compiler Skill

## What This Compiler Does

Compiles a Storybook story file for a React component in CSF3 format. Enforces: CSF3 format with typed default export (`Meta<typeof Component>`), each story typed as `StoryObj<typeof Component>` with `args`, a `Default` story exported, `title` in meta, a11y addon parameters configured, and no hardcoded secrets in story args.

**Upstream dependency:** none (cross-checks `component-artifact.json` if `spec.componentArtifact` declared)
**Output artifact:** `story-artifact.json`
**IR identifier:** `STORY:{component}`

---

## Spec Shape

```json
{
  "component": "Button",
  "stories": ["Default", "Primary", "Secondary", "Destructive", "Disabled", "Loading"],
  "componentArtifact": "../../react-components/Button/component-artifact.json"
}
```

Required fields:
- `component` — component name
- `stories` — non-empty array of story names

---

## Story File Shape

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    a11y: {
      config: {
        rules: [{ id: 'color-contrast', enabled: true }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Click me',
    variant: 'default',
  },
};

export const Primary: Story = {
  args: {
    children: 'Primary Action',
    variant: 'primary',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Delete',
    variant: 'destructive',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};
```

---

## Gates

### SB001 — spec-valid
Reads `story-spec.json`. Required: `component`, `stories` (non-empty array).

BAD: Missing `component`, empty `stories` array.
GOOD: `{ "component": "Button", "stories": ["Default", "Primary"] }`

### SB003 — csf3-valid
The `.stories.tsx` file must:
1. Have a `export default { ... }` or `export default meta` default export
2. Have at least one named story export (`export const StorName: Story = ...`)
3. Use `StoryObj` type for stories

BAD:
```tsx
// CSF2 format — not CSF3
export default { title: 'Button', component: Button };
export const Default = () => <Button />;
// No StoryObj typing
```
GOOD:
```tsx
const meta: Meta<typeof Button> = { ... };
export default meta;
type Story = StoryObj<typeof Button>;
export const Default: Story = { args: { ... } };
```

### SB004 — args-typed
The default export must be typed as `Meta<typeof Component>` (or use `satisfies Meta`). Each named story export typed as `Story` must have `args:` or `render:` defined.

BAD:
```tsx
export default { component: Button }; // not typed as Meta
export const Default: Story = {}; // no args or render
```
GOOD:
```tsx
const meta: Meta<typeof Button> = { component: Button };
export const Default: Story = { args: { children: 'Click me' } };
```

### SB005 — a11y-addon
`a11y:` parameters must be configured in the stories file (either in default export or per-story).

BAD: No `a11y:` key in `parameters`.
GOOD:
```tsx
const meta: Meta<typeof Button> = {
  parameters: {
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } }
  }
};
```

### SB006 — no-todos (skipped label — `no-todos` in runner)
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### SB007 — cross-component
Skipped if `spec.componentArtifact` not declared. When declared, the artifact file must exist (compiled by `react-component`).

### SB008 — contract-story
Three contract rules:

| Rule | Requirement |
|---|---|
| `default-story` | `export const Default` must exist |
| `no-hardcoded-data` | No `password: "..."` or token strings ≥ 20 chars in args |
| `title-in-meta` | Default export must have a `title:` field |

BAD: No `Default` story. Hardcoded `apiToken: "eyJhbGci..."` in story args. Missing `title:` in meta.
GOOD:
```tsx
const meta: Meta<typeof Button> = {
  title: 'Components/Button', // required
  component: Button,
};
export const Default: Story = { args: { children: 'Click' } };
```

---

## What This Compiler Never Forgives

- `story-spec.json` missing (SB001 hard-fails)
- `stories` array empty (SB001)
- No `.stories.tsx` file found (SB003 hard-fails)
- No default export in stories file (SB003)
- No named story exports (SB003)
- Stories not typed with `StoryObj` (SB003)
- Default export not typed as `Meta<typeof Component>` (SB004)
- Any story without `args` or `render` (SB004)
- No `a11y:` parameters in stories file (SB005)
- No `Default` story exported (SB008)
- Hardcoded secrets/tokens in story args (SB008)
- No `title:` in meta default export (SB008)

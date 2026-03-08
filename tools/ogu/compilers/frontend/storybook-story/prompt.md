# Storybook Story Compiler — Agent Prompt

You are writing CSF3 Storybook stories for a React component that pass all gates of the Storybook Story Compiler.

## Spec file: `story-spec.json`
```json
{
  "component": "Button",
  "stories": ["Default", "Primary", "Disabled", "Loading"],
  "propsFile": "Button.tsx"
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| SB001 | spec-valid | story-spec.json must exist with `component` field |
| SB002 | ts-valid | No TypeScript compilation errors |
| SB003 | csf3-valid | Default export + StoryObj type + named story exports |
| SB004 | args-typed | `StoryObj<typeof ComponentName>` — not `StoryObj<any>` |
| SB005 | a11y-addon | `parameters: { a11y: { config: {} } }` present |
| SB006 | no-todos | No TODO/FIXME comments |
| SB007 | cross-component | component-artifact.json must exist |
| SB008 | contract-story | Default export with autodocs, named stories with args |

## Required pattern (CSF3)

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    a11y: { config: {} }
  }
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { label: 'Click me', variant: 'primary' }
};

export const Disabled: Story = {
  args: { label: 'Disabled', disabled: true }
};
```

## Files to produce
- `Button.stories.tsx` — CSF3 stories with all variants from spec

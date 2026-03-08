# Storybook Harness Config — Implementation Prompt

You are configuring Storybook for a React/TypeScript project.

## Spec
Read `storybook-harness-spec.json` for:
- `framework`: `@storybook/react-vite` | `@storybook/react-webpack5`
- `addons`: list of addons to configure
- `stories_glob`: glob for story files

## Requirements

### .storybook/main.ts pattern
```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  docs: { autodocs: 'tag' },
  typescript: { reactDocgen: 'react-docgen-typescript' },
};
export default config;
```

### .storybook/preview.ts
```typescript
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
    backgrounds: { default: 'light' },
  },
};
export default preview;
```

## Output
- `.storybook/main.ts`
- `.storybook/preview.ts`

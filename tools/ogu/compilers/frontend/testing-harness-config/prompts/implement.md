# Testing Harness Config — Implementation Prompt

You are configuring the test harness for a React/TypeScript project.

## Spec
Read `test-harness-spec.json` for:
- `runner`: `vitest` | `jest`
- `coverage_threshold`: minimum % (lines, branches, functions)
- `test_environment`: `jsdom` | `node`

## Requirements

### vitest.config.ts pattern
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'lcov', 'html'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
      exclude: ['node_modules', 'dist', '**/*.test.tsx', '**/*.stories.tsx'],
    },
    globals: true,
  },
});
```

### vitest.setup.ts
```typescript
import '@testing-library/jest-dom';
```

### package.json scripts
```json
{
  "test": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

## Output
- `vitest.config.ts`
- `vitest.setup.ts`

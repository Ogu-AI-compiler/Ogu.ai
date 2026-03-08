# A11y Harness Config — Implementation Prompt

You are configuring the accessibility testing harness.

## Spec
Read `a11y-harness-spec.json` for:
- `wcag_level`: `A` | `AA` | `AAA`
- `components_under_test`: list of component names
- `axe_rules`: specific axe rules to enable/configure

## Requirements

### axe.config.ts pattern
```typescript
export const axeConfig = {
  runOnly: {
    type: 'tag' as const,
    values: ['wcag2aa', 'wcag21aa', 'best-practice'],
  },
  rules: {
    'color-contrast': { enabled: true },
    'label': { enabled: true },
  },
};
```

### Test pattern with jest-axe / vitest-axe
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<Button label="Submit" />);
  const results = await axe(container, axeConfig);
  expect(results).toHaveNoViolations();
});
```

### Storybook a11y parameters
```typescript
// In story file
export const Default: Story = {
  parameters: {
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
  },
};
```

## Output
- `axe.config.ts`
- `[Component].a11y.test.tsx` per component under test

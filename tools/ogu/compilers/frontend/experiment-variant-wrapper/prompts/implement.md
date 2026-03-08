# Experiment Variant Wrapper — Implementation Prompt

You are implementing an A/B experiment variant wrapper component.

## Spec
Read `experiment-variant-spec.json` for:
- `experiment_id`: unique experiment identifier
- `variants`: array of variant names (must include `control`)
- `fallback_variant`: default variant (usually `control`)

## Requirements

### Exposure tracking
- Call `trackExposure(experimentId)` exactly once, inside `useEffect(() => {}, [])`
- Never in the render path (fires on every render)

### Variant rendering
- Always render the control/fallback when `variant === fallback_variant` or on error
- Max 5 variant branches in one component — split if more

### Pattern
```typescript
import { useEffect } from 'react';
import { useExperiment } from '@/lib/experiments';
import { trackExposure } from '@/lib/analytics';

export function CheckoutButtonExperiment() {
  const variant = useExperiment('checkout-button-experiment') ?? 'control';
  
  useEffect(() => {
    trackExposure('checkout-button-experiment');
  }, []);

  if (variant === 'treatment-a') return <CheckoutButtonV2 />;
  return <CheckoutButton />; // control (fallback)
}
```

### No nested experiments
```typescript
// ✗ Never
function MyComponent() {
  const variant = useExperiment('exp-1');
  if (variant === 'treatment') {
    const innerVariant = useExperiment('exp-2'); // WRONG — nested
  }
}
```

## Output
- `[Name]Experiment.tsx`
- `[Name]Experiment.test.tsx` — tests for each variant render + exposure tracking

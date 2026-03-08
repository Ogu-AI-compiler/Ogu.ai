# Feature Module Scaffold — Implementation Prompt

You are creating a feature module with a clean public API boundary.

## Spec
Read `feature-module-spec.json` for:
- `feature_name`: e.g. `checkout`
- `capabilities`: e.g. `['CartSummary', 'PaymentForm', 'OrderConfirmation']`
- `public_api`: which symbols to expose

## Requirements

### Directory structure
```
checkout/
  index.ts          ← barrel (named exports only, no export *)
  CartSummary.tsx
  PaymentForm.tsx
  OrderConfirmation.tsx
  types.ts          ← shared types for this feature
```

### Barrel rules
- Named exports only: `export { CartSummary } from './CartSummary'`
- No `export * from './...'` — keep public API explicit
- No private/internal symbols (no `_` prefix, no `Internal`/`Impl` suffix)

### Cross-feature imports
- Never import from sibling feature directories: `../other-feature/SomeComponent`
- Communicate via shared contracts: `@/shared/types`, `@/lib/api`

### Pattern
```typescript
// index.ts
export { CartSummary } from './CartSummary';
export { PaymentForm } from './PaymentForm';
export type { CartItem, PaymentMethod } from './types';
// Note: OrderConfirmation NOT exported if it's internal
```

## Output
- `index.ts`
- One file per capability
- `types.ts`

---
name: utility-fn
description: Compiler skill for the utility-fn compiler. Activates when producing utility-artifact.json. Gates: UF001–UF010. No upstream dependency.
---

# utility-fn — Compiler Skill

## What This Compiler Does

Compiles a pure utility function — a deterministic, framework-agnostic TypeScript function with 100% test coverage. Enforces: no React/Next.js imports, no side effects (no DOM, network, timers, console, file system, Math.random, Date.now), the named function exported, full JSDoc comment, typed signature, and 100% line/function/branch coverage.

**Upstream dependency:** none
**Output artifact:** `utility-artifact.json`
**IR identifier:** `UTILITY_FN:{name}`

---

## Spec Shape

```json
{
  "name": "formatCurrency",
  "input": "amount: number, currency: string, locale?: string",
  "output": "string",
  "description": "Formats a numeric amount as a localized currency string"
}
```

Required fields:
- `name` — exported function name
- `input` — TypeScript parameter list (for documentation)
- `output` — TypeScript return type (for documentation)
- `description` — what the function does

Rejected:
- `hasSideEffects: true` — hard-fails spec-valid. Use a different compiler for effectful functions.

---

## Implementation Shape

```ts
// formatCurrency.ts

/**
 * Formats a numeric amount as a localized currency string.
 *
 * @param amount - The numeric value to format
 * @param currency - ISO 4217 currency code (e.g. 'USD', 'EUR', 'ILS')
 * @param locale - BCP 47 locale tag (defaults to 'en-US')
 * @returns Formatted currency string (e.g. '$1,234.56')
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

### Test File (100% coverage required)

```ts
// formatCurrency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56, 'USD', 'en-US')).toBe('$1,234.56');
  });

  it('formats EUR correctly', () => {
    expect(formatCurrency(1000, 'EUR', 'de-DE')).toContain('1.000');
  });

  it('uses en-US as default locale', () => {
    expect(formatCurrency(100, 'USD')).toBe('$100.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-50.5, 'USD')).toBe('-$50.50');
  });

  it('formats ILS correctly', () => {
    const result = formatCurrency(1500, 'ILS', 'he-IL');
    expect(result).toContain('1,500');
  });
});
```

---

## Gates

### UF001 — spec-valid
Reads `utility-spec.json`. Required: `name`, `input`, `output`, `description`. Rejected: `hasSideEffects: true`.

BAD: Missing any required field.
BAD: `{ "hasSideEffects": true }` — hard-fails; this compiler only handles pure functions.
GOOD: `{ "name": "formatCurrency", "input": "amount: number, currency: string", "output": "string", "description": "Formats currency" }`

### UF002 — ts-valid
TypeScript files must compile without errors.

### UF003 — no-any
No `: any` type annotations in source files (not test files).

### UF004 — no-side-effects
The following patterns are blocked in source files (non-comment lines):

| Pattern | Reason |
|---|---|
| `document` | DOM access |
| `window` | Browser global |
| `navigator` | Browser API |
| `localStorage` / `sessionStorage` | Storage write |
| `fetch(` / `axios` / `http` | Network call |
| `setTimeout` / `setInterval` / `clearTimeout` | Timer side effect |
| `console.log` / `console.error` / `console.warn` | Console output |
| `process.exit` | Process control |
| `fs.` | File system |
| `Math.random` | Non-deterministic |
| `Date.now` / `new Date()` | Non-deterministic |

BAD:
```ts
export function getTimestamp(): number {
  return Date.now(); // non-deterministic — blocked
}
export function logAndReturn(x: number): number {
  console.log(x); // side effect — blocked
  return x;
}
```
GOOD:
```ts
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
```

### UF005 — no-react-import
Source files (not test files) must not import React, Next.js, or any UI framework.

BAD:
```ts
import { useState } from 'react'; // blocked — framework import
import { useRouter } from 'next/router'; // blocked
```
GOOD: Pure TypeScript — no framework imports.

### UF006 — exported-fn
The function named `spec.name` must be exported from a source file.

BAD:
```ts
function formatCurrency(amount: number): string { ... }
// Not exported — blocked
```
GOOD:
```ts
export function formatCurrency(amount: number, currency: string): string { ... }
// or
export const formatCurrency = (amount: number): string => { ... };
```

### UF007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in all `.ts`/`.tsx` files.

### UF008 — tests-pass
All tests pass via vitest or jest.

### UF009 — coverage-100
100% coverage required for utility functions: lines, functions, and branches all at 100%.

BAD: 85% line coverage — untested edge cases.
GOOD: Every branch covered — zero, negative, default params, error inputs all tested.

### UF010 — contract-utility
Four contract rules:

| Rule | Requirement |
|---|---|
| `typed-signature` | `function name(...: Type): ReturnType` — fully typed, no implicit any |
| `jsdoc-present` | `/** ... */` JSDoc comment present in source |
| `pure-function` | No `Math.random`, `Date.now`, `new Date()` in source |
| `no-mutation` | No `.push(`, `.splice(`, `.sort()`, `.reverse()` on input args without spreading/cloning |

BAD:
```ts
// No JSDoc, implicit parameters, mutates input
function sortItems(items) { // implicit any
  items.sort(); // mutates input array!
  return items;
}
```
GOOD:
```ts
/**
 * Returns a sorted copy of the array without mutating the original.
 * @param items - Array to sort
 * @returns Sorted copy
 */
export function sortItems<T>(items: T[]): T[] {
  return [...items].sort(); // spreads before sort — no mutation
}
```

---

## What This Compiler Never Forgives

- `utility-spec.json` missing (UF001 hard-fails)
- `hasSideEffects: true` in spec (UF001 hard-fails)
- Missing `name`, `input`, `output`, or `description` (UF001)
- `document`, `window`, `fetch`, `Math.random`, `Date.now` in source (UF004)
- `console.log/error/warn` in source (UF004)
- React or Next.js imports in source (UF005)
- Function named `spec.name` not exported (UF006)
- Coverage below 100% (UF009)
- No JSDoc comment (UF010)
- Untyped function signature (UF010)
- Mutating input arguments without cloning (UF010)

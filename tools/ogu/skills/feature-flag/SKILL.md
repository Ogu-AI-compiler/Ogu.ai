---
name: feature-flag
description: Compiler skill for the feature-flag compiler. Activates when producing flag-artifact.json. Gates: FF001–FF009. No upstream dependency.
---

# feature-flag — Compiler Skill

## What This Compiler Does

Compiles a feature flag module — typed flag definitions, a `useFlag()` hook or `getFlag()` function, and tests. Enforces: flag names in kebab-case, safe defaults (boolean flags default off, killswitch flags must be false), no nested flag evaluation on the same line, TypeScript flag types exported, and a `defaultValue` fallback on every flag access.

**Upstream dependency:** none
**Output artifact:** `flag-artifact.json`
**IR identifier:** `FEATURE_FLAG:{module}`

---

## Spec Shape

```json
{
  "flags": [
    {
      "name": "enable-new-dashboard",
      "defaultValue": false,
      "description": "Enables the redesigned dashboard experience"
    },
    {
      "name": "show-beta-badge",
      "defaultValue": false,
      "description": "Shows beta badge on new features"
    },
    {
      "name": "disable-legacy-export",
      "type": "killswitch",
      "defaultValue": false,
      "description": "Kills legacy CSV export when true"
    },
    {
      "name": "max-upload-size-mb",
      "defaultValue": 10,
      "description": "Maximum file upload size in megabytes"
    }
  ]
}
```

Required fields:
- `flags` — non-empty array, each with `name` and `defaultValue`

Optional per flag:
- `type` — `"killswitch"` makes `defaultValue: false` mandatory
- `safeToDefaultOn` — set `true` to allow `defaultValue: true` for boolean flags
- `description` — human-readable description

---

## Implementation Shape

```ts
// flags.ts

export interface FeatureFlag {
  name: string;
  defaultValue: boolean | number | string;
  description?: string;
}

export const FLAGS: Record<string, FeatureFlag> = {
  'enable-new-dashboard': {
    name: 'enable-new-dashboard',
    defaultValue: false,
    description: 'Enables the redesigned dashboard experience',
  },
  'show-beta-badge': {
    name: 'show-beta-badge',
    defaultValue: false,
  },
  'disable-legacy-export': {
    name: 'disable-legacy-export',
    defaultValue: false,
  },
  'max-upload-size-mb': {
    name: 'max-upload-size-mb',
    defaultValue: 10,
  },
};

// Typed hook — returns the flag value with safe fallback
export function useFlag(flagName: keyof typeof FLAGS): boolean | number | string {
  const flag = FLAGS[flagName];
  const defaultValue = flag?.defaultValue ?? false;
  // In real usage: fetch from provider (LaunchDarkly, Split, etc.)
  // Fall back to defaultValue if provider unavailable
  try {
    return flagProvider.getFlag(flagName) ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function getFlag(flagName: keyof typeof FLAGS): boolean | number | string {
  return FLAGS[flagName]?.defaultValue ?? false;
}
```

---

## Gates

### FF001 — spec-valid
Reads `flag-spec.json`. Required: `flags` (non-empty array). Each flag must have `name` and `defaultValue` (not `undefined` or `null`).

BAD: `{ "flags": [] }` — empty.
BAD: `{ "flags": [{ "name": "my-flag" }] }` — missing `defaultValue`.
GOOD: `{ "flags": [{ "name": "my-flag", "defaultValue": false }] }`

### FF002 — ts-valid
TypeScript files must compile without errors.

### FF003 — no-any
No `: any` type annotations in source files (not test files).

### FF004 — safe-defaults
Three rules:
1. Flags with `type: "killswitch"` **must** have `defaultValue: false`
2. Every flag must have an explicit `defaultValue` (not `null` or absent)
3. Boolean flags with `defaultValue: true` must have `safeToDefaultOn: true` in spec

BAD:
```json
{ "name": "disable-payments", "type": "killswitch", "defaultValue": true }
// killswitch defaults to ON — dangerous!
```
BAD:
```json
{ "name": "new-checkout", "defaultValue": true }
// boolean true without safeToDefaultOn — flags should default off
```
GOOD:
```json
{ "name": "disable-payments", "type": "killswitch", "defaultValue": false }
{ "name": "always-show-help", "defaultValue": true, "safeToDefaultOn": true }
```

### FF005 — naming-convention
All flag `name` values must be **kebab-case**: lowercase letters, digits, hyphens only — no underscores, no uppercase, no spaces.

BAD:
```
"name": "enableNewDashboard"   // camelCase
"name": "ENABLE_NEW_DASHBOARD" // SCREAMING_SNAKE
"name": "enable_new_dashboard" // snake_case
```
GOOD:
```
"name": "enable-new-dashboard"
"name": "show-beta-badge"
"name": "max-upload-size-mb"
```

### FF006 — no-nested-flags
Multiple flag names appearing on the same line in source files is a violation. Flag lookups must be separated — one per conditional branch.

BAD:
```ts
const showWidget = useFlag('enable-new-dashboard') && useFlag('show-beta-badge');
// two flags on same line — nested evaluation
```
BAD:
```ts
if (useFlag('flag-a')) {
  const inner = useFlag('flag-b'); // flag inside flag-gated block with another useFlag call on same chain
}
```
GOOD:
```ts
const showDashboard = useFlag('enable-new-dashboard');
const showBadge = useFlag('show-beta-badge');
const showWidget = showDashboard && showBadge;
```

### FF007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in all `.ts`/`.tsx` files.

### FF008 — tests-pass
All tests pass via vitest or jest.

### FF009 — contract-flag
Four contract rules:

| Rule | Requirement |
|---|---|
| `typed-flags` | `interface ...Flag`, `type ...Flag =`, or `FeatureFlag` defined |
| `exported-flags` | `export const/function/type` for flags or flag map |
| `use-flag-hook` | `export function useFlag` or `export function getFlag` or `export const isEnabled` |
| `default-value` | `defaultValue`, `fallback`, or `default =` present in flag access code |

BAD:
```ts
// No exported hook, no typed interface
const myFlag = provider.get('flag-name'); // raw, untyped, no fallback
```
GOOD:
```ts
export interface FeatureFlag { name: string; defaultValue: boolean; }
export const FLAGS = { ... };
export function useFlag(name: keyof typeof FLAGS) {
  return provider.get(name) ?? FLAGS[name].defaultValue;
}
```

---

## What This Compiler Never Forgives

- `flag-spec.json` missing (FF001 hard-fails)
- `flags` array empty or missing (FF001)
- Any flag missing `defaultValue` (FF001, FF004)
- Killswitch flag with `defaultValue: true` (FF004)
- Boolean flag with `defaultValue: true` and no `safeToDefaultOn: true` (FF004)
- Flag names not kebab-case (FF005)
- Multiple `useFlag()` calls on the same line (FF006)
- No `useFlag`/`getFlag`/`isEnabled` exported (FF009)
- No `FeatureFlag` type or interface defined (FF009)
- No `defaultValue` fallback in flag access code (FF009)

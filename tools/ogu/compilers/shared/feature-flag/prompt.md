# Feature Flag Compiler — Agent Prompt

You are implementing a typed feature flag system that passes all gates of the Feature Flag Compiler.

## Spec file: `flag-spec.json`
```json
{
  "flags": [
    { "name": "enable-new-dashboard", "defaultValue": false, "type": "boolean" },
    { "name": "show-beta-feature", "defaultValue": false, "type": "boolean" },
    { "name": "max-upload-size", "defaultValue": 10, "type": "number" },
    { "name": "kill-legacy-api", "defaultValue": false, "type": "killswitch" }
  ]
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| FF001 | spec-valid | flag-spec.json with non-empty `flags` array, each flag has name + defaultValue |
| FF002 | ts-valid | No TypeScript compilation errors |
| FF003 | no-any | No explicit `any` |
| FF004 | safe-defaults | killswitch flags must default false; all flags need explicit defaultValue |
| FF005 | naming-convention | Flag names must be kebab-case |
| FF006 | no-nested-flags | No flag evaluated inside another flag's condition |
| FF007 | no-todos | No TODO/FIXME |
| FF008 | tests-pass | All tests pass |
| FF009 | contract-flag | Typed flags, exported map, useFlag/getFlag exposed, fallback used |

## Required pattern

```typescript
export interface FeatureFlag<T = boolean> {
  name: string;
  defaultValue: T;
}

export const FLAGS = {
  'enable-new-dashboard': { defaultValue: false },
  'show-beta-feature': { defaultValue: false },
  'kill-legacy-api': { defaultValue: false },
} as const;

export function getFlag<T>(name: keyof typeof FLAGS, defaultValue: T): T {
  // fetch from flag service, fall back to defaultValue on error
}

export function useFlag(name: keyof typeof FLAGS): boolean {
  // React hook — calls getFlag with defaultValue
}
```

## Files to produce
- `feature-flags.ts` — FLAG map, getFlag(), useFlag() hook
- `feature-flags.test.ts` — tests: default value fallback, type safety

---
name: feature-module-scaffold
description: Compiler skill for the feature-module-scaffold compiler. Activates when producing feature-module-artifact.json. Gates: FM001–FM007. No upstream dependency.
---

# feature-module-scaffold — Compiler Skill

## What This Compiler Does

Compiles a feature module directory — a vertical slice of functionality with a public API surface. Enforces: an `index.ts` barrel with named exports (no `export *`), capability files for each declared capability, no cross-feature imports (features talk via shared contracts, not direct imports), and no private/internal symbols leaked through the barrel.

**Upstream dependency:** none
**Output artifact:** `feature-module-artifact.json`
**IR identifier:** `FEATURE_MODULE:{feature_name}`

---

## Spec Shape

```json
{
  "feature_name": "user-profile",
  "capabilities": ["UserProfilePage", "UserProfileCard", "useUserProfile", "userProfileApi"],
  "public_api": ["UserProfilePage", "UserProfileCard", "useUserProfile"]
}
```

`feature_name` — kebab-case feature name.
`capabilities` — list of files/modules the feature provides. Each must have a corresponding file in the directory.
`public_api` — subset of capabilities exposed via `index.ts`. Only these are exported.

---

## File Structure

```
src/features/user-profile/
├── index.ts              ← barrel (public API only)
├── UserProfilePage.tsx
├── UserProfileCard.tsx
├── useUserProfile.ts
├── userProfileApi.ts
├── _UserProfileForm.tsx  ← private (not in barrel)
```

---

## Gates

### FM001 — spec-valid
Reads `feature-module-spec.json`. Required fields: `feature_name`, `capabilities` (non-empty array), `public_api`.

### FM002 — barrel-exports
`index.ts` must exist and:
1. Have at least one `export` statement
2. Use **named exports only** — `export *` is blocked (makes public API implicit)

BAD:
```ts
// index.ts
export * from './UserProfilePage'; // implicit — any change leaks
export * from './userProfileApi';
```
GOOD:
```ts
// index.ts
export { UserProfilePage } from './UserProfilePage';
export { UserProfileCard } from './UserProfileCard';
export type { UserProfile } from './useUserProfile';
export { useUserProfile } from './useUserProfile';
// userProfileApi is internal — not exported
```

### FM003 — capability-files
Every entry in `spec.capabilities` must have a corresponding file in the feature directory (name match after stripping extension and normalization to lowercase).

BAD: spec declares `UserProfileCard` capability but no `UserProfileCard.tsx` exists.
GOOD: all capabilities have matching files.

### FM004 — no-cross-feature-imports
Direct imports from sibling feature directories are blocked:
```ts
import { something } from '../other-feature/component'; // BLOCKED
```

Features may import from:
- `shared/` — shared utilities
- `lib/` — shared libraries
- `utils/` — utilities
- Their own directory

Features communicate via shared contracts, not direct file imports between feature directories.

BAD:
```ts
// Inside user-profile feature
import { AuthContext } from '../auth/AuthContext'; // direct cross-feature import
```
GOOD:
```ts
// Import from shared contracts
import { useAuth } from '@/shared/auth'; // shared module
```

### FM005 — no-private-leaks
The `index.ts` barrel must not export:
- Names with `_` prefix (private convention)
- Names ending in `Internal`, `Private`, or `Impl`

BAD:
```ts
export { _validateProfile } from './UserProfileForm'; // private function leaked
export { UserProfileFormInternal } from './UserProfileForm'; // internal leaked
```
GOOD: Only public API symbols in the barrel.

### FM007 — contract-feature-module
Three contract rules:

| Rule | Requirement |
|---|---|
| `has-barrel` | `index.ts` file exists |
| `has-types` | At least one `interface` or `type` definition in the feature |
| `no-default-export-all` | `export default *` not used |

---

## What This Compiler Never Forgives

- `feature-module-spec.json` missing (FM001 hard-fails)
- `capabilities` empty (FM001)
- No `index.ts` barrel file (FM002 hard-fails)
- Barrel has no exports (FM002)
- Barrel uses `export *` — implicit public API (FM002)
- Capability in spec has no matching file (FM003)
- Direct import from `../other-feature/` (FM004)
- `_privateName` or `FooInternal` exported through barrel (FM005)
- No type definitions in the feature (FM007)

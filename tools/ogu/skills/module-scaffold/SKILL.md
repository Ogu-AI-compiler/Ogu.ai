---
name: module-scaffold
description: Compiler skill for the module-scaffold compiler. Activates when producing scaffold-artifact.json. Gates: MS001–MS007. No upstream dependency.
---

# module-scaffold — Compiler Skill

## What This Compiler Does

Compiles the module folder structure and boundary rules for a backend feature module. Enforces a single public entrypoint (`index.ts`), that all internal folders are declared in capabilities, that no code imports directly from another module's internal folder (bypassing its `index.ts`), and that no circular imports exist.

**Upstream dependency:** none
**Output artifact:** `scaffold-artifact.json`
**IR identifier:** `MODULE`

---

## Spec Shape

```json
{
  "name": "user",
  "capabilities": ["services", "repositories", "events"],
  "allowedImports": ["auth", "shared"]
}
```

Valid `capabilities` values: `services` | `repositories` | `workflows` | `clients` | `events` | `jobs` | `webhooks` | `cache` | `graphql`

`allowedImports` is optional — lists other module names this module is permitted to import from.

---

## Gates

### MS001 — spec-valid
Reads `module-spec.json`. Fails if missing or invalid JSON.

Required fields: `name` (non-empty string), `capabilities` (array).

Each capability must be one of the nine valid values. Arbitrary capability names are rejected.

BAD: `"capabilities": ["dal", "utils"]` — `dal` and `utils` are not valid capability names.
GOOD: `"capabilities": ["services", "repositories"]`

### MS002 — entrypoint-exists
Looks for `index.ts` at these locations (in order):
1. `src/modules/{name}/index.ts`
2. `src/{name}/index.ts`
3. `{name}/index.ts`
4. `index.ts`

The entrypoint must:
- Exist at one of the above paths
- Contain at least one export (`export const`, `export function`, `export class`, `export type`, `export interface`, `export {`, `export default`)
- Not use wildcard re-exports from internal folders: `export * from './services/...'` is blocked

BAD: `index.ts` exists but has no exports — just comments.
BAD: `export * from './services/user.service'` — wildcard re-export of an internal file.
GOOD: `export { UserService } from './services/user.service'` — named re-export is fine.

### MS003 — folders-declared
Scans the module directory (`src/modules/{name}/` etc.) for subdirectories matching the nine capability names.

Any capability folder that exists on disk but is NOT in `spec.capabilities[]` is a violation.

Skips (passes) if the module directory doesn't exist yet.

BAD: `repositories/` folder exists in the module but `spec.capabilities` only has `["services"]`.
GOOD: Every folder that exists is declared. Folders declared in capabilities don't need to exist.

### MS004 — no-cross-module-internals
Scans all `.ts` files (excluding `node_modules`, `dist`, `.ogu`, `.git`, `coverage`).

Blocked pattern: any import that traverses into another module's internal folder:
```
from '../../other-module/services/...'
from '../other-module/repositories/...'
from '../../src/modules/other-module/events/...'
```

The check specifically finds imports where the path contains `/moduleName/capabilityFolder/` — and the module name is not the current module.

BAD: `import { UserRepository } from '../../user/repositories/user.repository'`
GOOD: `import { UserRepository } from '../../user'` — goes through the public entrypoint.

### MS005 — no-circular
Builds a module-level import graph using DFS through all `.ts` files, resolving relative imports.

Reports any circular chain, e.g.: `a.ts → b.ts → c.ts → a.ts`.

Only relative imports are followed — `node_modules` imports are ignored.

BAD: `user.service.ts` imports from `user.repository.ts` which imports back from `user.service.ts`.
GOOD: Repositories never import from services. Event emitters never import from consumers.

### MS006 — no-todos
Recursively scans all `.ts`, `.mjs`, `.js` files. Blocked: `TODO`, `FIXME`, `HACK`, `XXX`.

### MS007 — contract-scaffold
Validates three contract rules (MOD-001 through MOD-003):

| Rule | Check |
|---|---|
| MOD-001 | `spec.name` is a non-empty string |
| MOD-002 | `spec.capabilities` is a non-empty array |
| MOD-003 | Module entrypoint (`index.ts`) exists at a standard location |

MOD-003 mirrors MS002 — the contract requires the entrypoint to physically exist.

---

## What This Compiler Never Forgives

- `module-spec.json` missing (MS001 hard-fails)
- Capability name not in the valid set: services, repositories, workflows, clients, events, jobs, webhooks, cache, graphql (MS001)
- `index.ts` missing at any expected location (MS002 and MS007 both fail)
- `index.ts` with no exports (MS002)
- `export *` wildcard re-exports from internal folders in `index.ts` (MS002)
- Internal folder exists that is not in `capabilities[]` (MS003)
- Import from another module's internal folder (bypassing that module's `index.ts`) (MS004)
- Circular import chain detected (MS005)

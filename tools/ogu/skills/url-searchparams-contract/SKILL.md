---
name: url-searchparams-contract
description: Compiler skill for the url-searchparams-contract compiler. Activates when producing searchparams-artifact.json. Gates: USP001–USP009. No upstream dependency.
---

# url-searchparams-contract — Compiler Skill

## What This Compiler Does

Compiles the URL search parameters contract for a route — a typed module that defines, parses, and serializes URL query parameters. Enforces: typed `parse()` and `serialize()` functions, `parse()` is total (never throws — returns safe fallback), canonical serialization (deterministic key ordering prevents rerender loops), and params equal to their default value are omitted from the URL.

**Upstream dependency:** none
**Output artifact:** `searchparams-artifact.json`
**IR identifier:** `SEARCHPARAMS:{route}`

---

## Spec Shape

```json
{
  "params": [
    { "name": "page",    "type": "number",  "default": 1 },
    { "name": "sort",    "type": "string",  "default": "name" },
    { "name": "filter",  "type": "string",  "default": "" },
    { "name": "search",  "type": "string" },
    { "name": "userId",  "type": "string" }
  ]
}
```

Each param needs `name` and `type`. `default` is optional — but if declared, params equal to it must be omitted from serialized URLs.

---

## Source File Shape

```ts
// users-searchparams.ts

export interface UsersParams {
  page: number;
  sort: string;
  filter: string;
  search?: string;
  userId?: string;
}

const DEFAULTS: Partial<UsersParams> = {
  page: 1,
  sort: 'name',
  filter: '',
};

export function parse(searchParams: URLSearchParams): UsersParams {
  try {
    return {
      page:   parseInt(searchParams.get('page') ?? '1', 10) || 1,
      sort:   searchParams.get('sort') ?? 'name',
      filter: searchParams.get('filter') ?? '',
      search: searchParams.get('search') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    };
  } catch {
    return { page: 1, sort: 'name', filter: '' };
  }
}

export function serialize(params: UsersParams): string {
  const sp = new URLSearchParams();
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    if (key in DEFAULTS && DEFAULTS[key as keyof UsersParams] === value) continue;
    sp.set(key, String(value));
  }
  return sp.toString();
}
```

---

## Gates

### USP001 — spec-valid
Reads `searchparams-spec.json`. Required: `params` (non-empty array). Each param needs `name` and `type`.

BAD: Missing `params` or param without `name`/`type`.
GOOD: `{ "params": [{ "name": "page", "type": "number" }] }`

### USP002 — no-any
No `: any` type annotations in source files.

BAD:
```ts
export function parse(searchParams: any): any { ... }
```
GOOD: Fully typed with interface or type alias.

### USP003 — ts-valid
Source TypeScript files must compile without errors.

### USP004 — total-parse
`parse()` must be exported and must not throw on malformed input. Must return a safe fallback, not throw exceptions.

Detection: `throw new` inside `parse()` without a wrapping `try/catch` fails this gate.

BAD:
```ts
export function parse(sp: URLSearchParams): Params {
  const page = parseInt(sp.get('page')!);
  if (isNaN(page)) throw new Error('Invalid page'); // unguarded throw!
  return { page };
}
```
GOOD:
```ts
export function parse(sp: URLSearchParams): Params {
  try {
    return { page: parseInt(sp.get('page') ?? '1', 10) || 1 };
  } catch {
    return { page: 1 }; // safe fallback
  }
}
```

### USP005 — canonical-serialize
`serialize()` must be exported and produce deterministic (canonical) output. Non-canonical URLs cause rerender loops when compared as strings.

Requirements:
1. No `Math.random()`, `Date.now()`, or `new Date()` in serialize
2. Key order must be stable: use `URLSearchParams`, explicit `.sort()`, or `Object.keys().sort()`

BAD:
```ts
export function serialize(params: Params): string {
  const sp = new URLSearchParams();
  // Object.entries order is not guaranteed to be stable!
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));
  return sp.toString();
}
```
GOOD:
```ts
const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
```

### USP006 — default-omission
Skipped if no params have `default` declared.

When defaults exist, `serialize()` must contain logic to omit params that equal their default value. Clean URLs are essential — params at default pollute browser history and make deep links meaningless.

BAD: Spec declares `"page": 1` as default but `serialize()` always includes `page` in the URL.
GOOD:
```ts
if (params.page === DEFAULTS.page) continue; // omit param at default value
```

### USP007 — tests-pass
All test files for the module must pass.

### USP008 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### USP009 — contract-searchparams
Four contract rules:

| Rule | Requirement |
|---|---|
| `parse-exported` | `parse()` must be exported |
| `serialize-exported` | `serialize()` must be exported |
| `typed-schema` | A TypeScript `interface *Params` or `type *Params =` must exist |
| `no-any` | No `: any` annotations |

BAD: `serialize()` not exported, or no typed params interface.
GOOD:
```ts
export interface UsersParams { page: number; sort: string; }
export function parse(sp: URLSearchParams): UsersParams { ... }
export function serialize(params: UsersParams): string { ... }
```

---

## What This Compiler Never Forgives

- `searchparams-spec.json` missing (USP001 hard-fails)
- `params` empty or missing (USP001)
- Param without `name` or `type` (USP001)
- `: any` type annotations (USP002, USP009)
- TypeScript compile errors (USP003)
- `parse()` not exported (USP004, USP009)
- `parse()` with unguarded `throw` that can propagate to callers (USP004)
- `serialize()` not exported (USP005, USP009)
- `serialize()` using `Date.now()` or `Math.random()` — non-canonical (USP005)
- `serialize()` with no stable key ordering (USP005)
- Params with declared defaults not omitted from serialized URL (USP006)
- No typed `interface`/`type` for params (USP009)

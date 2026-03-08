---
name: react-component
description: Compiler skill for the react-component compiler. Activates when producing component-artifact.json. Gates: RC001–RC011. Upstream: optionally schema-artifact.json.
---

# react-component — Compiler Skill

## What This Compiler Does

Compiles a single reusable React component. Enforces TypeScript correctness, props alignment with schema, accessibility (static a11y), design token usage (no hardcoded hex/px), a proper index.ts barrel export, and ≥80% test coverage. Props must be declared in a `NameProps` interface. Inline styles are blocked.

**Upstream dependency:** optionally `schema-artifact.json` (from ts-schema compiler)
**Output artifact:** `component-artifact.json`
**IR identifier:** `COMPONENT:{name}`

---

## Spec Shape

```json
{
  "name": "UserCard",
  "props": [
    { "name": "userId", "type": "string", "required": true },
    { "name": "displayName", "type": "string", "required": true },
    { "name": "avatarUrl", "type": "string" },
    { "name": "role", "type": "string" }
  ],
  "variants": ["default", "compact", "loading"]
}
```

`name` must be PascalCase (`^[A-Z][a-zA-Z0-9]+$`).

`props` — array of prop objects. Each prop needs at least a `name` field. A string-only prop name is also accepted.

`variants` — array of variant names. Can be empty but must be present.

---

## File Structure

| File | Purpose |
|---|---|
| `UserCard.tsx` | Component implementation |
| `UserCard.types.ts` | Props interface (`UserCardProps`) — or inline in tsx |
| `UserCard.test.tsx` | Vitest test file — required |
| `UserCard.module.css` | Optional CSS module — checked for hardcoded values |
| `index.ts` | Barrel export — named + default re-export required |

---

## Gates

### RC001 — spec-valid
Reads `component-spec.json`. Fails if missing or invalid JSON.

Required fields: `name` (PascalCase string), `props` (array), `variants` (array).

BAD: `"name": "userCard"` — lowercase start. `"name": "User-Card"` — hyphen. Missing `variants`.
GOOD:
```json
{
  "name": "UserCard",
  "props": [{ "name": "userId", "type": "string" }],
  "variants": ["default", "compact"]
}
```

### RC002 — typescript
Runs `npx tsc --noEmit --strict` in project root. Zero TypeScript errors required.

If `tsc` is not found, gate is skipped (no block). Any `error TS####` line in tsc output counts as a failure.

### RC003 — render
Runs `UserCard.test.tsx` via vitest. Hard-fails if test file not found.

All tests must pass. Render errors (component throws during mount) show up here.

The test file must exist at `{dir}/UserCard.test.tsx`. Vitest JSON reporter output is parsed; if unavailable, falls back to text output check for `FAIL`.

### RC004 — a11y
Static accessibility analysis on `UserCard.tsx`. Three rules:

| Rule | Violation |
|---|---|
| `interactive-roles` | `onClick` on a non-`<button>`/`<a>` element without `role="button"` in surrounding 5 lines |
| `img-alt` | `<img>` without `alt=` attribute |
| `focus-visible` | `outline: 'none'` without `:focus-visible` override |

BAD:
```tsx
<div onClick={handleClick}>Click me</div>  // needs role="button"
<img src={avatar} />                        // needs alt=""
```
GOOD:
```tsx
<button onClick={handleClick}>Click me</button>
<div onClick={handleClick} role="button" onKeyDown={handleKey}>Click me</div>
<img src={avatar} alt={`${name}'s avatar`} />
```

### RC005 — coverage
Runs vitest with coverage and checks statement coverage ≥80% for `UserCard.tsx`.

If coverage data is unavailable (no vitest coverage plugin configured), gate is skipped rather than failing.

### RC006 — design-tokens / no-todos
Two distinct checks share this code:

**Design tokens**: Scans `UserCard.tsx` and `UserCard.module.css` for hardcoded design values (after stripping comments):
- Hex colors: `#fff`, `#1a2b3c`, `#rgba` — blocked
- `rgb(...)` / `rgba(...)` — blocked
- Raw pixel values like `16px`, `24px` — blocked

Use CSS custom properties or design tokens instead:
```tsx
// BAD
style={{ color: '#1a2b3c', padding: '16px' }}

// GOOD
style={{ color: 'var(--color-text-primary)', padding: 'var(--spacing-4)' }}
```

**No-todos**: Scans `UserCard.tsx` and `UserCard.types.ts` for `TODO`, `FIXME`, `HACK`, `PLACEHOLDER`, `XXX`.

### RC007 — props
Cross-checks every prop listed in `spec.props` against the props type definition.

Looks for `NameProps` interface in `UserCard.types.ts` first, then `UserCard.tsx`.

Every prop `name` must appear as `propName?:` or `propName:` in the interface.

Interface must be named exactly `UserCardProps` (or `ComponentNameProps`).

BAD:
```tsx
// spec declares userId and displayName, but interface only has:
interface UserCardProps {
  userId: string;
  // displayName missing!
}
```
GOOD:
```tsx
interface UserCardProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
}
```

### RC008 — contract-shape
Validates `UserCard.tsx` structural contract:

| Rule | Check |
|---|---|
| `named-export` | `export function UserCard` or `export const UserCard` or `export { UserCard }` in tsx file |
| `typed-props` | `interface UserCardProps` or `type UserCardProps` must exist |
| `no-inline-styles` | `style={{ ... }}` in JSX is blocked — use CSS modules or tokens |
| `index-reexport` | `index.ts` must mention `UserCard` |

Warning (not fail): `UserCard.displayName` not set.

BAD:
```tsx
const UserCard = ({ name }) => (   // no typed props
  <div style={{ color: 'red' }}>   // inline style blocked
    {name}
  </div>
);
```
GOOD:
```tsx
interface UserCardProps { name: string; }
export function UserCard({ name }: UserCardProps) {
  return <div className={styles.root}>{name}</div>;
}
UserCard.displayName = 'UserCard'; // recommended
```

### RC009 — contract-a11y
Second A11y pass focusing on three rules:

| Rule | Check |
|---|---|
| `img-alt` | Every `<img>` must have `alt=` |
| `interactive-roles` | `<div>` or `<span>` with `onClick` must have `role="button"` in surrounding 3 lines |
| `keyboard-handler` | `onClick` on non-`<button>`/`<a>` must also have `onKeyDown`, `onKeyPress`, or `onKeyUp` |

### RC010 — export-valid
`index.ts` must have all three:

1. `from './${name}'` or `from "./${name}"` — re-export from component file
2. `export { UserCard` or `export type { UserCard` — named export
3. `export default UserCard` or `export { UserCard as default }` — default export

BAD:
```ts
// index.ts
export * from './UserCard'; // no default export
```
GOOD:
```ts
// index.ts
export { UserCard } from './UserCard';
export type { UserCardProps } from './UserCard';
export default UserCard;
```
Or:
```ts
export { UserCard, default } from './UserCard';
```

### RC011 — cross-schema
Skipped if no `schema-artifact.json` found in `{dir}/`, `{dir}/../`, or `{dir}/../schema/`.

When schema exists: every prop in `spec.props` that is NOT a meta/UI prop must exist as a field in the schema.

**Exempt meta props** (never checked against schema):
`className`, `style`, `children`, `ref`, `key`, `id`, `onClick`, `onChange`, `onSubmit`, `onBlur`, `onFocus`, `onKeyDown`, `onKeyUp`, `onMouseEnter`, `onMouseLeave`, `disabled`, `loading`, `isLoading`, `aria-*`, `role`, `tabIndex`, `data-testid`, `variant`, `size`, `color`, `align`, `as`, `href`, `target`

BAD: spec declares `userId` prop but `User` schema has no `userId` field.
GOOD: either add `userId` to schema-spec.json and recompile ts-schema, or remove it from component-spec if it's not a data prop.

---

## What This Compiler Never Forgives

- `component-spec.json` missing (RC001 hard-fails)
- `spec.name` not PascalCase (RC001)
- `spec.variants` missing (RC001)
- TypeScript errors from `tsc --noEmit --strict` (RC002)
- `UserCard.test.tsx` not found (RC003 hard-fails)
- `onClick` on `<div>`/`<span>` without `role="button"` (RC004, RC009)
- `<img>` without `alt=` (RC004, RC009)
- Hardcoded hex color, `rgb(...)`, or raw `px` value in component or CSS file (RC006)
- `TODO` / `FIXME` / `HACK` / `PLACEHOLDER` in source files (RC006)
- Prop in spec missing from `ComponentNameProps` interface (RC007)
- No named `export const/function ComponentName` in tsx file (RC008)
- `style={{ ... }}` inline style in JSX (RC008)
- `index.ts` missing named or default export (RC010)
- Data prop not present in schema when schema-artifact.json exists (RC011)

---
name: layout-component
description: Compiler skill for the layout-component compiler. Activates when producing layout-artifact.json. Gates: LC001–LC010. Upstream: optionally design-tokens artifact.
---

# layout-component — Compiler Skill

## What This Compiler Does

Compiles a React layout wrapper component. Enforces slot typing (all declared regions as `ReactNode`), semantic HTML elements, no inline styles, responsive breakpoints, a skip-to-main-content link, and no fixed pixel widths. Every layout must include a `main` slot.

**Upstream dependency:** optionally `tokens-artifact.json`
**Output artifact:** `layout-artifact.json`
**IR identifier:** `LAYOUT:{name}`

---

## Spec Shape

```json
{
  "name": "DashboardLayout",
  "slots": ["header", "sidebar", "main", "footer"],
  "responsive": true,
  "tokensArtifact": "../design-tokens/tokens-artifact.json"
}
```

`slots` — array of layout regions. Valid values: `header`, `sidebar`, `main`, `footer`, `aside`, `nav`, `toolbar`, `drawer`. **`main` is required** in every layout.

`responsive` — default `true`. Set to `false` to skip breakpoint check.

`tokensArtifact` — optional relative path to compiled design tokens for cross-validation.

---

## Gates

### LC001 — spec-valid
Reads `layout-spec.json`. Fails if missing or invalid JSON.

Required fields: `name`, `slots` (non-empty array including `main`).

Invalid slot names fail. `main` is mandatory — it is the primary content area.

BAD: `"slots": ["header", "footer"]` — missing `main`. `"slots": ["content"]` — `content` not in valid set.
GOOD:
```json
{
  "name": "AppLayout",
  "slots": ["header", "main", "footer"]
}
```

### LC004 — slot-types
Every slot in `spec.slots` must be:
1. Typed as `ReactNode` in the props interface: `slotName?: React.ReactNode` or `slotName?: ReactNode`
2. Rendered in JSX: `{slotName}` or similar

BAD:
```tsx
interface AppLayoutProps {
  header: React.ReactNode;
  // main missing
}
// main is also not rendered in JSX
```
GOOD:
```tsx
interface DashboardLayoutProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  main: React.ReactNode;   // required
  footer?: React.ReactNode;
}

export function DashboardLayout({ header, sidebar, main, footer }: DashboardLayoutProps) {
  return (
    <div>
      <header>{header}</header>
      <aside>{sidebar}</aside>
      <main>{main}</main>
      <footer>{footer}</footer>
    </div>
  );
}
```

### LC005 — responsive-breakpoints
Skipped if `spec.responsive: false`.

Layout must use responsive breakpoints. Accepted:
- Tailwind breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- CSS media queries: `@media`, `min-width`, `max-width`

If `spec.slots` includes `sidebar`, mobile visibility control must be present:
- `hidden md:flex`, `sm:hidden`, `md:block`, or equivalent

BAD:
```tsx
// No breakpoints — fixed layout on all screens
<div className="flex">
  <aside className="w-64">...</aside>
  <main className="flex-1">...</main>
</div>
```
GOOD:
```tsx
<div className="flex flex-col md:flex-row">
  <aside className="hidden md:flex md:w-64">...</aside>
  <main className="flex-1">...</main>
</div>
```

### LC006 — no-inline-styles
`style={{ ... }}` in layout `.tsx` files is blocked. Exception: lines with `// layout` comment.

Use Tailwind classes or CSS modules instead.

BAD:
```tsx
<div style={{ display: 'flex', gap: '16px' }}>
```
GOOD:
```tsx
<div className="flex gap-4">
```

### LC009 — cross-tokens
Skipped if `spec.tokensArtifact` is not set.

When set: the artifact file must exist. This confirms the layout is built on top of the compiled design tokens system.

### LC010 — contract-layout
Four contract rules:

| Rule | Requirement |
|---|---|
| `main-slot-required` | `{main}`, `<main>`, or `role="main"` present in JSX |
| `semantic-html` | Uses semantic elements: `<header>`, `<nav>`, `<main>`, `<footer>`, or `<aside>` |
| `skip-to-main` | Has a skip-to-main-content link: `skip.*main`, `#main`, or `#content` |
| `no-fixed-px-width` | No `width: NNpx` or `w-[NNpx]` — use `max-w-*`, `container`, or `%` |

BAD (no semantic HTML, no skip link, fixed width):
```tsx
<div style={{ width: '1200px' }}>  {/* fixed px, no semantic */}
  <div>{header}</div>
  <div>{main}</div>
  <div>{footer}</div>
</div>
```
GOOD:
```tsx
<>
  <a href="#main-content" className="sr-only focus:not-sr-only">
    Skip to main content
  </a>
  <div className="max-w-7xl mx-auto">
    <header>{header}</header>
    <main id="main-content">{main}</main>
    <footer>{footer}</footer>
  </div>
</>
```

### no-any / ts-valid / tests-pass / no-todos
Standard gates.

---

## What This Compiler Never Forgives

- `layout-spec.json` missing (LC001 hard-fails)
- `main` not in `spec.slots` (LC001 hard-fails)
- Unknown slot name outside the valid set (LC001)
- Slot declared in spec but not typed as `ReactNode` in props (LC004)
- Slot declared in spec but not rendered in JSX (LC004)
- No responsive breakpoints in a responsive layout (LC005)
- Layout has `sidebar` but no mobile visibility class (`hidden md:`) (LC005)
- `style={{ ... }}` inline styles in layout tsx files (LC006)
- `tokensArtifact` declared but file not found (LC009)
- No `<main>` or `role="main"` element (LC010)
- No semantic HTML elements at all (LC010)
- No skip-to-main-content link (LC010)
- Fixed pixel width (`width: 800px`, `w-[800px]`) (LC010)
- No test files (tests-pass hard-fails)

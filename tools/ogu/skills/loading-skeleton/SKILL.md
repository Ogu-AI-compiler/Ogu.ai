---
name: loading-skeleton
description: Compiler skill for the loading-skeleton compiler. Activates when producing skeleton-artifact.json. Gates: SK001–SK011. No upstream dependency.
---

# loading-skeleton — Compiler Skill

## What This Compiler Does

Compiles a loading skeleton component — purely structural, no real data. Enforces shape fidelity to the target component, `aria-busy="true"` on the container, `prefers-reduced-motion` handling for shimmer animations, muted fill colors, and fixed dimensions. Skeletons must never fetch data or access real data props.

**Upstream dependency:** none
**Output artifact:** `skeleton-artifact.json`
**IR identifier:** `SKELETON:{componentName}`

---

## Spec Shape

```json
{
  "componentName": "UserCardSkeleton",
  "shape": "card",
  "rows": 3,
  "animated": true
}
```

`shape` — `list` | `card` | `table` | `form` | `profile` | `article` | `grid` | `custom`

`rows` — number of repeated rows for list/table/grid shapes. Default 3.

`animated` — whether shimmer animation is used.

---

## Gates

### SK001 — spec-valid
Reads `skeleton-spec.json`. Required fields: `componentName`, `shape`. `shape` must be in the valid set.

### SK004 — aria-busy
The skeleton container must have `aria-busy="true"` to signal to screen readers that content is loading.

BAD: `<div className="animate-pulse">` — invisible to assistive technology.
GOOD:
```tsx
<div aria-busy="true" aria-label="Loading user card..." role="status">
  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
</div>
```

### SK005 — reduced-motion
Skipped if no shimmer/pulse animation is present.

When animation is used: must include `prefers-reduced-motion` handling.

Accepted: `@media (prefers-reduced-motion: reduce)` in CSS, Tailwind `motion-reduce:animate-none`, or `motion-safe:animate-pulse`.

BAD:
```tsx
<div className="animate-pulse"> {/* no motion preference check */}
```
GOOD:
```tsx
<div className="animate-pulse motion-reduce:animate-none">
```

### SK006 — shape-fidelity
Structural check per shape type. The skeleton must visually approximate the real component:

| Shape | Required Patterns |
|---|---|
| `list` | List structure + skeleton rows with `Array.from` or `.map` repeat |
| `card` | Rounded container + explicit h-N/w-N dimensions |
| `table` | Table/grid structure + column/row elements |
| `form` | Input/label structure + submit button placeholder |
| `profile` | `rounded-full` circle (avatar) + dimensions |
| `article` | Spacing (`space-y`, `mb-`, `mt-`) + dimensions |
| `grid` | `grid`/`grid-cols` + `gap-` |
| `custom` | Skipped |

For list/table/grid with `rows > 1`, a repeat pattern is required (`Array.from`, `.map`, repeat).

BAD:
```tsx
// spec.shape: 'list', spec.rows: 5 — but no repeat
<div className="h-4 bg-muted" /> {/* only one row */}
```
GOOD:
```tsx
{Array.from({ length: rows }, (_, i) => (
  <div key={i} className="flex gap-3 py-2">
    <div className="h-4 w-full bg-muted rounded animate-pulse motion-reduce:animate-none" />
  </div>
))}
```

### SK007 — no-real-data
Skeleton must not:
- Call `fetch(`, `axios.*`, `useQuery`, or `useSWR`
- Access data via `data?.property`, `user?.name`, `item?.title`, etc.

BAD:
```tsx
export function UserCardSkeleton() {
  const { data, isLoading } = useUser(id); // fetches data in skeleton
  if (!isLoading) return <UserCard user={data} />;
  return <div className="animate-pulse" />;
}
```
GOOD (pure structure, no data):
```tsx
export function UserCardSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
    </div>
  );
}
```

### SK011 — contract-skeleton
Four contract rules:

| Rule | Requirement |
|---|---|
| `aria-busy` | `aria-busy` attribute present |
| `no-text-content` | No readable text content — only structural placeholders |
| `fixed-dimensions` | At least one explicit `h-N`, `w-N`, `height`, or `width` class/style |
| `bg-muted` | Fill uses neutral/muted colors: `bg-muted`, `bg-gray`, `bg-slate`, `bg-neutral`, `bg-secondary` |

---

## What This Compiler Never Forgives

- `skeleton-spec.json` missing (SK001 hard-fails)
- `shape` not in valid set (SK001)
- No `aria-busy="true"` on skeleton container (SK004)
- Shimmer animation without `prefers-reduced-motion` handling (SK005)
- Shape structure doesn't match declared `shape` type (SK006)
- Missing repeat pattern for list/table/grid with rows > 1 (SK006)
- `useQuery`, `fetch(`, or real data prop access in skeleton (SK007)
- No test files (tests-pass hard-fails)

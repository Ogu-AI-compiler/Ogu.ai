---
name: navigation-config
description: Compiler skill for the navigation-config compiler. Activates when producing nav-artifact.json. Gates: NC001–NC010. No upstream dependency.
---

# navigation-config — Compiler Skill

## What This Compiler Does

Compiles the application navigation component. Enforces that nav items have typed interfaces, all nav paths are registered routes, a `<nav>` landmark is used, navigation uses `<Link>`/`<NavLink>` (not `<div onClick>`), active state is marked with `aria-current="page"`, and the component accepts items as props.

**Upstream dependency:** none
**Output artifact:** `nav-artifact.json`
**IR identifier:** `NAVIGATION`

---

## Spec Shape

```json
{
  "items": [
    { "label": "Dashboard", "path": "/dashboard", "icon": "LayoutDashboard" },
    { "label": "Users",     "path": "/users",     "icon": "Users",          "roles": ["admin"] },
    { "label": "Settings",  "path": "/settings",  "icon": "Settings" }
  ],
  "variant": "sidebar"
}
```

Each item must have `label` and `path`. `path` must start with `/`.

`variant` — `sidebar` | `topnav` | `breadcrumb` | `tabs` (informational, not enforced).

---

## Gates

### NC001 — spec-valid
Reads `nav-spec.json`. Fails if missing or invalid JSON.

`items` must be a non-empty array. Each item must have `label` and `path`.

BAD: item with no `path`. Empty `items[]`.
GOOD:
```json
{
  "items": [
    { "label": "Home", "path": "/" },
    { "label": "Profile", "path": "/profile" }
  ]
}
```

### NC004 — nav-routes-valid
All nav paths must be valid route paths (start with `/` or be `#` for anchors).

When a routing config file is found in the project, every nav path must appear in that file as a registered route. Unregistered paths are flagged.

BAD: nav declares `/admin` but `/admin` is not in the routing config.
GOOD: all nav paths exist as route definitions.

### NC005 — active-state
The navigation component must indicate the current active item both visually and semantically.

Requires `aria-current="page"` (or dynamic `aria-current={isActive ? "page" : undefined}`) on the active nav item. Screen readers announce this as the current page.

Accepted patterns: `aria-current`, `NavLink`, `useMatch()`, `useLocation()`, `pathname ===`, `location.pathname`

BAD:
```tsx
// CSS class only — invisible to screen readers
<a className={active ? 'nav-active' : ''}>Dashboard</a>
```
GOOD:
```tsx
<NavLink aria-current={isActive ? "page" : undefined} to="/dashboard">
  Dashboard
</NavLink>
```

### NC006 — keyboard-accessible
Three accessibility rules:

1. Must use `<nav>` element or `role="navigation"` — required landmark for screen readers
2. Must use `<a>`, `<Link>`, or `<NavLink>` — not `<div onClick>` for nav items
3. No `<div onClick>` without `onKeyDown` keyboard handler

BAD:
```tsx
<div>  {/* no nav landmark */}
  <div onClick={() => navigate('/home')}>Home</div>  {/* not a link */}
</div>
```
GOOD:
```tsx
<nav aria-label="Main navigation">
  <NavLink to="/home">Home</NavLink>
  <NavLink to="/about">About</NavLink>
</nav>
```

### NC010 — contract-nav
Five contract rules:

| Rule | Requirement |
|---|---|
| `nav-landmark` | `<nav>` or `role="navigation"` |
| `nav-items-typed` | `interface NavItem`, `type NavItem`, or `NavItem` type referenced |
| `exported-nav` | Component name containing `Nav`, `Navigation`, `Sidebar`, `Menu`, or `Breadcrumb` is exported |
| `aria-current` | Active item sets `aria-current` |
| `accepts-items-prop` | Navigation accepts `items` prop or `navItems` — not hardcoded |

BAD (hardcoded items):
```tsx
// Items hardcoded in component — can't reuse with different items
export function Sidebar() {
  return <nav><a href="/home">Home</a><a href="/about">About</a></nav>;
}
```
GOOD:
```tsx
interface NavItem { label: string; path: string; icon?: React.ComponentType; }

interface SidebarNavProps { items: NavItem[]; }

export function SidebarNav({ items }: SidebarNavProps) {
  return (
    <nav aria-label="Main navigation">
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          aria-current={isActive ? "page" : undefined}
        >
          {item.icon && <item.icon />}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

### cross-routing / no-any / ts-valid / tests-pass / no-todos
Standard gates — routing alignment, no `any`, TypeScript passes, tests pass, no TODOs.

---

## What This Compiler Never Forgives

- `nav-spec.json` missing (NC001 hard-fails)
- Nav item missing `label` or `path` (NC001)
- `path` not starting with `/` (NC004)
- Nav path not registered in routing config (NC004)
- No `aria-current` on active nav item (NC005)
- No `<nav>` landmark or `role="navigation"` (NC006)
- `<div onClick>` for nav item without `onKeyDown` (NC006)
- No `<a>`, `<Link>`, or `<NavLink>` element (NC006)
- `NavItem` type not defined (NC010)
- Navigation doesn't accept `items` as prop — hardcoded (NC010)
- No test files (tests-pass hard-fails)

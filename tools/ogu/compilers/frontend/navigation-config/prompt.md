# Navigation Config Compiler — Agent Prompt

You are implementing an app navigation component that passes all gates of the Navigation Config Compiler.

## Spec file: `nav-spec.json`
```json
{
  "items": [
    { "label": "Dashboard", "path": "/dashboard", "icon": "LayoutDashboard" },
    { "label": "Projects", "path": "/projects", "icon": "FolderOpen" },
    { "label": "Settings", "path": "/settings", "icon": "Settings" }
  ],
  "type": "sidebar"
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| NC001 | spec-valid | nav-spec.json with non-empty `items` array (label + path) |
| NC002 | ts-valid | No TypeScript compilation errors |
| NC003 | no-any | No explicit `any` |
| NC004 | nav-routes-valid | All nav paths start with / and are registered routes |
| NC005 | active-state | aria-current="page" on active nav item |
| NC006 | keyboard-accessible | `<nav>` element, `<NavLink>` or `<Link>` elements |
| NC007 | no-todos | No TODO/FIXME |
| NC008 | tests-pass | All tests pass |
| NC009 | cross-routing | routing-artifact.json must exist |
| NC010 | contract-nav | Typed NavItem, exported component, aria-current, nav landmark |

## Required pattern

```tsx
interface NavItem {
  label: string;
  path: string;
  icon?: React.ComponentType;
}

interface SidebarNavProps {
  items: NavItem[];
}

export function SidebarNav({ items }: SidebarNavProps) {
  const location = useLocation();
  return (
    <nav aria-label="Main navigation">
      {items.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
```

## Files to produce
- `SidebarNav.tsx` — navigation component
- `SidebarNav.test.tsx` — renders items, tests active state, keyboard navigation

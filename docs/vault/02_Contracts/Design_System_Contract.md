# Design System Contract

## Decision Rules

The design system choice is deterministic. Ogu does not "prefer" — it follows these rules in order.

### Platform detection

Scan the repo structure:

| Structure | Platform | Default |
|-----------|----------|---------|
| `apps/web/` only | Web only | shadcn/ui + Tailwind |
| `apps/web/` + `apps/mobile/` | Web + Mobile | Tamagui |
| `apps/mobile/` only | Mobile only | Tamagui |

If no apps exist yet, read IDEA.md and PRD.md for platform intent.

### Override conditions

| Condition | Override |
|-----------|---------|
| PRD specifies mobile app planned for future | Tamagui (start cross-platform early) |
| PRD specifies web-only MVP, mobile maybe later | shadcn/ui now, ADR when mobile is added |
| Project requires shared design tokens across 3+ clients | Tamagui |
| Project is a quick prototype / MVP | shadcn/ui |

Any override from the default requires an ADR.

## Forbidden

- MUI, Chakra, Ant Design, or similar runtime-heavy opinionated libraries as default
- Using a UI library's components directly in app code without wrapping in `packages/ui/`
- Hardcoded color, spacing, or font values in components — tokens only
- Mixing two design system libraries in the same project without ADR

## Monorepo Structure

```
packages/
  ui/               Wrapped components (Button, Input, Card, Modal, etc.)
  ui/tokens/        Design tokens: colors, spacing, typography, radius
  ui/primitives/    Base building blocks
  ui/components/    Feature-level composed components
```

Apps import from `packages/ui/` only. Never import shadcn or Tamagui directly in app code.

## Token Schema

Every project must define these token categories:

```
color.primary, color.secondary, color.background, color.surface, color.error, color.success
space.1, space.2, space.3, space.4, space.5, space.6
radius.sm, radius.md, radius.lg
font.body, font.heading, font.mono
fontSize.xs, fontSize.sm, fontSize.md, fontSize.lg, fontSize.xl
```

Components consume tokens, never raw values.

## Core Primitives

These must exist in `packages/ui/` before any feature component:

- Button (primary, secondary, ghost, destructive variants)
- Input (text, password, email, number)
- Card
- Modal / Dialog
- Toast / Notification
- Tabs
- Table
- Badge
- Avatar
- Dropdown / Select

Each primitive must accept `data-testid` prop for E2E testing.

## Implementation Lifecycle

1. **Tokens first** — define the token package before any component
2. **Primitives second** — build base components using only tokens
3. **Feature components third** — compose primitives into feature-specific UI
4. **App usage last** — apps import only from `packages/ui/`

Never skip steps. No feature component without primitives. No primitives without tokens.

## shadcn/ui Specific Rules

- Components are copied into `packages/ui/`, not used as npm dependency
- Tailwind config references token values from `packages/ui/tokens/`
- shadcn components are wrapped — app code never imports from `@/components/ui` directly
- Customization happens at the wrapper level in `packages/ui/`

## Tamagui Specific Rules

- Theme config lives in `packages/ui/tokens/`
- `createTamagui` config is shared across web and mobile
- Components use Tamagui's `styled()` with token references
- Platform-specific overrides use `.native.tsx` / `.web.tsx` when needed
- Animations use Tamagui's built-in animation driver

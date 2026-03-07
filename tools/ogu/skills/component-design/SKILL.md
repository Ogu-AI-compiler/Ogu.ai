---
name: component-design
description: Designs reusable, composable UI components with clear props contracts, accessibility support, and theming. Use when building new UI components, refactoring existing ones, or establishing component library patterns. Triggers: "design a component", "create UI component", "build a widget", "component library", "reusable component".
---

# Component Design

## When to Use
- Building a new UI component that will be used in multiple places
- Refactoring a monolithic component into composable parts
- Establishing patterns for a component library

## Workflow
1. Define the component's single responsibility before writing code
2. Design the props contract: required props, optional with defaults, event handlers
3. Build the base case first, then add variants and states
4. Implement all states: default, loading, error, empty, disabled
5. Add accessibility: keyboard navigation, ARIA roles, focus management

## Quality Bar
- Component renders with no required props (uses sensible defaults)
- All interactive states are keyboard accessible
- Props interface is stable — no breaking changes without major version bump
- Component is documented with usage examples

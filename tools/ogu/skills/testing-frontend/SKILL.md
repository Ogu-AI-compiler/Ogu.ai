---
name: testing-frontend
description: Writes and maintains unit, integration, and E2E tests for frontend code using React Testing Library, Vitest, or Playwright. Use when testing components, user flows, or UI interactions. Triggers: "test this component", "write frontend tests", "test the UI", "React testing", "add tests".
---

# Frontend Testing

## When to Use
- Writing tests for new UI components or features
- Adding tests to untested existing components
- Debugging a flaky or failing frontend test

## Workflow
1. Start with the user story: "A user does X, they should see Y"
2. Use queries by role/text (not CSS class or test-id) for integration tests
3. Test behavior, not implementation details (avoid testing state shape or method calls)
4. Mock API calls at the network boundary (MSW), not at the function level
5. For E2E: use stable selectors (`data-testid`) and cover the 3-5 critical user journeys

## Quality Bar
- Tests are independent and don't share mutable state
- No `act()` warnings in test output
- E2E tests pass on first run without retries
- Flaky tests are treated as bugs and fixed immediately

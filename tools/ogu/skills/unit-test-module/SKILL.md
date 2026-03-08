---
name: unit-test-module
description: Compiler skill for the unit-test-module compiler. Activates when producing unit-test-artifact.json. Gates: UT001–UT008. No upstream dependency.
---

# unit-test-module — Compiler Skill

## What This Compiler Does

Compiles the unit test suite for a frontend component or module. Enforces: user-centric queries (getByRole over getByTestId), no real network calls without mocking, no shared mutable state between tests, no weak assertions (toBeTruthy/toBeFalsy), and contract rules (describe blocks, no .only/.skip left in code, render cleanup).

**Upstream dependency:** none
**Output artifact:** `unit-test-artifact.json`
**IR identifier:** `UNIT_TEST:{component}`

---

## Spec Shape

```json
{
  "component": "Button",
  "coverage_target": 80,
  "test_scenarios": [
    "renders with default props",
    "renders all variants (primary, secondary, destructive)",
    "calls onClick when clicked",
    "is disabled when disabled prop is true",
    "shows loading state when loading prop is true"
  ]
}
```

Required fields:
- `component` — the component being tested
- `coverage_target` — number between 60 and 100
- `test_scenarios` — non-empty array of test case descriptions

---

## Test File Requirements

Test files must end in `.test.tsx`, `.test.ts`, `.spec.tsx`, or `.spec.ts`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button', { name: /click/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

---

## Gates

### UT001 — spec-valid
Reads `unit-test-spec.json`. Required: `component`, `coverage_target` (60–100), `test_scenarios` (non-empty array).

BAD: `coverage_target: 50` (below 60), or empty `test_scenarios`.
GOOD: `{ "component": "Button", "coverage_target": 80, "test_scenarios": [...] }`

### UT002 — user-centric-queries
Implementation-detail queries are blocked: `getByTestId`, `queryByTestId`, `getAllByTestId`, `findByTestId`, `getByClassName`, `querySelector`, `getElementsBy`.

Must use user-centric queries: `getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`, `getByDisplayValue`, `getByAltText`, `getByTitle`.

BAD:
```tsx
const btn = screen.getByTestId('submit-button');
```
GOOD:
```tsx
const btn = screen.getByRole('button', { name: /submit/i });
```

### UT003 — no-network-calls
Real network calls without mocking are blocked: `fetch(`, `axios.`, `http.get`, `http.post`, `XMLHttpRequest`, `supertest(`.

If network call patterns exist, mock patterns must also be present: `vi.fn()`, `jest.fn()`, `mockResolvedValue`, `msw`, `setupServer`.

BAD:
```tsx
it('loads data', async () => {
  const res = await fetch('/api/users'); // real network call!
```
GOOD:
```tsx
vi.fn().mockResolvedValue({ data: [] });
// or use msw
```

### UT004 — no-shared-state
Two shared state patterns are blocked:

1. `beforeAll` without `afterAll` — setup leaks between suites
2. Module-level `let` declarations without `beforeEach` reset — tests may share mutable state

BAD:
```tsx
let user: User; // module-level let
beforeAll(async () => { user = await createUser(); });
// no afterAll cleanup!
```
GOOD:
```tsx
let user: User;
beforeEach(async () => { user = await createUser(); });
afterEach(async () => { await deleteUser(user.id); });
```

### UT005 — no-weak-assertions
Blocked weak assertion patterns:
- `toBeTruthy()` — doesn't verify specific value
- `toBeFalsy()` — doesn't verify specific value
- `toBeDefined()` alone — doesn't verify actual content
- `expect(true).toBe(true)` — trivially passes
- `toBeGreaterThan(0)` on a constant

Tests with no `expect()` calls at all also fail.

BAD:
```tsx
expect(result).toBeTruthy();
expect(element).toBeDefined();
```
GOOD:
```tsx
expect(result).toEqual({ id: 1, name: 'Alice' });
expect(element).toHaveTextContent('Submit');
expect(onClick).toHaveBeenCalledWith({ id: 1 });
```

### UT006 — tests-pass
All tests in the module must pass.

### UT007 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked.

### UT008 — contract-unit-test
Five contract rules enforced:

| Rule | Requirement |
|---|---|
| `describe-block` | Tests must be wrapped in `describe()` |
| `has-assertions` | At least one `expect()` call |
| `no-only` | No `it.only`/`test.only`/`describe.only` |
| `no-skip` | No `it.skip`/`test.skip`/`describe.skip` |
| `render-cleanup` | React tests using `render()` must use `cleanup`/`unmount`/`afterEach` |

BAD:
```tsx
it.only('my test', ...); // blocks all other tests in CI
it.skip('not done yet', ...); // pending test committed
```
GOOD: All tests in `describe()`, no `.only`/`.skip`, cleanup after render.

---

## What This Compiler Never Forgives

- `unit-test-spec.json` missing (UT001 hard-fails)
- `coverage_target` below 60 or above 100 (UT001)
- `test_scenarios` empty (UT001)
- No test file found (UT002–UT008 all fail)
- `getByTestId` or `querySelector` used without `getByRole` (UT002)
- Real `fetch()`/`axios.` calls without mocking (UT003)
- `beforeAll` without `afterAll` (UT004)
- Module-level `let` without `beforeEach` reset (UT004)
- `toBeTruthy()`/`toBeFalsy()` assertions (UT005)
- Tests with no `expect()` calls (UT005)
- `it.only` or `describe.skip` in committed code (UT008)
- Tests not wrapped in `describe()` (UT008)
- React `render()` without cleanup (UT008)

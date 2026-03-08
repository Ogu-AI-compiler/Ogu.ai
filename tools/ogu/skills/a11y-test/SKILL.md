---
name: a11y-test
description: Compiler skill for the a11y-test compiler. Activates when producing a11y-artifact.json. Gates: A1001–A1008. No upstream dependency (cross-checks component-artifact.json if found).
---

# a11y-test — Compiler Skill

## What This Compiler Does

Compiles an accessibility test suite for a React component. Enforces: axe-core imported and `toHaveNoViolations()` asserted, keyboard navigation tested with real key events, focus management validated (required for modal/dialog/drawer/dropdown), ARIA attributes asserted via `getByRole`/`getByLabelText`, and the component rendered with `render()` in the test.

**Upstream dependency:** none (cross-checks `component-artifact.json` if found nearby)
**Output artifact:** `a11y-artifact.json`
**IR identifier:** `A11Y_TEST:{component}`

---

## Spec Shape

```json
{
  "component": "Modal",
  "wcagLevel": "AA",
  "focusManagement": true
}
```

Required fields:
- `component` — component name being tested
- `wcagLevel` — WCAG conformance target: `"A"`, `"AA"`, or `"AAA"`

Optional fields:
- `focusManagement` — set `true` for modal/dialog/drawer — triggers stricter focus gate

---

## Implementation Shape

```tsx
// Modal.a11y.test.tsx
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'vitest-axe';
import { Modal } from './Modal';

expect.extend(toHaveNoViolations);

describe('Modal — Accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <Modal isOpen title="Confirm action" onClose={() => {}}>
        <p>Are you sure?</p>
      </Modal>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders with correct ARIA role and label', () => {
    render(<Modal isOpen title="Confirm action" onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm action')).toBeInTheDocument();
  });

  it('traps focus inside modal', () => {
    render(<Modal isOpen title="Confirm action" onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    // First focusable element receives focus on open
    expect(document.activeElement).toBeTruthy();
    // Tab key cycles within dialog
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toContainElement(document.activeElement as Element);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<Modal isOpen title="Confirm action" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('buttons are keyboard accessible', () => {
    render(<Modal isOpen title="Confirm action" onClose={() => {}} />);
    const closeBtn = screen.getByRole('button', { name: /close/i });
    closeBtn.focus();
    expect(closeBtn).toHaveFocus();
    fireEvent.keyDown(closeBtn, { key: 'Enter' });
  });
});
```

---

## Gates

### A1001 — spec-valid
Reads `a11y-spec.json`. Required: `component` (string), `wcagLevel` (`"A"`, `"AA"`, or `"AAA"`).

BAD: Missing `wcagLevel` or invalid value like `"2.1"`.
GOOD: `{ "component": "Modal", "wcagLevel": "AA" }`

### A1002 — axe-present
A test file (`.test.tsx` / `.test.ts` / `.spec.tsx`) must exist. In that file:
1. axe must be imported from `vitest-axe`, `jest-axe`, or `@axe-core/*`
2. `toHaveNoViolations()` or `checkA11y()` must be called

BAD:
```tsx
// No axe import — manual ARIA checks only
import { render } from '@testing-library/react';
```
BAD:
```tsx
import { axe } from 'vitest-axe';
const results = await axe(container);
// never asserted — toHaveNoViolations() missing
```
GOOD:
```tsx
import { axe, toHaveNoViolations } from 'vitest-axe';
expect.extend(toHaveNoViolations);
const results = await axe(container);
expect(results).toHaveNoViolations();
```

### A1003 — keyboard-nav
Tests must fire keyboard events. Requires:
1. `fireEvent.keyDown`, `fireEvent.keyUp`, `fireEvent.keyPress`, `userEvent.keyboard`, `userEvent.tab`, or `.type()`
2. At least one of the standard navigation keys tested: `Tab`, `Enter`, `Escape`, `ArrowDown`, `ArrowUp`, `ArrowLeft`, `ArrowRight`, `Space`

BAD:
```tsx
// Only mouse events, no keyboard
fireEvent.click(button);
```
GOOD:
```tsx
fireEvent.keyDown(element, { key: 'Tab' });
fireEvent.keyDown(dialog, { key: 'Escape' });
await userEvent.keyboard('[Enter]');
```

### A1004 — focus-management
Requires focus assertions in tests: `toHaveFocus()`, `document.activeElement`, `getFocusedElement`, or `within()`.

For focus-critical components (modal/dialog/drawer/dropdown/menu/popover/tooltip/sheet OR `spec.focusManagement: true`), this gate is **mandatory** — tests must check that focus is set correctly on open and contained within the component.

BAD (for a Modal component):
```tsx
// No focus assertion — modal opens but focus not verified
render(<Modal isOpen />);
```
GOOD:
```tsx
render(<Modal isOpen title="Test" />);
expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));
// Or for focus trap:
fireEvent.keyDown(dialog, { key: 'Tab' });
expect(dialog).toContainElement(document.activeElement as Element);
```

### A1005 — no-todos
`TODO`, `FIXME`, `HACK`, `XXX` blocked in all `.ts`/`.tsx` files.

### A1006 — tests-pass
All tests pass via vitest or jest.

### A1007 — cross-component
Skipped if `component-artifact.json` not found in the directory, parent directory, or sibling directories. When found, the artifact file must exist (does not require pass/fail status from that compiler).

### A1008 — contract-a11y
Five contract rules — all must pass:

| Rule | Requirement |
|---|---|
| `axe-import` | `from 'vitest-axe'`, `'jest-axe'`, or `'@axe-core'` |
| `no-violations-assertion` | `toHaveNoViolations()` called |
| `render-in-test` | `render(<` — component rendered in test |
| `keyboard-test` | `fireEvent.keyDown`, `userEvent.keyboard`, or `userEvent.tab` |
| `aria-assertions` | `getByRole`, `getByLabelText`, `aria-label`, or `toHaveAttribute('aria-*')` |

BAD: No ARIA assertions, testing only by class name or test-id.
GOOD:
```tsx
expect(screen.getByRole('dialog')).toBeInTheDocument();
expect(screen.getByLabelText('Close')).toHaveFocus();
expect(button).toHaveAttribute('aria-expanded', 'false');
```

---

## What This Compiler Never Forgives

- `a11y-spec.json` missing (A1001 hard-fails)
- `wcagLevel` missing or invalid — must be `"A"`, `"AA"`, or `"AAA"` (A1001)
- No test file found (A1002, A1003, A1004 hard-fail)
- axe-core not imported (A1002)
- `toHaveNoViolations()` not called (A1002, A1008)
- No keyboard event (`fireEvent.keyDown`/`userEvent.keyboard`) (A1003, A1008)
- No navigation key (`Tab`/`Enter`/`Escape`/Arrow) tested (A1003)
- No focus assertion for modal/dialog/drawer (A1004)
- No `render(<` in tests (A1008)
- No ARIA assertions (`getByRole`/`getByLabelText`/`aria-*`) (A1008)

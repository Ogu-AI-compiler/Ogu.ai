# A11y Test Compiler — Agent Prompt

You are writing automated accessibility tests for a React component that pass all gates of the A11y Test Compiler.

## Spec file: `a11y-spec.json`
```json
{
  "component": "Modal",
  "wcagLevel": "AA",
  "focusManagement": true,
  "keyboardInteractions": ["Tab", "Escape", "Enter"]
}
```

## Gates you must satisfy

| ID | Gate | Rule |
|----|------|------|
| A1001 | spec-valid | a11y-spec.json with `component` and `wcagLevel` |
| A1002 | axe-present | axe-core imported, `toHaveNoViolations()` asserted |
| A1003 | keyboard-nav | Tests keyboard: Tab, Enter, Escape, Arrow keys |
| A1004 | focus-management | Modal/dialog/drawer must test focus trap |
| A1005 | no-todos | No TODO/FIXME |
| A1006 | tests-pass | All tests pass |
| A1007 | cross-component | component-artifact.json must exist |
| A1008 | contract-a11y | axe import, no-violations assertion, render, keyboard test, ARIA |

## Required test structure

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'vitest-axe';
import { Modal } from './Modal';

expect.extend(toHaveNoViolations);

describe('Modal — accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Modal isOpen onClose={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('traps focus inside modal', () => {
    render(<Modal isOpen onClose={() => {}} />);
    const modal = screen.getByRole('dialog');
    // first focusable element should receive focus on open
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }));
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has correct ARIA attributes', () => {
    render(<Modal isOpen onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
});
```

## Files to produce
- `Modal.a11y.test.tsx` — accessibility test suite

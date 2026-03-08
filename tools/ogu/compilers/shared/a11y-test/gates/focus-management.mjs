import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx'));
  if (!testFiles.length) return { pass: false, code: 'A1004', message: 'No test file found' };

  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check if this component likely needs focus management (modal/drawer/dialog/dropdown)
  const specPath = join(dir, 'a11y-spec.json');
  let isFocusCritical = false;
  try {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    const focusCritical = ['modal', 'dialog', 'drawer', 'dropdown', 'menu', 'popover', 'tooltip', 'sheet'];
    isFocusCritical = focusCritical.some(kw => spec.component?.toLowerCase().includes(kw) || (spec.focusManagement === true));
  } catch { /* spec not parseable, check anyway */ }

  // Look for focus-related assertions
  const hasFocusTest =
    /toHaveFocus\s*\(\s*\)|focus\s*\(\s*\)|document\.activeElement|getFocusedElement|within\s*\(/.test(content);

  // Check for focus trap pattern
  const hasFocusTrap = /focus.?trap|FocusTrap|aria-modal|inert|focusable/.test(content);

  if (isFocusCritical && !hasFocusTest) {
    return {
      pass: false, code: 'A1004',
      message: `Focus management test required for modal/drawer/dialog components`,
      detail: 'Add: expect(document.activeElement).toBe(firstFocusableElement)\nTest focus trap: Tab should cycle within the dialog'
    };
  }

  if (!hasFocusTest && !hasFocusTrap) {
    return {
      pass: false, code: 'A1004',
      message: 'No focus management test found',
      detail: 'Add focus assertions: expect(button).toHaveFocus() or check document.activeElement'
    };
  }

  return { pass: true, code: 'A1004', message: 'Focus management tests present' };
}

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Keys that interactive elements must support
const REQUIRED_KEYS = ['Tab', 'Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Space', ' '];

export async function run({ dir }) {
  const testFiles = readdirSync(dir).filter(f => f.endsWith('.test.tsx') || f.endsWith('.test.ts') || f.endsWith('.spec.tsx'));
  if (!testFiles.length) return { pass: false, code: 'A1003', message: 'No test file found' };

  const content = testFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Must fire keyboard events in tests
  const hasKeyboardEvent =
    /fireEvent\.keyDown|fireEvent\.keyUp|fireEvent\.keyPress|userEvent\.keyboard|userEvent\.tab|\.type\s*\(/.test(content);

  if (!hasKeyboardEvent) {
    return {
      pass: false, code: 'A1003',
      message: 'No keyboard navigation test — use fireEvent.keyDown() or userEvent.keyboard()',
      detail: 'Test Tab, Enter, Escape, and Arrow key navigation\nExample: fireEvent.keyDown(element, { key: "Tab" })'
    };
  }

  // Check at least one of the required navigation keys is tested
  const testedKeys = REQUIRED_KEYS.filter(key => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`key:\\s*['"]${escapedKey}['"]|keyboard\\(['"].*${escapedKey}`).test(content);
  });

  if (!testedKeys.length) {
    return {
      pass: false, code: 'A1003',
      message: 'No keyboard navigation keys tested (Tab, Enter, Escape, Arrow keys)',
      detail: 'Add tests for: ' + REQUIRED_KEYS.slice(0, 5).join(', ')
    };
  }

  return { pass: true, code: 'A1003', message: `Keyboard navigation tested: ${testedKeys.slice(0, 4).join(', ')}` };
}

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'layout-spec.json'), 'utf8'));
  const files = readdirSync(dir).filter(f => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.endsWith('.test.tsx'));

  if (!files.length) return { pass: false, code: 'LC004', message: 'No layout component file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const violations = [];

  for (const slot of spec.slots) {
    // Each slot must be typed as ReactNode
    const hasType = new RegExp(`${slot}\\s*[?:]\\s*React\\.ReactNode|${slot}\\s*[?:]\\s*ReactNode`).test(content);
    if (!hasType) {
      violations.push(`Slot '${slot}' missing ReactNode type annotation`);
    }

    // Each slot must be rendered in JSX
    const isRendered = new RegExp(`\\{\\s*${slot}\\s*\\}|\\{.*${slot}.*\\}`).test(content);
    if (!isRendered) {
      violations.push(`Slot '${slot}' is typed but never rendered in JSX`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'LC004',
      message: `Slot type/render violations (${violations.length})`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'LC004', message: `All ${spec.slots.length} slots typed as ReactNode and rendered` };
}

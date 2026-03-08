import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// Every track() call must send these base properties
const REQUIRED_BASE = ['event_name', 'timestamp', 'session_id'];

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
  if (!files.length) return { pass: false, code: 'AE006', message: 'No analytics source file found' };

  const content = files.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  // Check that the base event type/interface declares required properties
  const missing = REQUIRED_BASE.filter(prop => {
    const propRe = new RegExp(`\\b${prop}\\s*[?:]`, 'i');
    return !propRe.test(content);
  });

  if (missing.length) {
    return {
      pass: false, code: 'AE006',
      message: `Required base properties not declared: ${missing.join(', ')}`,
      detail: `Every analytics event type must include: ${REQUIRED_BASE.join(', ')}`
    };
  }

  return { pass: true, code: 'AE006', message: `Required base properties present: ${REQUIRED_BASE.join(', ')}` };
}

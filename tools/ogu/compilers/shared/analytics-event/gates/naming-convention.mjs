import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Event names must be SCREAMING_SNAKE_CASE: BUTTON_CLICKED, PAGE_VIEWED
const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

export async function run({ dir }) {
  const specPath = join(dir, 'analytics-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'AE004', message: 'analytics-spec.json not found' };

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const violations = (spec.events || []).filter(e => e.name && !SCREAMING_SNAKE.test(e.name));

  if (violations.length) {
    return {
      pass: false, code: 'AE004',
      message: `${violations.length} event name(s) not SCREAMING_SNAKE_CASE`,
      detail: violations.map(e => `  "${e.name}" → should be "${e.name.toUpperCase().replace(/\s+/g, '_')}"`).join('\n')
    };
  }

  return { pass: true, code: 'AE004', message: `All ${spec.events.length} event names are SCREAMING_SNAKE_CASE` };
}
